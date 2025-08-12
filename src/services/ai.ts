// AI service for goal generation and assistance with timeout, retry, and performance optimization

import { Categories } from '../constants';
import { AIContext, AIGoal } from '../types';

export class AIService {
  /**
   * Generate a goal from natural language text
   * Uses OpenAI ChatGPT if available, proxy endpoint as secondary, otherwise falls back to local heuristic
   */
  static async generateGoalFromText(prompt: string): Promise<AIGoal> {
    console.time('[AI] Goal Generation Total');
    
    const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    const proxyUrl = process.env.EXPO_PUBLIC_AI_PROXY_URL;
    
    try {
      if (openaiApiKey && openaiApiKey !== 'your-openai-api-key-here') {
        return await this.generateWithChatGPT(prompt);
      } else if (proxyUrl) {
        return await this.generateWithProxy(proxyUrl, prompt);
      } else {
        return this.generateWithLocalHeuristic(prompt);
      }
    } finally {
      console.timeEnd('[AI] Goal Generation Total');
    }
  }

  /**
   * Continue goal refinement with follow-up questions
   */
  static async continueGoalRefinement(context: AIContext, userAnswer: string): Promise<AIGoal> {
    console.time('[AI] Goal Refinement Total');
    
    const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    
    try {
      if (openaiApiKey && openaiApiKey !== 'your-openai-api-key-here') {
        return await this.refineWithChatGPT(context, userAnswer);
      } else {
        // Fallback to local heuristic with context
        return this.generateWithLocalHeuristic(userAnswer);
      }
    } finally {
      console.timeEnd('[AI] Goal Refinement Total');
    }
  }

