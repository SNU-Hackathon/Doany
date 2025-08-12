// AI Goal Draft State Management

export type VerificationMethod = "location" | "time" | "screentime" | "manual";

export interface AIGoalDraft {
  title?: string;
  category?: string;
  verificationMethods?: VerificationMethod[];
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
  if (incoming.frequency) merged.frequency = { ...merged.frequency, ...incoming.frequency };
  if (incoming.startDate?.trim()) merged.startDate = incoming.startDate.trim();
  if (incoming.duration) merged.duration = { ...merged.duration, ...incoming.duration };
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
  const needsStartDate = !draft.startDate?.trim();
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

  // Generate follow-up question for non-date fields only
  if (!needsDatePicker && missing.length > 0 && !followUpQuestion) {
    const nonDateFields = missing.filter(f => !['startDate', 'duration'].includes(f));
    if (nonDateFields.length > 0) {
      followUpQuestion = `Please provide: ${nonDateFields.join(', ')}`;
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
  startDate: string, 
  durationType: 'days' | 'weeks' | 'months', 
  value: number
): { startDate: string; endDate: string } {
  const start = new Date(startDate);
  const end = new Date(start);

  switch (durationType) {
    case 'days':
      end.setDate(start.getDate() + value);
      break;
    case 'weeks':
      end.setDate(start.getDate() + (value * 7));
      break;
    case 'months':
      end.setMonth(start.getMonth() + value);
      break;
  }

  return {
    startDate: start.toISOString().split('T')[0], // YYYY-MM-DD
    endDate: end.toISOString().split('T')[0]
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
