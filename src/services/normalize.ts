/**
 * Normalization Layer for GoalSpec v2 (Occurrence-based)
 * 
 * Converts raw user input from widgets into canonical GoalSpecV2 format.
 * This is the ONLY place where data transformation happens.
 * 
 * Rules:
 * - Input: Raw widget values (strings, dates, arrays)
 * - Output: Normalized values matching GoalSpecV2 schema
 * - All date/time handling uses provided timezone
 * - Validation happens here (type coercion, range checks)
 */

import { ScheduleOverride, SlotId } from '../schemas/goalSpecV2';

/**
 * Normalize a slot value based on its ID
 * 
 * @param slotId - The slot identifier
 * @param raw - Raw value from widget
 * @param timezone - User's timezone (e.g., "Asia/Seoul")
 * @returns Normalized value ready for GoalSpecV2
 */
export function normalize(slotId: SlotId | string, raw: any, timezone?: string): any {
  console.log('[NORMALIZE]', { slotId, raw, timezone });
  
  // Handle legacy slot IDs
  const normalizedSlotId = normalizeLegacySlotId(slotId);
  
  switch (normalizedSlotId) {
    case "type":
      return normalizeType(raw);
      
    case "title":
      return normalizeTitle(raw);
      
    case "period":
      return normalizePeriod(raw, timezone);
      
    case "baseRule.weekdays":
      return normalizeWeekdays(raw);
      
    case "baseRule.time":
      return normalizeTime(raw);
      
    case "exceptions":
      return normalizeExceptions(raw);
      
    case "confirmOccurrences":
      // This is a flag slot - no normalization needed
      return true;
      
    case "perWeek":
      return normalizePerWeek(raw);
      
    case "milestones":
      return normalizeMilestones(raw);
      
    case "currentState":
      return normalizeCurrentState(raw);
      
    case "verification":
      return normalizeVerification(raw);
      
    case "successRate":
      return normalizeSuccessRate(raw);
      
    default:
      console.warn('[NORMALIZE] Unknown slotId:', slotId);
      return raw;
  }
}

/**
 * Map legacy slot IDs to new SlotId format
 */
function normalizeLegacySlotId(slotId: string): SlotId | string {
  const legacyMap: Record<string, SlotId> = {
    'weekdays': 'baseRule.weekdays',
    'time': 'baseRule.time'
  };
  
  return legacyMap[slotId] || slotId as SlotId;
}

/**
 * Normalize goal type
 */
function normalizeType(raw: any): "schedule" | "frequency" | "milestone" {
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase();
    if (lower === 'schedule' || lower === 'frequency' || lower === 'milestone') {
      return lower as "schedule" | "frequency" | "milestone";
    }
  }
  
  console.warn('[NORMALIZE] Invalid type, defaulting to "frequency":', raw);
  return "frequency";
}

/**
 * Normalize title
 */
function normalizeTitle(raw: any): string {
  if (typeof raw === 'string') {
    return raw.trim();
  }
  
  console.warn('[NORMALIZE] Invalid title, using default:', raw);
  return "새 목표";
}

/**
 * Normalize period (date range)
 * 
 * Input formats supported:
 * - { startDate: Date, endDate: Date }
 * - { startDate: string, endDate: string }
 * - { start: string, end: string }
 */
function normalizePeriod(raw: any, timezone?: string): { start: string; end: string } {
  if (!raw || typeof raw !== 'object') {
    console.error('[NORMALIZE] Invalid period:', raw);
    throw new Error('Period must be an object with start and end dates');
  }
  
  const startRaw = raw.startDate || raw.start;
  const endRaw = raw.endDate || raw.end;
  
  const start = toISODate(startRaw, timezone);
  const end = toISODate(endRaw, timezone);
  
  // Validate: end should be after or equal to start
  if (new Date(end) < new Date(start)) {
    console.warn('[NORMALIZE] End date before start date, swapping:', { start, end });
    return { start: end, end: start };
  }
  
  console.log('[NORMALIZE] Period normalized:', { start, end });
  return { start, end };
}

