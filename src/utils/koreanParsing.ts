/**
 * Korean parsing utilities for goal generation
 * 
 * DETERMINISM RULES:
 * 1. Precedence: Specific day+time > time-only > frequency-only
 * 2. Multiple days: Take all mentioned days, no duplicates
 * 3. Multiple times: Use first time found, ignore subsequent
 * 4. Ambiguous cases: Default to frequency with manual verification
 * 5. Korean > English when both present (Korean takes precedence)
 */

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface TimeRange {
  start?: string;
  end?: string;
}

export interface RelativeSpan {
  startOffsetDays?: number;
  durationDays?: number;
}

/**
 * Korean weekday mapping (comprehensive)
 */
const KOREAN_WEEKDAY_MAP: Record<string, Weekday> = {
  // Full names
  '월요일': 'mon',
  '화요일': 'tue', 
  '수요일': 'wed',
  '목요일': 'thu',
  '금요일': 'fri',
  '토요일': 'sat',
  '일요일': 'sun',
  
  // Short forms
  '월': 'mon',
  '화': 'tue',
  '수': 'wed', 
  '목': 'thu',
  '금': 'fri',
  '토': 'sat',
  '일': 'sun',
  
  // English equivalents (lower precedence)
  'monday': 'mon',
  'tuesday': 'tue',
  'wednesday': 'wed',
  'thursday': 'thu',
  'friday': 'fri',
  'saturday': 'sat',
  'sunday': 'sun',
  
  // Short English
  'mon': 'mon',
  'tue': 'tue',
  'wed': 'wed',
  'thu': 'thu',
  'fri': 'fri',
  'sat': 'sat',
  'sun': 'sun'
};

/**
 * Korean time anchor mapping
 */
const KOREAN_TIME_ANCHORS: Record<string, string> = {
  '새벽': '05:00',
  '아침': '07:00',
  '점심': '12:00',
  '저녁': '18:00',
  '밤': '21:00',
  '자정': '00:00',
  '정오': '12:00'
};

/**
 * Parse Korean weekdays from input text
 * Returns array of weekdays found (no duplicates, preserves order)
 */
export function parseWeekdaysKo(input: string): Weekday[] {
  const found: Weekday[] = [];
  const seen = new Set<Weekday>();
  
  // Korean weekday patterns (higher precedence)
  const koreanPatterns = [
    { pattern: /월요일/gi, weekday: 'mon' as Weekday },
    { pattern: /화요일/gi, weekday: 'tue' as Weekday },
    { pattern: /수요일/gi, weekday: 'wed' as Weekday },
    { pattern: /목요일/gi, weekday: 'thu' as Weekday },
    { pattern: /금요일/gi, weekday: 'fri' as Weekday },
    { pattern: /토요일/gi, weekday: 'sat' as Weekday },
    { pattern: /일요일/gi, weekday: 'sun' as Weekday },
    // Short forms - match individual characters in sequences
    { pattern: /월/gi, weekday: 'mon' as Weekday },
    { pattern: /화/gi, weekday: 'tue' as Weekday },
    { pattern: /수/gi, weekday: 'wed' as Weekday },
    { pattern: /목/gi, weekday: 'thu' as Weekday },
    { pattern: /금/gi, weekday: 'fri' as Weekday },
    { pattern: /토/gi, weekday: 'sat' as Weekday },
    // Only match 일 if it's standalone (not part of 요일, 일주일, 매일, etc.)
    { pattern: /(?<!요)(?<!일)(?<!주)(?<!매)일(?=\s|[^\w가-힣]|$)/gi, weekday: 'sun' as Weekday }
  ];
  
  // English weekday patterns (lower precedence)
  const englishPatterns = [
    { pattern: /\bmonday\b/gi, weekday: 'mon' as Weekday },
    { pattern: /\btuesday\b/gi, weekday: 'tue' as Weekday },
    { pattern: /\bwednesday\b/gi, weekday: 'wed' as Weekday },
    { pattern: /\bthursday\b/gi, weekday: 'thu' as Weekday },
    { pattern: /\bfriday\b/gi, weekday: 'fri' as Weekday },
    { pattern: /\bsaturday\b/gi, weekday: 'sat' as Weekday },
    { pattern: /\bsunday\b/gi, weekday: 'sun' as Weekday },
    { pattern: /\bmon\b/gi, weekday: 'mon' as Weekday },
    { pattern: /\btue\b/gi, weekday: 'tue' as Weekday },
    { pattern: /\bwed\b/gi, weekday: 'wed' as Weekday },
    { pattern: /\bthu\b/gi, weekday: 'thu' as Weekday },
    { pattern: /\bfri\b/gi, weekday: 'fri' as Weekday },
    { pattern: /\bsat\b/gi, weekday: 'sat' as Weekday },
    { pattern: /\bsun\b/gi, weekday: 'sun' as Weekday }
  ];
  
  // Check Korean patterns first (higher precedence)
  for (const { pattern, weekday } of koreanPatterns) {
    const matches = input.match(pattern);
    if (matches) {
      for (const match of matches) {
        if (!seen.has(weekday)) {
          found.push(weekday);
          seen.add(weekday);
        }
      }
    }
  }
  
  // Check English patterns - allow mixing with Korean
  for (const { pattern, weekday } of englishPatterns) {
    const matches = input.match(pattern);
    if (matches) {
      for (const match of matches) {
        if (!seen.has(weekday)) {
          found.push(weekday);
          seen.add(weekday);
        }
      }
    }
  }
  
  return found;
}

