// AI-powered Quest Generator Service
// Converts goals into individual quests based on patterns

import { createCatalogError } from '../constants/errorCatalog';
import { Quest, QuestGenerationRequest, QuestGenerationResult, VerificationRule } from '../types/quest';
import { getLanguageAwareSystemPrompt, getLocaleConfig } from '../utils/languageDetection';
import { generateRequestId, logAIRequest, logAIResponse, PerformanceTimer } from '../utils/structuredLogging';

export class QuestGeneratorService {
  
  /**
   * Generate quests from a goal using AI analysis
   */
  static async generateQuestsFromGoal(request: QuestGenerationRequest): Promise<QuestGenerationResult> {
    const requestId = generateRequestId();
    const timer = new PerformanceTimer('quest_generation', requestId);
    
    console.log('[QuestGenerator] Starting quest generation for goal:', request.goalTitle);
    console.log('[QuestGenerator] Request details:', {
      goalId: request.goalId,
      goalTitle: request.goalTitle,
      goalType: request.goalType,
      duration: request.duration,
      schedule: request.schedule,
      verificationMethods: request.verificationMethods
    });
    
    try {
      console.log('[QuestGenerator] Getting locale configuration...');
      // Detect language for appropriate AI prompts
      const localeConfig = getLocaleConfig(request.goalTitle);
      console.log('[QuestGenerator] Locale config:', localeConfig);
      
      console.log('[QuestGenerator] Creating AI prompt...');
      // Create AI prompt for quest generation
      const questPrompt = this.createQuestGenerationPrompt(request, localeConfig);
      console.log('[QuestGenerator] Prompt created, length:', questPrompt.length);
      
      console.log('[QuestGenerator] Calling AI service...');
      // Call AI service to generate quest structure
      const aiResponse = await this.callAIForQuestGeneration(questPrompt, requestId);
      console.log('[QuestGenerator] AI response received, length:', aiResponse.length);
      console.log('[QuestGenerator] AI response preview:', aiResponse.substring(0, 200));
      
      // Parse AI response into quest objects
      const quests = this.parseAIResponseToQuests(aiResponse, request);
      
      // Generate final result
      const result: QuestGenerationResult = {
        goalType: request.goalType,
        quests,
        totalQuests: quests.length,
        schedule: request.schedule ? {
          duration: `${request.duration.startDate} to ${request.duration.endDate}`,
          pattern: this.describeSchedulePattern(request)
        } : undefined,
        metadata: {
          generatedAt: new Date().toISOString(),
          aiModel: 'gpt-4o-mini',
          confidence: 0.9
        }
      };
      
      logAIResponse({
        requestId,
        model: 'gpt-4o-mini',
        responseLength: JSON.stringify(quests).length,
        durationMs: timer.end(true),
        success: true,
        schemaValid: true,
        message: `Generated ${quests.length} quests successfully`
      });
      
      console.log('[GEN.END]', {
        totalGenerated: quests.length,
        goalType: request.goalType,
        goalTitle: request.goalTitle,
        frequencyDetails: request.goalType === 'frequency' ? {
          weeksCount: Math.ceil((new Date(request.duration.endDate).getTime() - new Date(request.duration.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)),
          perWeek: request.schedule?.frequency || 3
        } : undefined
      });
      
      console.log('[QuestGenerator] Generated', quests.length, 'quests for goal:', request.goalTitle);
      return result;
      
    } catch (error) {
      console.error('[QuestGenerator] Error generating quests:', error);
      console.error('[QuestGenerator] Request details:', {
        goalTitle: request.goalTitle,
        goalType: request.goalType,
        duration: request.duration,
        verificationMethods: request.verificationMethods,
        schedule: request.schedule
      });
      
      logAIResponse({
        requestId,
        model: 'gpt-4o-mini',
        responseLength: 0,
        durationMs: timer.end(false),
        success: false,
        schemaValid: false,
        message: `Failed to generate quests: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      // No fallback - AI-only quest generation
      console.log('[QuestGenerator] AI quest generation failed - no fallbacks available');
      throw createCatalogError('AI_QUEST_GENERATION_ERROR', error);
    }
  }
  
  /**
   * Create AI prompt for quest generation
   */
  private static createQuestGenerationPrompt(request: QuestGenerationRequest, localeConfig: any): string {
    console.log('[QuestGenerator] Creating prompt with request:', {
      goalTitle: request.goalTitle,
      goalType: request.goalType,
      duration: request.duration,
      schedule: request.schedule,
      verificationMethods: request.verificationMethods
    });

    const basePrompt = getLanguageAwareSystemPrompt(`
You are a Quest Generator AI. Your job is to break down goals into individual, actionable quests based on the goal's type, schedule, and verification methods.

GOAL ANALYSIS:
- Goal: "${request.goalTitle}"
- Description: "${request.goalDescription || 'No description'}"
- Type: ${request.goalType}
- Duration: ${request.duration.startDate} to ${request.duration.endDate}
- Original Goal Data: ${JSON.stringify(request.originalGoalData || {})}
- Verification Methods: ${request.verificationMethods.join(', ')}

        SCHEDULE INFORMATION:
        ${request.schedule ? `
        - Weekdays: ${request.schedule.weekdays ? request.schedule.weekdays.map(d => ['일','월','화','수','목','금','토'][d]).join(', ') : 'Not specified'}
        - Time: ${request.schedule.time || 'Not specified'}
        - Frequency: ${request.schedule.frequency || 'Not specified'} times per week
        
        IMPORTANT: Use this Schedule configuration to generate quests, not just the original goal text.
        - Duration: ${request.duration.startDate} to ${request.duration.endDate}
        - Total weeks: ${Math.ceil((new Date(request.duration.endDate).getTime() - new Date(request.duration.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))} weeks
        - Expected quests: ${Math.ceil((new Date(request.duration.endDate).getTime() - new Date(request.duration.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)) * (request.schedule.weekdays?.length || 1)} quests
        ` : `
        - Type: FREQUENCY (no specific schedule)
        - Duration: ${request.duration.startDate} to ${request.duration.endDate}
        - Total weeks: ${Math.ceil((new Date(request.duration.endDate).getTime() - new Date(request.duration.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))} weeks
        - Target per week: ${request.schedule?.frequency || 3} times
        - Expected quests: ${Math.ceil((new Date(request.duration.endDate).getTime() - new Date(request.duration.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)) * (request.schedule?.frequency || 3)} quests
        `}

QUEST GENERATION RULES:

        1. SCHEDULE TYPE:
           - Generate one quest for each scheduled occurrence within the duration
           - Use exact dates based on weekdays and duration
           - Include specific time if provided
           - Calculate total weeks: (endDate - startDate) / 7 days
           - Example: "월수금 6시 헬스장" (4 weeks) → 12 quests with exact dates
           - Each quest must have scheduledDate field with YYYY-MM-DD format

        2. FREQUENCY TYPE:
           - Generate quests based on target frequency per week
           - Each quest should have weekNumber and sequence within that week
           - Calculate total weeks: (endDate - startDate) / 7 days
           - Example: "주 3회 운동" (4 weeks) → 12 quests (4 weeks × 3 quests per week)
           - Each quest must have weekNumber field (1, 2, 3, 4...)
           - Title format: "X주차 Y회차 [목표명]" where Y goes from 1 to frequency per week
           - CRITICAL: Generate ALL quests for each week (1주차 1회차, 1주차 2회차, 1주차 3회차, 2주차 1회차, etc.)

3. MILESTONE TYPE:
   - Generate sequential milestone quests
   - Each quest should have sequence number
   - Break down the goal into logical steps

OUTPUT FORMAT:
Return ONLY valid JSON array of quests. Each quest MUST have these exact fields:
[
  {
    "title": "Quest title in Korean (MUST include goal name)",
    "description": "Detailed quest description in Korean",
    "type": "${request.goalType}",
    "scheduledDate": "YYYY-MM-DD" (for schedule type only),
    "weekNumber": 1 (for frequency type only),
    "sequence": 1 (for milestone type only),
    "verificationRules": [
      {
        "type": "camera|screenshot|manual|time|partner|screentime",
        "required": true,
        "config": {}
      }
    ]
  }
]

CRITICAL: Do NOT use fields like "quest", "frequency", "duration", "reward". 
Use ONLY the fields specified above: title, description, type, scheduledDate/weekNumber/sequence, verificationRules.

VERIFICATION RULES:
- Include ALL specified verification methods: ${request.verificationMethods.join(', ')}
- If time verification: include time window based on schedule
- Always include manual verification as fallback
- Camera/Screenshot verification for visual confirmation

LOCALE SETTINGS:
${localeConfig.language === 'ko' ? 
  '- Use Korean for quest titles and descriptions' :
  '- Use English for quest titles and descriptions'}

        IMPORTANT:
        - Generate realistic and actionable quest titles that reflect the goal
        - Make descriptions specific and helpful
        - Ensure verification rules match the goal's requirements
        - Calculate exact dates for schedule type goals
        - Respect the target frequency for frequency type goals
        - For schedule type: Generate quests for each scheduled occurrence (specific dates/times)
        - For frequency type: Generate exactly (weeks × frequency per week) quests
        - CRITICAL SCHEDULE RULE: Use Schedule step configuration (weekdays, times) to generate quests
        - CRITICAL SCHEDULE RULE: Each schedule quest MUST have scheduledDate field (YYYY-MM-DD format)
        - CRITICAL SCHEDULE RULE: Generate one quest per scheduled occurrence (weekday × time combination)
        - CRITICAL FREQUENCY RULE: Use Frequency step configuration (count per week) to generate quests
        - Use Korean language for quest titles and descriptions
        - Pay attention to the goal title to extract frequency information (e.g., "3 times a week" = 3 quests per week)
        - Consider the original goal data context when generating quests
        - If the goal title contains frequency information, use it instead of the provided frequency
        - Quest titles should include the goal name/title
        - For frequency goals: Each week must have ALL required sessions (1회차, 2회차, 3회차, etc.)
        - MAXIMUM 100 QUESTS: Never generate more than 100 quests total
        - CRITICAL: Follow the exact JSON format specified above. Do NOT deviate from the required fields.
        - CRITICAL: Each quest MUST have title, description, type, and verificationRules fields.
        - CRITICAL: For frequency type, each quest MUST have weekNumber field.
        - CRITICAL: For schedule type, each quest MUST have scheduledDate field.
        - CRITICAL: For milestone type, each quest MUST have sequence field.

        EXAMPLE OUTPUT FOR FREQUENCY TYPE:
        If goal is "헬스장에서 운동하기" with frequency 3 per week for 2 weeks:
        [
          {
            "title": "헬스장에서 운동하기 - 1주차 1회차",
            "description": "1주차 첫 번째 운동 세션을 헬스장에서 수행합니다",
            "type": "frequency",
            "weekNumber": 1,
            "verificationRules": [...]
          },
          {
            "title": "헬스장에서 운동하기 - 1주차 2회차", 
            "description": "1주차 두 번째 운동 세션을 헬스장에서 수행합니다",
            "type": "frequency",
            "weekNumber": 1,
            "verificationRules": [...]
          },
          {
            "title": "헬스장에서 운동하기 - 1주차 3회차",
            "description": "1주차 세 번째 운동 세션을 헬스장에서 수행합니다", 
            "type": "frequency",
            "weekNumber": 1,
            "verificationRules": [...]
          },
          {
            "title": "헬스장에서 운동하기 - 2주차 1회차",
            "description": "2주차 첫 번째 운동 세션을 헬스장에서 수행합니다",
            "type": "frequency", 
            "weekNumber": 2,
            "verificationRules": [...]
          },
          {
            "title": "헬스장에서 운동하기 - 2주차 2회차",
            "description": "2주차 두 번째 운동 세션을 헬스장에서 수행합니다",
            "type": "frequency",
            "weekNumber": 2, 
            "verificationRules": [...]
          },
          {
            "title": "헬스장에서 운동하기 - 2주차 3회차",
            "description": "2주차 세 번째 운동 세션을 헬스장에서 수행합니다",
            "type": "frequency",
            "weekNumber": 2,
            "verificationRules": [...]
          }
        ]

        EXAMPLE OUTPUT FOR SCHEDULE TYPE:
        If goal is "매일 아침 7시에 헬스장 가기" for 7 days:
        [
          {
            "title": "헬스장 가기 - 10월 1일 (화)",
            "description": "10월 1일 아침 7시에 헬스장에서 운동을 수행합니다",
            "type": "schedule",
            "scheduledDate": "2025-10-01",
            "verificationRules": [
              {
                "type": "time",
                "required": true,
                "config": {
                  "time": {
                    "window": { "start": "06:30", "end": "07:30" },
                    "tolerance": 30
                  }
                }
              },
              {
                "type": "location", 
                "required": true,
                "config": { "location": { "name": "헬스장", "radius": 100 } }
              },
              {
                "type": "manual",
                "required": true,
                "config": {}
              }
            ]
          },
          {
            "title": "헬스장 가기 - 10월 2일 (수)",
            "description": "10월 2일 아침 7시에 헬스장에서 운동을 수행합니다",
            "type": "schedule", 
            "scheduledDate": "2025-10-02",
            "verificationRules": [...]
          }
        ]

        EXAMPLE OUTPUT FOR MILESTONE TYPE:
        If goal is "Learn Piano" with 3 milestones over 12 weeks:
        [
          {
            "title": "Learn Piano - Kickoff",
            "description": "피아노 학습의 첫 번째 마일스톤을 완성합니다",
            "type": "milestone",
            "sequence": 1,
            "verificationRules": [
              {
                "type": "manual",
                "required": true,
                "config": {}
              }
            ]
          },
          {
            "title": "Learn Piano - Mid Review", 
            "description": "피아노 학습의 중간 마일스톤을 완성합니다",
            "type": "milestone",
            "sequence": 2,
            "verificationRules": [...]
          },
          {
            "title": "Learn Piano - Final Completion",
            "description": "피아노 학습의 최종 마일스톤을 완성합니다", 
            "type": "milestone",
            "sequence": 3,
            "verificationRules": [...]
          }
        ]

        Generate quests now:`, localeConfig);

    return basePrompt;
  }
  
  /**
   * Call AI service for quest generation
   */
  private static async callAIForQuestGeneration(prompt: string, requestId: string): Promise<any> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    const proxyUrl = process.env.EXPO_PUBLIC_AI_PROXY_URL;
    
    console.log('[QuestGenerator] AI service configuration:', {
      hasApiKey: !!apiKey,
      hasProxyUrl: !!proxyUrl,
      apiKeyLength: apiKey?.length || 0,
      promptLength: prompt.length
    });
    
    logAIRequest({
      requestId,
      model: 'gpt-4o-mini',
      promptLength: prompt.length,
      promptHash: 'quest_generation',
      message: 'Generating quests from goal',
      durationMs: 0,
      success: false,
      schemaValid: false
    });
    
    if (proxyUrl) {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          type: 'quest_generation',
          requestId
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[QuestGenerator] Proxy API error:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`Proxy API error: ${response.status} - ${errorText}`);
      }
      
      return await response.json();
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
          temperature: 0.3,
          messages: [
            { role: 'system', content: prompt }
          ]
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[QuestGenerator] OpenAI API error:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[QuestGenerator] OpenAI API response:', {
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length || 0,
        hasMessage: !!data.choices?.[0]?.message,
        contentLength: data.choices?.[0]?.message?.content?.length || 0,
        fullResponse: data
      });
      
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error('[QuestGenerator] No content in AI response:', data);
        throw new Error('No content received from AI service');
      }
      
      return content;
    }
    
    throw new Error('No AI service configured');
  }
  
  /**
   * Parse AI response into Quest objects
   */
  private static parseAIResponseToQuests(aiResponse: any, request: QuestGenerationRequest): Quest[] {
    console.log('[QuestGenerator] Parsing AI response:', {
      responseType: typeof aiResponse,
      responseLength: typeof aiResponse === 'string' ? aiResponse.length : 'N/A',
      responsePreview: typeof aiResponse === 'string' ? aiResponse.substring(0, 200) : aiResponse,
      isNull: aiResponse === null,
      isUndefined: aiResponse === undefined
    });

    try {
      let questData;
      
      if (typeof aiResponse === 'string' && aiResponse.trim().length > 0) {
        // Clean up JSON response
        let cleaned = aiResponse.trim();
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```\s*$/i, '');
        
        // Safe indexOf calls with null checks
        const first = cleaned.indexOf('[');
        const last = cleaned.lastIndexOf(']');
        if (first !== -1 && last !== -1 && last > first) {
          cleaned = cleaned.slice(first, last + 1);
        }
        
        console.log('[QuestGenerator] Cleaned JSON:', cleaned.substring(0, 500));
        questData = JSON.parse(cleaned);
      } else if (aiResponse && typeof aiResponse === 'object' && Array.isArray(aiResponse)) {
        questData = aiResponse;
      } else {
        console.error('[QuestGenerator] Invalid aiResponse:', {
          value: aiResponse,
          type: typeof aiResponse,
          isNull: aiResponse === null,
          isUndefined: aiResponse === undefined
        });
        throw new Error(`Invalid AI response format: ${typeof aiResponse} - ${aiResponse}`);
      }
      
      if (!Array.isArray(questData)) {
        console.error('[QuestGenerator] AI response is not an array:', questData);
        throw new Error('AI response is not an array');
      }
      
      console.log('[QuestGenerator] Parsed quest data:', {
        questCount: questData.length,
        quests: questData.map((q: any, i: number) => ({
          index: i,
          title: q.title,
          type: q.type,
          scheduledDate: q.scheduledDate,
          weekNumber: q.weekNumber,
          verificationRules: q.verificationRules?.length || 0
        }))
      });
      
      // Validate quest count and structure
      const expectedQuests = this.calculateExpectedQuestCount(request);
      console.log('[QuestGenerator] Quest validation:', {
        expectedQuests,
        actualQuests: questData.length,
        matches: questData.length === expectedQuests,
        requestType: request.goalType,
        requestSchedule: request.schedule,
        requestDuration: request.duration
      });
      
      if (questData.length !== expectedQuests) {
        console.warn('[QuestGenerator] Quest count mismatch!', {
          expected: expectedQuests,
          actual: questData.length,
          requestType: request.goalType,
          requestSchedule: request.schedule
        });
      }
      
      // Validate quest structure for frequency type
      if (request.goalType === 'frequency') {
        const weekNumbers = [...new Set(questData.map((q: any) => q.weekNumber).filter(w => w !== undefined))];
        const expectedWeeks = Math.ceil((new Date(request.duration.endDate).getTime() - new Date(request.duration.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000));
        
        console.log('[QuestGenerator] Frequency validation:', {
          weekNumbers,
          expectedWeeks,
          weekNumbersMatch: weekNumbers.length === expectedWeeks,
          questsPerWeek: questData.length / weekNumbers.length
        });
        
        // Check if each week has the right number of quests
        weekNumbers.forEach(weekNum => {
          const weekQuests = questData.filter((q: any) => q.weekNumber === weekNum);
          console.log(`[QuestGenerator] Week ${weekNum}: ${weekQuests.length} quests`, {
            titles: weekQuests.map(q => q.title)
          });
        });
      }
      
      // Validate quest structure before conversion
      const validatedQuests = questData.filter((quest: any, index: number) => {
        const isValid = quest.title && quest.description && quest.type && quest.verificationRules;
        if (!isValid) {
          console.warn(`[QuestGenerator] Invalid quest at index ${index}:`, quest);
        }
        return isValid;
      });
      
      if (validatedQuests.length !== questData.length) {
        console.warn(`[QuestGenerator] Filtered out ${questData.length - validatedQuests.length} invalid quests`);
      }
      
      // Convert to Quest objects
      return validatedQuests.map((quest: any, index: number) => this.createQuestFromData(quest, request, index));
      
    } catch (error) {
      console.error('[QuestGenerator] Error parsing AI response:', error);
      console.error('[QuestGenerator] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        request: {
          goalTitle: request.goalTitle,
          goalType: request.goalType,
          duration: request.duration,
          schedule: request.schedule
        }
      });
      console.error('[QuestGenerator] Raw response:', aiResponse);
      
      // Fallback: generate basic quests
      console.log('[QuestGenerator] Falling back to basic quests');
      return this.generateFallbackQuests(request);
    }
  }
  