  /**
   * Generate goal using OpenAI ChatGPT with timeout and retry
   */
  private static async generateWithChatGPT(prompt: string): Promise<AIGoal> {
    console.time('[AI] ChatGPT Generation');
    
    // First attempt
    try {
      return await this.performChatGPTRequest(prompt, null);
    } catch (error) {
      console.warn('[AI] ChatGPT first attempt failed, retrying...', error);
      
      // Second attempt with short backoff
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        return await this.performChatGPTRequest(prompt, null);
      } catch (retryError) {
        console.error('[AI] ChatGPT retry failed, falling back to local heuristic:', retryError);
        console.timeEnd('[AI] ChatGPT Generation');
        
        // Fallback to local heuristic on retry failure
        return this.generateWithLocalHeuristic(prompt);
      }
    } finally {
      console.timeEnd('[AI] ChatGPT Generation');
    }
  }

  /**
   * Refine goal with ChatGPT using conversation context
   */
  private static async refineWithChatGPT(context: AIContext, userAnswer: string): Promise<AIGoal> {
    console.time('[AI] ChatGPT Refinement');
    
    try {
      return await this.performChatGPTRequest(userAnswer, context);
    } catch (error) {
      console.error('[AI] ChatGPT refinement failed:', error);
      console.timeEnd('[AI] ChatGPT Refinement');
      
      // Fallback to local heuristic
      return this.generateWithLocalHeuristic(userAnswer);
    }
  }

  /**
   * Perform ChatGPT API request with timeout and enhanced error handling
   */
  private static async performChatGPTRequest(prompt: string, context: AIContext | null): Promise<AIGoal> {
    const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    const baseUrl = process.env.EXPO_PUBLIC_OPENAI_BASE_URL || 'https://api.openai.com/v1';

    // Create AbortController for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('[AI] Request timeout after 15 seconds');
      abortController.abort();
    }, 15000); // 15 second timeout

    try {
      const systemPrompt = context 
        ? `You are continuing a goal-setting conversation. Use the conversation history and user's latest answer to update the goal structure. Return ONLY a valid JSON object. Do not include any prose or explanations.

CRITICAL: 
- Update the partial goal with the new information
- Keep asking follow-up questions until ALL required fields are complete
- For gym/fitness goals: targetLocation is MANDATORY before completion
- Validate that all required fields are present and complete
- Auto-assign category from: Health, Fitness, Productivity, Education, Personal, Career, Spiritual, Other

Return the same JSON format with updated information. Continue to populate missingFields and followUpQuestion until everything is complete.

Current conversation context: ${JSON.stringify(context.partialGoal || {})}`
        : `You are a goal-setting assistant. Parse the user's goal description and return ONLY a valid JSON object. Do not include any prose or explanations.

CRITICAL REQUIREMENTS:
1. RETURN ONLY VALID JSON - no additional text or markdown
2. ALL fields must be populated or marked as missing
3. If verificationMethods includes "location", targetLocation is REQUIRED
4. For gym/fitness goals, "location" verification is mandatory
5. Auto-assign category from: Health, Fitness, Productivity, Education, Personal, Career, Spiritual, Other
6. startDate must be today or later
7. duration must be specific with clear end conditions

Required JSON format:
{
  "title": "Clear, concise goal title",
  "category": "Health|Fitness|Productivity|Education|Personal|Career|Spiritual|Other",
  "verificationMethods": ["location", "time", "screentime", "manual"] (multiple allowed),
  "frequency": {"count": number, "unit": "per_day|per_week|per_month"},
  "startDate": "ISO date string (today or later)",
  "duration": {
    "type": "days|weeks|months|range",
    "value": number (if type is days/weeks/months),
    "startDate": "ISO date string (if type is range)",
    "endDate": "ISO date string (if type is range)"
  },
  "targetLocation": {"name": "string", "placeId": "optional", "lat": number, "lng": number} (REQUIRED if "location" in verificationMethods),
  "notes": "Additional context",
  "missingFields": ["field1", "field2"] (array of missing/ambiguous fields),
  "followUpQuestion": "Natural language question to ask user for missing info"
}

VALIDATION RULES:
- For "go to gym" type goals: MUST include "location" in verificationMethods and ask for specific gym
- For "daily habits": frequency.unit should be "per_day"
- For "workout routines": frequency.unit should be "per_week"
- For time-based goals: include "time" verification method
- For screen time limits: include "screentime" verification method
- Always include "manual" for user check-ins

MISSING FIELD DETECTION:
If ANY of these are unclear, add to missingFields and ask followUpQuestion:
- Specific location for gym/location-based goals
- Exact frequency (how many times per day/week/month)
- Duration (how long should this goal run)
- Start date (when to begin)
- Time of day (for time-based goals)`;

      // Build messages array
      const messages = context 
        ? [
            { role: 'system', content: systemPrompt },
            ...context.conversationHistory,
            { role: 'user', content: prompt }
          ]
        : [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ];

      console.log(`[AI] Making ChatGPT request (${messages.length} messages)`);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
        body: JSON.stringify({
          model: 'gpt-3.5-turbo-1106', // Supports JSON mode
          messages,
          response_format: { type: "json_object" }, // Force JSON mode
          temperature: 0.3,
          max_tokens: 800,
          stream: false // Disable streaming for reliability
        })
      });

      // Enhanced error handling with detailed logging
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI] OpenAI API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('Content-Type'),
          body: errorText.substring(0, 200)
        });
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}`);
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;

      if (!aiResponse) {
        console.error('[AI] No AI response in data:', data);
        throw new Error('No response content from OpenAI');
      }

      // Safe JSON parsing with detailed error logging
      let goalData;
      try {
        goalData = JSON.parse(aiResponse);
      } catch (parseError) {
        console.error('[AI] JSON Parse Error Details:', {
          error: parseError,
          response: aiResponse.substring(0, 200),
          responseLength: aiResponse.length,
          firstChar: aiResponse.charAt(0),
          lastChar: aiResponse.charAt(aiResponse.length - 1)
        });
        throw new Error(`Invalid JSON response from AI: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
      }

      return this.validateAndNormalizeAIGoal(goalData);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('AI request timed out after 15 seconds');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

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
        throw new Error(`Proxy API error: ${response.status}`);
      }

      const data = await response.json();
      return this.validateAndNormalizeAIGoal(data);

    } catch (error) {
      console.error('[AI] Proxy generation failed:', error);
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
      
      // Extract basic information
      let title = prompt.charAt(0).toUpperCase() + prompt.slice(1);
      let category = this.autoAssignCategory(title, []);
      let verificationMethods: string[] = ['manual'];
      let frequency: { count: number; unit: 'per_day' | 'per_week' | 'per_month' } = { count: 1, unit: 'per_day' };
      let missingFields: string[] = [];
      let followUpQuestion = '';

      // Detect verification methods
      if (lowerPrompt.includes('gym') || lowerPrompt.includes('location') || 
          lowerPrompt.includes('place') || lowerPrompt.includes('office') || 
          lowerPrompt.includes('cafe') || lowerPrompt.includes('park') || 
          lowerPrompt.includes('library') || lowerPrompt.includes('studio') ||
          lowerPrompt.includes('home')) {
        verificationMethods.push('location');
        missingFields.push('targetLocation');
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

      // Extract frequency
      const frequencyMatch = lowerPrompt.match(/(\d+)\s*(times?|x)\s*(per\s+)?(day|daily|week|weekly|month|monthly)/);
      if (frequencyMatch) {
        const count = parseInt(frequencyMatch[1]);
        const period = frequencyMatch[4];
        
        if (period.includes('day')) {
          frequency = { count, unit: 'per_day' };
        } else if (period.includes('week')) {
          frequency = { count, unit: 'per_week' };
        } else if (period.includes('month')) {
          frequency = { count, unit: 'per_month' };
        }
      } else {
        missingFields.push('frequency');
      }

      // Check for duration
      if (!lowerPrompt.includes('week') && !lowerPrompt.includes('month') && 
          !lowerPrompt.includes('day') && !lowerPrompt.includes('for')) {
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

      // Extract specific day and time information for weekly schedule
      let weeklySchedule: { [key: string]: string } = {};
      if (needsWeeklySchedule) {
        const dayTimePatterns = [
          { day: 'monday', regex: /monday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
          { day: 'tuesday', regex: /tuesday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
          { day: 'wednesday', regex: /wednesday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
          { day: 'thursday', regex: /thursday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
          { day: 'friday', regex: /friday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
          { day: 'saturday', regex: /saturday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
          { day: 'sunday', regex: /sunday\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i },
        ];

        // Also check for Korean day names
        const koreanDayTimePatterns = [
          { day: 'monday', regex: /월요일\s*(\d{1,2})시?/i },
          { day: 'tuesday', regex: /화요일\s*(\d{1,2})시?/i },
          { day: 'wednesday', regex: /수요일\s*(\d{1,2})시?/i },
          { day: 'thursday', regex: /목요일\s*(\d{1,2})시?/i },
          { day: 'friday', regex: /금요일\s*(\d{1,2})시?/i },
          { day: 'saturday', regex: /토요일\s*(\d{1,2})시?/i },
          { day: 'sunday', regex: /일요일\s*(\d{1,2})시?/i },
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

        // Check Korean patterns
        koreanDayTimePatterns.forEach(({ day, regex }) => {
          const match = lowerPrompt.match(regex);
          if (match) {
            let hour = parseInt(match[1]);
            const timeString = `${hour.toString().padStart(2, '0')}:00`;
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

      // Generate follow-up question
      if (missingFields.length > 0) {
        const missing = missingFields.join(', ');
        followUpQuestion = `I need more information about: ${missing}. Could you provide these details?`;
      }

      const goal: AIGoal = {
        title: title.length > 50 ? title.substring(0, 47) + '...' : title,
        category,
        verificationMethods: verificationMethods as any,
        frequency,
        duration: {
          type: 'weeks',
          value: 2,
          startDate: today,
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        notes: prompt,
        missingFields: missingFields.length > 0 ? missingFields : undefined,
        followUpQuestion: followUpQuestion || undefined,
        needsWeeklySchedule,
        weeklySchedule
      };

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
              ['location', 'time', 'screentime', 'manual'].includes(vm)
            )
          : ['manual'],
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

      // Validate required fields
      const requiredFields = ['title', 'category', 'verificationMethods', 'frequency'];
      const actualMissing = requiredFields.filter(field => {
        if (field === 'verificationMethods') return !validated.verificationMethods.length;
        if (field === 'frequency') return !validated.frequency.count || validated.frequency.count < 1;
        return !validated[field as keyof AIGoal];
      });

      // Check location requirement
      if (validated.verificationMethods.includes('location') && !validated.targetLocation?.name) {
        actualMissing.push('targetLocation');
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
      // Fitness & Health
      'Go to the gym 3 times a week',
      'Run 5km every morning',
      'Practice yoga for 30 minutes daily',
      'Swim twice a week',
      'Do 100 push-ups daily',
      'Walk 10,000 steps every day',
      'Meditate for 20 minutes before bed',
      'Drink 8 glasses of water daily',
      
      // Learning & Education
      'Read 30 minutes every day',
      'Learn Spanish for 1 hour daily',
      'Practice piano for 45 minutes daily',
      'Study coding for 2 hours every weekend',
      'Write 500 words daily',
      'Watch one educational video daily',
      'Learn to cook 3 new recipes per week',
      'Practice drawing for 1 hour daily',
      
      // Work & Productivity
      'Complete 3 important tasks daily',
      'Review and plan next day every evening',
      'Take a 5-minute break every hour',
      'Organize workspace every Friday',
      'Learn one new skill per month',
      'Network with 2 new people weekly',
      'Update portfolio every month',
      'Track time spent on projects daily',
      
      // Personal Development
      'Journal for 15 minutes daily',
      'Call family members weekly',
      'Try one new hobby per month',
      'Practice gratitude every morning',
      'Learn to play guitar for 1 hour daily',
      'Visit one new place monthly',
      'Volunteer 4 hours per month',
      'Practice public speaking weekly',
      
      // Financial Goals
      'Save $100 every week',
      'Track all expenses daily',
      'Invest 10% of income monthly',
      'Review budget every Sunday',
      'Cook meals at home 5 days a week',
      'Cancel unused subscriptions monthly',
      'Read one finance book per month',
      'Set aside emergency fund weekly'
    ];
  }
}