/**
 * Parse Korean time phrases and convert to HH:MM format
 * Handles ranges like "18:30~19:10" and single times
 */
export function parseTimePhrasesKo(input: string): TimeRange {
  const result: TimeRange = {};
  
  // Korean range pattern: "6시-7시", "6시~7시" (highest precedence)
  const koreanRangePattern = /(\d{1,2})시\s*(?:(\d{1,2})분)?\s*[~-]\s*(\d{1,2})시\s*(?:(\d{1,2})분)?/;
  const koreanRangeMatch = input.match(koreanRangePattern);
  if (koreanRangeMatch) {
    const startHour = parseInt(koreanRangeMatch[1]);
    const startMin = koreanRangeMatch[2] ? parseInt(koreanRangeMatch[2]) : 0;
    const endHour = parseInt(koreanRangeMatch[3]);
    const endMin = koreanRangeMatch[4] ? parseInt(koreanRangeMatch[4]) : 0;
    
    result.start = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
    result.end = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
    return result;
  }

  // English range pattern: HH:MM~HH:MM or HH~HH
  const rangePattern = /(\d{1,2}):?(\d{2})?\s*[~-]\s*(\d{1,2}):?(\d{2})?/;
  const rangeMatch = input.match(rangePattern);
  if (rangeMatch) {
    const startHour = parseInt(rangeMatch[1]);
    const startMin = rangeMatch[2] ? parseInt(rangeMatch[2]) : 0;
    const endHour = parseInt(rangeMatch[3]);
    const endMin = rangeMatch[4] ? parseInt(rangeMatch[4]) : 0;
    
    result.start = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
    result.end = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
    return result;
  }
  
  // Korean time format with period: "오전 7시", "오후 3시"
  const koreanPeriodTimePattern = /(오전|오후)\s*(\d{1,2})시\s*(?:(\d{1,2})분)?/;
  const koreanPeriodMatch = input.match(koreanPeriodTimePattern);
  if (koreanPeriodMatch) {
    const period = koreanPeriodMatch[1];
    let hour = parseInt(koreanPeriodMatch[2]);
    const minute = koreanPeriodMatch[3] ? parseInt(koreanPeriodMatch[3]) : 0;
    
    // Validate input time ranges
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
      return result; // Invalid time, return empty
    }
    
    // Convert to 24-hour format
    if (period === '오후' && hour !== 12) hour += 12;
    if (period === '오전' && hour === 12) hour = 0;
    
    result.start = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    return result;
  }

  // Standalone Korean period: "오전", "오후"
  const koreanPeriodOnlyPattern = /(오전|오후)(?!\s*\d)/;
  const koreanPeriodOnlyMatch = input.match(koreanPeriodOnlyPattern);
  if (koreanPeriodOnlyMatch) {
    const period = koreanPeriodOnlyMatch[1];
    // Default times for standalone periods
    if (period === '오전') {
      result.start = '09:00'; // Default morning time
    } else if (period === '오후') {
      result.start = '15:00'; // Default afternoon time
    }
    return result;
  }
  
  // Korean time format: "6시", "6시 30분" (higher precedence than anchors)
  const koreanTimePattern = /(\d{1,2})시\s*(?:(\d{1,2})분)?/;
  const koreanMatch = input.match(koreanTimePattern);
  if (koreanMatch) {
    const hour = parseInt(koreanMatch[1]);
    const minute = koreanMatch[2] ? parseInt(koreanMatch[2]) : 0;
    
    // Validate time ranges
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return result; // Invalid time, return empty
    }
    
    result.start = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    return result;
  }
  
  // English format: "6am", "6:30pm", "18:30" (but not "30분")
  const englishTimePattern = /(\d{1,2}):(\d{2})\s*(am|pm)?|(\d{1,2})\s*(am|pm)\b/i;
  const englishMatch = input.match(englishTimePattern);
  if (englishMatch) {
    let hour: number;
    let minute = 0;
    let ampm: string | undefined;
    
    if (englishMatch[1] && englishMatch[2]) {
      // Format: "6:30am" or "18:30"
      hour = parseInt(englishMatch[1]);
      minute = parseInt(englishMatch[2]);
      ampm = englishMatch[3]?.toLowerCase();
    } else if (englishMatch[4] && englishMatch[5]) {
      // Format: "6am"
      hour = parseInt(englishMatch[4]);
      ampm = englishMatch[5]?.toLowerCase();
    } else {
      return result;
    }
    
    // Convert to 24-hour format
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    
    result.start = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    return result;
  }
  
  // Time anchor patterns (Korean) - lowest precedence
  for (const [anchor, time] of Object.entries(KOREAN_TIME_ANCHORS)) {
    if (input.includes(anchor)) {
      result.start = time;
      return result; // Take first anchor found
    }
  }
  
  return result;
}

