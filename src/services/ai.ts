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
   * Propose a default schedule from partial inputs
   */
  static async proposeSchedule(input: {
    frequency?: { count: number; unit: 'per_day'|'per_week'|'per_month' };
    duration?: { type: 'days'|'weeks'|'months'|'range'; value?: number; startDate?: string; endDate?: string };
    notes?: string;
  }): Promise<{ weeklyWeekdays: number[]; weeklyTimeSettings: { [key: number]: string[] }; followUpQuestion?: string }> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    const fallback = () => {
      const count = input.frequency?.count || 3;
      const unit = input.frequency?.unit || 'per_week';
      let days: number[] = [];
      if (unit === 'per_week') {
        if (count >= 5) days = [1,2,3,4,5];
        else if (count === 4) days = [1,2,4,5];
        else if (count === 3) days = [1,3,5];
        else if (count === 2) days = [2,4];
        else days = [3];
      } else if (unit === 'per_day') {
        days = [0,1,2,3,4,5,6];
      } else {
        days = [2,5];
      }
      const time = /morning|before work/i.test(input.notes || '') ? '07:00' : /evening|after work|night/i.test(input.notes || '') ? '19:00' : '19:00';
      const weeklyTimeSettings: any = {};
      days.forEach(d => { weeklyTimeSettings[d] = [time]; });
      return { weeklyWeekdays: days, weeklyTimeSettings };
    };
    if (!apiKey) return Promise.resolve(fallback());
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          messages: [
            { role: 'system', content: 'Return ONLY JSON with shape {"weeklyWeekdays": number[], "weeklyTimeSettings": { [dayIndex:number]: string[] }, "followUpQuestion"?: string}. Use Asia/Seoul. If morning/before work, use 07:00; evening/after work, use 19:00; else propose reasonable times. Prefer defaults over questions; include at most one concise followUpQuestion only if absolutely necessary.' },
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
      return fallback();
    } catch {
      return fallback();
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
  }): { ready: boolean; reasons: string[]; suggestions: string[] } {
    const reasons: string[] = [];
    const suggestions: string[] = [];
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
    let scheduled = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0];
      const base = weekly.has(d.getDay());
      const isScheduled = (base && !exclude.has(ds)) || include.has(ds);
      if (isScheduled) { scheduled++; if (scheduled > 0) break; }
    }
    if (scheduled === 0) {
      reasons.push('No scheduled days yet.');
      suggestions.push('Select weekdays and/or tap days on the calendar to schedule.');
    }

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

    const ready = reasons.length === 0;
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
            { role: 'system', content: 'Output JSON only with fields: {"title":string,"category":string,"verificationMethods":string[],"mandatoryVerificationMethods"?:string[],"frequency":{ "count":number, "unit":"per_day"|"per_week"|"per_month" },"duration":{ "type":"days"|"weeks"|"months"|"range","value"?:number,"startDate"?:string,"endDate"?:string },"notes"?:string,"targetLocation"?:{ "name":string },"needsWeeklySchedule"?:boolean,"weeklySchedule"?:{ [weekdayName:string]: string },"weeklyWeekdays"?:number[],"weeklyTimeSettings"?:{ [dayIndex:number]: string[] },"includeDates"?:string[],"excludeDates"?:string[],"missingFields"?:string[],"followUpQuestion"?:string }. Rules: 1) If time-of-day is vague, map: morning→"07:00", before work→"07:00", lunchtime→"12:00", evening/after work→"19:00", night→"21:00". 2) Use 24h HH:MM, local timezone. 3) If schedule can be inferred, fill needsWeeklySchedule, weeklyWeekdays and weeklyTimeSettings (indexes 0=Sun..6=Sat). 4) If something is truly missing, set missingFields and provide EXACTLY ONE concise followUpQuestion. 5) Prefer to propose defaults over asking.' },
            { role: 'user', content: JSON.stringify({ prompt, timezone: 'Asia/Seoul', locale: 'ko-KR' }) }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = safeParse(content);
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
  static async analyzeVerificationMethods(input: string | { prompt: string; targetLocationName?: string; placeId?: string; locale?: string; timezone?: string }): Promise<{ methods: VerificationType[]; mandatory: VerificationType[]; usedFallback?: boolean }> {
    const proxyUrl = process.env.EXPO_PUBLIC_AI_PROXY_URL;
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    const allowed: VerificationType[] = ['location','time','screentime','photo','manual'];
    const asObject = (typeof input === 'string') ? { prompt: input, locale: 'ko-KR', timezone: 'Asia/Seoul' } : input;
    const payload = {
      prompt: asObject.prompt,
      targetLocationName: asObject.targetLocationName,
      placeId: asObject.placeId,
      locale: asObject.locale || 'ko-KR',
      timezone: asObject.timezone || 'Asia/Seoul'
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
        if (payload.targetLocationName || payload.placeId) {
          if (!methods.includes('location' as any)) methods = [...methods, 'location' as any];
          if (!mandatory.includes('location' as any)) mandatory = [...mandatory, 'location' as any];
        }
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
              { role: 'system', content: 'Return ONLY JSON with shape {"methods": string[], "mandatory": string[]}. Allowed values: ["location","time","screentime","photo","manual"]. Choose the minimal set required; mark as mandatory only when truly required. If targetLocationName or placeId is present, you MUST include "location" in both methods and mandatory. No prose.' },
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
        if (payload.targetLocationName || payload.placeId) {
          if (!methods.includes('location' as any)) methods = [...methods, 'location' as any];
          if (!mandatory.includes('location' as any)) mandatory = [...mandatory, 'location' as any];
        }
        return { methods, mandatory };
      }

      // Heuristic fallback
      const heuristic = this.generateWithLocalHeuristic(payload.prompt);
      let methods = heuristic.verificationMethods as VerificationType[];
      let mandatory = (heuristic as any).mandatoryVerificationMethods || [];
      if (payload.targetLocationName || payload.placeId) {
        if (!methods.includes('location' as any)) methods = [...methods, 'location' as any];
        if (!mandatory.includes('location' as any)) mandatory = [...mandatory, 'location' as any];
      }
      return { methods, mandatory, usedFallback: true };
    } catch (error) {
      console.warn('[AI] analyzeVerificationMethods failed, using heuristic fallback:', error);
      const heuristic = this.generateWithLocalHeuristic(payload.prompt);
      let methods = heuristic.verificationMethods as VerificationType[];
      let mandatory = (heuristic as any).mandatoryVerificationMethods || [];
      if (payload.targetLocationName || payload.placeId) {
        if (!methods.includes('location' as any)) methods = [...methods, 'location' as any];
        if (!mandatory.includes('location' as any)) mandatory = [...mandatory, 'location' as any];
      }
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