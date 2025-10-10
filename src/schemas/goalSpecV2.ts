/**
 * GoalSpec v2 - Single Source of Truth (SSOT)
 * Occurrence-based Schedule System
 * 
 * Core Concept:
 * - Rules define patterns (e.g., "Mon/Wed/Fri 19:00")
 * - Rules are expanded into concrete occurrences
 * - User can edit individual occurrences (add/cancel/retime/move)
 * - Final occurrences array drives quest generation
 * 
 * Version: 2.0.0 - Occurrence-based
 */

export type GoalType = "schedule" | "frequency" | "milestone";

/**
 * Schedule rule - defines recurring pattern
 */
export interface ScheduleRule {
  /** Weekdays when this rule applies (0=Sunday, 1=Monday, ..., 6=Saturday) */
  byWeekday: number[];
  /** Time in HH:mm format (24-hour) */
  time?: string;
}

/**
 * Override types for schedule exceptions
 */
export type ScheduleOverride =
  | { kind: "add"; date: string; time: string }           // Add new occurrence
  | { kind: "cancel"; date: string }                       // Cancel occurrence on this date
  | { kind: "retime"; date: string; time: string }        // Change time on this date
  | { kind: "move"; from: string; toDate: string; toTime: string }; // Move occurrence

/**
 * Final occurrence - concrete datetime in UTC
 */
export interface Occurrence {
  /** Start time in UTC ISO format */
  start: string;
  /** End time in UTC ISO format (optional) */
  end?: string;
}

/**
 * Core goal specification interface
 */
export interface GoalSpecV2 {
  /** Goal type - determines required fields */
  type: GoalType;
  
  /** User-friendly goal title */
  title: string;

  /** Timezone for all date/time operations (REQUIRED) */
  timezone: string; // e.g., "Asia/Seoul"

  /** Date range for goal execution (YYYY-MM-DD format) */
  period: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
  };

  /** Schedule-specific configuration (for type="schedule") */
  schedule?: {
    /** Recurring rules (e.g., Mon/Wed/Fri at 19:00) */
    rules?: ScheduleRule[];
    
    /** Exceptions/overrides to the rules */
    overrides?: ScheduleOverride[];
    
    /** Final confirmed occurrences (UTC ISO) */
    occurrences?: Occurrence[];
    
    /** Default duration for each occurrence in minutes */
    defaultDurationMin?: number;
  };

  /** Frequency-specific configuration (for type="frequency") */
  frequency?: {
    targetPerWeek: number; // Number of times per week
    windowDays?: number;   // Rolling window (default: 7)
  };

  /** Milestone-specific configuration (for type="milestone") */
  milestone?: {
    milestones: Array<{
      key: string;    // Unique identifier (e.g., "m1", "m2")
      label: string;  // Display label (e.g., "시작", "중간", "완료")
    }>;
    currentState?: string; // User's current state description
  };

  /** Verification methods */
  verification?: {
    signals: Array<"manual" | "photo" | "location" | "time">;
  };

  /** Success criteria */
  successCriteria?: {
    targetRate?: number; // Percentage (0-100)
  };

  /** Locale for internationalization */
  locale?: string; // e.g., "ko-KR", "en-US"

  /** Version for optimistic locking */
  version: number;

  /** Creation timestamp */
  createdAt?: string; // ISO8601

  /** Last update timestamp */
  updatedAt?: string; // ISO8601
}

/**
 * Slot IDs used in the chatbot conversation
 */
export type SlotId =
  | "type"
  | "title"
  | "period"
  | "baseRule.weekdays"
  | "baseRule.time"
  | "exceptions"
  | "confirmOccurrences"
  | "perWeek"
  | "milestones"
  | "currentState"
  | "verification"
  | "successRate";

/**
 * Required slots for each goal type
 */
export const REQUIRED_SLOTS: Record<GoalType, SlotId[]> = {
  schedule: [
    "type",
    "title",
    "period",
    "baseRule.weekdays",
    "baseRule.time",
    "confirmOccurrences", // Must confirm occurrences before proceeding
    "verification",
    "successRate"
  ],
  frequency: [
    "type",
    "title",
    "period",
    "perWeek",
    "verification",
    "successRate"
  ],
  milestone: [
    "type",
    "title",
    "period",
    "milestones",
    "currentState",
    "verification",
    "successRate"
  ]
};

/**
 * Check if all required slots are filled for a goal type
 */
