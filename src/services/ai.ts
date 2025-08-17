// AI service for goal generation and assistance with timeout, retry, and performance optimization

import { Categories } from '../constants';
import { AIContext, AIGoal, VerificationType } from '../types';

export class AIService {
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
        const aiGoal = await this.generateWithOpenAI(apiKey, userAnswer);
        return this.validateAndNormalizeAIGoal(aiGoal);
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
            { role: 'system', content: 'You are an assistant that converts a user\'s goal into a concise JSON with fields: title, category, verificationMethods, mandatoryVerificationMethods (subset of verificationMethods), frequency {count, unit}, duration {type, value, startDate?, endDate?}, notes, and optionally targetLocation {name}. verificationMethods must be any of ["location","time","screentime","photo","manual"]. If the task likely requires going to or being at a place (e.g., gym, pool, library, office, cafe, studio, court, field, track, park, trail) or is an outdoor/venue activity (run, jog, walk, hike, cycle, bike, swim, climb), include "location" in verificationMethods. Only include it in mandatoryVerificationMethods if the place is explicitly specified or clearly required. Respond with JSON only.' },
            { role: 'user', content: prompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      return parsed;
    } catch (error) {
      console.error('[AI] OpenAI generation failed, falling back to heuristic:', error);
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
        mandatoryVerificationMethods: Array.from(new Set(mandatoryVerificationMethods)) as any,
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
   * Analyze verification methods using OpenAI (or heuristic) and return both selected and mandatory sets
   */
  static async analyzeVerificationMethods(prompt: string): Promise<{ methods: VerificationType[]; mandatory: VerificationType[] }> {
    const proxyUrl = process.env.EXPO_PUBLIC_AI_PROXY_URL;
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    const allowed: VerificationType[] = ['location','time','screentime','photo','manual'];
    try {
      if (proxyUrl) {
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, type: 'verification_analysis' })
        });
        const data = await response.json();
        const methods = (Array.isArray(data.methods) ? data.methods.filter((m: string) => (allowed as string[]).includes(m)) : []) as VerificationType[];
        const mandatory = (Array.isArray(data.mandatory) ? data.mandatory.filter((m: string) => (allowed as string[]).includes(m)) : []) as VerificationType[];
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
              { role: 'system', content: 'Return ONLY JSON with shape {"methods": string[], "mandatory": string[]}. Allowed values: ["location","time","screentime","photo","manual"]. Choose the minimal set required to verify the user truly did the task. Mark truly required ones under "mandatory". If the goal likely involves going to/being at a place (gym, pool, library, office, cafe, studio, court, field, track, park, trail) or outdoor/venue activities (run, walk, jog, hike, cycle, bike, swim, climb), include "location" in methods; include it in mandatory only when the place is explicit/required.' },
              { role: 'user', content: prompt }
            ]
          })
        });
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);
        const methods = (Array.isArray(parsed.methods) ? parsed.methods.filter((m: string) => (allowed as string[]).includes(m)) : []) as VerificationType[];
        const mandatory = (Array.isArray(parsed.mandatory) ? parsed.mandatory.filter((m: string) => (allowed as string[]).includes(m)) : []) as VerificationType[];
        return { methods, mandatory };
      }

      // Heuristic fallback
      const heuristic = this.generateWithLocalHeuristic(prompt);
      const methods = heuristic.verificationMethods as VerificationType[];
      const mandatory = (heuristic as any).mandatoryVerificationMethods || [];
      return { methods, mandatory };
    } catch (error) {
      console.error('[AI] analyzeVerificationMethods failed:', error);
      // Fallback to heuristic
      const heuristic = this.generateWithLocalHeuristic(prompt);
      const methods = heuristic.verificationMethods as VerificationType[];
      const mandatory = (heuristic as any).mandatoryVerificationMethods || [];
      return { methods, mandatory };
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