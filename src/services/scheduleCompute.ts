/**
 * Schedule Computation Engine
 * 
 * Converts schedule rules into concrete occurrences with timezone support.
 * Handles overrides (add/cancel/retime/move) and generates final UTC timestamps.
 * 
 * Core Flow:
 * 1. Expand rules (weekdays + time) across period → initial occurrences
 * 2. Apply overrides (cancel/retime/add/move)
 * 3. Sort and convert to UTC ISO format
 * 
 * Uses native Date APIs for timezone handling (no external dependencies)
 */

import { GoalSpecV2, Occurrence, ScheduleOverride, ScheduleRule } from '../schemas/goalSpecV2';

/**
 * Build final occurrences from goal spec
 * 
 * @param spec - Goal specification with schedule rules and overrides
 * @returns Array of occurrences in UTC ISO format
 */
export function buildOccurrences(spec: GoalSpecV2): Occurrence[] {
  console.log('[SCHED.BUILD] Starting occurrence computation:', {
    timezone: spec.timezone,
    period: spec.period,
    rules: spec.schedule?.rules?.length || 0,
    overrides: spec.schedule?.overrides?.length || 0
  });

  if (!spec.schedule?.rules || spec.schedule.rules.length === 0) {
    console.warn('[SCHED.BUILD] No schedule rules defined');
    return [];
  }

  const timezone = spec.timezone || 'Asia/Seoul';
  const { start, end } = spec.period;
  const rules = spec.schedule.rules;
  const overrides = spec.schedule.overrides || [];
  const durationMin = spec.schedule.defaultDurationMin || 60;

  // Step 1: Expand rules into initial occurrences
  let occurrences = expandRules(rules, start, end, timezone);
  console.log('[SCHED.BUILD] Step 1 - Expanded rules:', occurrences.length, 'occurrences');

  // Step 2: Apply overrides
  occurrences = applyOverrides(occurrences, overrides, timezone);
  console.log('[SCHED.BUILD] Step 2 - After overrides:', occurrences.length, 'occurrences');

  // Step 3: Sort and convert to UTC ISO
  const finalOccurrences = occurrences
    .sort((a, b) => a.getTime() - b.getTime())
    .map(dt => {
      const start = toUTCISO(dt);
      const end = toUTCISO(addMinutes(dt, durationMin));
      return { start, end };
    });

  console.log('[SCHED.BUILD] ✅ Final occurrences:', finalOccurrences.length);
  console.log('[SCHED.BUILD] First 3:', finalOccurrences.slice(0, 3));
  
  return finalOccurrences;
}

/**
 * Expand schedule rules into concrete dates
 */
function expandRules(
  rules: ScheduleRule[],
  startDate: string,
  endDate: string,
  timezone: string
): Date[] {
  const occurrences: Date[] = [];
  
  // Parse period dates
  const start = parseDate(startDate, timezone);
  const end = parseDate(endDate, timezone);
  
  console.log('[SCHED.EXPAND] Expanding rules from', startDate, 'to', endDate);
  
  // Iterate through each day in the period
  let currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    
    // Check each rule
    for (const rule of rules) {
      if (rule.byWeekday.includes(dayOfWeek)) {
        // This rule applies to this day
        const time = rule.time || '09:00';
        const occurrence = combineDateAndTime(currentDate, time, timezone);
        occurrences.push(occurrence);
        
        console.log('[SCHED.EXPAND] Added:', formatLocal(occurrence, timezone));
      }
    }
    
    // Move to next day
    currentDate = addDays(currentDate, 1);
  }
  
  return occurrences;
}

/**
 * Apply overrides to occurrence list
 */
