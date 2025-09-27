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
    
    try {
      // Detect language for appropriate AI prompts
      const localeConfig = getLocaleConfig(request.goalTitle);
      
      // Create AI prompt for quest generation
      const questPrompt = this.createQuestGenerationPrompt(request, localeConfig);
      
      // Call AI service to generate quest structure
      const aiResponse = await this.callAIForQuestGeneration(questPrompt, requestId);
      
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
    const basePrompt = getLanguageAwareSystemPrompt(`
You are a Quest Generator AI. Your job is to break down goals into individual, actionable quests.

GOAL ANALYSIS:
- Goal: "${request.goalTitle}"
- Type: ${request.goalType}
- Duration: ${request.duration.startDate} to ${request.duration.endDate}
- Verification Methods: ${request.verificationMethods.join(', ')}

QUEST GENERATION RULES:

1. SCHEDULE TYPE:
   - Break into specific date/time quests
   - Each quest should have exact scheduledDate
   - Example: "월수금 6시 헬스장" → 12 quests (4 weeks × 3 days)

2. FREQUENCY TYPE:
   - Break into weekly quests with targetPerWeek
   - Each quest should have weekNumber
   - Example: "주 3회 운동" → 12 quests (4 weeks × 3 quests per week)

3. MILESTONE TYPE:
   - Break into sequential milestone quests
   - Each quest should have sequence number
   - Example: "미국 유학 준비" → 8 milestone quests

OUTPUT FORMAT:
Return ONLY valid JSON array of quests:
[
  {
    "title": "Quest title",
    "description": "Quest description",
    "type": "schedule|frequency|milestone",
    "scheduledDate": "YYYY-MM-DD" (for schedule),
    "weekNumber": 1 (for frequency),
    "sequence": 1 (for milestone),
    "verificationRules": [
      {
        "type": "location|photo|manual|time|partner",
        "required": true,
        "config": { ... }
      }
    ]
  }
]

LOCALE SETTINGS:
${localeConfig.language === 'ko' ? 
  '- Use Korean for quest titles and descriptions' :
  '- Use English for quest titles and descriptions'}

VERIFICATION RULES:
- If location specified: include location verification
- If time specified: include time verification  
- Always include manual verification as fallback
- Photo verification for visual confirmation

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
        
        questData = JSON.parse(cleaned);
      } else {
        questData = aiResponse;
      }
      
      if (!Array.isArray(questData)) {
        throw new Error('AI response is not an array');
      }
      
      // Convert to Quest objects
      return questData.map((quest: any, index: number) => this.createQuestFromData(quest, request, index));
      
    } catch (error) {
      console.error('[QuestGenerator] Error parsing AI response:', error);
      
      // Fallback: generate basic quests
      return this.generateFallbackQuests(request);
    }
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