/**
 * Parse Korean relative time spans
 * Examples: "내일부터 2주간", "다음달 평일"
 */
export function parseRelativeSpanKo(input: string): RelativeSpan {
  const result: RelativeSpan = {};
  
  // Start offset patterns
  if (input.includes('내일') || input.includes('tomorrow')) {
    result.startOffsetDays = 1;
  } else if (input.includes('모레') || input.includes('day after tomorrow')) {
    result.startOffsetDays = 2;
  } else if (input.includes('다음주') || input.includes('next week')) {
    result.startOffsetDays = 7;
  } else if (input.includes('다음달') || input.includes('next month')) {
    result.startOffsetDays = 30;
  }
  
  // Duration patterns
  const durationPattern = /(\d+)\s*(주|week|일|day|개월|month)/;
  const durationMatch = input.match(durationPattern);
  if (durationMatch) {
    const amount = parseInt(durationMatch[1]);
    const unit = durationMatch[2];
    
    if (unit.includes('주') || unit.includes('week')) {
      result.durationDays = amount * 7;
    } else if (unit.includes('일') || unit.includes('day')) {
      result.durationDays = amount;
    } else if (unit.includes('개월') || unit.includes('month')) {
      result.durationDays = amount * 30;
    }
  }
  
  return result;
}

/**
 * Parse combined Korean patterns (weekdays + times)
 * Returns structured data for goal scheduling
 */
export function parseKoreanSchedule(input: string): {
  weekdays: Weekday[];
  timeRange: TimeRange;
  relativeSpan: RelativeSpan;
} {
  return {
    weekdays: parseWeekdaysKo(input),
    timeRange: parseTimePhrasesKo(input),
    relativeSpan: parseRelativeSpanKo(input)
  };
}