export function isAllRequiredFilled(spec: Partial<GoalSpecV2>): boolean {
  if (!spec.type) return false;
  
  const required = REQUIRED_SLOTS[spec.type];
  
  for (const slotId of required) {
    switch (slotId) {
      case "type":
        if (!spec.type) return false;
        break;
      case "title":
        if (!spec.title) return false;
        break;
      case "period":
        if (!spec.period?.start || !spec.period?.end) return false;
        break;
      case "baseRule.weekdays":
        if (!spec.schedule?.rules || spec.schedule.rules.length === 0) return false;
        if (!spec.schedule.rules[0].byWeekday || spec.schedule.rules[0].byWeekday.length === 0) return false;
        break;
      case "baseRule.time":
        if (!spec.schedule?.rules || spec.schedule.rules.length === 0) return false;
        if (!spec.schedule.rules[0].time) return false;
        break;
      case "confirmOccurrences":
        // Occurrences must be explicitly confirmed
        if (!spec.schedule?.occurrences || spec.schedule.occurrences.length === 0) return false;
        break;
      case "perWeek":
        if (!spec.frequency?.targetPerWeek) return false;
        break;
      case "milestones":
        if (!spec.milestone?.milestones || spec.milestone.milestones.length === 0) return false;
        break;
      case "currentState":
        if (!spec.milestone?.currentState) return false;
        break;
      case "verification":
        if (!spec.verification?.signals || spec.verification.signals.length === 0) return false;
        break;
      case "successRate":
        if (spec.successCriteria?.targetRate === undefined) return false;
        break;
      case "exceptions":
        // Exceptions are optional, always "filled"
        break;
    }
  }
  
  return true;
}

/**
 * Get filled slot IDs from a spec
 */
export function getFilledSlots(spec: Partial<GoalSpecV2>): SlotId[] {
  const filled: SlotId[] = [];
  
  if (spec.type) filled.push("type");
  if (spec.title) filled.push("title");
  if (spec.period?.start && spec.period?.end) filled.push("period");
  
  if (spec.schedule?.rules && spec.schedule.rules.length > 0) {
    if (spec.schedule.rules[0].byWeekday && spec.schedule.rules[0].byWeekday.length > 0) {
      filled.push("baseRule.weekdays");
    }
    if (spec.schedule.rules[0].time) {
      filled.push("baseRule.time");
    }
  }
  
  if (spec.schedule?.overrides && spec.schedule.overrides.length > 0) {
    filled.push("exceptions");
  }
  
  if (spec.schedule?.occurrences && spec.schedule.occurrences.length > 0) {
    filled.push("confirmOccurrences");
  }
  
  if (spec.frequency?.targetPerWeek) filled.push("perWeek");
  if (spec.milestone?.milestones && spec.milestone.milestones.length > 0) filled.push("milestones");
  if (spec.milestone?.currentState) filled.push("currentState");
  if (spec.verification?.signals && spec.verification.signals.length > 0) filled.push("verification");
  if (spec.successCriteria?.targetRate !== undefined) filled.push("successRate");
  
  return filled;
}

/**
 * Get missing slot IDs for a goal type
 */
export function getMissingSlots(spec: Partial<GoalSpecV2>): SlotId[] {
  if (!spec.type) return ["type"];
  
  const required = REQUIRED_SLOTS[spec.type];
  const filled = getFilledSlots(spec);
  
  return required.filter(slot => !filled.includes(slot));
}

/**
 * Get human-readable slot name
 */
export function getSlotName(slotId: SlotId): string {
  const names: Record<SlotId, string> = {
    "type": "목표 유형",
    "title": "목표 제목",
    "period": "기간",
    "baseRule.weekdays": "요일",
    "baseRule.time": "시간",
    "exceptions": "예외 일정",
    "confirmOccurrences": "일정 확정",
    "perWeek": "주당 횟수",
    "milestones": "단계",
    "currentState": "현재 상태",
    "verification": "검증 방법",
    "successRate": "목표 달성률"
  };
  return names[slotId] || slotId;
}

// Stub exports for backwards compatibility
export type GoalSpec = GoalSpecV2;
export function validateGoalSpec(spec: any): any {
  return { isValid: true, spec };
}
export function validateGoalSpecWithRecovery(spec: any): any {
  return { isValid: true, spec, recovery: {} };
}
export function validateTypeSpecificFields(spec: any): any {
  return { isValid: true };
}