  /**
   * Calculate expected quest count based on request
   */
  private static calculateExpectedQuestCount(request: QuestGenerationRequest): number {
    const startDate = new Date(request.duration.startDate);
    const endDate = new Date(request.duration.endDate);
    const totalWeeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    console.log('[QuestGenerator] Calculating expected quest count:', {
      goalType: request.goalType,
      totalWeeks,
      schedule: request.schedule,
      scheduleDetails: request.schedule ? {
        weekdays: request.schedule.weekdays,
        frequency: request.schedule.frequency,
        time: request.schedule.time
      } : null
    });
    
    if (request.goalType === 'schedule' && request.schedule?.weekdays) {
      const count = totalWeeks * request.schedule.weekdays.length;
      console.log('[QuestGenerator] Schedule type:', { weekdays: request.schedule.weekdays.length, count });
      return count;
    } else if (request.goalType === 'frequency' && request.schedule?.frequency) {
      const count = totalWeeks * request.schedule.frequency;
      console.log('[QuestGenerator] Frequency type:', { frequency: request.schedule.frequency, count });
      return count;
    } else if (request.goalType === 'milestone') {
      const count = Math.max(3, Math.min(10, totalWeeks));
      console.log('[QuestGenerator] Milestone type:', { count });
      return count;
    }
    
    const fallbackCount = totalWeeks * 3;
    console.log('[QuestGenerator] Fallback calculation:', { fallbackCount });
    return fallbackCount;
  }