/**
 * Normalize weekdays
 * 
 * Input formats:
 * - ["mon", "wed", "fri"] - string day names
 * - [1, 3, 5] - numeric (0=Sun, 6=Sat)
 * - ["월요일", "수요일", "금요일"] - Korean day names
 */
function normalizeWeekdays(raw: any): number[] {
  if (!Array.isArray(raw)) {
    console.error('[NORMALIZE] Weekdays must be an array:', raw);
    return [];
  }
  
  const result: number[] = [];
  
  for (const item of raw) {
    if (typeof item === 'number') {
      // Already a number, validate range
      if (item >= 0 && item <= 6) {
        result.push(item);
      }
    } else if (typeof item === 'string') {
      // Convert string to number
      const num = dayNameToNumber(item);
      if (num !== null) {
        result.push(num);
      }
    }
  }
  
  // Remove duplicates and sort
  const unique = Array.from(new Set(result)).sort((a, b) => a - b);
  
  console.log('[NORMALIZE] Weekdays normalized:', { raw, result: unique });
  return unique;
}

/**
 * Normalize time (HH:mm format)
 * 
 * Input formats:
 * - "7:00", "07:00", "19:00"
 * - Date object
 * - "오전 7시", "오후 7시" (Korean)
 */
function normalizeTime(raw: any): string {
  if (typeof raw === 'string') {
    // Already in HH:mm format
    if (/^\d{1,2}:\d{2}$/.test(raw)) {
      const [hours, minutes] = raw.split(':').map(Number);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    
    // Korean format: "오전 7시" → "07:00", "오후 7시" → "19:00"
    const koreanMatch = raw.match(/(오전|오후)\s*(\d+)시/);
    if (koreanMatch) {
      const isPM = koreanMatch[1] === '오후';
      let hours = parseInt(koreanMatch[2]);
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:00`;
    }
  }
  
  if (raw instanceof Date) {
    const hours = raw.getHours();
    const minutes = raw.getMinutes();
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  
  console.warn('[NORMALIZE] Invalid time, using default 09:00:', raw);
  return "09:00";
}

/**
 * Normalize exceptions (schedule overrides)
 * 
 * Input format:
 * Array of override objects from OccurrenceEditor
 */
function normalizeExceptions(raw: any): ScheduleOverride[] {
  if (!Array.isArray(raw)) {
    console.warn('[NORMALIZE] Exceptions must be an array:', raw);
    return [];
  }
  
  const result: ScheduleOverride[] = [];
  
  for (const item of raw) {
    if (!item || typeof item !== 'object' || !item.kind) {
      console.warn('[NORMALIZE] Invalid exception item:', item);
      continue;
    }
    
    switch (item.kind) {
      case 'add':
        if (item.date && item.time) {
          result.push({ kind: 'add', date: item.date, time: item.time });
        }
        break;
      case 'cancel':
        if (item.date) {
          result.push({ kind: 'cancel', date: item.date });
        }
        break;
      case 'retime':
        if (item.date && item.time) {
          result.push({ kind: 'retime', date: item.date, time: item.time });
        }
        break;
      case 'move':
        if (item.from && item.toDate && item.toTime) {
          result.push({ 
            kind: 'move', 
            from: item.from, 
            toDate: item.toDate, 
            toTime: item.toTime 
          });
        }
        break;
      default:
        console.warn('[NORMALIZE] Unknown exception kind:', item.kind);
    }
  }
  
  console.log('[NORMALIZE] Exceptions normalized:', { raw: raw.length, result: result.length });
  return result;
}

/**
 * Normalize perWeek (frequency)
 */
function normalizePerWeek(raw: any): { targetPerWeek: number; windowDays: number } {
  const num = Number(raw);
  const targetPerWeek = isNaN(num) ? 3 : Math.max(1, Math.min(7, num));
  
  console.log('[NORMALIZE] PerWeek normalized:', { raw, targetPerWeek });
  return { targetPerWeek, windowDays: 7 };
}

/**
 * Normalize milestones
 * 
 * Input formats:
 * - ["시작", "중간", "완료"] - array of labels
 * - [{ key: "m1", label: "시작" }, ...] - already normalized
 */
function normalizeMilestones(raw: any): Array<{ key: string; label: string }> {
  if (!Array.isArray(raw)) {
    console.error('[NORMALIZE] Milestones must be an array:', raw);
    return [
      { key: "m1", label: "시작" },
      { key: "m2", label: "중간" },
      { key: "m3", label: "완료" }
    ];
  }
  
  return raw.map((item, index) => {
    if (typeof item === 'string') {
      return { key: `m${index + 1}`, label: item };
    } else if (typeof item === 'object' && item.key && item.label) {
      return { key: item.key, label: item.label };
    } else {
      return { key: `m${index + 1}`, label: String(item) };
    }
  });
}

/**
 * Normalize current state
 */
function normalizeCurrentState(raw: any): string {
  if (typeof raw === 'string') {
    return raw.trim();
  }
  
  console.warn('[NORMALIZE] Invalid currentState, using default:', raw);
  return "처음 시작";
}

/**
 * Normalize verification signals
 * 
 * Input formats:
 * - ["사진", "위치 등록"] - Korean labels (from chips widget)
 * - ["photo", "location"] - English signals
 */
function normalizeVerification(raw: any): { signals: Array<"manual" | "photo" | "location" | "time"> } {
  if (!Array.isArray(raw)) {
    console.error('[NORMALIZE] Verification must be an array:', raw);
    return { signals: ["manual"] };
  }
  
  const signalMap: Record<string, "manual" | "photo" | "location" | "time"> = {
    '사진': 'photo',
    'photo': 'photo',
    '위치 등록': 'location',
    '위치': 'location',
    'location': 'location',
    '체크리스트': 'manual',
    'manual': 'manual',
    '시간': 'time',
    'time': 'time'
  };
  
  const signals: Array<"manual" | "photo" | "location" | "time"> = [];
  
  for (const item of raw) {
    const key = String(item).toLowerCase();
    for (const [pattern, signal] of Object.entries(signalMap)) {
      if (key.includes(pattern.toLowerCase()) || pattern.toLowerCase().includes(key)) {
        signals.push(signal);
        break;
      }
    }
  }
  
  // Remove duplicates
  const unique = Array.from(new Set(signals));
  
  if (unique.length === 0) {
    console.warn('[NORMALIZE] No valid verification signals, using manual:', raw);
    return { signals: ["manual"] };
  }
  
  console.log('[NORMALIZE] Verification normalized:', { raw, signals: unique });
  return { signals: unique };
}

/**
 * Normalize success rate
 */
function normalizeSuccessRate(raw: any): { targetRate: number } {
  const rate = Math.max(0, Math.min(100, Number(raw) || 70));
  
  console.log('[NORMALIZE] SuccessRate normalized:', { raw, targetRate: rate });
  return { targetRate: rate };
}

/**
 * Helper: Convert date to ISO format (YYYY-MM-DD)
 */
function toISODate(d: any, timezone?: string): string {
  if (typeof d === 'string') {
    // Already a string, validate and normalize
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return d;
    }
    // Try parsing
    d = new Date(d);
  }
  
  if (d instanceof Date && !isNaN(d.getTime())) {
    // Use local date components to avoid timezone issues
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  console.error('[NORMALIZE] Invalid date:', d);
  throw new Error('Invalid date format');
}

/**
 * Helper: Convert day name to number
 */
function dayNameToNumber(name: string): number | null {
  const map: Record<string, number> = {
    'sun': 0, 'sunday': 0, '일': 0, '일요일': 0,
    'mon': 1, 'monday': 1, '월': 1, '월요일': 1,
    'tue': 2, 'tuesday': 2, '화': 2, '화요일': 2,
    'wed': 3, 'wednesday': 3, '수': 3, '수요일': 3,
    'thu': 4, 'thursday': 4, '목': 4, '목요일': 4,
    'fri': 5, 'friday': 5, '금': 5, '금요일': 5,
    'sat': 6, 'saturday': 6, '토': 6, '토요일': 6
  };
  
  const key = name.toLowerCase().trim();
  return map[key] ?? null;
}
