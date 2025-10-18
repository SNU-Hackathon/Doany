/**
 * Verification signals policy constants
 * Single source of truth for verification signal combinations
 */

export type VerificationSignal = 'time' | 'camera' | 'screenshot' | 'manual' | 'partner';

export type GoalType = 'schedule' | 'frequency' | 'milestone';

/**
 * Verification signal combinations for each goal type
 */
export const VERIFICATION_POLICIES = {
  schedule: {
    withTimeAndPlace: ['time', 'camera'] as VerificationSignal[],
    withTimeOnly: ['time', 'screenshot'] as VerificationSignal[], // or ['time', 'manual']
    fallback: ['time', 'manual'] as VerificationSignal[],
  },
  frequency: {
    primary: ['manual', 'camera'] as VerificationSignal[],
    withScreenshot: ['manual', 'screenshot'] as VerificationSignal[], // when meaningful
    fallback: ['manual'] as VerificationSignal[],
  },
  milestone: {
    primary: ['time', 'manual'] as VerificationSignal[],
    withCamera: ['time', 'camera'] as VerificationSignal[],
  },
} as const;

/**
 * Default verification signals for uncertain classification
 */
export const DEFAULT_VERIFICATION_SIGNALS: VerificationSignal[] = ['manual'];

/**
 * Policy descriptions for prompts
 */
export const VERIFICATION_POLICY_DESCRIPTIONS = {
  schedule: {
    withTimeAndPlace: 'Schedule with specific time and visual proof: include ["time","camera"]',
    withTimeOnly: 'Schedule with time but no camera: ["time", "screenshot" or "manual"]',
    fallback: 'Schedule fallback: ["time", "manual"]',
  },
  frequency: {
    primary: 'Frequency goals: prefer ["manual","camera"]',
    withScreenshot: 'Frequency with screenshot evidence: ["manual","screenshot"]',
    fallback: 'Frequency fallback: ["manual"]',
  },
  milestone: {
    primary: 'Milestone goals: prefer ["time","manual"]',
    withCamera: 'Milestone with camera evidence: ["time","camera"]',
  },
} as const;

/**
 * Get verification signals for a goal type and context
 */
export function getVerificationSignals(
  goalType: GoalType,
  context: {
    hasTime?: boolean;
    hasCamera?: boolean;
    hasPartner?: boolean;
  } = {}
): VerificationSignal[] {
  switch (goalType) {
    case 'schedule':
      if (context.hasTime && context.hasCamera) {
        return VERIFICATION_POLICIES.schedule.withTimeAndPlace;
      } else if (context.hasTime) {
        return VERIFICATION_POLICIES.schedule.withTimeOnly;
      } else {
        return VERIFICATION_POLICIES.schedule.fallback;
      }
    
    case 'frequency':
      if (context.hasCamera) {
        return VERIFICATION_POLICIES.frequency.withScreenshot;
      } else {
        return VERIFICATION_POLICIES.frequency.primary;
      }
    
    case 'milestone':
      return context.hasTime 
        ? VERIFICATION_POLICIES.milestone.withCamera
        : VERIFICATION_POLICIES.milestone.primary;
    
    default:
      return DEFAULT_VERIFICATION_SIGNALS;
  }
}

/**
 * Validate verification signals against policy
 */