  /**
   * Create Quest object from AI response data
   */
  private static createQuestFromData(data: any, request: QuestGenerationRequest, index: number): Quest {
    const questId = `${request.goalId}_quest_${index + 1}`;
    
    return {
      questId: questId,
      id: questId,
      goalId: request.goalId,
      date: data.scheduledDate || new Date().toISOString().split('T')[0],
      state: 'onTrack',
      title: data.title || `Quest ${index + 1}`,
      description: data.description || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }
  
  /**
   * Parse verification rules from AI response
   */
  private static parseVerificationRules(rules: any[], request: QuestGenerationRequest): VerificationRule[] {
    const verificationRules: VerificationRule[] = [];
    
    // Add verification rules based on request
    request.verificationMethods.forEach(method => {
      const rule: VerificationRule = {
        type: method as any,
        required: true,
        config: {}
      };
      
      // Add specific config based on verification type
      if (method === 'time' && request.schedule?.time) {
        rule.config = {
          time: {
            window: {
              start: request.schedule.time,
              end: this.addMinutes(request.schedule.time, 60) // 1 hour window
            },
            tolerance: 15 // 15 minutes tolerance
          }
        };
      }
      
      if (method === 'camera') {
        rule.config = {
          camera: {
            required: true,
            exifValidation: true
          }
        };
      }
      
      if (method === 'screenshot') {
        rule.config = {
          screenshot: {
            required: true
          }
        };
      }
      
      verificationRules.push(rule);
    });
    
    // Always add manual verification as fallback
    if (!verificationRules.some(r => r.type === 'manual')) {
      verificationRules.push({
        type: 'manual',
        required: false,
        config: {}
      });
    }
    
    return verificationRules;
  }
  
  
  /**
   * Describe schedule pattern for result metadata
   */
  private static describeSchedulePattern(request: QuestGenerationRequest): string {
    if (!request.schedule) return 'No schedule';
    
    const weekdays = request.schedule.weekdays || [];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const weekdayNames = weekdays.map(day => dayNames[day]).join(', ');
    
    if (request.schedule.time) {
      return `${weekdayNames} ${request.schedule.time}`;
    } else {
      return `${weekdayNames}`;
    }
  }
  
  /**
   * Helper: Add minutes to time string
   */
  private static addMinutes(timeStr: string, minutes: number): string {
    if (!timeStr || typeof timeStr !== 'string') {
      console.warn('[QuestGenerator] Invalid timeStr:', timeStr);
      return '09:00'; // Default fallback time
    }
    
    const timeParts = timeStr.split(':');
    if (timeParts.length !== 2) {
      console.warn('[QuestGenerator] Invalid time format:', timeStr);
      return timeStr; // Return original if format is invalid
    }
    
    const [hours, mins] = timeParts.map(Number);
    if (isNaN(hours) || isNaN(mins)) {
      console.warn('[QuestGenerator] Invalid time numbers:', timeStr);
      return timeStr; // Return original if numbers are invalid
    }
    
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24; // Handle day overflow
    const newMins = totalMinutes % 60;
    
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }
  
  /**
   * Helper: Format date to YYYY-MM-DD
   */
  private static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Generate fallback quests when AI generation fails
   */
  private static generateFallbackQuests(request: QuestGenerationRequest): Quest[] {
    console.log('[QuestGenerator] Generating fallback quests for:', {
      goalTitle: request.goalTitle,
      goalType: request.goalType,
      duration: request.duration,
      schedule: request.schedule,
      scheduleFrequency: request.schedule?.frequency
    });

    const quests: Quest[] = [];
    const startDate = new Date(request.duration.startDate);
    const endDate = new Date(request.duration.endDate);
    
    if (request.goalType === 'frequency' && request.schedule) {
      // Frequency type: generate quests based on frequency
      const totalWeeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const frequencyPerWeek = request.schedule.frequency || 3;
      
      console.log('[QuestGenerator] Frequency fallback generation:', {
        totalWeeks,
        frequencyPerWeek,
        scheduleFrequency: request.schedule.frequency,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        requestDetails: {
          goalType: request.goalType,
          schedule: request.schedule,
          goalTitle: request.goalTitle
        }
      });
      
      let questIndex = 1;
      for (let week = 1; week <= totalWeeks; week++) {
        for (let session = 1; session <= frequencyPerWeek; session++) {
          const questId = `fallback_${request.goalId}_quest_${questIndex}`;
          const quest: Quest = {
            questId: questId,
            id: questId,
            goalId: request.goalId,
            date: new Date(startDate.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            state: 'onTrack',
            title: `${request.goalTitle} - ${week}주차 ${session}회차`,
            description: `${week}주차 ${session}번째 ${request.goalTitle} 세션을 수행합니다`,
            status: 'pending',
            createdAt: new Date().toISOString()
          };
          
          quests.push(quest);
          questIndex++;
        }
      }
    } else if (request.goalType === 'schedule' && request.schedule) {
      // Schedule type: generate quests for each weekday
      const weekdays = request.schedule.weekdays || [1, 3, 5]; // Default: Mon, Wed, Fri
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      
      let questIndex = 1;
      let currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        
        if (weekdays.includes(dayOfWeek)) {
          const dayName = dayNames[dayOfWeek];
          const questId = `fallback_${request.goalId}_quest_${questIndex}`;
          const quest: Quest = {
            questId: questId,
            id: questId,
            goalId: request.goalId,
            date: this.formatDate(currentDate),
            state: 'onTrack',
            title: `${request.goalTitle} - ${dayName}요일`,
            description: `${dayName}요일에 ${request.goalTitle}를 수행합니다`,
            status: 'pending',
            createdAt: new Date().toISOString()
          };
          
          quests.push(quest);
          questIndex++;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // Default: generate basic quests
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const questCount = Math.min(totalDays, 10); // Max 10 fallback quests
      
      for (let i = 1; i <= questCount; i++) {
        const questId = `fallback_${request.goalId}_quest_${i}`;
        const quest: Quest = {
          questId: questId,
          id: questId,
          goalId: request.goalId,
          date: new Date(startDate.getTime() + (i - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          state: 'onTrack',
          title: `${request.goalTitle} - Quest ${i}`,
          description: `${request.goalTitle}의 ${i}번째 단계를 수행합니다`,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        
        quests.push(quest);
      }
    }
    
    console.log('[QuestGenerator] Generated', quests.length, 'fallback quests');
    return quests;
  }

  /**
   * Generate basic verification rules for fallback quests
   */
  private static generateBasicVerificationRules(request: QuestGenerationRequest): any[] {
    const rules = [];
    
    // Always include manual verification
    rules.push({
      type: 'manual',
      required: true,
      config: {}
    });
    
    // Add other verification methods if specified
    if (request.verificationMethods.includes('camera')) {
      rules.push({
        type: 'camera',
        required: false,
        config: { camera: { required: false, exifValidation: true } }
      });
    }
    
    if (request.verificationMethods.includes('screenshot')) {
      rules.push({
        type: 'screenshot',
        required: false,
        config: { screenshot: { required: false } }
      });
    }
    
    return rules;
  }
}
