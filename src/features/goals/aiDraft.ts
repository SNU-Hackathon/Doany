// AI Goal Draft State Management

import { getLocalYMD } from '../../utils/dateUtils';

export type VerificationMethod = "location" | "time" | "screentime" | "photo" | "manual";

export interface AIGoalDraft {
  title?: string;
  category?: string;
  verificationMethods?: VerificationMethod[];
  // Methods that AI determined are mandatory and should be locked in UI
  mandatoryVerificationMethods?: VerificationMethod[];
  frequency?: { 
    count?: number; 
    unit?: "per_day" | "per_week" | "per_month" 
  };
  startDate?: string;         // ISO (YYYY-MM-DD)
  duration?: {
    type?: "days" | "weeks" | "months" | "range";
    value?: number;
    startDate?: string;       // for range mode
    endDate?: string;         // for range mode
  };
  targetLocation?: { 
    name?: string; 
    placeId?: string; 
    lat?: number; 
    lng?: number 
  };
  notes?: string;
  missingFields?: string[];   // computed via validator
  followUpQuestion?: string;  // not used for dates when picker is visible
  lastAskedField?: string;    // track what we last asked to avoid re-asking
  needsWeeklySchedule?: boolean; // AI determines if weekly schedule is needed
  weeklySchedule?: { [key: string]: string };
}

/**
 * Merge incoming AI goal data into existing draft
 * Idempotent - never unset existing fields unless explicitly null
 */
export function mergeAIGoal(draft: AIGoalDraft, incoming: Partial<AIGoalDraft>): AIGoalDraft {
  const merged: AIGoalDraft = { ...draft };

  // Only update fields that are provided and not empty
  if (incoming.title?.trim()) merged.title = incoming.title.trim();
  if (incoming.category?.trim()) merged.category = incoming.category.trim();
  if (incoming.verificationMethods?.length) merged.verificationMethods = incoming.verificationMethods;
  if (incoming.mandatoryVerificationMethods) merged.mandatoryVerificationMethods = incoming.mandatoryVerificationMethods;
  if (incoming.frequency) merged.frequency = { ...merged.frequency, ...incoming.frequency };
  if (incoming.startDate?.trim()) merged.startDate = incoming.startDate.trim();
  if (incoming.duration) merged.duration = { ...merged.duration, ...incoming.duration };
  // If duration contains startDate and top-level startDate is missing, mirror it for validation compatibility
  if (!merged.startDate && merged.duration?.startDate) merged.startDate = merged.duration.startDate;
  if (incoming.targetLocation) merged.targetLocation = { ...merged.targetLocation, ...incoming.targetLocation };
  if (incoming.notes?.trim()) merged.notes = incoming.notes.trim();
  if (incoming.lastAskedField) merged.lastAskedField = incoming.lastAskedField;
  if (incoming.needsWeeklySchedule !== undefined) merged.needsWeeklySchedule = incoming.needsWeeklySchedule;

  // Always recompute validation after merge
  const validation = validateAIGoal(merged);
  merged.missingFields = validation.missingFields;
  merged.followUpQuestion = validation.followUpQuestion;

  return merged;
}

/**
 * Validate AI goal draft and return missing fields
 */
