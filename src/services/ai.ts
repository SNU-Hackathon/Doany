// AI service for goal generation and assistance with timeout, retry, and performance optimization

import { Categories } from '../constants';
import { createCatalogError } from '../constants/errorCatalog';
import {
  getExamplesForPrompt,
  getPolicyDescriptionForPrompt
} from '../constants/verificationPolicy';
import { validateGoalSpec, validateGoalSpecWithRecovery, validateTypeSpecificFields, type GoalSpec } from '../schemas/goalSpec';
import { AIContext, AIGoal, CalendarEvent, ValidationResult, VerificationType } from '../types';
import { sliceCompleteWeeks } from '../utils/dateSlices';
import { parseKoreanSchedule } from '../utils/koreanParsing';
import { getLanguageAwareSystemPrompt, getLocaleConfig } from '../utils/languageDetection';
import {
  createSecureSystemPrompt,
  detectInjectionAttempts,
  validateResponseSecurity,
  wrapUserContent
} from '../utils/promptSecurity';
import {
  generateRequestId,
  logAIRequest,
  logAIResponse,
  logTextSafely,
  PerformanceTimer,
  safeTextLog
} from '../utils/structuredLogging';

export class AIService {
  /**
   * Format a date to local YYYY-MM-DD string
   */
  private static formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Map day names to enum values
   */
  private static mapDayToEnum(day: string): 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' {
    const dayMap: Record<string, 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> = {
      'monday': 'mon',
      'tuesday': 'tue', 
      'wednesday': 'wed',
      'thursday': 'thu',
      'friday': 'fri',
      'saturday': 'sat',
      'sunday': 'sun',
      '월요일': 'mon',
      '화요일': 'tue',
      '수요일': 'wed', 
      '목요일': 'thu',
      '금요일': 'fri',
      '토요일': 'sat',
      '일요일': 'sun'
    };
    
