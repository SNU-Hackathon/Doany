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
      verificationMethods: request.verificationMethods,
      targetLocation: request.targetLocation
    });

    const basePrompt = getLanguageAwareSystemPrompt(`
You are a Quest Generator AI. Your job is to break down goals into individual, actionable quests based on the goal's type, schedule, and verification methods.

GOAL ANALYSIS:
- Goal: "${request.goalTitle}"
- Description: "${request.goalDescription || 'No description'}"
- Type: ${request.goalType}
- Duration: ${request.duration.startDate} to ${request.duration.endDate}
- Verification Methods: ${request.verificationMethods.join(', ')}

        SCHEDULE INFORMATION:
        ${request.schedule ? `
        - Weekdays: ${request.schedule.weekdays ? request.schedule.weekdays.map(d => ['일','월','화','수','목','금','토'][d]).join(', ') : 'Not specified'}
        - Time: ${request.schedule.time || 'Not specified'}
        - Location: ${request.schedule.location || 'Not specified'}
        - Frequency: ${request.schedule.frequency || 'Not specified'} times per week
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

TARGET LOCATION:
${request.targetLocation ? `
- Name: ${request.targetLocation.name}
- Address: ${(request.targetLocation as any).address || 'Not specified'}
- Coordinates: ${(request.targetLocation as any).lat || 'N/A'}, ${(request.targetLocation as any).lng || 'N/A'}
` : '- No target location specified'}

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
        "type": "location|photo|manual|time|partner|screentime",
        "required": true,
        "config": {
          "location": {
            "name": "Location name",
            "coordinates": {"lat": 37.5665, "lng": 126.9780},
            "radius": 100
          }
        }
      }
    ]
  }
]

CRITICAL: Do NOT use fields like "quest", "frequency", "duration", "reward". 
Use ONLY the fields specified above: title, description, type, scheduledDate/weekNumber/sequence, verificationRules.

VERIFICATION RULES:
- Include ALL specified verification methods: ${request.verificationMethods.join(', ')}
- If location verification: include target location details
- If time verification: include time window based on schedule
- Always include manual verification as fallback
- Photo verification for visual confirmation

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
        - For schedule type: Generate quests for each weekday occurrence within the duration
        - For frequency type: Generate exactly (weeks × frequency per week) quests
        - Use Korean language for quest titles and descriptions
        - Quest titles should include the goal name/title
        - For frequency goals: Each week must have ALL required sessions (1회차, 2회차, 3회차, etc.)
        - CRITICAL: Follow the exact JSON format specified above. Do NOT deviate from the required fields.
        - CRITICAL: Each quest MUST have title, description, type, and verificationRules fields.
        - CRITICAL: For frequency type, each quest MUST have weekNumber field.
        - CRITICAL: For schedule type, each quest MUST have scheduledDate field.

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
        contentLength: data.choices?.[0]?.message?.content?.length || 0
      });
      return data.choices?.[0]?.message?.content || '[]';
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
      responsePreview: typeof aiResponse === 'string' ? aiResponse.substring(0, 200) : aiResponse
    });

    try {
      let questData;
      
      if (typeof aiResponse === 'string') {
        // Clean up JSON response
        let cleaned = aiResponse.trim();
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```\s*$/i, '');
        
        const first = cleaned.indexOf('[');
        const last = cleaned.lastIndexOf(']');
        if (first !== -1 && last !== -1 && last > first) {
          cleaned = cleaned.slice(first, last + 1);
        }
        
        console.log('[QuestGenerator] Cleaned JSON:', cleaned.substring(0, 500));
        questData = JSON.parse(cleaned);
      } else {
        questData = aiResponse;
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
        requestType: request.goalType
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
      schedule: request.schedule
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
      id: questId,
      goalId: request.goalId,
      title: data.title || `Quest ${index + 1}`,
      description: data.description,
      type: data.type || request.goalType,
      status: 'pending',
      scheduledDate: data.scheduledDate,
      weekNumber: data.weekNumber,
      verificationRules: this.parseVerificationRules(data.verificationRules || [], request),
      createdAt: new Date().toISOString(),
      metadata: {
        sequence: data.sequence,
        dependencies: data.dependencies,
        priority: data.priority || 'medium'
      }
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
      if (method === 'location' && request.targetLocation) {
        rule.config = {
          location: {
            name: request.targetLocation.name,
            coordinates: request.targetLocation.coordinates,
            radius: 100 // 100 meters default
          }
        };
      }
      
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
      
      if (method === 'photo') {
        rule.config = {
          photo: {
            required: true,
            exifValidation: true
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
   * Generate fallback quests if AI fails
   */
  private static generateFallbackQuests(request: QuestGenerationRequest): Quest[] {
    console.log('[QuestGenerator] Generating fallback quests');
    
    const quests: Quest[] = [];
    const startDate = new Date(request.duration.startDate);
    const endDate = new Date(request.duration.endDate);
    
    if (request.goalType === 'schedule' && request.schedule?.weekdays) {
      // Generate schedule quests
      let questIndex = 1;
      let currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        
        if (request.schedule.weekdays.includes(dayOfWeek)) {
          quests.push({
            id: `${request.goalId}_quest_${questIndex}`,
            goalId: request.goalId,
            title: `${request.goalTitle} - ${this.formatDate(currentDate)}`,
            type: 'schedule',
            status: 'pending',
            scheduledDate: this.formatDate(currentDate),
            verificationRules: this.parseVerificationRules([], request),
            createdAt: new Date().toISOString()
          });
          questIndex++;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // Generate basic quests
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const questCount = Math.min(totalDays, 10); // Max 10 fallback quests
      
      for (let i = 1; i <= questCount; i++) {
        quests.push({
          id: `${request.goalId}_quest_${i}`,
          goalId: request.goalId,
          title: `${request.goalTitle} - Quest ${i}`,
          type: request.goalType,
          status: 'pending',
          verificationRules: this.parseVerificationRules([], request),
          createdAt: new Date().toISOString()
        });
      }
    }
    
    return quests;
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
    const [hours, mins] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }
  
  /**
   * Helper: Format date to YYYY-MM-DD
   */
  private static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