export function validateVerificationSignals(
  goalType: GoalType,
  signals: VerificationSignal[]
): {
  valid: boolean;
  errors: string[];
  suggestions: VerificationSignal[];
} {
  const errors: string[] = [];
  const suggestions: VerificationSignal[] = [];
  
  switch (goalType) {
    case 'schedule':
      if (!signals.includes('time')) {
        errors.push('Schedule goals must include "time" signal');
        suggestions.push('time');
      }
      
      if (signals.includes('time') && !signals.includes('camera') && !signals.includes('screenshot') && !signals.includes('manual')) {
        errors.push('Schedule with time must include camera, screenshot, or manual signal');
        suggestions.push('camera', 'screenshot', 'manual');
      }
      break;
    
    case 'frequency':
      if (!signals.includes('manual')) {
        errors.push('Frequency goals must include "manual" signal');
        suggestions.push('manual');
      }
      
      // Manual alone is valid (fallback), but recommend adding camera or screenshot
      if (signals.includes('manual') && !signals.includes('camera') && !signals.includes('screenshot') && signals.length > 1) {
        errors.push('Frequency goals should include camera or screenshot signal');
        suggestions.push('camera', 'screenshot');
      }
      break;
    
    case 'milestone':
      if (!signals.includes('time')) {
        errors.push('Milestone goals must include "time" signal');
        suggestions.push('time');
      }
      if (!signals.includes('manual') && !signals.includes('camera')) {
        errors.push('Milestone goals must include manual or camera signal');
        suggestions.push('manual', 'camera');
      }
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors,
    suggestions: [...new Set(suggestions)],
  };
}

/**
 * Get policy description for prompt inclusion
 */
export function getPolicyDescriptionForPrompt(): string {
  return `VERIFICATION SIGNALS POLICY:
- Schedule with time+camera: ${JSON.stringify(VERIFICATION_POLICIES.schedule.withTimeAndPlace)}
- Schedule with time only: ${JSON.stringify(VERIFICATION_POLICIES.schedule.withTimeOnly)} or ${JSON.stringify(VERIFICATION_POLICIES.schedule.fallback)}
- Frequency goals: ${JSON.stringify(VERIFICATION_POLICIES.frequency.primary)} (add camera when meaningful)
- Milestone goals: ${JSON.stringify(VERIFICATION_POLICIES.milestone.primary)} or ${JSON.stringify(VERIFICATION_POLICIES.milestone.withCamera)}`;
}

/**
 * Get examples for prompt inclusion
 */
export function getExamplesForPrompt(): string {
  return `EXAMPLES:
GOOD: {"type":"schedule","originalText":"월수금 6시 러닝","schedule":{"events":[{"dayOfWeek":"mon","time":"06:00"},{"dayOfWeek":"wed","time":"06:00"},{"dayOfWeek":"fri","time":"06:00"}]},"verification":{"signals":${JSON.stringify(VERIFICATION_POLICIES.schedule.withTimeOnly)}}}
GOOD: {"type":"frequency","originalText":"일주일에 3번 독서","frequency":{"targetPerWeek":3,"windowDays":7},"verification":{"signals":${JSON.stringify(VERIFICATION_POLICIES.frequency.primary)}}}
GOOD: {"type":"milestone","originalText":"매일 코치와 운동 검토","milestone":{"target":"운동 검토","deadline":"2024-12-31"},"verification":{"signals":${JSON.stringify(VERIFICATION_POLICIES.milestone.primary)}}}`;
}

/**
 * Allowed verification signal combinations (for testing)
 */
export const ALLOWED_SIGNAL_COMBINATIONS = [
  // Schedule combinations
  ['time', 'camera'],
  ['time', 'screenshot'],
  ['time', 'manual'],
  ['time', 'camera', 'screenshot'],
  ['time', 'camera', 'manual'],
  ['time', 'screenshot', 'manual'],
  
  // Frequency combinations
  ['manual', 'camera'],
  ['manual', 'screenshot'],
  ['manual', 'camera', 'screenshot'],
  
  // Partner combinations
  ['partner'],
  ['partner', 'manual'],
  ['partner', 'camera'],
  ['partner', 'screenshot'],
  ['partner', 'manual', 'camera'],
  ['partner', 'manual', 'screenshot'],
  ['partner', 'camera', 'screenshot'],
  
  // Fallback
  ['manual'],
] as const;

/**
 * Check if a signal combination is allowed
 */
export function isAllowedSignalCombination(signals: VerificationSignal[]): boolean {
  return ALLOWED_SIGNAL_COMBINATIONS.some(combination => 
    combination.length === signals.length && 
    combination.every(signal => signals.includes(signal))
  );
}