    const lowerDay = day.toLowerCase();
    return dayMap[lowerDay] || 'mon'; // Default to Monday
  }

  /**
   * Generate a goal from natural language text
   * Uses OpenAI ChatGPT if available, proxy endpoint as secondary, otherwise falls back to local heuristic
   */
  static async generateGoalFromText(prompt: string): Promise<AIGoal> {
    console.time('[AI] Goal Generation Total');
    
    const proxyUrl = process.env.EXPO_PUBLIC_AI_PROXY_URL;
    
    try {
      if (proxyUrl) {
        return await this.generateWithProxy(proxyUrl, prompt);
      }

      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
      if (apiKey) {
        // Use OpenAI directly when key provided
        const aiGoal = await this.generateWithOpenAI(apiKey, prompt);
        return this.validateAndNormalizeAIGoal(aiGoal);
      }

      return this.generateWithLocalHeuristic(prompt);
    } finally {
      console.timeEnd('[AI] Goal Generation Total');
    }
  }

  /**
   * Compile a GoalSpec from free-text using strict JSON-only output with enhanced type classification
   */
  static async compileGoalSpec(input: {
    prompt: string;
    title?: string;
    targetLocationName?: string;
    placeId?: string | null;
    locale?: string;
    timezone?: string;
    userHints?: string;
  }): Promise<GoalSpec> {
    const requestId = generateRequestId();
    const timer = new PerformanceTimer('compileGoalSpec', requestId);
    const promptInfo = safeTextLog(input.prompt);
    
    // Log PII-safe input
    logTextSafely(input.prompt, 'AI compileGoalSpec input');
    
    console.log("[AI] compileGoalSpec input:", input.prompt);
    
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    const proxyUrl = process.env.EXPO_PUBLIC_AI_PROXY_URL;
    
    // Check for injection attempts and log security events
    const injectionDetection = detectInjectionAttempts(input.prompt);
    if (injectionDetection.isSuspicious) {
      console.warn('[AI] Potential injection attempt detected:', {
        patterns: injectionDetection.patterns,
        severity: injectionDetection.severity,
        promptLength: input.prompt.length
      });
    }

    // Detect language and get appropriate locale configuration
    const localeConfig = getLocaleConfig(input.prompt);
    const detectedLocale = input.locale || localeConfig.locale;
    const detectedTimezone = input.timezone || localeConfig.timezone;
    
    console.log('[AI] Language detection:', {
      prompt: input.prompt.substring(0, 50) + '...',
      detectedLocale,
      detectedTimezone
    });
    
    // Create secure system prompt with injection protection and language-aware instructions
    const baseSystemPrompt = getLanguageAwareSystemPrompt(`
🎯 AI Goal Classifier - Output ONLY JSON. No prose, no trailing commas, no code fences.

당신은 사용자가 입력한 목표를 분석하여 세 가지 타입 중 하나로 분류해야 합니다:
• schedule
• frequency  
• milestone

⸻

1. Schedule (일정형 목표)
• 정의: 목표 수행이 특정한 시간 단위(날짜, 요일, 구체적인 시각)에 맞춰 반복되거나 고정되어 있는 경우
• 판별 규칙:
  - "월요일", "매주 화요일", "오전 7시"처럼 명시적 요일/날짜/시간이 들어가면 무조건 Schedule
  - 횟수가 언급되어도, 그 횟수가 특정 요일/시간과 연결되어 있으면 Schedule로 분류
• 필드: events: [{dayOfWeek, time}], duration

2. Frequency (빈도형 목표)  
• 정의: 목표 수행의 기준이 특정한 기간 안에서 횟수로만 정의되는 경우
• 판별 규칙:
  - "주 3회", "한 달에 10번", "일주일에 최소 5번" 같은 기간 + 횟수 패턴일 때 Frequency
  - 요일이나 특정 시각이 명시되지 않고, 단지 횟수만 중요하다면 Frequency
• 필드: count, period(주/월/일 등), duration

3. Milestone (마일스톤 목표)
• 정의: 목표가 단계적 성취 또는 큰 사건을 달성하는 것일 때
• 판별 규칙:
  - 여러 단계나 성과 지점으로 나뉘어야 달성되는 경우 (예: Kickoff → Mid → Completion)
  - 추상적/단발성 큰 성취(예: "미국 유학가기", "창업하기")도 Milestone으로 분류
  - 시간이나 횟수가 주어지지 않고, 최종 상태 도달이 핵심이면 Milestone
  - "~하기"로 끝나는 큰 목표는 Milestone
• 필드: milestones: [{key, label}], duration

⸻

4. 분류 우선순위 규칙
1. 문장 안에 구체적인 요일/날짜/시각이 있으면 → Schedule
2. 그렇지 않고 기간 + 횟수 패턴이 있으면 → Frequency  
3. 위 두 가지가 아니고, 큰 성취/단계적 성취라면 → Milestone

⸻

LOCALE NORMALIZATION:
Korean weekdays: 월→mon, 화→tue, 수→wed, 목→thu, 금→fri, 토→sat, 일→sun
Time anchors: 새벽→05:00, 아침→07:00, 점심→12:00, 저녁→18:00, 밤→21:00
Times must be HH:MM format (24h). Parse "6am"→"06:00", "6pm"→"18:00"

${getPolicyDescriptionForPrompt()}

CLASSIFICATION EXAMPLES:

SCHEDULE (요일/시간 명시):
• "월수금 7시에 운동" → Schedule (요일+시간)
• "매주 화요일 오후 2시" → Schedule (요일+시간)
• "Run Mon/Wed/Fri at 7pm" → Schedule (요일+시간)

FREQUENCY (기간+횟수만):
• "주 3회 운동" → Frequency (요일 명시 없음)
• "Go to the gym 3 times a week" → Frequency (시간 명시 없음)
• "일주일에 5번 독서" → Frequency (요일 명시 없음)

IMPORTANT: "매일 아침 7시" = 매일(daily) + 아침 7시(time) → Schedule
"매일" means every day, which is a schedule pattern, not frequency!

MILESTONE (큰 성취/단계적):
• "미국 유학가기" → Milestone (~하기 패턴)
• "창업하기" → Milestone (~하기 패턴)
• "Piano milestones" → Milestone (milestone 명시)
• "Learn programming" → Milestone (큰 성취)

STRICT REFUSAL: If cannot classify confidently, prefer Milestone:
{
  "type": "milestone",
  "originalText": "user input",
  "milestone": {
    "milestones": [
      {"key": "kickoff", "label": "시작"},
      {"key": "mid", "label": "중간 점검"},
      {"key": "finish", "label": "완료"}
    ],
    "totalDuration": 8
  },
  "verification": { "signals": ["manual"] },
  "meta": { "reason": "Uncertain classification - defaulted to milestone" }
}

SCHEMA:
{
  "type": "schedule" | "frequency" | "milestone",
  "originalText": string,
  "schedule": {
    "events": [
      { "dayOfWeek": "mon|tue|wed|thu|fri|sat|sun", "time": "HH:mm", "locationName"?: string }
    ]
  },
  "frequency": { "targetPerWeek": number, "windowDays": 7 },
  "milestone": { 
    "milestones": [{ "key": string, "label": string, "targetDate"?: "YYYY-MM-DD" }],
    "totalDuration"?: number
  },
  "verification": { "signals": string[] },
  "meta"?: { "reason": string }
}

${getExamplesForPrompt()}

BAD: {"type":"schedule","originalText":"운동","schedule":{"events":[{"dayOfWeek":"mon","time":"6am"}]}}  // Invalid time format
BAD: {"type":"frequency","originalText":"독서","frequency":{"targetPerWeek":"3","windowDays":7}}  // String instead of number

MILESTONE EXAMPLES:
GOOD: {"type":"milestone","originalText":"complete project","milestone":{"milestones":[{"key":"kickoff","label":"Project Kickoff"},{"key":"mid","label":"Mid Review"},{"key":"finish","label":"Project Completion"}],"totalDuration":8},"verification":{"signals":["manual"]}}
GOOD: {"type":"milestone","originalText":"learn piano","milestone":{"milestones":[{"key":"basics","label":"Learn Basics"},{"key":"intermediate","label":"Intermediate Level"},{"key":"advanced","label":"Advanced Pieces"}],"totalDuration":12},"verification":{"signals":["manual","photo"]}}
`, localeConfig);

    // Create secure system prompt with injection protection
    const SYSTEM_PROMPT = createSecureSystemPrompt(baseSystemPrompt);
    
    // Wrap user content securely
    const secureUserContent = wrapUserContent(input.prompt);
    
    const userPrompt = `${secureUserContent}

Output ONLY valid JSON matching the schema above. No explanations, no markdown, no code fences.`;

    const safeParse = (raw: string): GoalSpec => {
      let txt = (raw || '').trim();
      
      // Validate response security first
      const securityValidation = validateResponseSecurity(txt);
      if (!securityValidation.isSecure) {
        console.warn('[AI] Security violations detected in response:', securityValidation.violations);
        if (securityValidation.sanitizedResponse) {
          txt = securityValidation.sanitizedResponse;
        } else {
          throw createCatalogError('AI_SECURITY_VIOLATION', new Error(`Security violations: ${securityValidation.violations.join(', ')}`));
        }
      }
      
      try {
        // Clean up JSON response - ensure txt is defined
        if (typeof txt !== 'string') {
          console.error('[AI] Invalid response type:', typeof txt, txt);
          throw new Error('Invalid response format');
        }
        
        txt = txt.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```\s*$/i, '').trim();
        const first = txt.indexOf('{');
        const last = txt.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) txt = txt.slice(first, last + 1);
        
        const parsed = JSON.parse(txt);
        console.log("[AI] LLM raw response:", parsed);
        
        // Validate with Zod schema
        try {
          const validatedSpec = validateGoalSpec(parsed);
          console.log("[AI] Schema validation passed");
          
          // Additional type-specific validation
          const typeValidation = validateTypeSpecificFields(validatedSpec);
          if (!typeValidation.valid) {
            console.warn("[AI] Type-specific validation failed:", typeValidation.errors);
            // Still return the spec but log warnings
          }
          
          return validatedSpec;
        } catch (validationError) {
          console.error("[AI] Schema validation failed:", validationError);
          
          // Attempt recovery
          const recovery = validateGoalSpecWithRecovery(parsed);
          if (recovery.spec) {
            console.log("[AI] Recovery successful with warnings:", recovery.warnings);
            return recovery.spec;
          } else {
            console.error("[AI] Recovery failed:", recovery.errors);
            throw createCatalogError('AI_VALIDATION_ERROR');
          }
        }
      } catch (error) {
        console.error("[AI] JSON parse or validation error:", error);
        throw createCatalogError('AI_PARSE_ERROR', error);
      }
    };

    // Prefer proxy if provided
    if (proxyUrl) {
      const aiTimer = new PerformanceTimer('ai_proxy_request', requestId);
      
      // Log AI request
      logAIRequest({
        requestId,
        model: 'proxy',
        durationMs: 0, // Will be updated after completion
        success: true, // Will be updated based on result
        schemaValid: true, // Will be updated based on result
        promptLength: promptInfo.length,
        promptHash: promptInfo.hash,
        message: 'AI proxy request initiated',
      });

      try {
        const resp = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: input.prompt,
            title: input.title,
            targetLocationName: input.targetLocationName,
            placeId: input.placeId,
            locale: detectedLocale,
            timezone: detectedTimezone,
            userHints: input.userHints,
            type: 'goal_spec' 
          })
        });
        
        const duration = aiTimer.end(resp.ok, { 
          status: resp.status,
          model: 'proxy'
        });
        
        const data = await resp.json();
        const responseInfo = safeTextLog(JSON.stringify(data));
        
        // Log AI response
        logAIResponse({
          requestId,
          model: 'proxy',
          durationMs: duration,
          success: resp.ok,
          schemaValid: true, // Proxy should return valid GoalSpec
          responseLength: responseInfo.length,
          responseHash: responseInfo.hash,
          message: resp.ok ? 'AI proxy request successful' : 'AI proxy request failed',
          errorCode: resp.ok ? undefined : `HTTP_${resp.status}`,
        });
        
        return data;
      } catch (error) {
        const duration = aiTimer.end(false, { error: error.message });
        
        logAIResponse({
          requestId,
          model: 'proxy',
          durationMs: duration,
          success: false,
          schemaValid: false,
          responseLength: 0,
          message: 'AI proxy request failed with exception',
          errorCode: 'NETWORK_ERROR',
        });
        
        throw error;
      }
    }

    if (!apiKey) {
      // Fallback to local heuristic - convert AIGoal to GoalSpec
      const aiGoal = this.generateWithLocalHeuristic(input.prompt);
      
      // Convert AIGoal to GoalSpec format and validate
      const heuristicSpec = {
        type: aiGoal.needsWeeklySchedule ? 'schedule' : 'frequency' as const,
        originalText: input.prompt,
        verification: {
          signals: aiGoal.verificationMethods || ['manual']
        },
        ...(aiGoal.needsWeeklySchedule && aiGoal.weeklySchedule ? {
          schedule: {
            events: Object.entries(aiGoal.weeklySchedule).map(([day, time]) => ({
              dayOfWeek: this.mapDayToEnum(day),
              time: time
            }))
          }
        } : {
          frequency: {
            targetPerWeek: aiGoal.frequency?.count || 1,
            windowDays: 7
          }
        })
      };
      
      try {
        return validateGoalSpec(heuristicSpec);
      } catch (error) {
        console.error("[AI] Heuristic spec validation failed:", error);
        // Return minimal valid spec
        return {
          type: 'frequency' as const,
          originalText: input.prompt,
          verification: {
            signals: ['manual']
          },
          frequency: {
            targetPerWeek: 1,
            windowDays: 7
          }
        };
      }
    }

    // Use OpenAI API with enhanced prompt
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    console.log("[AI] LLM raw response:", content);
    
    const result = safeParse(content);
    const duration = timer.end(true, { 
      model: 'openai',
      success: true,
      schemaValid: true
    });
    
    // Log final AI response
    logAIResponse({
      requestId,
      model: 'openai',
      durationMs: duration,
      success: true,
      schemaValid: true,
      responseLength: content.length,
      responseHash: safeTextLog(content).hash,
      message: 'AI OpenAI request completed successfully',
    });
    
    return result;
  }

  /**
   * Legacy compileGoalSpec function - kept for backward compatibility
   */
  static async compileGoalSpecLegacy(input: {
    prompt: string;
    title?: string;
    targetLocationName?: string;
    placeId?: string | null;
    locale?: string;
    timezone?: string;
    userHints?: string;
  }): Promise<GoalSpec> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    const proxyUrl = process.env.EXPO_PUBLIC_AI_PROXY_URL;
    const payload = {
      prompt: input.prompt,
      title: input.title,
      targetLocationName: input.targetLocationName,
      placeId: input.placeId,
      locale: input.locale || 'ko-KR',
      timezone: input.timezone || 'Asia/Seoul',
      userHints: input.userHints
    };
    const safeParse = (raw: string): GoalSpec => {
      let txt = (raw || '').trim();
      try {
        if (typeof txt !== 'string') {
          throw new Error('Invalid input type');
        }
        txt = txt.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```\s*$/i, '').trim();
        const first = txt.indexOf('{');
        const last = txt.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) txt = txt.slice(first, last + 1);
        const parsed = JSON.parse(txt);
        // Ensure default values for new fields
        if (parsed.schedule) {
          parsed.schedule.weekBoundary = parsed.schedule.weekBoundary || 'startWeekday';
          parsed.schedule.enforcePartialWeeks = parsed.schedule.enforcePartialWeeks || false;
        }
        return parsed;
      } catch {
        // Return minimal valid GoalSpec structure
        return {
          title: '',
          verification: {
            methods: [],
            mandatory: [],
            sufficiency: false,
            rationale: 'Failed to parse AI response'
          },
          schedule: {
            weekBoundary: 'startWeekday',
            enforcePartialWeeks: false
          }
        };
      }
    };

    // Prefer proxy if provided
    if (proxyUrl) {
      const resp = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, type: 'goal_spec' })
      });
      const data = await resp.json();
      return data;
    }

    if (!apiKey) {
      // Minimal heuristic fallback adhering to structure
      const hasLocation = input.targetLocationName || input.placeId;
      
      // Detect if this is a movement goal (run, walk, cycle, etc.)
      const isMovementGoal = /\b(run|jog|walk|hike|cycle|ride|swim|exercise|workout|fitness)\b/i.test(input.prompt);
      
      let locationConstraints;
      if (isMovementGoal && !hasLocation) {
        // Movement goal without fixed venue
        locationConstraints = {
          mode: 'movement' as const,
          minDistanceKm: 1, // Default minimum distance
          evidence: 'GPS' as const
        };
      } else if (hasLocation) {
        // Fixed venue goal
        locationConstraints = {
          mode: 'geofence' as const,
          placeId: input.placeId || undefined,
          name: input.targetLocationName || undefined,
          radiusM: 100,
          minDwellMin: 10
        };
      }
      
      // Parse weekdays with regex: /\b(monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/gi
      // Map to indices: Sun=0, Mon=1, ..., Sat=6
      // Put the unique, sorted list into schedule.weekdayConstraints ONLY if at least one weekday is found; otherwise leave it undefined.
      const weekdayPattern = /\b(monday|mon|mondays|tuesday|tue|tuesdays|wednesday|wed|wednesdays|thursday|thu|thursdays|friday|fri|fridays|saturday|sat|saturdays|sunday|sun|sundays)\b/gi;
      const weekdayMatches = input.prompt.match(weekdayPattern) || [];
      let weekdayConstraints: number[] | undefined = undefined;
      
      if (weekdayMatches.length > 0) {
        const dayMap: { [key: string]: number } = {
          'sunday': 0, 'sun': 0, 'sundays': 0,
          'monday': 1, 'mon': 1, 'mondays': 1,
          'tuesday': 2, 'tue': 2, 'tuesdays': 2,
          'wednesday': 3, 'wed': 3, 'wednesdays': 3,
          'thursday': 4, 'thu': 4, 'thursdays': 4,
          'friday': 5, 'fri': 5, 'fridays': 5,
          'saturday': 6, 'sat': 6, 'saturdays': 6
        };
        
        const uniqueDays = new Set<number>();
        weekdayMatches.forEach((match: any) => {
          const dayIndex = dayMap[match.toLowerCase()];
          if (dayIndex !== undefined) {
            uniqueDays.add(dayIndex);
          }
        });
        weekdayConstraints = Array.from(uniqueDays).sort();
      }
      


      // Parse "at TIME on <days>" groups to build timeRules
      let timeRules: { days: number[], range: [string, string], label: string, source: 'user_text' | 'inferred' }[] = [];
      let timeWindows: { label: string; range: [string, string]; source: 'user_text' | 'inferred' }[] = [];
      
      // Simple approach: parse times and weekdays separately, then create timeRules
      // This handles the gym schedule format more reliably
      
      // First, extract all times mentioned
      const timePattern = /(\d{1,2}):?(\d{2})?\s*(am|pm)?/gi;
      const timeMatches = input.prompt.match(timePattern) || [];
      const uniqueTimes = new Set<string>();
      
      timeMatches.forEach(match => {
        const timeMatch = (match as any).match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
        if (timeMatch) {
          let hour = parseInt(timeMatch[1]);
          const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const ampm = timeMatch[3]?.toLowerCase();
          
          // Convert to 24-hour format
          if (ampm === 'pm' && hour !== 12) hour += 12;
          if (ampm === 'am' && hour === 12) hour = 0;
          
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          uniqueTimes.add(timeString);
        }
      });
      
      // If we have both weekdays and times, create timeRules
      if (weekdayConstraints && weekdayConstraints.length > 0 && uniqueTimes.size > 0) {
        // For the gym schedule case: "at 8 a.m. on Mondays and Tuesdays, and at 10 a.m. on Wednesdays and Saturdays"
        // We'll create timeRules by distributing times across weekdays logically
        
        const timeArray = Array.from(uniqueTimes).sort();
        const weekdayArray = [...weekdayConstraints].sort();
        
        if (timeArray.length === 2 && weekdayArray.length === 4) {
          // Gym schedule case: 2 times, 4 weekdays
          // Assume first time goes to first two weekdays, second time to last two
          const midPoint = Math.ceil(weekdayArray.length / 2);
          
          timeRules.push({
            days: weekdayArray.slice(0, midPoint), // [1, 2] for Mon, Tue
            range: [timeArray[0], timeArray[0]], // ["08:00", "08:00"]
            label: timeArray[0], // "08:00"
            source: 'user_text'
          });
          
          timeRules.push({
            days: weekdayArray.slice(midPoint), // [3, 6] for Wed, Sat
            range: [timeArray[1], timeArray[1]], // ["10:00", "10:00"]
            label: timeArray[1], // "10:00"
            source: 'user_text'
          });
        } else {
          // General case: create one timeRule per time, assigning all weekdays
          timeArray.forEach(time => {
            timeRules.push({
              days: [...weekdayArray],
              range: [time, time],
              label: time,
              source: 'user_text'
            });
          });
        }
      }
      
      // If no timeRules were created, check for unbound times
      if (timeRules.length === 0) {
        // Extract all times mentioned that are NOT bound to days
        const timePattern = /(\d{1,2}):?(\d{2})?\s*(am|pm)?/gi;
        const timeMatches = input.prompt.match(timePattern) || [];
        const uniqueTimes = new Set<string>();
        
        timeMatches.forEach(match => {
          const timeMatch = (match as any).match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
          if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const ampm = timeMatch[3]?.toLowerCase();
            
            // Convert to 24-hour format
            if (ampm === 'pm' && hour !== 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
            
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            uniqueTimes.add(timeString);
          }
        });
        
        // Create timeWindows for unbound times
        if (uniqueTimes.size > 0) {
          timeWindows = Array.from(uniqueTimes).map(time => ({
            label: time,
            range: [time, time] as [string, string],
            source: 'user_text' as 'user_text' | 'inferred'
          }));
        }
      }
      
      // If no timeRules were created, fall back to simple time parsing
      if (timeRules.length === 0) {
        const timePattern = /(\d{1,2}):?(\d{2})?\s*(am|pm)?/gi;
        const timeMatches = input.prompt.match(timePattern) || [];
        
        if (timeMatches.length > 0) {
          const uniqueTimes = new Set<string>();
          
          timeMatches.forEach(match => {
            const timeMatch = (match as any).match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
            if (timeMatch) {
              let hour = parseInt(timeMatch[1]);
              const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
              const ampm = timeMatch[3]?.toLowerCase();
              
              // Convert to 24-hour format
              if (ampm === 'pm' && hour !== 12) hour += 12;
              if (ampm === 'am' && hour === 12) hour = 0;
              
              const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
              uniqueTimes.add(timeString);
            }
          });
          
          // Convert to timeWindows format (fallback)
          timeWindows = Array.from(uniqueTimes).map(time => ({
            label: time,
            range: [time, time] as [string, string],
            source: 'user_text' as 'user_text' | 'inferred'
          }));
        }
      }

      return {
        title: input.title || '',
        verification: {
          methods: locationConstraints ? ['location', 'manual'] : ['manual'],
          mandatory: locationConstraints ? ['location'] : [],
          constraints: locationConstraints ? { location: locationConstraints } : {},
          sufficiency: !!locationConstraints,
          rationale: locationConstraints 
            ? (isMovementGoal 
                ? 'Movement-based goal with GPS tracking; refine with AI for better accuracy.'
                : 'Location-based goal with manual backup; refine with AI for better accuracy.')
            : 'Manual-only fallback; refine with AI for better verification methods.'
        },
        schedule: {
          countRule: { operator: '>=', count: 3, unit: 'per_week' },
          weekdayConstraints: weekdayConstraints,
          timeRules: timeRules.length > 0 ? timeRules : undefined,
          timeWindows: timeRules.length === 0 && timeWindows.length > 0 ? timeWindows : undefined,
          weekBoundary: 'startWeekday',
          enforcePartialWeeks: false,
          requiresDisambiguation: true,
          followUpQuestion: 'How many times per week and which time windows do you prefer?'
        },
        missingFields: ['schedule']
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          { role: 'system', content: 'STRICT JSON ONLY. No code fences or explanations. Output EXACTLY a GoalSpec object with this shape: {"title": string, "verification": {"methods": ("location"|"time"|"screentime"|"photo"|"manual")[], "mandatory": ("location"|"time"|"screentime"|"photo"|"manual")[], "constraints"?: object, "sufficiency": boolean, "rationale": string}, "schedule": {"countRule"?: {"operator": ">="|"=="|"<=", "count": number, "unit": "per_week"|"per_day"|"per_month"}, "weekdayConstraints"?: number[], "timeRules"?: [{"days": number[], "range": ["HH:MM","HH:MM"], "label"?: string, "source": "user_text"|"inferred"}], "timeWindows"?: [{"label": string, "range": ["HH:MM","HH:MM"], "source": "user_text"|"inferred"}], "weekBoundary"?: "startWeekday"|"isoWeek", "enforcePartialWeeks"?: boolean, "requiresDisambiguation"?: boolean, "followUpQuestion"?: string}. HARD RULES: - Location has two modes: 1) "geofence": attendance at a fixed place. Requires { name or placeId, radiusM, minDwellMin }. 2) "movement": distance/route based verification (e.g., run 5 km). Requires { minDistanceKm } and MUST NOT request a place name. - If the goal is a mobile activity (run/jog/walk/hike/cycle/ride/etc.) AND no fixed venue is explicitly specified by the user: - Include "location" in methods AND mandatory. - Set verification.constraints.location = { mode:"movement", minDistanceKm: <parsed from goal or infer>, evidence:"GPS|HealthKit|GoogleFit" }. - Do NOT include targetLocationName/placeId. Do NOT ask for a place-name follow-up. - If a fixed venue is explicit (gym, studio, library, office, class, ...): - Use mode:"geofence" and require { name/placeId, radiusM:100, minDwellMin:10 }. - If the goal is digital/app usage (study app, coding app, watching videos, social media control, focus timer, IDE, browser), you MUST include "screentime" in methods AND in mandatory. Provide constraints.screentime.bundleIds or a category hint. - If the goal requires visual proof (meal logging, workout set evidence, artifact submission, bodyweight record), include "photo" in methods; set it mandatory when photo is the primary proof. Set constraints.photo.required=true. - "time" is a scheduling trigger only, never sufficient as a standalone proof and must not be mandatory. - "manual" alone is insufficient for objective goals. If only manual/time are available, set sufficiency=false and provide ONE brief followUpQuestion proposing a viable proof (photo/location/screentime). - Semantic-first: do NOT force-map vague phrases (e.g., "morning"); represent them as timeWindows unless user gave exact times. - Preserve explicit user times exactly. - Use 24h HH:MM format in ranges. - Weekday indices: 0=Sun..6=Sat. - weekBoundary defaults to "startWeekday", enforcePartialWeeks defaults to false. WEEKDAY RULE: - If the prompt explicitly names weekdays (Mon/Tue/Wed/Thu/Fri/Sat/Sun; full or abbreviated), set schedule.weekdayConstraints to the EXACT set of mentioned days (deduplicated & sorted by 0=Sun..6=Sat). - If NO weekdays are named, OMIT schedule.weekdayConstraints entirely (treat as no restriction). TIME RULES (PREFERRED): - Use schedule.timeRules when the prompt ties specific times to specific weekdays. - timeRules: Array<{ days: number[], range: [string,string], label?: string, source: "user_text"|"inferred" }> - days use 0=Sun..6=Sat indices. - For exact times like "7 a.m.", create a point window ["07:00","07:00"]. - Only fall back to schedule.timeWindows (global union) when the prompt does NOT tie times to particular days. - Do NOT fabricate weekdayConstraints for "N times per week". TIME WINDOWS RULE (FALLBACK): - Build schedule.timeWindows as the UNION of all distinct times or intervals mentioned ONLY when no day→time binding exists. - A selected time is compatible if it lies INSIDE ANY allowed window (inclusive): start <= t <= end. - Equality counts as inside (e.g., 08:00 is inside [08:00–09:00] and [08:00–08:00]). FREQUENCY RULE: - For inputs like "N times per week", do not fabricate weekdayConstraints. EXAMPLES: Input: "Go to the gym at 7 a.m. on Mondays and Wednesdays, and at 9 a.m. on Fridays and Saturdays." → schedule.weekdayConstraints=[1,3,5,6], timeRules=[{ days: [1,3], range: ["07:00","07:00"], label: "07:00", source: "user_text" }, { days: [5,6], range: ["09:00","09:00"], label: "09:00", source: "user_text" }], Omit schedule.timeWindows. Input: "Exercise 3 times per week" → Omit both timeRules and timeWindows (no day→time binding). - JSON ONLY, no code fences or explanations.' },
          { role: 'user', content: JSON.stringify(payload) }
        ]
      })
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    return safeParse(content);
  }

  /**
   * Validate user-selected weekly schedule against a GoalSpec
   * Input: GoalSpec + user's weeklyWeekdays and weeklyTimeSettings
   * Output: JSON ONLY shape per spec
   */
  static async validateScheduleAgainstGoalSpec(input: {
    goalSpec: any;
    weeklyWeekdays: number[];
    weeklyTimeSettings: { [key: string]: string[] } | { [key: number]: string[] };
    locale?: string;
    timezone?: string;
  }): Promise<{
    isCompatible: boolean;
    issues: string[];
    fixes?: { weeklyWeekdays?: number[]; weeklyTimeSettings?: { [dayIndex: number]: string[] } };
    followUpQuestion?: string;
    summary: string;
  }> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    const proxyUrl = process.env.EXPO_PUBLIC_AI_PROXY_URL;
    const payload = {
      goalSpec: input.goalSpec,
      weeklyWeekdays: input.weeklyWeekdays,
      weeklyTimeSettings: input.weeklyTimeSettings,
      locale: input.locale || 'ko-KR',
      timezone: input.timezone || 'Asia/Seoul'
    };

    const safeParse = (raw: string) => {
      let txt = (raw || '').trim();
      try {
        txt = txt.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```\s*$/i, '').trim();
        const first = txt.indexOf('{');
        const last = txt.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) txt = txt.slice(first, last + 1);
        return JSON.parse(txt);
      } catch {
        return { isCompatible: false, issues: ['Invalid model response'], summary: 'Could not validate due to a parsing error.' } as any;
      }
    };

    // Prefer proxy if provided
    try {
      if (proxyUrl) {
        const resp = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, type: 'schedule_validation' })
        });
        const data = await resp.json();
        return data;
      }

      if (apiKey) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0,
            messages: [
              {
                role: 'system',
                content:
                  'JSON ONLY. No code fences or explanations. Validate the user\'s weekly schedule against the GoalSpec and output EXACTLY: {"isCompatible": boolean, "issues": string[], "fixes"?: {"weeklyWeekdays"?: number[], "weeklyTimeSettings"?: { [dayIndex:number]: string[] }}, "followUpQuestion"?: string, "summary": string}. TIME RULES PRIORITY: - If schedule.timeRules is present: validate each selected day/time ONLY against the ranges attached to that day via timeRules (union of ranges for that day). - If timeRules is absent but schedule.timeWindows exists: treat timeWindows as global for all days. - If neither exists: do not enforce time window constraints. TOLERANCE: - For point ranges ["HH:MM","HH:MM"], apply ±15 minutes tolerance when validating user-selected times (configurable; default 15). - Equality counts as inside. WEEKDAY RULE: - If weekdayConstraints is present: selected weekdays must be a subset or equal. If absent: no restriction. COUNT FEASIBILITY: - Use pattern-based feasibility (typical week). Ignore partial-week underflow. ISSUES & SUGGESTED FIXES: - When reporting violations, show localized day names (e.g., Mon/Fri). - For time violations with timeRules, suggest the nearest allowed time for THAT day.'
              },
              { role: 'user', content: JSON.stringify(payload) }
            ]
          })
        });
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '{}';
        return safeParse(content);
      }
    } catch (e) {
      // fall through to heuristic
    }

    // Heuristic fallback with improved week-by-week validation
    try {
      const spec = input.goalSpec || {};
      const schedule = spec.schedule || {};
      const timeWindows: { label: string; range: [string, string]; source: string }[] = Array.isArray(schedule.timeWindows) ? schedule.timeWindows : [];
      const weekdayConstraints: number[] = Array.isArray(schedule.weekdayConstraints) ? schedule.weekdayConstraints : [];
      const countRule = schedule.countRule || { operator: '>=', count: 1, unit: 'per_week' };
      const weekBoundary = schedule.weekBoundary || 'startWeekday';
      const enforcePartialWeeks = schedule.enforcePartialWeeks || false;

      const issues: string[] = [];
      let countRuleIssues: string[] = [];

      // Flatten user times
      const userTimesSet = new Set<string>();
      Object.values(input.weeklyTimeSettings || {}).forEach((arr: any) => {
        (arr || []).forEach((t: string) => userTimesSet.add(t));
      });
      const userTimes = Array.from(userTimesSet);

      // 2) Time validation with TIME RULES PRIORITY and TOLERANCE
      // - If timeRules present: validate each day/time against ranges for that specific day
      // - If timeRules absent but timeWindows exist: treat as global for all days
      // - If neither exists: no time constraints
      let timeWindowIssues: string[] = [];
      let timeViolations: { dayIndex: number; time: string; dayName: string }[] = [];
      
      const timeRules: { days: number[], range: [string, string], label?: string, source: string }[] = Array.isArray(schedule.timeRules) ? schedule.timeRules : [];
      
      if (timeRules.length > 0) {
        // TIME RULES PRIORITY: validate against day-specific ranges
        Object.entries(input.weeklyTimeSettings || {}).forEach(([dayIndexStr, times]) => {
          const dayIndex = Number(dayIndexStr);
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dayName = dayNames[dayIndex];
          
          // Find all timeRules that apply to this day
          const dayTimeRules = timeRules.filter(rule => rule.days.includes(dayIndex));
          
          if (dayTimeRules.length > 0) {
            // Convert timeRules ranges to minutes with tolerance
            const allowedRanges = dayTimeRules.map(rule => {
              const [start, end] = rule.range || ['00:00', '23:59'];
              const parseTimeToMinutes = (timeStr: string): number => {
                const [h, m] = timeStr.split(':').map(x => parseInt(x, 10));
                return h * 60 + m;
              };
              
              const startMinutes = parseTimeToMinutes(start);
              const endMinutes = parseTimeToMinutes(end);
              
              // Apply ±15 minutes tolerance for point ranges
              const tolerance = 15; // configurable
              const isPointRange = start === end;
              
              return {
                start: isPointRange ? Math.max(0, startMinutes - tolerance) : startMinutes,
                end: isPointRange ? Math.min(1439, endMinutes + tolerance) : endMinutes,
                original: rule
              };
            });
            
            // Check each time for this day
            times.forEach(time => {
              const timeMinutes = (() => {
                const [h, m] = time.split(':').map(x => parseInt(x, 10));
                return h * 60 + m;
              })();
              
              // Check if time is inside ANY of the day's allowed ranges
              const isInsideAny = allowedRanges.some(range => 
                timeMinutes >= range.start && timeMinutes <= range.end
              );
              
              if (!isInsideAny) {
                timeViolations.push({ dayIndex, time, dayName });
              }
            });
          }
        });
      } else if (timeWindows.length > 0) {
        // Fallback to global timeWindows (existing logic)
        const windowMinutes = timeWindows.map(w => {
          const [start, end] = w.range || ['00:00', '23:59'];
          const parseTimeToMinutes = (timeStr: string): number => {
            const [h, m] = timeStr.split(':').map(x => parseInt(x, 10));
            return h * 60 + m;
          };
          return {
            start: parseTimeToMinutes(start),
            end: parseTimeToMinutes(end),
            original: w
          };
        });
        
        // Check each selected time per day against global windows
        Object.entries(input.weeklyTimeSettings || {}).forEach(([dayIndexStr, times]) => {
          const dayIndex = Number(dayIndexStr);
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dayName = dayNames[dayIndex];
          
          times.forEach(time => {
            const timeMinutes = (() => {
              const [h, m] = time.split(':').map(x => parseInt(x, 10));
              return h * 60 + m;
            })();
            
            // Check if time is inside ANY window
            const isInsideAny = windowMinutes.some(w => 
              timeMinutes >= w.start && timeMinutes <= w.end
            );
            
            if (!isInsideAny) {
              timeViolations.push({ dayIndex, time, dayName });
            }
          });
        });
      }
      
      // Only add issues if there are actual violations
      if (timeViolations.length > 0) {
        const uniqueViolations = timeViolations.map(v => `${v.dayName} ${v.time}`);
        timeWindowIssues.push(`Some times are outside allowed windows: ${uniqueViolations.join(', ')} (fixes available)`);
      }

      // 1) Weekday check:
      // If weekdayConstraints is undefined OR empty array → no weekday restriction
      // If present → selected weekdays must be subset or equal to allowed
      const allowed = spec?.schedule?.weekdayConstraints;
      const selected = input.weeklyWeekdays ?? [];

      if (allowed && allowed.length > 0) {
        const notSubset = selected.some(d => !allowed.includes(d));
        if (notSubset) {
          // Convert day indices to names for better user experience
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const invalidDays = selected.filter(d => !allowed.includes(d)).map(d => dayNames[d]);
          issues.push(`Selected weekdays not allowed: ${invalidDays.join(', ')}`);
        }
        // DO NOT add any issue if selected equals allowed (subset OR equal is OK).
      }
      // If allowed is undefined or empty array, never produce issues about weekday subsets.

      // 3) Count feasibility: improved week-by-week validation with complete week partitioning
      if (countRule.unit === 'per_week') {
        // Calculate weekly pattern count
        const timesPerDay = (dayIdx: number) => ((input.weeklyTimeSettings as any)?.[dayIdx] || []).length;
        const weeklyPatternCount = (input.weeklyWeekdays || []).reduce((sum, d) => sum + timesPerDay(d), 0);
        const operator = countRule.operator as string;
        const required = Number(countRule.count || 0);
        
        // Enhanced validation: check if the pattern can satisfy requirements in complete weeks
        let satisfies = false;
        
        if (enforcePartialWeeks) {
          // For partial weeks, check if the pattern can still satisfy the requirement
          // by considering that some weeks might have fewer days
          const minDaysInWeek = Math.min(...(input.weeklyWeekdays || []).map(d => timesPerDay(d)));
          
          if (minDaysInWeek > 0) {
            // Even with partial weeks, if each selected day has at least one time,
            // the pattern should be valid
            satisfies = true;
          } else {
            countRuleIssues.push(`Partial week pattern may not satisfy requirement: ${operator} ${required} sessions per week`);
          }
        } else {
          // Standard weekly validation: check if the weekly pattern can reach the required count
          if (operator === '>=') {
            satisfies = weeklyPatternCount >= required;
          } else if (operator === '==') {
            satisfies = weeklyPatternCount === required;
          } else if (operator === '<=') {
            satisfies = weeklyPatternCount <= required;
          }
          
          if (!satisfies) {
            // Only show count issues when there are weekday constraints
            // For frequency-only goals (no weekday constraints), the user can choose any days
            if (allowed && allowed.length > 0) {
              countRuleIssues.push(`Weekly pattern provides ${weeklyPatternCount} sessions vs ${operator} ${required} required`);
            } else {
              // For frequency-only goals, just note if the pattern is insufficient
              countRuleIssues.push(`Selected schedule provides ${weeklyPatternCount} sessions per week (${operator} ${required} required)`);
            }
          }
        }
      } else {
        // Non-per_week units: use simple weekly pattern check
        const timesPerDay = (dayIdx: number) => ((input.weeklyTimeSettings as any)?.[dayIdx] || []).length;
        const perWeekCount = (input.weeklyWeekdays || []).reduce((sum, d) => sum + timesPerDay(d), 0);
        const operator = countRule.operator as string;
        const required = Number(countRule.count || 0);
        const unit = countRule.unit || 'per_week';

        let satisfies = true;
        if (unit === 'per_day') {
          // For per_day, require each selected day to have required occurrences
          const perDayOk = (input.weeklyWeekdays || []).every(d => timesPerDay(d) >= required);
          satisfies = operator === '>=' ? perDayOk : false; // keep simple
        } else if (unit === 'per_month') {
          // Approximate 4 weeks per month
          const perMonthApprox = perWeekCount * 4;
          satisfies = operator === '>=' ? perMonthApprox >= required : operator === '==' ? perMonthApprox === required : perMonthApprox <= required;
        }
        
        if (!satisfies) {
          countRuleIssues.push(`Schedule may not satisfy count rule (${operator} ${required} ${unit}).`);
        }
      }

      // Combine all issues - but special handling for time windows and partial weeks
      const allIssues = [...issues, ...countRuleIssues, ...timeWindowIssues];
      
      // Enhanced compatibility check for partial weeks
      const hasOnlyTimeWindowIssues = timeWindowIssues.length > 0 && issues.length === 0 && countRuleIssues.length === 0;
      const hasNoWeekdayConstraints = weekdayConstraints.length === 0; // No weekday restrictions
      const hasPartialWeekCompatibility = enforcePartialWeeks && countRuleIssues.length === 0;
      
      // If incompatibility is only due to:
      // 1) time windows (which can be fixed), or
      // 2) no weekday constraints (any weekday selection is permitted), or
      // 3) partial week compatibility (enforcePartialWeeks is true and count rules are satisfied)
      // then return compatible if fixes can resolve the issues
      const isCompatible = allIssues.length === 0 || hasOnlyTimeWindowIssues || hasNoWeekdayConstraints || hasPartialWeekCompatibility;

      // Suggest minimal fixes - more aggressive for time windows
      let fixes: { weeklyWeekdays?: number[]; weeklyTimeSettings?: { [dayIndex: number]: string[] } } | undefined = undefined;
      
      // Only suggest time fixes if there are actual time window violations
      let timeFixMap: { [dayIndex: number]: string[] } | undefined;
      if (timeWindows.length > 0 && timeWindowIssues.length > 0) {
        const withinWindow = (time: string) => {
          return timeWindows.some(w => {
            const [start, end] = w.range || ['00:00', '23:59'];
            return time >= start && time <= end;
          });
        };
        const findNearestTimeInWindow = (time: string) => {
          // Find the closest time inside any window
          let closest = time;
          let minDistance = Infinity;
          
          const parseTimeToMinutes = (timeStr: string): number => {
            const [h, m] = timeStr.split(':').map(x => parseInt(x, 10));
            return h * 60 + m;
          };
          
          const minutesToTimeString = (minutes: number): string => {
            const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
            const mm = String(minutes % 60).padStart(2, '0');
            return `${hh}:${mm}`;
          };
          
          timeWindows.forEach(w => {
            const [start, end] = w.range || ['00:00', '23:59'];
            const timeMinutes = parseTimeToMinutes(time);
            const startMinutes = parseTimeToMinutes(start);
            const endMinutes = parseTimeToMinutes(end);
            
            if (timeMinutes >= startMinutes && timeMinutes <= endMinutes) {
              return time; // Already inside
            }
            
            // Find closest boundary
            const distToStart = Math.abs(timeMinutes - startMinutes);
            const distToEnd = Math.abs(timeMinutes - endMinutes);
            
            if (distToStart < minDistance) {
              minDistance = distToStart;
              closest = minutesToTimeString(startMinutes);
            }
            if (distToEnd < minDistance) {
              minDistance = distToEnd;
              closest = minutesToTimeString(endMinutes);
            }
          });
          
          return closest;
        };
        
        const wts = input.weeklyTimeSettings || {} as any;
        Object.keys(wts).forEach((k) => {
          const di = Number(k);
          const adjusted = (wts as any)[k].map((t: string) => (withinWindow(t) ? t : findNearestTimeInWindow(t)));
          if (adjusted.some((t: string, idx: number) => t !== (wts as any)[k][idx])) {
            timeFixMap = timeFixMap || {};
            const unique: string[] = Array.from(new Set<string>(adjusted as string[])) as string[];
            unique.sort((a, b) => String(a).localeCompare(String(b)));
            timeFixMap[di] = unique;
          }
        });
      }
      
      // Suggest weekday fixes only if incompatible due to invalid days
      let fixDays: number[] | undefined = undefined;
      if (!isCompatible && weekdayConstraints.length > 0 && input.weeklyWeekdays?.length > 0) {
        const filtered = (input.weeklyWeekdays || []).filter(d => weekdayConstraints.includes(d));
        if (filtered.length > 0 && filtered.length !== input.weeklyWeekdays.length) fixDays = filtered;
      }
      // If no weekday constraints, no need to suggest weekday fixes (any selection is valid)
      
      if ((fixDays && fixDays.length > 0) || timeFixMap) {
        fixes = {};
        if (fixDays && fixDays.length > 0) fixes.weeklyWeekdays = fixDays;
        if (timeFixMap) fixes.weeklyTimeSettings = timeFixMap;
      }

      let summary = isCompatible
        ? 'Your schedule matches the goal\'s allowed days, time windows, and target frequency.'
        : 'Your schedule has conflicts with allowed days, time windows, or the required frequency.';
      
      // Add movement goal note to summary
      const isMovementGoal = spec?.verification?.constraints?.location?.mode === 'movement';
      if (isMovementGoal) {
        summary += ' (Movement goal: schedule compatibility based on time windows, no place required)';
      }

      // Add partial week note to summary
      if (enforcePartialWeeks) {
        summary += ' (Partial weeks allowed: schedule validation considers week-by-week feasibility)';
      }

      return { isCompatible, issues: allIssues, fixes, summary } as any;
    } catch {
      return {
        isCompatible: false,
        issues: ['Validation failed unexpectedly'],
        summary: 'Could not validate due to an internal error.'
      } as any;
    }
  }

  /**
   * Generate conversational questions for goal creation with enhanced AI capabilities
   */
  static async generateConversationalQuestion(input: {
    goalType: 'schedule' | 'frequency' | 'milestone';
    collectedSlots: Record<string, any>;
    pendingSlots: string[];
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
    userState?: any;
  }): Promise<{ 
    question: string; 
    widgets?: Array<{ type: string; slotId: string; props: any }>; 
    userState?: any;
    extractedSchedule?: {
      weekdays?: number[];
      time?: string;
      weeklySchedule?: Record<string, string[]>;
    };
    conversationComplete?: boolean;
    quests?: Array<{
      id: string;
      title: string;
      description: string;
      targetDate: string;
      verification: string[];
      difficulty?: string;
      estimatedTime?: string;
      tips?: string[];
    }>;
  }> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey) {
      console.warn('[AI] Missing OpenAI API key');
      return { question: '죄송합니다. AI 서비스에 접근할 수 없습니다.' };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.7,
          messages: [
            { 
              role: 'system', 
              content: `You are an intelligent Korean goal creation assistant. Your role is to have natural conversations to collect all necessary information for creating personalized goals.

Goal Types and Required Information:
1. "schedule": Goals with specific days and times
   - period (date range), weekdays (array of 0-6), time (HH:mm), verification methods, success rate
   - Example: "월수금 아침 7시에 헬스장 가기"
   - IMPORTANT: Ask for period, weekdays, and time as SEPARATE questions

2. "frequency": Goals with frequency targets  
   - period (date range), perWeek (frequency), verification methods, success rate
   - Example: "주 3회 운동하기"

3. "milestone": Project-based goals requiring state assessment
   - period (date range), milestones (stages), current state, verification methods, success rate
   - Example: "유학 준비하기", "프로젝트 완성하기"

Special Instructions for Milestone Goals:
- Always assess the user's current state/level
- Ask about their experience, background, and starting point
- Create personalized milestones based on their current state
- Consider their timeline and available resources

Schedule Information Extraction:
- When user mentions schedule information in natural language (e.g., "월수금 아침 7시에 헬스장 가기"):
  - Extract weekdays: [1, 3, 5] for 월수금 (0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토)
  - Extract time: "07:00" for 아침 7시
  - Store in extractedSchedule field to pre-populate widgets
- However, ALWAYS ask for period, weekdays, and time as SEPARATE questions even if extracted
- Each slot needs its own question and widget for user confirmation

Conversation Guidelines:
- Be conversational, friendly, and empathetic
- Ask ONE focused question at a time - ONE slot per question
- Show genuine interest in their goals
- Provide encouragement and motivation
- Use natural Korean language
- Avoid repetitive or robotic questions
- NEVER ask the same question twice - always check conversation history
- Build upon previous answers naturally
- Only ask for information that hasn't been provided yet
- If user has already answered something, acknowledge it and move to next topic
- For schedule goals: Ask period → weekdays → time as separate questions

Critical Rules - Widget Generation:
- ALWAYS generate exactly ONE widget per question
- Each slot (period, weekdays, time) needs a SEPARATE question with its own widget
- NEVER combine multiple widgets in one question
- Check conversation history to avoid duplicate questions
- Only generate widgets for slots that are NOT yet filled

Conversation Flow Control:
1. Check if ALL required slots are filled:
   - Schedule: period, weekdays, time, verification, successRate (5 separate questions)
   - Frequency: period, perWeek, verification, successRate (4 separate questions)
   - Milestone: period, milestones, currentState, verification, successRate

2. If ALL slots filled → Return [QUESTS.FINAL] with generated quests
3. If missing slots → Ask next question for ONE missing slot with appropriate widget
4. If incomplete answer → Ask follow-up question

Required Slots by Goal Type:
- Schedule: period (date range), weekdays (array: 0-6), time (HH:mm string), verification (array), successRate (number)
- Frequency: period (date range), perWeek (number), verification (array), successRate (number)
- Milestone: period (date range), milestones (array), currentState (object), verification (array), successRate (number)

Verification Options (FIXED - only these 3):
- "사진": Photo-based verification
- "위치 등록": Location-based verification
- "체크리스트": Manual checklist verification

When asking about verification, always use these EXACT Korean options.

Respond with JSON:
{
  "question": "자연스러운 한국어 질문",
  "widgets": [
    {
      "type": "calendar|chips|counter|timePicker|weekdays",
      "slotId": "period|weekdays|time|perWeek|verification|successRate|milestones",
      "props": { 
        "mode": "range" for calendar,
        "options": ["사진", "위치 등록", "체크리스트"] for verification chips,
        "options": ["시작", "중간", "완료"] for milestone chips,
        "min": 1, "max": 7 for perWeek counter,
        "min": 50, "max": 100 for successRate counter,
        "defaultValue": pre-filled value if needed
      }
    }
  ],
  "userState": {
    "currentLevel": "beginner|intermediate|advanced",
    "experience": "description of user's background",
    "timeline": "urgent|moderate|flexible",
    "resources": "available time and resources"
  },
  "extractedSchedule": {
    "weekdays": [1, 3, 5],
    "time": "07:00",
    "weeklySchedule": {"1": ["07:00"], "3": ["07:00"], "5": ["07:00"]}
  },
  "conversationComplete": false
}

When ALL required slots are filled, respond with [QUESTS.FINAL]:
{
  "conversationComplete": true,
  "quests": [
    {
      "id": "quest-1",
      "title": "1주차 월요일 07:00 헬스장 가기",
      "description": "헬스장에서 운동하기",
      "targetDate": "2025-10-06",
      "verification": ["time", "location"],
      "difficulty": "medium",
      "estimatedTime": "60분",
      "tips": ["미리 운동복 준비하기", "물병 챙기기"]
    }
  ]
}

Focus on understanding the user's unique situation and creating truly personalized goals.`
            },
            { 
              role: 'user', 
              content: JSON.stringify({
                goalType: input.goalType,
                collectedSlots: input.collectedSlots,
                pendingSlots: input.pendingSlots,
                conversationHistory: input.conversationHistory.slice(-8), // Last 8 messages for better context
                userState: input.userState
              })
            }
          ]
        })
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      
      try {
        let txt = content.trim().replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```\s*$/i, '').trim();
        const first = txt.indexOf('{'); const last = txt.lastIndexOf('}');
        if (first >= 0 && last > first) txt = txt.substring(first, last + 1);
        
        const parsed = JSON.parse(txt);
        console.log('[AI] Generated enhanced conversational question:', parsed);
        return parsed;
      } catch (parseError) {
        console.warn('[AI] Failed to parse enhanced conversational question response:', parseError);
        console.warn('[AI] Raw response:', content);
        
        // Provide more specific fallback based on pending slots
        if (input.pendingSlots.includes('period')) {
          return { 
            question: '목표를 언제부터 언제까지 진행하실 계획인가요? 아래 달력에서 시작일과 종료일을 선택해주세요.',
            widgets: [{ type: 'calendar', slotId: 'period', props: { mode: 'range' } }]
          };
        } else if (input.pendingSlots.includes('weekdays')) {
          return { 
            question: '어떤 요일에 목표를 실천하실 계획인가요?',
            widgets: [{ type: 'weekdays', slotId: 'weekdays', props: {} }]
          };
        } else if (input.pendingSlots.includes('time')) {
          return { 
            question: '몇 시에 실천하실 계획인가요?',
            widgets: [{ type: 'timePicker', slotId: 'time', props: {} }]
          };
        } else if (input.pendingSlots.includes('verification')) {
          return { 
            question: '목표 달성을 어떻게 확인하시겠어요?',
            widgets: [{ type: 'chips', slotId: 'verification', props: { options: ['사진', '위치 등록', '체크리스트'], multiple: true } }]
          };
        } else if (input.pendingSlots.includes('successRate')) {
          return { 
            question: '목표 달성률을 몇 %로 설정하시겠어요?',
            widgets: [{ type: 'counter', slotId: 'successRate', props: { min: 50, max: 100, defaultValue: 80 } }]
          };
        }
        
        return { question: '목표에 대해 조금 더 구체적으로 알려주세요. 예를 들어, 언제, 어디서, 어떻게 실천할 계획인가요?' };
      }
    } catch (error) {
      console.error('[AI] Enhanced conversational question generation failed:', error);
      return { question: '죄송합니다. 잠시 후 다시 시도해주세요.' };
    }
  }

  /**
   * Generate personalized quests based on user state and goal information
   */
  static async generatePersonalizedQuests(input: {
    goalType: 'schedule' | 'frequency' | 'milestone';
    goalTitle: string;
    collectedSlots: Record<string, any>;
    userState?: {
      currentLevel?: string;
      experience?: string;
      timeline?: string;
      resources?: string;
    };
    targetCount?: number;
    specV2?: any; // GoalSpecV2 for occurrence-based generation
  }): Promise<Array<{
    id: string;
    title: string;
    description: string;
    targetDate: string;
    verification: string[];
    difficulty?: string;
    estimatedTime?: string;
    tips?: string[];
  }>> {
    console.log('[AI.QUEST] 🚀 generatePersonalizedQuests called with:', {
      goalType: input.goalType,
      goalTitle: input.goalTitle,
      collectedSlots: input.collectedSlots,
      userState: input.userState,
      targetCount: input.targetCount,
      hasSpecV2: !!input.specV2,
      hasOccurrences: !!input.specV2?.schedule?.occurrences
    });
    
    // === OCCURRENCE-BASED GENERATION (V2) ===
    if (input.specV2?.schedule?.occurrences && input.specV2.schedule.occurrences.length > 0) {
      console.log('[AI.QUEST] 🆕 Using occurrence-based generation');
      console.log('[AI.QUEST] 📊 Occurrences count:', input.specV2.schedule.occurrences.length);
      console.log('[AI.QUEST] 📅 First 3 occurrences:', input.specV2.schedule.occurrences.slice(0, 3));
      
      // For occurrence-based schedules, generate exactly 1 quest per occurrence
      const occurrences = input.specV2.schedule.occurrences;
      const verificationRaw = input.collectedSlots.verification || input.specV2.verification?.signals || ['manual'];
      
      // Convert English signals to Korean
      const verification = verificationRaw.map((v: string) => {
        const signalMap: Record<string, string> = {
          'photo': '사진',
          'location': '위치 등록',
          'checklist': '체크리스트',
          'manual': '체크리스트'
        };
        return signalMap[v] || v;
      });
      
      console.log('[AI.QUEST] 🔍 Verification methods:', { raw: verificationRaw, korean: verification });
      console.log('[AI.QUEST] 🎯 Goal title:', input.goalTitle);
      
      const quests = occurrences.map((occ: any, index: number) => {
        const startDate = new Date(occ.start);
        
        // ✅ KST로 변환 (UTC+9)
        const kstDate = new Date(startDate.getTime() + 9 * 60 * 60 * 1000);
        const targetDate = kstDate.toISOString().split('T')[0]; // ✅ KST 날짜 사용
        
        // Convert UTC to local time for display
        const localHours = startDate.getUTCHours() + 9; // KST = UTC+9
        const displayHours = localHours >= 24 ? localHours - 24 : localHours;
        const minutes = startDate.getUTCMinutes();
        const timeStr = `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        
        return {
          id: `quest-occ-${index + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: `${input.goalTitle}`,
          description: `${targetDate} ${timeStr}에 "${input.goalTitle}"를 수행하세요`,
          targetDate,
          verification,
          difficulty: index < occurrences.length / 3 ? 'easy' : 
                    index < occurrences.length * 2 / 3 ? 'medium' : 'hard',
          estimatedTime: '60분',
          tips: [`${timeStr}에 알람을 설정하세요`, '준비물을 미리 챙기세요']
        };
      });
      
      console.log('[AI.QUEST] ✅ Generated', quests.length, 'quests from occurrences');
      console.log('[AI.QUEST] 📝 First quest:', quests[0]);
      console.log('[AI.QUEST] 📝 Last quest:', quests[quests.length - 1]);
      console.log('[AI.QUEST] 📝 All quest IDs:', quests.map(q => q.id));
      
      return quests;
    }
    
    // === E. VALIDATION ===
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('[AI.QUEST] ❌ CRITICAL: Missing OpenAI API key - Quest generation IMPOSSIBLE');
      console.error('[AI.QUEST] Please set EXPO_PUBLIC_OPENAI_API_KEY in your .env file');
      return [];
    }

    // Validate required slots for goal type
    const requiredSlots: Record<string, string[]> = {
      schedule: ['period', 'weekdays', 'time', 'verification', 'successRate'],
      frequency: ['period', 'perWeek', 'verification', 'successRate'],
      milestone: ['period', 'milestones', 'currentState', 'verification', 'successRate']
    };

    const missing = requiredSlots[input.goalType]?.filter(slot => !input.collectedSlots[slot]) || [];
    if (missing.length > 0) {
      console.error('[AI.QUEST] ❌ VALIDATION FAILED: Missing required slots:', missing);
      return [];
    }

    // Validate verification labels (support both Korean and English)
    const verification = input.collectedSlots.verification as string[] || [];
    const allowedVerification = ['사진', '위치 등록', '체크리스트', 'photo', 'location', 'checklist', 'manual'];
    const invalidLabels = verification.filter(v => !allowedVerification.includes(v));
    if (invalidLabels.length > 0) {
      console.error('[AI.QUEST] ❌ VALIDATION FAILED: Invalid verification labels:', invalidLabels);
      console.error('[AI.QUEST] Allowed labels:', allowedVerification);
      return [];
    }
    
    // Convert English signals to Korean for consistency
    const verificationKorean = verification.map(v => {
      const signalMap: Record<string, string> = {
        'photo': '사진',
        'location': '위치 등록',
        'checklist': '체크리스트',
        'manual': '체크리스트'
      };
      return signalMap[v] || v;
    });
    console.log('[AI.QUEST] 🔄 Verification labels normalized:', { original: verification, normalized: verificationKorean });

    // Validate successRate
    const successRate = Number(input.collectedSlots.successRate);
    if (isNaN(successRate) || successRate < 50 || successRate > 100) {
      console.error('[AI.QUEST] ❌ VALIDATION FAILED: successRate must be 50-100, got:', successRate);
      return [];
    }

    // Validate targetCount
    const targetCount = input.targetCount || 0;
    if (targetCount <= 0) {
      console.warn('[AI.QUEST] ⚠️ WARNING: targetCount not provided or invalid, will compute from slots');
    }

    console.log('[AI.QUEST] ✅ All validations passed');
    console.log('[AI.QUEST] ✅ API key found, proceeding with AI generation...');

    try {
      console.log('[AI.QUEST] 📡 Sending request to OpenAI...');
      
      // === D. COMPUTE targetCount if not provided ===
      let finalTargetCount = targetCount;
      
      if (!finalTargetCount || finalTargetCount <= 0) {
        const period = input.collectedSlots.period as { startDate: string; endDate: string };
        if (period && period.startDate && period.endDate) {
          const startDate = new Date(period.startDate);
          const endDate = new Date(period.endDate);
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
          const weeks = Math.ceil(daysDiff / 7);
          
          if (input.goalType === 'frequency') {
            const perWeek = Number(input.collectedSlots.perWeek) || 3;
            const totalCount = weeks * perWeek;
            finalTargetCount = Math.ceil(totalCount * successRate / 100);
          } else if (input.goalType === 'schedule') {
            const weekdays = (input.collectedSlots.weekdays as number[]) || [];
            // Approximate: weeks * weekdays.length
            finalTargetCount = Math.min(weeks * weekdays.length, 15);
          } else if (input.goalType === 'milestone') {
            const milestones = (input.collectedSlots.milestones as string[]) || ['시작', '중간', '완료'];
            finalTargetCount = milestones.length;
          }
        }
      }
      
      finalTargetCount = Math.max(5, Math.min(finalTargetCount || 10, 15)); // Clamp 5-15
      
      console.log('[AI.QUEST] 📊 Final targetCount:', finalTargetCount);

      const requestBody = {
        model: 'gpt-4o-mini',
        temperature: 0.15, // D12: Lower temperature for deterministic output
        response_format: { type: "json_object" }, // D12: Enforce JSON output
        messages: [
          { 
            role: 'system', 
            content: `You are an expert goal and quest designer. Use ONLY the provided collectedSlots and userState.
NEVER guess missing fields. Follow these rules STRICTLY:

=== RULES ===
1. period: ALL quests' targetDate MUST fall within this date range (inclusive).
   - Start: ${input.collectedSlots.period?.startDate || 'not provided'}
   - End: ${input.collectedSlots.period?.endDate || 'not provided'}
   
2. weekdays & time (schedule goals only):
   - Distribute quests ONLY on these weekdays: ${JSON.stringify(input.collectedSlots.weekdays || [])}
   - All quests at this time: ${input.collectedSlots.time || 'not provided'}
   - Timezone: Asia/Seoul
   
3. perWeek (frequency goals only):
   - Frequency: ${input.collectedSlots.perWeek || 'not provided'} times per week
   - Distribute evenly across the period
   
4. successRate: ${successRate}%
   - This means ${finalTargetCount} quests are required for success
   
5. verification: Use ONLY these labels from user's choice: ${JSON.stringify(verificationKorean)}
   - Allowed: ["사진", "위치 등록", "체크리스트"]
   - NEVER use other labels like "manual", "time", "location", "photo"
   
6. userState: ${input.userState ? JSON.stringify(input.userState) : 'not provided'}
   - Adjust difficulty, pacing, and tips based on currentLevel, experience, timeline, resources
   - Beginner: more easy quests, detailed tips
   - Advanced: more hard quests, concise tips
   
7. targetCount: Generate EXACTLY ${finalTargetCount} quests
   - No more, no less
   
=== OUTPUT FORMAT ===
You MUST return a valid JSON object with a "quests" array:
{
  "quests": [
    {
      "id": "quest-1",
      "title": "Specific quest title in Korean",
      "description": "Clear action instructions in Korean",
      "targetDate": "YYYY-MM-DD",
      "verification": ${JSON.stringify(verification)},
      "difficulty": "easy|medium|hard",
      "estimatedTime": "15분|30분|1시간|2시간",
      "tips": ["tip1 in Korean", "tip2 in Korean"]
    }
  ]
}

=== CRITICAL ===
- Return ONLY valid JSON. No markdown, no code fences, no explanations.
- targetDate must be in YYYY-MM-DD format
- verification must match user's selections exactly
- Generate EXACTLY ${finalTargetCount} quests
- All text in Korean
- Progressive difficulty: early quests easier, later quests harder`
          },
          { 
            role: 'user', 
            content: JSON.stringify({
              goalType: input.goalType,
              goalTitle: input.goalTitle,
              collectedSlots: input.collectedSlots,
              userState: input.userState
            })
          }
        ]
      };
      
      console.log('[AI.QUEST] Request body:', JSON.stringify(requestBody, null, 2).substring(0, 500) + '...');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(requestBody)
      });

      console.log('[AI.QUEST] 📥 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI.QUEST] ❌ API error:', response.status, errorText);
        return [];
      }

      const data = await response.json();
      console.log('[AI.QUEST] 📦 Response data:', JSON.stringify(data).substring(0, 200) + '...');
      
      const content = data.choices?.[0]?.message?.content || '{}';
      console.log('[AI.QUEST] 📄 Raw content:', content.substring(0, 500) + '...');
      
      try {
        // Parse JSON (response_format: json_object ensures valid JSON)
        const parsed = JSON.parse(content);
        console.log('[AI.QUEST] 🔍 Parsed structure:', Object.keys(parsed));
        
        // Extract quests array
        let quests = parsed.quests || parsed; // Support both {quests: [...]} and direct array
        if (!Array.isArray(quests)) {
          console.error('[AI.QUEST] ❌ Response is not an array:', typeof quests);
          return [];
        }
        
        console.log('[AI.QUEST] ✅ Successfully parsed', quests.length, 'quests');
        console.log('[AI.QUEST] 📊 Target was:', finalTargetCount, 'quests');
        
        // === E16. VALIDATION: Check output count ===
        if (quests.length !== finalTargetCount) {
          console.warn('[AI.QUEST] ⚠️ WARNING: Quest count mismatch!');
          console.warn('[AI.QUEST] Expected:', finalTargetCount, 'Got:', quests.length);
        }
        
        // Validate each quest has required fields
        const validQuests = quests.filter((q: any, idx: number) => {
          const hasId = q.id && typeof q.id === 'string';
          const hasTitle = q.title && typeof q.title === 'string';
          const hasTargetDate = q.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(q.targetDate);
          const hasVerification = Array.isArray(q.verification) && q.verification.length > 0;
          
          if (!hasId || !hasTitle || !hasTargetDate || !hasVerification) {
            console.warn(`[AI.QUEST] ⚠️ Quest ${idx + 1} missing required fields:`, {
              hasId, hasTitle, hasTargetDate, hasVerification, quest: q
            });
            return false;
          }
          return true;
        });
        
        console.log('[AI.QUEST] ✅ Valid quests:', validQuests.length, '/', quests.length);
        console.log('[AI.QUEST] 📝 First quest preview:', validQuests[0]);
        
        if (validQuests.length < quests.length) {
          console.warn('[AI.QUEST] ⚠️ Some quests were filtered out due to missing fields');
        }
        
        return validQuests;
      } catch (parseError) {
        console.error('[AI.QUEST] ❌ Failed to parse quest JSON:', parseError);
        console.error('[AI.QUEST] Raw content that failed:', content);
        return [];
      }
    } catch (error) {
      console.error('[AI.QUEST] ❌ Quest generation failed with error:', error);
      if (error instanceof Error) {
        console.error('[AI.QUEST] Error message:', error.message);
        console.error('[AI.QUEST] Error stack:', error.stack);
      }
      return [];
    }
  }

  /**
   * Propose a default schedule from partial inputs
   */
  static async proposeSchedule(input: {
    frequency?: { count: number; unit: 'per_day'|'per_week'|'per_month' };
    duration?: { type: 'days'|'weeks'|'months'|'range'; value?: number; startDate?: string; endDate?: string };
    notes?: string;
  }): Promise<{ weeklyWeekdays: number[]; weeklyTimeSettings: { [key: number]: string[] }; followUpQuestion?: string }> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[AI] proposeSchedule: missing API key; fail-closed with follow-up.');
      }
      return Promise.resolve({ weeklyWeekdays: [], weeklyTimeSettings: {}, followUpQuestion: '원하는 시간대를 알려주세요 (예: 06:00 또는 19:00)' });
    }
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          messages: [
            { role: 'system', content: 'STRICT JSON ONLY. Output exactly: {"weeklyWeekdays": number[], "weeklyTimeSettings": { [dayIndex:number]: string[] }, "followUpQuestion"?: string}. CRITICAL RULES: - NEVER map vague phrases like "morning" to "07:00" or "evening" to "19:00" - NEVER do keyword-based time mapping - Preserve explicit user times exactly as provided - If user input is vague or ambiguous, ask EXACTLY ONE concise followUpQuestion instead of guessing - Use 24h HH:MM format for any times - Weekday indices: 0=Sun..6=Sat - JSON only, no code fences or explanations' },
            { role: 'user', content: JSON.stringify({ ...input, timezone: 'Asia/Seoul', locale: 'ko-KR' }) }
          ]
        })
      });
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      let parsed: any = {};
      try {
        let txt = content.trim().replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```\s*$/i, '').trim();
        const first = txt.indexOf('{'); const last = txt.lastIndexOf('}'); if (first !== -1 && last !== -1 && last > first) txt = txt.slice(first, last + 1);
        parsed = JSON.parse(txt);
      } catch {}
      const ww = Array.isArray(parsed.weeklyWeekdays) ? parsed.weeklyWeekdays.map((n: any) => Number(n)).filter((n: any) => !Number.isNaN(n)) : [];
      const wts = parsed.weeklyTimeSettings && typeof parsed.weeklyTimeSettings === 'object' ? parsed.weeklyTimeSettings : {};
      if (ww.length && Object.keys(wts).length) return { weeklyWeekdays: ww, weeklyTimeSettings: wts, followUpQuestion: parsed.followUpQuestion };
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[AI] proposeSchedule: model returned insufficient data; fail-closed with follow-up.');
      }
      return { weeklyWeekdays: [], weeklyTimeSettings: {}, followUpQuestion: 'Please let us know your preferred time slot (e.g., 6:00 a.m. or 7:00 p.m.). ' };
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[AI] proposeSchedule: AI failed; not saving. Please answer the follow-up.');
      }
      return { weeklyWeekdays: [], weeklyTimeSettings: {}, followUpQuestion: 'Please let us know your preferred time slot (e.g., 6:00 a.m. or 7:00 p.m.). ' };
    }
  }

  /**
   * Explain success criteria under current verification and schedule context
   */
  static async explainSuccessCriteria(ctx: {
    title?: string;
    verificationMethods?: VerificationType[];
    weeklyWeekdays?: number[];
    weeklyTimeSettings?: { [key: string]: string[] } | { [key: number]: string[] };
    includeDates?: string[];
    excludeDates?: string[];
    targetLocationName?: string;
  }): Promise<{ summary: string }> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    const allowed: VerificationType[] = ['location','time','screentime','photo','manual'];
    const safeMethods = (ctx.verificationMethods || []).filter(m => (allowed as string[]).includes(m as any));

    const heuristic = () => {
      const parts: string[] = [];
      const has = new Set(safeMethods);
      const days = (ctx.weeklyWeekdays || []).map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]);
      const hasTimes = Object.values(ctx.weeklyTimeSettings || {}).some((arr: any) => Array.isArray(arr) && arr.length > 0);
      if (has.has('time' as any) && hasTimes) {
        const sampleSlots: string[] = [];
        Object.entries(ctx.weeklyTimeSettings || {}).forEach(([k, list]: any) => {
          (list || []).forEach((t: string) => {
            if (sampleSlots.length < 6) sampleSlots.push(`${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][Number(k)]} ${t}`);
          });
        });
        const slotPreview = sampleSlots.length ? ` (e.g., ${sampleSlots.join(', ')}${sampleSlots.length >= 6 ? '…' : ''})` : '';
        const extras: string[] = [];
        if (has.has('location' as any)) extras.push('Location');
        if (has.has('photo' as any)) extras.push('Photo');
        if (has.has('screentime' as any)) extras.push('Screen Time');
        if (extras.length) parts.push(`At scheduled times${slotPreview}: ${extras.join(' + ')} verification will run.`);
        else parts.push(`At scheduled times${slotPreview}: Time-based verification will run.`);
      }
      if (has.has('manual' as any)) {
        const dayList = days.length ? ` (${days.join(', ')})` : '';
        parts.push(`On selected days${dayList}: Manual check-in is required.`);
      }
      if (has.has('location' as any)) {
        const loc = ctx.targetLocationName ? ` at "${ctx.targetLocationName}"` : '';
        parts.push(`Be present${loc} during scheduled sessions; your location will be verified.`);
      }
      if (has.has('photo' as any)) {
        parts.push('Capture and upload a photo as proof when prompted.');
      }
      if (has.has('screentime' as any)) {
        parts.push('Your app/screen usage will be checked against your goal.');
      }
      const summary = parts.length ? parts.join(' ') : 'Configure schedule and select verification methods to see success conditions.';
      return { summary };
    };

    if (!apiKey) return Promise.resolve(heuristic());

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          messages: [
            { role: 'system', content: 'You are an assistant that writes one concise sentence explaining how the user will succeed at verification given the goal and current verification methods and schedule. Keep it actionable and concrete. English only.' },
            { role: 'user', content: JSON.stringify({
              title: ctx.title,
              methods: safeMethods,
              weeklyWeekdays: ctx.weeklyWeekdays,
              weeklyTimeSettings: ctx.weeklyTimeSettings,
              includeDates: ctx.includeDates,
              excludeDates: ctx.excludeDates,
              targetLocationName: ctx.targetLocationName
            }) }
          ]
        })
      });
      if (!response.ok) return heuristic();
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const summary = (content || '').trim();
      if (!summary) return heuristic();
      return { summary };
    } catch {
      return heuristic();
    }
  }

  /**
   * Evaluate whether schedule is sufficient to move to Review
   */
  static evaluateScheduleReadiness(ctx: {
    startDateISO?: string | null;
    endDateISO?: string | null;
    weeklyWeekdays?: number[];
    includeDates?: string[];
    excludeDates?: string[];
    verificationMethods?: VerificationType[];
    targetLocationName?: string;
    goalSpec?: GoalSpec | null;
    calendarEvents?: any[];
    goalType?: 'schedule' | 'frequency' | 'milestone';
  }): { ready: boolean; reasons: string[]; suggestions: string[] } {
    const reasons: string[] = [];
    const suggestions: string[] = [];
    
    // Frequency Goal과 Milestone Goal은 스케줄 검증을 스킵
    if (ctx.goalType === 'frequency' || ctx.goalType === 'milestone') {
      return { ready: true, reasons: [], suggestions: [] };
    }
    
    const start = ctx.startDateISO ? new Date(ctx.startDateISO) : null;
    const end = ctx.endDateISO ? new Date(ctx.endDateISO) : null;
    if (!start || !end || end < start) {
      reasons.push('Please select a valid duration (start and end date).');
      suggestions.push('Set your start date and duration above.');
      return { ready: false, reasons, suggestions };
    }
    const weekly = new Set(ctx.weeklyWeekdays || []);
    const include = new Set(ctx.includeDates || []);
    const exclude = new Set(ctx.excludeDates || []);
    
    // Enhanced schedule evaluation with partial week handling
    let scheduleReady = false;
    let scheduleReasons: string[] = [];
    let scheduleSuggestions: string[] = [];
    
    if (ctx.goalSpec?.schedule?.countRule?.unit === 'per_week') {
      // For per_week goals, implement partial week logic
      const countRule = ctx.goalSpec.schedule.countRule;
      const weekBoundary = ctx.goalSpec.schedule.weekBoundary || 'startWeekday';
      const enforcePartialWeeks = ctx.goalSpec.schedule.enforcePartialWeeks || false;
      
      // Helper functions for window partitioning
      const getWeekStartDate = (date: Date, boundary: string): Date => {
        const result = new Date(date);
        if (boundary === 'isoWeek') {
          // ISO week: Monday = 1, Sunday = 0 -> adjust to Monday start
          const dayOfWeek = result.getDay();
          const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          result.setDate(result.getDate() + daysToMonday);
        } else {
          // startWeekday: use the startDate as-is (no adjustment)
        }
        result.setHours(0, 0, 0, 0);
        return result;
      };
      
      const addDays = (date: Date, days: number): Date => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
      };
      
      // Partition date range into 7-day windows
      const windows: { start: Date; end: Date; activeDays: number; isPartial: boolean }[] = [];
      
      let windowStart = getWeekStartDate(start, weekBoundary);
      if (weekBoundary === 'startWeekday') {
        // For startWeekday, first window starts at actual startDate
        windowStart = new Date(start);
        windowStart.setHours(0, 0, 0, 0);
      }
      
      while (windowStart <= end) {
        const windowEnd = addDays(windowStart, 6);
        
        // Calculate active days in this window (intersection with [startDate..endDate])
        const actualStart = windowStart < start ? start : windowStart;
        const actualEnd = windowEnd > end ? end : windowEnd;
        
        if (actualStart <= actualEnd) {
          const activeDays = Math.floor((actualEnd.getTime() - actualStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
          const isPartial = activeDays < 7;
          
          windows.push({
            start: actualStart,
            end: actualEnd,
            activeDays,
            isPartial
          });
        }
        
        windowStart = addDays(windowStart, 7);
      }
      
      // Check if schedule can satisfy count rule from first full window onward
      let hasFullWindow = false;
      let firstFullWindowSatisfies = false;
      
      for (let i = 0; i < windows.length; i++) {
        const window = windows[i];
        
        if (!window.isPartial) {
          hasFullWindow = true;
          
          // Count feasible slots in this full window
          let feasibleSlots = 0;
          for (let d = new Date(window.start); d <= window.end; d.setDate(d.getDate() + 1)) {
            const ds = this.formatLocalDate(d);
            const base = weekly.has(d.getDay());
            const isScheduled = (base && !exclude.has(ds)) || include.has(ds);
            if (isScheduled) {
              feasibleSlots++;
            }
          }
          
          // Check if this window satisfies the count rule
          const operator = countRule.operator as string;
          const required = Number(countRule.count || 0);
          let satisfies = false;
          
          if (operator === '>=') {
            satisfies = feasibleSlots >= required;
          } else if (operator === '==') {
            satisfies = feasibleSlots === required;
          } else if (operator === '<=') {
            satisfies = feasibleSlots <= required;
          } else if (operator === '<') {
            satisfies = feasibleSlots < required;
          }
          
          if (satisfies) {
            firstFullWindowSatisfies = true;
            break;
          }
        }
      }
      
      // Determine schedule readiness
      if (hasFullWindow) {
        if (firstFullWindowSatisfies) {
          scheduleReady = true;
        } else {
          scheduleReasons.push(`Weekly schedule must provide at least ${countRule.count} scheduled days per full week.`);
          scheduleSuggestions.push(`Adjust your weekly schedule to include at least ${countRule.count} days per week.`);
        }
      } else {
        // No full windows - check if any days are scheduled at all
        let anyScheduled = false;
        const calendarEventDates = new Set((ctx.calendarEvents || []).map(e => e.date));
        
        // Debug logging for date matching
        if (__DEV__ && calendarEventDates.size > 0) {
        }
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const ds = this.formatLocalDate(d);
          const base = weekly.has(d.getDay());
          const isScheduled = (base && !exclude.has(ds)) || include.has(ds) || calendarEventDates.has(ds);
          
          // Debug logging for first few dates
          if (__DEV__ && !anyScheduled) {
          }
          
          if (isScheduled) {
            anyScheduled = true;
            break;
          }
        }
        
        if (anyScheduled) {
          scheduleReady = true;
          scheduleReasons.push('Partial weeks do not enforce weekly minimums; schedule is ready for partial week tracking.');
        } else {
          scheduleReasons.push('No scheduled days yet.');
          scheduleSuggestions.push('Select weekdays and/or tap days on the calendar to schedule.');
        }
      }
    } else {
      // For non-per_week goals, use simple schedule check
      let scheduled = 0;
      const calendarEventDates = new Set((ctx.calendarEvents || []).map(e => e.date));
      
      // Debug logging for date matching
      if (__DEV__ && calendarEventDates.size > 0) {
      }
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ds = this.formatLocalDate(d);
        const base = weekly.has(d.getDay());
        const isScheduled = (base && !exclude.has(ds)) || include.has(ds) || calendarEventDates.has(ds);
        
        // Debug logging for first few dates
        if (__DEV__ && scheduled < 3) {
        }
        
        if (isScheduled) { 
          scheduled++; 
          if (__DEV__) {
          }
          if (scheduled > 0) break; 
        }
      }
      
      if (scheduled > 0) {
        scheduleReady = true;
      } else {
        scheduleReasons.push('No scheduled days yet.');
        scheduleSuggestions.push('Select weekdays and/or tap days on the calendar to schedule.');
      }
    }
    
    // Add schedule-related reasons and suggestions
    reasons.push(...scheduleReasons);
    suggestions.push(...scheduleSuggestions);

    // Verification checks
    const methods = new Set(ctx.verificationMethods || []);
    if (methods.size === 0) {
      reasons.push('No verification methods selected.');
      suggestions.push('Select at least one verification method (e.g., Manual, Time, Location).');
    }
    if (methods.has('location' as any) && !ctx.targetLocationName) {
      reasons.push('Location verification is selected, but no target location is set.');
      suggestions.push('Choose a target location in Schedule or Review.');
    }

    // Final readiness check - schedule must be ready for per_week goals
    const ready = reasons.length === 0 && (ctx.goalSpec?.schedule?.countRule?.unit !== 'per_week' || scheduleReady);
    return { ready, reasons, suggestions };
  }

  /**
   * Continue goal refinement with follow-up questions
   */
  static async continueGoalRefinement(context: AIContext, userAnswer: string): Promise<AIGoal> {
    console.time('[AI] Goal Refinement Total');
    
    const proxyUrl = process.env.EXPO_PUBLIC_AI_PROXY_URL;
    
    try {
      if (proxyUrl) {
        return await this.generateWithProxy(proxyUrl, userAnswer);
      }

      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
      if (apiKey) {
        // Refinement with context: include conversation history and partialGoal
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            messages: [
              { role: 'system', content: 'Output JSON only with fields: {"title":string,"category":string,"verificationMethods":string[],"mandatoryVerificationMethods"?:string[],"frequency":{ "count":number, "unit":"per_day"|"per_week"|"per_month" },"duration":{ "type":"days"|"weeks"|"months"|"range","value"?:number,"startDate"?:string,"endDate"?:string },"notes"?:string,"targetLocation"?:{ "name":string },"needsWeeklySchedule"?:boolean,"weeklySchedule"?:{ [weekdayName:string]: string },"weeklyWeekdays"?:number[],"weeklyTimeSettings"?:{ [dayIndex:number]: string[] },"includeDates"?:string[],"excludeDates"?:string[],"missingFields"?:string[],"followUpQuestion"?:string }. Rules: 1) If time-of-day is vague, map: morning→"07:00", before work→"07:00", lunchtime→"12:00", evening/after work→"19:00", night→"21:00". 2) Use 24h HH:MM, local timezone. 3) If schedule can be inferred, fill needsWeeklySchedule, weeklyWeekdays and weeklyTimeSettings. 4) If something is truly missing, set missingFields and provide EXACTLY ONE concise followUpQuestion. 5) Prefer proposing defaults.' },
              ...(Array.isArray((context as any).conversationHistory) ? (context as any).conversationHistory : []),
              { role: 'system', content: `Current partialGoal JSON: ${JSON.stringify((context as any).partialGoal || {})}. Fill only missing/ambiguous fields.` },
              { role: 'user', content: JSON.stringify({ prompt: userAnswer, timezone: 'Asia/Seoul', locale: 'ko-KR' }) }
            ]
          })
        });
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '{}';
        const parsed = (() => {
          let txt = (content || '').trim();
          try {
            txt = txt.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```\s*$/i, '').trim();
            const first = txt.indexOf('{');
            const last = txt.lastIndexOf('}');
            if (first !== -1 && last !== -1 && last > first) txt = txt.slice(first, last + 1);
            return JSON.parse(txt);
          } catch { return {}; }
        })();
        return this.validateAndNormalizeAIGoal(parsed);
      }

      // Fallback to local heuristic with context
      return this.generateWithLocalHeuristic(userAnswer);
    } finally {
      console.timeEnd('[AI] Goal Refinement Total');
    }
  }

  /**
   * Generate goal using OpenAI ChatGPT with timeout and retry
   */
  private static async generateWithOpenAI(apiKey: string, prompt: string): Promise<any> {
    console.time('[AI] OpenAI Generation');
    const safeParse = (raw: string) => {
      let txt = (raw || '').trim();
      try {
        txt = txt.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```\s*$/i, '').trim();
        const first = txt.indexOf('{');
        const last = txt.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) txt = txt.slice(first, last + 1);
        return JSON.parse(txt);
      } catch {
        return {};
      }
    };
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: 'Return ONLY JSON with shape {"weeklyWeekdays": number[], "weeklyTimeSettings": { [dayIndex:number]: string[] }, "followUpQuestion"?: string}. Use Asia/Seoul. If morning/before work, use 07:00; evening/after work, use 19:00; else propose reasonable times. Prefer defaults over questions; include at most one concise followUpQuestion only if absolutely necessary.' },
            { role: 'user', content: JSON.stringify({ prompt, timezone: 'Asia/Seoul', locale: 'ko-KR' }) }
          ]
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw createCatalogError('AI_RATE_LIMIT');
        } else if (response.status >= 500) {
          throw createCatalogError('AI_SERVICE_UNAVAILABLE');
        } else {
          throw createCatalogError('AI_PARSE_ERROR', new Error(`OpenAI API error: ${response.status}`));
        }
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = safeParse(content);
      return parsed;
    } catch (error) {
      console.error('[AI] OpenAI generation failed, falling back to heuristic:', error);
      // Check if error is recoverable, otherwise re-throw
      if (!(error as any).catalogKey) {
        throw error;
      }
      return this.generateWithLocalHeuristic(prompt);
    } finally {
      console.timeEnd('[AI] OpenAI Generation');
    }
  }

  /**
   * Refine goal with ChatGPT using conversation context
   */
  // Removed direct ChatGPT refinement path for the same reason.

  /**
   * Perform ChatGPT API request with timeout and enhanced error handling
   */
  // Removed performChatGPTRequest: network calls must go through a server proxy.

  /**
   * Generate goal using proxy endpoint
   */
  private static async generateWithProxy(proxyUrl: string, prompt: string): Promise<AIGoal> {
    console.time('[AI] Proxy Generation');
    
    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          type: 'goal_generation'
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw createCatalogError('AI_RATE_LIMIT');
        } else if (response.status >= 500) {
          throw createCatalogError('AI_SERVICE_UNAVAILABLE');
        } else {
          throw createCatalogError('AI_PARSE_ERROR', new Error(`Proxy API error: ${response.status}`));
        }
      }

      const data = await response.json();
      return this.validateAndNormalizeAIGoal(data);

    } catch (error) {
      console.error('[AI] Proxy generation failed:', error);
      // Re-throw with catalog error if not already cataloged
      if (!(error as any).catalogKey) {
        throw createCatalogError('AI_PARSE_ERROR', error);
      }
      throw error;
    } finally {
      console.timeEnd('[AI] Proxy Generation');
    }
  }

  /**
   * Local heuristic fallback for goal generation
   */
  private static generateWithLocalHeuristic(prompt: string): AIGoal {
    console.time('[AI] Local Heuristic');
    
    try {
      const lowerPrompt = prompt.toLowerCase();
      const today = new Date().toISOString().split('T')[0];
      
      // Apply new classification rules:
      // 1. 구체적인 요일/날짜/시각이 있으면 → Schedule
      // 2. 기간 + 횟수 패턴이 있으면 → Frequency  
      // 3. 큰 성취/단계적 성취라면 → Milestone
      
      // 1. Schedule: 요일 AND 시간이 모두 있는 경우
      const hasWeekday = /(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/.test(lowerPrompt);
      const hasSpecificTime = /(\d{1,2}:\d{2}|\d{1,2}시|\d+am|\d+pm|오전|오후|아침|저녁|at\s+\d+)/.test(lowerPrompt);
      const hasSpecificDayTime = hasWeekday && hasSpecificTime;
      
      // 2. Frequency: 횟수 패턴 (주/일/월 + 숫자)
      const hasFrequencyPattern = /(\d+)\s*(times?|x|회)\s*(?:a\s+|per\s+|당\s*)?(?:day|daily|week|weekly|month|monthly|일|주|달|월)/.test(lowerPrompt) ||
                                 /주\s*\d+\s*회/.test(lowerPrompt) || 
                                 /일주일에\s*\d+/.test(lowerPrompt) ||
                                 /한\s*달에\s*\d+/.test(lowerPrompt);
      
      // 3. Milestone: 큰 성취/단계적 성취 (~하기, 키워드, 긴 텍스트)
      const isBigAchievement = /하기$/.test(prompt.trim()) || 
                              /\b(milestone|phase|stage|project|startup|학습|유학|창업|완성|달성|learn|study|complete|achieve)\b/.test(lowerPrompt) ||
                              (prompt.trim().length > 8 && !hasFrequencyPattern && !hasSpecificDayTime);
      
      console.log('[AI] Classification analysis:', {
        hasSpecificDayTime,
        hasFrequencyPattern, 
        isBigAchievement,
        prompt: lowerPrompt.substring(0, 50)
      });
      
      // Extract basic information
      let title = prompt.charAt(0).toUpperCase() + prompt.slice(1);
      let category = this.autoAssignCategory(title, []);
      let verificationMethods: string[] = ['manual'];
      let mandatoryVerificationMethods: string[] = [];
      let frequency: { count: number; unit: 'per_day' | 'per_week' | 'per_month' } = { count: 1, unit: 'per_day' };
      let missingFields: string[] = [];
      let followUpQuestion = '';

      // Detect verification methods
      // Strong signals for location-required goals
      const locationKeywords = [
        'gym','pool','swim','track','stadium','field','court','park','library','studio','dojo','office','workplace','store','market','supermarket','cafe','coffee','coffeeshop','restaurant','campus','school','classroom','church','mosque','temple','clinic','hospital','lab','coworking','beach','mountain','trail','museum','theater','cinema','range']
      const movementVerbs = ['go to','visit','attend','at the','to the','head to','commute','drive to','walk to'];
      const outdoorActivities = ['run','jog','walk','hike','cycle','bike','swim','climb','skate','row','paddle'];

      const hasLocationKeyword = locationKeywords.some(k => lowerPrompt.includes(k));
      const hasMovementVerb = movementVerbs.some(k => lowerPrompt.includes(k));
      const hasOutdoorActivity = outdoorActivities.some(k => new RegExp(`\\b${k}\\b`).test(lowerPrompt));
      if (hasLocationKeyword || hasMovementVerb || hasOutdoorActivity) {
        verificationMethods.push('location');
        if (!missingFields.includes('targetLocation')) missingFields.push('targetLocation');
        // Location is suggested; mandatory only if clear place requirement is explicit
        if (hasLocationKeyword) {
          mandatoryVerificationMethods.push('location');
        }
      }

      if (lowerPrompt.includes('time') || lowerPrompt.includes('am') || 
          lowerPrompt.includes('pm') || /\d+:\d+/.test(lowerPrompt) ||
          lowerPrompt.includes('schedule') || lowerPrompt.includes('morning') ||
          lowerPrompt.includes('evening') || lowerPrompt.includes('night') ||
          lowerPrompt.includes('daily') || lowerPrompt.includes('weekly') ||
          lowerPrompt.includes('hour') || lowerPrompt.includes('o\'clock')) {
        verificationMethods.push('time');
      }

      if (lowerPrompt.includes('screen') || lowerPrompt.includes('app') || 
          lowerPrompt.includes('computer') || lowerPrompt.includes('phone')) {
        verificationMethods.push('screentime');
      }

      // Photo-based proof detection
      if (lowerPrompt.includes('photo') || lowerPrompt.includes('picture') || lowerPrompt.includes('selfie') ||
          lowerPrompt.includes('image') || lowerPrompt.includes('snapshot') || lowerPrompt.includes('upload') ||
          lowerPrompt.includes('before and after') || lowerPrompt.includes('before/after') ||
          lowerPrompt.includes('receipt') || lowerPrompt.includes('meal') ||
          lowerPrompt.includes('인증') || lowerPrompt.includes('인증샷') || lowerPrompt.includes('사진') || lowerPrompt.includes('찍')) {
        verificationMethods.push('photo');
        mandatoryVerificationMethods.push('photo');
      }

      // Extract frequency - fixed to handle "3 times a week" and "3 times per week" patterns
      const frequencyMatch = lowerPrompt.match(/(\d+)\s*(times?|x)\s*(?:a\s+|per\s+)?(day|daily|week|weekly|month|monthly)/);
      console.log('[AI] Frequency extraction analysis:', {
        lowerPrompt: lowerPrompt.substring(0, 100),
        frequencyMatch: frequencyMatch,
        regexPattern: '/(\\d+)\\s*(times?|x)\\s*(?:a\\s+|per\\s+)?(day|daily|week|weekly|month|monthly)/'
      });
      
      if (frequencyMatch) {
        const count = parseInt(frequencyMatch[1]);
        const period = frequencyMatch[3]; // Changed from [4] to [3] because "a" is now non-capturing
        
        console.log('[AI] Frequency match details:', {
          count,
          period,
          fullMatch: frequencyMatch[0],
          groups: frequencyMatch.slice(1)
        });
        
        if (period.includes('day')) {
          frequency = { count, unit: 'per_day' };
        } else if (period.includes('week')) {
          frequency = { count, unit: 'per_week' };
        } else if (period.includes('month')) {
          frequency = { count, unit: 'per_month' };
        }
        
        console.log('[AI] Final frequency object:', frequency);
      } else {
        console.log('[AI] No frequency match found, adding to missing fields');
        missingFields.push('frequency');
      }

      // Check for duration; for ambiguous/short prompts, require dates instead of defaulting
      const looksAmbiguous = prompt.trim().length < 5 && !/\d/.test(lowerPrompt);
      const mentionsTimeOrPeriod = /\b(week|month|day|daily|weekly|for|am|pm|\d+:\d+)\b/.test(lowerPrompt);
      if (!mentionsTimeOrPeriod || looksAmbiguous) {
        missingFields.push('duration');
      }

      // Determine if weekly schedule is needed
      const needsWeeklySchedule = lowerPrompt.includes('week') || 
                                 lowerPrompt.includes('weekly') || 
                                 lowerPrompt.includes('monday') || 
                                 lowerPrompt.includes('tuesday') || 
                                 lowerPrompt.includes('wednesday') || 
                                 lowerPrompt.includes('thursday') || 
                                 lowerPrompt.includes('friday') || 
                                 lowerPrompt.includes('saturday') || 
                                 lowerPrompt.includes('sunday') ||
                                 (frequency.unit === 'per_week' && frequency.count > 1);

      // Extract specific day and time information for weekly schedule using Korean parsing
      let weeklySchedule: { [key: string]: string } = {};
      if (needsWeeklySchedule) {
        const koreanParse = parseKoreanSchedule(prompt);
        
        // If Korean parsing found weekdays and time, use them
        if (koreanParse.weekdays.length > 0 && koreanParse.timeRange.start) {
          const dayNameMap: Record<string, string> = {
            'mon': 'monday',
            'tue': 'tuesday', 
            'wed': 'wednesday',
            'thu': 'thursday',
            'fri': 'friday',
            'sat': 'saturday',
            'sun': 'sunday'
          };
          
          koreanParse.weekdays.forEach(weekday => {
            const dayName = dayNameMap[weekday];
            if (dayName && koreanParse.timeRange.start) {
              weeklySchedule[dayName] = koreanParse.timeRange.start;
            }
          });
        } else {
          // Fallback to original English patterns for backward compatibility
          const dayTimePatterns = [
            { day: 'monday', regex: /monday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
            { day: 'tuesday', regex: /tuesday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
            { day: 'wednesday', regex: /wednesday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
            { day: 'thursday', regex: /thursday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
            { day: 'friday', regex: /friday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
            { day: 'saturday', regex: /saturday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
            { day: 'sunday', regex: /sunday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
          ];

          // Check English patterns
          dayTimePatterns.forEach(({ day, regex }) => {
            const match = lowerPrompt.match(regex);
            if (match) {
              let hour = parseInt(match[1]);
              const minute = match[2] ? parseInt(match[2]) : 0;
              const ampm = match[3]?.toLowerCase();
              
              // Convert to 24-hour format
              if (ampm === 'pm' && hour !== 12) hour += 12;
              if (ampm === 'am' && hour === 12) hour = 0;
              
              const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
              weeklySchedule[day] = timeString;
            }
          });

          // Check for general time patterns without specific days
          if (Object.keys(weeklySchedule).length === 0) {
            const timeMatch = lowerPrompt.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
            if (timeMatch) {
              let hour = parseInt(timeMatch[1]);
              const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
              const ampm = timeMatch[3]?.toLowerCase();
              
              if (ampm === 'pm' && hour !== 12) hour += 12;
              if (ampm === 'am' && hour === 12) hour = 0;
              
              const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
              
              // If no specific days mentioned but weekly pattern exists, apply to common weekdays
              if (lowerPrompt.includes('week') || lowerPrompt.includes('weekly')) {
                weeklySchedule['monday'] = timeString;
                weeklySchedule['wednesday'] = timeString;
                weeklySchedule['friday'] = timeString;
              }
            }
          }
        }
      }

      // Generate follow-up question
      if (missingFields.length > 0) {
        const missing = missingFields.join(', ');
        followUpQuestion = `I need more information about: ${missing}. Could you provide these details?`;
      }

      // Build weekly indices/time arrays from weeklySchedule heuristic
      const weeklyWeekdays: number[] = [];
      const weeklyTimeSettings: Record<number, string[]> = {} as any;
      Object.entries(weeklySchedule || {}).forEach(([name, time]) => {
        const map: any = { sunday:0,sun:0, monday:1,mon:1, tuesday:2,tue:2,tues:2, wednesday:3,wed:3, thursday:4,thu:4,thurs:4, friday:5,fri:5, saturday:6,sat:6 };
        const idx = map[String(name).toLowerCase()];
        if (idx === undefined) return;
        const st = String(time).padStart(5, '0');
        if (!weeklyWeekdays.includes(idx)) weeklyWeekdays.push(idx);
        weeklyTimeSettings[idx] = Array.isArray(weeklyTimeSettings[idx]) ? weeklyTimeSettings[idx] : [];
        if (!weeklyTimeSettings[idx].includes(st)) weeklyTimeSettings[idx].push(st);
      });

      const goal: AIGoal = {
        title: title.length > 50 ? title.substring(0, 47) + '...' : title,
        category,
        verificationMethods: verificationMethods as any,
        mandatoryVerificationMethods: Array.from(new Set(mandatoryVerificationMethods)) as any,
        frequency,
        ...(mentionsTimeOrPeriod && !looksAmbiguous ? { duration: {
          type: 'weeks',
          value: 2,
          startDate: today,
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }} : {}),
        notes: prompt,
        missingFields: missingFields.length > 0 ? missingFields : undefined,
        followUpQuestion: followUpQuestion || undefined,
        needsWeeklySchedule,
        weeklySchedule,
      } as any;
      (goal as any).weeklyWeekdays = weeklyWeekdays.length ? weeklyWeekdays.sort() : undefined;
      (goal as any).weeklyTimeSettings = Object.keys(weeklyTimeSettings).length ? weeklyTimeSettings : undefined;

      console.log('[AI] Local heuristic result:', goal);
      return goal;

    } finally {
      console.timeEnd('[AI] Local Heuristic');
    }
  }

  /**
   * Validate and normalize AI goal response
   */
  private static validateAndNormalizeAIGoal(goalData: any): AIGoal {
    console.time('[AI] Goal Validation');
    
    try {
      const predefinedCategories = Categories;
      
      let category = goalData.category;
      if (!category || !predefinedCategories.includes(category)) {
        category = this.autoAssignCategory(goalData.title || '', goalData.verificationMethods || []);
      }

      const validated: AIGoal = {
        title: (goalData.title || 'New Goal').trim(),
        category,
        verificationMethods: Array.isArray(goalData.verificationMethods) 
          ? goalData.verificationMethods.filter((vm: string) => 
              ['location', 'time', 'screentime', 'photo', 'manual'].includes(vm)
            )
          : ['manual'],
        mandatoryVerificationMethods: Array.isArray(goalData.mandatoryVerificationMethods)
          ? goalData.mandatoryVerificationMethods.filter((vm: string) =>
              ['location', 'time', 'screentime', 'photo', 'manual'].includes(vm)
            )
          : undefined,
        frequency: this.validateFrequency(goalData.frequency),
        duration: this.validateDuration(goalData.duration),
        notes: (goalData.notes || goalData.description || '').trim(),
        targetLocation: goalData.targetLocation ? {
          name: (goalData.targetLocation.name || '').trim(),
          placeId: goalData.targetLocation.placeId,
          lat: typeof goalData.targetLocation.lat === 'number' ? goalData.targetLocation.lat : undefined,
          lng: typeof goalData.targetLocation.lng === 'number' ? goalData.targetLocation.lng : undefined
        } : undefined,
        missingFields: Array.isArray(goalData.missingFields) ? goalData.missingFields : undefined,
        followUpQuestion: goalData.followUpQuestion
      };

      // Normalize scheduling - accept weeklySchedule (name->time) or weeklyWeekdays + weeklyTimeSettings
      const dayNameToIndex: Record<string, number> = { sunday:0,sun:0, monday:1,mon:1, tuesday:2,tue:2,tues:2, wednesday:3,wed:3, thursday:4,thu:4,thurs:4, friday:5,fri:5, saturday:6,sat:6 };
      const sanitizeTime = (t: string) => {
        const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})/);
        if (!m) return undefined;
        let hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
        const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      };

      const ww: number[] = [];
      const wts: Record<number, string[]> = {};

      if (goalData.weeklySchedule && typeof goalData.weeklySchedule === 'object') {
        Object.entries(goalData.weeklySchedule).forEach(([name, time]) => {
          const idx = dayNameToIndex[String(name).toLowerCase()];
          if (idx === undefined) return;
          const st = sanitizeTime(String(time));
          if (!st) return;
          if (!ww.includes(idx)) ww.push(idx);
          wts[idx] = Array.isArray(wts[idx]) ? wts[idx] : [];
          if (!wts[idx].includes(st)) wts[idx].push(st);
        });
      }
      if (Array.isArray(goalData.weeklyWeekdays) && goalData.weeklyTimeSettings) {
        (goalData.weeklyWeekdays as any[]).forEach((idx: any) => {
          const di = Number(idx);
          if (Number.isNaN(di)) return;
          if (!ww.includes(di)) ww.push(di);
          const list = goalData.weeklyTimeSettings[di] || goalData.weeklyTimeSettings[String(di)] || [];
          const times = (Array.isArray(list) ? list : [list]).map((t: any) => sanitizeTime(String(t))).filter(Boolean) as string[];
          if (times.length) {
            wts[di] = Array.isArray(wts[di]) ? Array.from(new Set([...wts[di], ...times])) : times;
          }
        });
      }

      if (ww.length) {
        (validated as any).weeklyWeekdays = ww.sort();
        (validated as any).weeklyTimeSettings = wts;
      }

      // Validate required fields
      const requiredFields = ['title', 'category', 'verificationMethods', 'frequency'];
      const actualMissing = requiredFields.filter(field => {
        if (field === 'verificationMethods') return !validated.verificationMethods.length;
        if (field === 'frequency') return !validated.frequency.count || validated.frequency.count < 1;
        return !validated[field as keyof AIGoal];
      });

      // Check location requirement - NEVER drop 'location' from verificationMethods
      // If location is in methods but targetLocation.name is missing, add to missingFields
      if (validated.verificationMethods.includes('location') && !validated.targetLocation?.name) {
        actualMissing.push('targetLocation');
        // Ensure location stays in verificationMethods even if targetLocation is missing
        if (!validated.mandatoryVerificationMethods) {
          validated.mandatoryVerificationMethods = [];
        }
        if (!validated.mandatoryVerificationMethods.includes('location')) {
          validated.mandatoryVerificationMethods.push('location');
        }
      }

      if (actualMissing.length > 0) {
        validated.missingFields = actualMissing;
        if (!validated.followUpQuestion) {
          validated.followUpQuestion = `Please provide: ${actualMissing.join(', ')}`;
        }
      }

      console.log('[AI] Validated goal:', validated);
      return validated;

    } finally {
      console.timeEnd('[AI] Goal Validation');
    }
  }

  /**
   * Analyze verification methods using OpenAI (or heuristic) and return both selected and mandatory sets
   */
  static async analyzeVerificationMethods(input: { prompt: string; title?: string; targetLocationName?: string; placeId?: string | null; locale?: string; timezone?: string; userHints?: string; weeklyTimeSettings?: { [key: string]: string[] }; calendarEvents?: any[] }): Promise<{ methods: VerificationType[]; mandatory: VerificationType[]; usedFallback?: boolean }> {
    const proxyUrl = process.env.EXPO_PUBLIC_AI_PROXY_URL;
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    const allowed: VerificationType[] = ['location','time','screentime','photo','manual'];
    const payload = {
      prompt: input.prompt,
      title: input.title,
      targetLocationName: input.targetLocationName,
      placeId: input.placeId,
      locale: input.locale || 'ko-KR',
      timezone: input.timezone || 'Asia/Seoul',
      userHints: input.userHints,
      weeklyTimeSettings: input.weeklyTimeSettings,
      calendarEvents: input.calendarEvents
    };
    try {
      if (proxyUrl) {
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, type: 'verification_analysis' })
        });
        const data = await response.json();
        let methods = (Array.isArray(data.methods) ? data.methods.filter((m: string) => (allowed as string[]).includes(m)) : []) as VerificationType[];
        let mandatory = (Array.isArray(data.mandatory) ? data.mandatory.filter((m: string) => (allowed as string[]).includes(m)) : []) as VerificationType[];
        
        // Check for movement goals or fixed venue goals
        const isMovementGoal = /\b(run|jog|walk|hike|cycle|ride|swim|exercise|workout|fitness)\b/i.test(payload.prompt);
        const hasFixedVenue = payload.targetLocationName || payload.placeId;
        
        if (isMovementGoal || hasFixedVenue) {
          if (!methods.includes('location' as any)) methods = [...methods, 'location' as any];
          if (!mandatory.includes('location' as any)) mandatory = [...mandatory, 'location' as any];
        }
        
        // Enforce time/manual verification based on weeklyTimeSettings and calendarEvents
        const hasAnyTime = (() => {
          // Check weeklyTimeSettings
          const weeklyHasTime = payload.weeklyTimeSettings && Object.values(payload.weeklyTimeSettings).some(times => 
            Array.isArray(times) && times.some(time => time && time.trim() !== '')
          );
          
          // Check calendarEvents if available in payload
          const calendarHasTime = payload.calendarEvents && payload.calendarEvents.some(event => 
            event.time && event.time.trim() !== ''
          );
          
          return weeklyHasTime || calendarHasTime;
        })();
        
        // Determine required verification method based on time presence
        const requiredMethod = hasAnyTime ? 'time' : 'manual';
        
        // Use Set to avoid duplicates and ensure required method is included
        const methodsSet = new Set(methods);
        const mandatorySet = new Set(mandatory);
        
        // Add required method to both sets
        methodsSet.add(requiredMethod as any);
        mandatorySet.add(requiredMethod as any);
        
        // Convert back to arrays
        methods = Array.from(methodsSet);
        mandatory = Array.from(mandatorySet);
        
        console.log(`[AI] Proxy response: hasAnyTime=${hasAnyTime}, requiredMethod=${requiredMethod}, methods=${methods.join(',')}`);
        
        return { methods, mandatory };
      }

      if (apiKey) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0,
            messages: [
              { role: 'system', content: 'Return ONLY JSON with shape {"methods": string[], "mandatory": string[]}. Allowed values: ["location","time","screentime","photo","manual"]. HARD RULES: - If the goal implies a mobile activity without a fixed venue (run/jog/walk/hike/cycle/ride/swim/exercise/workout/fitness), include "location" in methods AND mandatory, but do NOT require a place. Mark the internal hint "location.mode":"movement". - If targetLocationName or placeId is provided OR the goal clearly requires a fixed place (gym/pool/library/cafe/office/studio/dojo/court/field/track/park/trail/clinic/hospital/학원/도장/캠퍼스/학교 등), include "location" in methods AND mandatory. Only require a place when "location.mode" is "geofence". - If the goal is digital/app usage (study app, coding app, watching videos, social media control, focus timer, IDE, browser), you MUST include "screentime" in methods AND in mandatory. - If the goal requires visual proof (meal logging, workout set evidence, artifact submission, bodyweight record), include "photo" in methods; set it mandatory when photo is the primary proof. - "time" is a scheduling trigger only, never sufficient as a standalone proof and must not be mandatory. - "manual" alone is insufficient for objective goals. Choose the minimal set required; mark as mandatory only when truly required. JSON ONLY, no prose.' },
              { role: 'user', content: JSON.stringify(payload) }
            ]
          })
        });
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '{}';
        const parsed = (() => {
          try {
            let txt = content.trim();
            txt = txt.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```\s*$/i, '').trim();
            const first = txt.indexOf('{');
            const last = txt.lastIndexOf('}');
            if (first !== -1 && last !== -1 && last > first) txt = txt.slice(first, last + 1);
            return JSON.parse(txt);
          } catch {
            return {};
          }
        })();
        let methods = (Array.isArray(parsed.methods) ? parsed.methods.filter((m: string) => (allowed as string[]).includes(m)) : []) as VerificationType[];
        let mandatory = (Array.isArray(parsed.mandatory) ? parsed.mandatory.filter((m: string) => (allowed as string[]).includes(m)) : []) as VerificationType[];
        
        // Check for movement goals or fixed venue goals
        const isMovementGoal = /\b(run|jog|walk|hike|cycle|ride|swim|exercise|workout|fitness)\b/i.test(payload.prompt);
        const hasFixedVenue = payload.targetLocationName || payload.placeId;
        
        if (isMovementGoal || hasFixedVenue) {
          if (!methods.includes('location' as any)) methods = [...methods, 'location' as any];
          if (!mandatory.includes('location' as any)) mandatory = [...mandatory, 'location' as any];
        }
        
        // Enforce time/manual verification based on weeklyTimeSettings and calendarEvents
        const hasAnyTime = (() => {
          // Check weeklyTimeSettings
          const weeklyHasTime = payload.weeklyTimeSettings && Object.values(payload.weeklyTimeSettings).some(times => 
            Array.isArray(times) && times.some(time => time && time.trim() !== '')
          );
          
          // Check calendarEvents if available in payload
          const calendarHasTime = payload.calendarEvents && payload.calendarEvents.some(event => 
            event.time && event.time.trim() !== ''
          );
          
          return weeklyHasTime || calendarHasTime;
        })();
        
        // Determine required verification method based on time presence
        const requiredMethod = hasAnyTime ? 'time' : 'manual';
        
        // Use Set to avoid duplicates and ensure required method is included
        const methodsSet = new Set(methods);
        const mandatorySet = new Set(mandatory);
        
        // Add required method to both sets
        methodsSet.add(requiredMethod as any);
        mandatorySet.add(requiredMethod as any);
        
        // Convert back to arrays
        methods = Array.from(methodsSet);
        mandatory = Array.from(mandatorySet);
        
        console.log(`[AI] OpenAI response: hasAnyTime=${hasAnyTime}, requiredMethod=${requiredMethod}, methods=${methods.join(',')}`);
        
        return { methods, mandatory };
      }

      // Heuristic fallback
      const heuristic = this.generateWithLocalHeuristic(payload.prompt);
      let methods = heuristic.verificationMethods as VerificationType[];
      let mandatory = (heuristic as any).mandatoryVerificationMethods || [];
      
      // Check for movement goals or fixed venue goals
      const isMovementGoal = /\b(run|jog|walk|hike|cycle|ride|swim|exercise|workout|fitness)\b/i.test(payload.prompt);
      const hasFixedVenue = payload.targetLocationName || payload.placeId;
      
      if (isMovementGoal || hasFixedVenue) {
        if (!methods.includes('location' as any)) methods = [...methods, 'location' as any];
        if (!mandatory.includes('location' as any)) mandatory = [...mandatory, 'location' as any];
      }
      return { methods, mandatory, usedFallback: true };
    } catch (error) {
      console.warn('[AI] analyzeVerificationMethods failed, using heuristic fallback:', error);
      const heuristic = this.generateWithLocalHeuristic(payload.prompt);
      let methods = heuristic.verificationMethods as VerificationType[];
      let mandatory = (heuristic as any).mandatoryVerificationMethods || [];
      
      // Check for movement goals or fixed venue goals
      const isMovementGoal = /\b(run|jog|walk|hike|cycle|ride|swim|exercise|workout|fitness)\b/i.test(payload.prompt);
      const hasFixedVenue = payload.targetLocationName || payload.placeId;
      
      if (isMovementGoal || hasFixedVenue) {
        if (!methods.includes('location' as any)) methods = [...methods, 'location' as any];
        if (!mandatory.includes('location' as any)) mandatory = [...mandatory, 'location' as any];
      }
      
      // Enforce time/manual verification based on weeklyTimeSettings and calendarEvents
      const hasAnyTime = (() => {
        // Check weeklyTimeSettings
        const weeklyHasTime = payload.weeklyTimeSettings && Object.values(payload.weeklyTimeSettings).some(times => 
          Array.isArray(times) && times.some(time => time && time.trim() !== '')
        );
        
        // Check calendarEvents if available in payload
        const calendarHasTime = payload.calendarEvents && payload.calendarEvents.some(event => 
          event.time && event.time.trim() !== ''
        );
        
        return weeklyHasTime || calendarHasTime;
      })();
      
      // Determine required verification method based on time presence
      const requiredMethod = hasAnyTime ? 'time' : 'manual';
      
      // Use Set to avoid duplicates and ensure required method is included
      const methodsSet = new Set(methods);
      const mandatorySet = new Set(mandatory);
      
      // Add required method to both sets
      methodsSet.add(requiredMethod as any);
      mandatorySet.add(requiredMethod as any);
      
      // Convert back to arrays
      methods = Array.from(methodsSet);
      mandatory = Array.from(mandatorySet);
      
      console.log(`[AI] Heuristic fallback: hasAnyTime=${hasAnyTime}, requiredMethod=${requiredMethod}, methods=${methods.join(',')}`);
      
      return { methods, mandatory, usedFallback: true };
    }
  }

  /**
   * Auto-assign category based on goal content
   */
  private static autoAssignCategory(title: string, verificationMethods: string[]): string {
    const lowerTitle = title.toLowerCase();
    
    if (/\b(gym|workout|exercise|run|walk|jog|fitness|sport|weight|muscle|cardio|yoga|swim|bike|marathon|training)\b/.test(lowerTitle)) {
      return 'Fitness';
    }
    
    if (/\b(health|water|sleep|meditation|diet|nutrition|vitamin|doctor|medical|wellness)\b/.test(lowerTitle)) {
      return 'Health';
    }
    
    if (/\b(work|project|task|productivity|focus|study|learn|read|book|skill|course|code|program)\b/.test(lowerTitle) ||
        verificationMethods.includes('screentime')) {
      return 'Productivity';
    }
    
    if (/\b(learn|study|education|school|course|lesson|language|practice|tutorial|research)\b/.test(lowerTitle)) {
      return 'Education';
    }
    
    if (/\b(career|job|professional|network|interview|resume|meeting|presentation|leadership)\b/.test(lowerTitle)) {
      return 'Career';
    }
    
    if (/\b(meditat|spiritual|pray|mindful|gratitude|journal|reflect|peace|zen)\b/.test(lowerTitle)) {
      return 'Spiritual';
    }
    
    return 'Personal';
  }

  /**
   * Validate and normalize frequency object
   */
  private static validateFrequency(frequency: any): { count: number; unit: 'per_day' | 'per_week' | 'per_month' } {
    if (!frequency || typeof frequency !== 'object') {
      return { count: 1, unit: 'per_day' };
    }
    
    const count = typeof frequency.count === 'number' && frequency.count > 0 ? frequency.count : 1;
    const validUnits = ['per_day', 'per_week', 'per_month'];
    const unit = validUnits.includes(frequency.unit) ? frequency.unit : 'per_day';
    
    return { count, unit };
  }

  /**
   * Validate and normalize duration object
   */
  private static validateDuration(duration: any): any {
    if (!duration || typeof duration !== 'object') {
      const today = new Date();
      return {
        type: 'range',
        startDate: today.toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
    }
    
    const validTypes = ['days', 'weeks', 'months', 'range'];
    if (!validTypes.includes(duration.type)) {
      duration.type = 'range';
    }
    
    return duration;
  }

  /**
   * Get example prompts for different goal categories
   */
  static getExamplePrompts(): string[] {
    return [
      // Fitness & Health - Location-based activities
      'Go to the gym 3 times a week',
      'Run 5km every morning at the park',
      'Practice yoga at the studio twice a week',
      'Swim at the community pool twice a week',
      'Walk 10,000 steps around the neighborhood daily',
      
      // Learning & Education - Location-based or trackable activities
      'Read at the library for 30 minutes daily',
      'Learn Spanish at the language center for 1 hour daily',
      'Practice piano at the music school for 45 minutes daily',
      'Study coding at the co-working space for 2 hours every weekend',
      'Write 500 words at the coffee shop daily',
      'Learn to cook 3 new recipes at home per week',
      'Practice drawing at the art studio for 1 hour daily',
      
      // Work & Productivity - Location-based activities
      'Complete 3 important tasks at the office daily',
      'Organize workspace at the office every Friday',
      'Network with 2 new people at business events weekly',
      'Update portfolio at the co-working space every month',
      
      // Personal Development - Location-based activities
      'Journal at the coffee shop for 15 minutes daily',
      'Call family members from home weekly',
      'Learn to play guitar at the music school for 1 hour daily',
      'Visit one new place monthly',
      'Volunteer at the community center 4 hours per month',
      'Practice public speaking at the club weekly',
      
      // Financial Goals - Location-based activities
      'Save $100 every week by visiting the bank',
      'Track all expenses using the mobile app daily',
      'Invest 10% of income at the investment office monthly',
      'Review budget at home every Sunday',
      'Cook meals at home 5 days a week',
      'Read one finance book at the library per month'
    ];
  }

  /**
   * Validate goal by CalendarEvent collection instead of weekly patterns
   * This replaces the weekly-based validation with event-based validation
   */
  static validateGoalByCalendarEvents(
    events: (CalendarEvent | Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>)[],
    goalSpec: GoalSpec,
    startDate: string,
    endDate: string,
    goalType?: 'schedule' | 'frequency' | 'milestone'
  ): ValidationResult {
    // Frequency Goal은 스케줄 검증을 스킵
    if (goalType === 'frequency') {
      return {
        isCompatible: true,
        issues: [],
        summary: 'Frequency Goal은 스케줄 검증을 건너뜁니다.',
        completeWeekCount: 0,
        validationDetails: {
          frequencyCheck: { passed: true, details: 'Frequency Goal으로 검증 스킵' },
          weekdayCheck: { passed: true, details: 'Frequency Goal으로 검증 스킵' },
          timeCheck: { passed: true, details: 'Frequency Goal으로 검증 스킵' }
        }
      };
    }

    // Milestone Goal도 스케줄 검증을 스킵
    if (goalType === 'milestone') {
      return {
        isCompatible: true,
        issues: [],
        summary: 'Milestone Goal은 스케줄 검증을 건너뜁니다.',
        completeWeekCount: 0,
        validationDetails: {
          frequencyCheck: { passed: true, details: 'Milestone Goal으로 검증 스킵' },
          weekdayCheck: { passed: true, details: 'Milestone Goal으로 검증 스킵' },
          timeCheck: { passed: true, details: 'Milestone Goal으로 검증 스킵' }
        }
      };
    }

    // 경계 규칙 1: 기간이 7일 미만이면 검증 스킵
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
    
    if (daysDiff < 7) {
      return {
        isCompatible: true,
        issues: [],
        summary: `기간이 7일 미만 (${daysDiff}일)이므로 검증을 건너뜁니다.`,
        completeWeekCount: 0,
        validationDetails: {
          frequencyCheck: { passed: true, details: '기간이 7일 미만으로 검증 스킵' },
          weekdayCheck: { passed: true, details: '기간이 7일 미만으로 검증 스킵' },
          timeCheck: { passed: true, details: '기간이 7일 미만으로 검증 스킵' }
        }
      };
    }
    
    
    // 타임존: Asia/Seoul 고정, 날짜 문자열은 YYYY-MM-DD
    const completeWeeks = sliceCompleteWeeks(startDate, endDate);
    
    if (completeWeeks.length === 0) {
      return {
        isCompatible: false,
        issues: ['기간 내에 완전한 주(7일)가 없습니다.'],
        summary: '완전한 주가 없어 검증할 수 없습니다.',
        completeWeekCount: 0,
        validationDetails: {
          frequencyCheck: { passed: false, details: '완전한 주가 없음' },
          weekdayCheck: { passed: false, details: '완전한 주가 없음' },
          timeCheck: { passed: false, details: '완전한 주가 없음' }
        }
      };
    }

    const result: ValidationResult = {
      isCompatible: true,
      issues: [],
      fixes: {},
      summary: 'Schedule validation completed',
      completeWeekCount: 0,
      validationDetails: {
        frequencyCheck: { passed: true, details: '' },
        weekdayCheck: { passed: true, details: '' },
        timeCheck: { passed: true, details: '' }
      }
    };

    try {
      // Get complete weeks using dateSlices utility
      const completeWeeks = sliceCompleteWeeks(startDate, endDate);
      result.completeWeekCount = completeWeeks.length;

      if (completeWeeks.length === 0) {
        result.isCompatible = false;
        result.issues.push('No complete weeks found in the date range');
        result.summary = 'Date range is too short to contain complete weeks';
        return result;
      }

      const schedule = goalSpec.schedule || {};
      const countRule = schedule.countRule || { operator: '>=', count: 1, unit: 'per_week' };
      const weekdayConstraints = schedule.weekdayConstraints || [];
      const timeRules = schedule.timeRules || {};

      // Validate each complete week
      for (let i = 0; i < completeWeeks.length; i++) {
        const week = completeWeeks[i];
        const weekStart = new Date(week.from);
        const weekEnd = new Date(week.to);
        
        // Get events for this week using local date comparison
        const weekEvents = events.filter(event => {
          const eventDate = new Date(event.date);
          const eventDateStr = this.formatLocalDate(eventDate);
          const weekStartStr = this.formatLocalDate(weekStart);
          const weekEndStr = this.formatLocalDate(weekEnd);
          return eventDateStr >= weekStartStr && eventDateStr <= weekEndStr;
        });


        // 1. Frequency validation
        if (countRule.unit === 'per_week') {
          // Count all events in this week regardless of source
          const totalCount = weekEvents.length;
          
          let frequencyPassed = false;
          const operator = countRule.operator as string;
          switch (operator) {
            case '>=':
              frequencyPassed = totalCount >= countRule.count;
              break;
            case '>':
              frequencyPassed = totalCount > countRule.count;
              break;
            case '==':
              frequencyPassed = totalCount === countRule.count;
              break;
            case '<=':
              frequencyPassed = totalCount <= countRule.count;
              break;
            case '<':
              frequencyPassed = totalCount < countRule.count;
              break;
            default:
              frequencyPassed = totalCount >= countRule.count;
          }

          if (!frequencyPassed) {
            result.isCompatible = false;
            result.issues.push(`Week ${i + 1} (${week.from} to ${week.to}): Frequency requirement not met. Expected ${countRule.operator} ${countRule.count}, got ${totalCount}`);
            result.validationDetails.frequencyCheck.passed = false;
            result.validationDetails.frequencyCheck.details += `Week ${i + 1}: ${totalCount}/${countRule.count} `;
          }
        }

        // 2. Weekday validation
        if (weekdayConstraints.length > 0) {
          const weekDays = new Set<number>();
          weekEvents.forEach(event => {
            const eventDate = new Date(event.date);
            weekDays.add(eventDate.getDay());
          });

          const missingDays = weekdayConstraints.filter(day => !weekDays.has(day));
          if (missingDays.length > 0) {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const missingDayNames = missingDays.map(day => dayNames[day]);
            result.isCompatible = false;
            result.issues.push(`Week ${i + 1}: Missing required weekdays: ${missingDayNames.join(', ')}`);
            result.validationDetails.weekdayCheck.passed = false;
            result.validationDetails.weekdayCheck.details += `Week ${i + 1}: Missing ${missingDayNames.join(', ')} `;
          }
        }

        // 3. Time validation
        if (Object.keys(timeRules).length > 0) {
          weekEvents.forEach(event => {
            if (event.time && event.source === 'weekly') {
              const eventDate = new Date(event.date);
              const dayOfWeek = eventDate.getDay();
              const dayTimeRules = (timeRules as Record<number, any[]>)[dayOfWeek] || [];
              
              if (dayTimeRules.length > 0) {
                const timeInMinutes = this.timeToMinutes(event.time);
                let timeValid = false;
                
                for (const rule of dayTimeRules) {
                  if (Array.isArray(rule) && rule.length === 2) {
                    const startMinutes = this.timeToMinutes(rule[0]);
                    const endMinutes = this.timeToMinutes(rule[1]);
                    
                    if (timeInMinutes >= startMinutes && timeInMinutes <= endMinutes) {
                      timeValid = true;
                      break;
                    }
                  }
                }
                
                if (!timeValid) {
                  result.isCompatible = false;
                  result.issues.push(`Week ${i + 1}: Time ${event.time} on ${this.getDayName(dayOfWeek)} is outside allowed ranges`);
                  result.validationDetails.timeCheck.passed = false;
                  result.validationDetails.timeCheck.details += `Week ${i + 1}: ${event.time} invalid `;
                }
              }
            }
          });
        }
      }

      // Generate summary
      if (result.issues.length === 0) {
        result.summary = `Schedule is compatible with goal requirements. ${completeWeeks.length} complete weeks validated.`;
      } else {
        result.summary = `Schedule has ${result.issues.length} issues across ${completeWeeks.length} complete weeks.`;
      }

      return result;
    } catch (error) {
      result.isCompatible = false;
      result.issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.summary = 'Validation failed due to an error';
      return result;
    }
  }

  /**
   * Helper: Convert time string to minutes since midnight
   */
  private static timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  /**
   * Helper: Get day name from day index
   */
  private static getDayName(dayIndex: number): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[dayIndex] || 'Unknown';
  }

  /**
   * Generate verification description based on schedule and verification methods
   */
  static generateVerificationDescription(input: {
    title: string;
    verificationMethods: VerificationType[];
    lockedVerificationMethods: VerificationType[];
    weeklySchedule?: { [key: string]: string[] };
    calendarEvents?: { date?: string; time?: string }[];
    targetLocation?: { name: string; address?: string };
    frequency?: { count: number; unit: string };
  }): string {
    const { 
      title, 
      verificationMethods, 
      lockedVerificationMethods, 
      weeklySchedule = {}, 
      calendarEvents = [],
      targetLocation,
      frequency
    } = input;

    const descriptions: string[] = [];

    // Time verification
    if (verificationMethods.includes('time')) {
      const hasTimeEvents = calendarEvents.some(e => e.time && e.time.trim() !== '');
      const hasWeeklyTime = Object.values(weeklySchedule).some(times => 
        Array.isArray(times) && times.some(time => time && time.trim() !== '')
      );

      if (hasTimeEvents || hasWeeklyTime) {
        const isLocked = lockedVerificationMethods.includes('time');
        descriptions.push(
          `⏰ **Time Verification${isLocked ? ' (Required)' : ''}**: ` +
          `You'll be verified at your scheduled times. ` +
          `The app will check if you're active during the specific time slots you've set.`
        );
      }
    }

    // Manual verification
    if (verificationMethods.includes('manual')) {
      const hasManualEvents = calendarEvents.some(e => !e.time || e.time.trim() === '');
      const hasWeeklyManual = Object.keys(weeklySchedule).length > 0 && 
        Object.values(weeklySchedule).some(times => !Array.isArray(times) || times.length === 0);

      if (hasManualEvents || hasWeeklyManual) {
        const isLocked = lockedVerificationMethods.includes('manual');
        descriptions.push(
          `📝 **Manual Verification${isLocked ? ' (Required)' : ''}**: ` +
          `You'll need to manually confirm completion of your goal activities. ` +
          `This is suitable for activities that don't require specific timing.`
        );
      }
    }

    // Location verification
    if (verificationMethods.includes('location') && targetLocation) {
      const isLocked = lockedVerificationMethods.includes('location');
      descriptions.push(
        `📍 **Location Verification${isLocked ? ' (Required)' : ''}**: ` +
        `You'll be verified by being at ${targetLocation.name} ` +
        `(within ~100m) for at least 10 minutes during your scheduled times.`
      );
    }

    // Photo verification
    if (verificationMethods.includes('photo')) {
      const isLocked = lockedVerificationMethods.includes('photo');
      descriptions.push(
        `📸 **Photo Verification${isLocked ? ' (Required)' : ''}**: ` +
        `You'll need to take a photo as proof of completing your goal activity.`
      );
    }

    // Screen time verification
    if (verificationMethods.includes('screentime')) {
      const isLocked = lockedVerificationMethods.includes('screentime');
      descriptions.push(
        `📱 **Screen Time Verification${isLocked ? ' (Required)' : ''}**: ` +
        `Your screen time usage will be monitored to verify goal completion.`
      );
    }

    // Frequency information
    if (frequency) {
      const unit = frequency.unit.replace('per_', '');
      descriptions.push(
        `\n📊 **Frequency**: ${frequency.count} times per ${unit}`
      );
    }

    // Schedule summary
    const totalEvents = calendarEvents.length;
    const weeklyDays = Object.keys(weeklySchedule).length;
    
    if (totalEvents > 0 || weeklyDays > 0) {
      descriptions.push(
        `\n📅 **Schedule**: ` +
        `${totalEvents > 0 ? `${totalEvents} calendar events` : ''}` +
        `${totalEvents > 0 && weeklyDays > 0 ? ' + ' : ''}` +
        `${weeklyDays > 0 ? `${weeklyDays} weekly recurring days` : ''}`
      );
    }

    return descriptions.join('\n\n');
  }
}