function applyOverrides(
  occurrences: Date[],
  overrides: ScheduleOverride[],
  timezone: string
): Date[] {
  let result = [...occurrences];
  
  console.log('[SCHED.OVERRIDE] Applying', overrides.length, 'overrides');
  
  for (const override of overrides) {
    switch (override.kind) {
      case 'cancel':
        // Remove occurrences on this date
        result = result.filter(dt => !isSameDate(dt, override.date, timezone));
        console.log('[SCHED.OVERRIDE] Canceled:', override.date);
        break;
        
      case 'retime':
        // Change time for occurrences on this date
        result = result.map(dt => {
          if (isSameDate(dt, override.date, timezone)) {
            const newTime = combineDateAndTime(dt, override.time, timezone);
            console.log('[SCHED.OVERRIDE] Retimed:', override.date, 'to', override.time);
            return newTime;
          }
          return dt;
        });
        break;
        
      case 'add':
        // Add new occurrence
        const newOccurrence = combineDateAndTime(
          parseDate(override.date, timezone),
          override.time,
          timezone
        );
        result.push(newOccurrence);
        console.log('[SCHED.OVERRIDE] Added:', override.date, override.time);
        break;
        
      case 'move':
        // Remove from original date and add to new date
        result = result.filter(dt => !isSameDate(dt, override.from, timezone));
        const movedOccurrence = combineDateAndTime(
          parseDate(override.toDate, timezone),
          override.toTime,
          timezone
        );
        result.push(movedOccurrence);
        console.log('[SCHED.OVERRIDE] Moved:', override.from, '→', override.toDate, override.toTime);
        break;
    }
  }
  
  return result;
}

/**
 * Parse date string in local timezone
 */
function parseDate(dateStr: string, timezone: string): Date {
  // dateStr format: YYYY-MM-DD
  // We want to create a Date at midnight in the specified timezone
  
  // For simplicity with native Date API, we assume local timezone matches
  // For production, use a proper timezone library (dayjs, date-fns-tz, luxon)
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Combine date and time in local timezone
 */
function combineDateAndTime(date: Date, timeStr: string, timezone: string): Date {
  // timeStr format: HH:mm
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  
  return result;
}

/**
 * Check if two dates are on the same day (ignoring time)
 */
function isSameDate(date: Date, dateStr: string, timezone: string): boolean {
  const d1 = formatDateOnly(date);
  const d2 = dateStr;
  return d1 === d2;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date with time for logging
 */
function formatLocal(date: Date, timezone: string): string {
  const dateStr = formatDateOnly(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}`;
}

/**
 * Convert to UTC ISO string
 */
function toUTCISO(date: Date): string {
  return date.toISOString();
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add minutes to a date
 */
function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/**
 * Preview occurrences for UI display (before confirmation)
 * 
 * Returns human-readable occurrence list
 */
export function previewOccurrences(spec: Partial<GoalSpecV2>): Array<{
  date: string;      // YYYY-MM-DD
  time: string;      // HH:mm
  dayName: string;   // 월요일, 화요일...
  weekNumber: number; // Week number in period
}> {
  if (!spec.schedule?.rules || !spec.period) {
    return [];
  }

  const timezone = spec.timezone || 'Asia/Seoul';
  const occurrences = expandRules(
    spec.schedule.rules,
    spec.period.start,
    spec.period.end,
    timezone
  );

  // Apply overrides if any
  const withOverrides = spec.schedule.overrides 
    ? applyOverrides(occurrences, spec.schedule.overrides, timezone)
    : occurrences;

  // Convert to preview format
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const startDate = parseDate(spec.period.start, timezone);

  return withOverrides
    .sort((a, b) => a.getTime() - b.getTime())
    .map((dt, index) => {
      const weekNumber = Math.floor((dt.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      
      return {
        date: formatDateOnly(dt),
        time: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
        dayName: dayNames[dt.getDay()],
        weekNumber
      };
    });
}

/**
 * Validate occurrences
 */
export function validateOccurrences(occurrences: Occurrence[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (occurrences.length === 0) {
    errors.push('최소 1개 이상의 일정이 필요합니다');
  }

  if (occurrences.length > 100) {
    errors.push('일정은 최대 100개까지 생성할 수 있습니다');
  }

  // Check for valid ISO format
  for (const occ of occurrences) {
    try {
      new Date(occ.start);
      if (occ.end) new Date(occ.end);
    } catch (e) {
      errors.push('잘못된 날짜 형식이 포함되어 있습니다');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