export function validateAIGoal(draft: AIGoalDraft): { 
  missingFields: string[]; 
  followUpQuestion?: string;
  needsDatePicker?: boolean;
} {
  const missing: string[] = [];
  let followUpQuestion: string | undefined;
  let needsDatePicker = false;

  // Required fields validation
  if (!draft.title?.trim()) missing.push('title');
  if (!draft.category?.trim()) missing.push('category');
  if (!draft.verificationMethods?.length) missing.push('verificationMethods');
  if (!draft.frequency?.count || draft.frequency.count < 1) missing.push('frequency');

  // Date validation - trigger picker instead of AI questions
  const hasDurationStart = !!draft.duration?.startDate;
  const needsStartDate = !draft.startDate?.trim() && !hasDurationStart;
  const needsDuration = !draft.duration || (!draft.duration.value && draft.duration.type !== 'range');
  const needsDateRange = draft.duration?.type === 'range' && (!draft.duration.startDate || !draft.duration.endDate);

  if (needsStartDate || needsDuration || needsDateRange) {
    if (needsStartDate) missing.push('startDate');
    if (needsDuration || needsDateRange) missing.push('duration');
    needsDatePicker = true;
    followUpQuestion = 'Please select your start date and duration using the calendar below.';
  }

  // Location validation - only if location verification is selected
  if (draft.verificationMethods?.includes('location') && !draft.targetLocation) {
    missing.push('targetLocation');
    if (!needsDatePicker) {
      followUpQuestion = 'Please select a specific location for this goal.';
    }
  }

  // Generate a single, targeted follow-up question (one-by-one)
  if (!needsDatePicker && missing.length > 0 && !followUpQuestion) {
    const firstMissing = missing.find(f => !['startDate', 'duration'].includes(f)) || missing[0];
    if (firstMissing === 'targetLocation') {
      followUpQuestion = 'Which location should we use? (e.g., GymBox Gangnam)';
    } else if (firstMissing === 'frequency') {
      followUpQuestion = 'How often should we repeat this? (e.g., 3 per week, or 1 per day)';
    } else if (firstMissing === 'verificationMethods') {
      followUpQuestion = 'Which verification methods should we use? (e.g., manual, time, location, photo)';
    } else {
      followUpQuestion = `Please provide ${firstMissing}.`;
    }
  }

  return {
    missingFields: missing,
    followUpQuestion,
    needsDatePicker
  };
}

/**
 * Convert duration selection to proper date range
 */
export function convertDurationToRange(
  startYmd: string, 
  type: 'days' | 'weeks' | 'months', 
  value: number
): { startDate: string; endDate: string } {
  const start = new Date(startYmd);
  const end = new Date(startYmd);

  if (type === 'days') {
    end.setDate(end.getDate() + (value - 1));
  }
  if (type === 'weeks') {
    end.setDate(end.getDate() + (value * 7 - 1));
  }
  if (type === 'months') {
    end.setMonth(end.getMonth() + value, end.getDate());
  }

  return { 
    startDate: getLocalYMD(start), 
    endDate: getLocalYMD(end) 
  };
}

/**
 * Validate date constraints
 */
export function validateDates(startDate: string, endDate?: string): { 
  isValid: boolean; 
  error?: string 
} {
  const today = new Date().toISOString().split('T')[0];
  
  if (startDate < today) {
    return { isValid: false, error: 'Start date cannot be in the past' };
  }

  if (endDate && endDate < startDate) {
    return { isValid: false, error: 'End date must be after start date' };
  }

  return { isValid: true };
}

/**
 * Check if we should show date picker instead of AI question
 */
export function shouldShowDatePicker(draft: AIGoalDraft): boolean {
  const validation = validateAIGoal(draft);
  return !!validation.needsDatePicker;
}

/**
 * Update draft with date selection
 */
export function updateDraftWithDates(
  draft: AIGoalDraft,
  selection: {
    mode: 'single' | 'range' | 'duration';
    startDate: string;
    endDate?: string;
    durationType?: 'days' | 'weeks' | 'months';
    durationValue?: number;
  }
): AIGoalDraft {
  const updated = { ...draft };

  updated.startDate = selection.startDate;

  if (selection.mode === 'range' && selection.endDate) {
    updated.duration = {
      type: 'range',
      startDate: selection.startDate,
      endDate: selection.endDate
    };
  } else if (selection.mode === 'duration' && selection.durationType && selection.durationValue) {
    const range = convertDurationToRange(selection.startDate, selection.durationType, selection.durationValue);
    updated.duration = {
      type: selection.durationType,
      value: selection.durationValue,
      startDate: range.startDate,
      endDate: range.endDate
    };
  } else {
    // Single date - default to 30 days
    const range = convertDurationToRange(selection.startDate, 'days', 30);
    updated.duration = {
      type: 'days',
      value: 30,
      startDate: range.startDate,
      endDate: range.endDate
    };
  }

  return mergeAIGoal(draft, updated);
}
