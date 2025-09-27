/**
 * Verification signals policy constants
 * Single source of truth for verification signal combinations
 */

export type VerificationSignal = 'time' | 'location' | 'photo' | 'manual' | 'partner';

export type GoalType = 'schedule' | 'frequency' | 'partner';

/**
 * Verification signal combinations for each goal type
 */
export const VERIFICATION_POLICIES = {
  schedule: {
    withTimeAndPlace: ['time', 'location'] as VerificationSignal[],
    withTimeOnly: ['time', 'photo'] as VerificationSignal[], // or ['time', 'manual']
    fallback: ['time', 'manual'] as VerificationSignal[],
  },
  frequency: {
    primary: ['manual', 'photo'] as VerificationSignal[],
    withLocation: ['manual', 'location'] as VerificationSignal[], // when meaningful
    fallback: ['manual'] as VerificationSignal[],
  },
  partner: {
    required: ['partner'] as VerificationSignal[],
    withOthers: ['partner', 'manual'] as VerificationSignal[], // optionally combine
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
    withTimeAndPlace: 'Schedule with specific time and place: include ["time","location"]',
    withTimeOnly: 'Schedule with time but no place: ["time", "photo" or "manual"]',
    fallback: 'Schedule fallback: ["time", "manual"]',
  },
  frequency: {
    primary: 'Frequency goals: prefer ["manual","photo"]',
    withLocation: 'Frequency with meaningful location: ["manual","location"]',
    fallback: 'Frequency fallback: ["manual"]',
  },
  partner: {
    required: 'Partner type: MUST include ["partner"]',
    withOthers: 'Partner type: optionally combine with others if independently verifiable',
  },
} as const;

/**
 * Get verification signals for a goal type and context
 */
export function getVerificationSignals(
  goalType: GoalType,
  context: {
    hasTime?: boolean;
    hasLocation?: boolean;
    hasPartner?: boolean;
  } = {}
): VerificationSignal[] {
  switch (goalType) {
    case 'schedule':
      if (context.hasTime && context.hasLocation) {
        return VERIFICATION_POLICIES.schedule.withTimeAndPlace;
      } else if (context.hasTime) {
        return VERIFICATION_POLICIES.schedule.withTimeOnly;
      } else {
        return VERIFICATION_POLICIES.schedule.fallback;
      }
    
    case 'frequency':
      if (context.hasLocation) {
        return VERIFICATION_POLICIES.frequency.withLocation;
      } else {
        return VERIFICATION_POLICIES.frequency.primary;
      }
    
    case 'partner':
      if (context.hasPartner) {
        return context.hasTime || context.hasLocation 
          ? VERIFICATION_POLICIES.partner.withOthers
          : VERIFICATION_POLICIES.partner.required;
      } else {
        return VERIFICATION_POLICIES.partner.required;
      }
    
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
      
      if (signals.includes('time') && !signals.includes('location') && !signals.includes('photo') && !signals.includes('manual')) {
        errors.push('Schedule with time must include location, photo, or manual signal');
        suggestions.push('location', 'photo', 'manual');
      }
      break;
    
    case 'frequency':
      if (!signals.includes('manual')) {
        errors.push('Frequency goals must include "manual" signal');
        suggestions.push('manual');
      }
      
      // Manual alone is valid (fallback), but recommend adding photo or location
      if (signals.includes('manual') && !signals.includes('photo') && !signals.includes('location') && signals.length > 1) {
        errors.push('Frequency goals should include photo or location signal');
        suggestions.push('photo', 'location');
      }
      break;
    
    case 'partner':
      if (!signals.includes('partner')) {
        errors.push('Partner goals must include "partner" signal');
        suggestions.push('partner');
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
- Schedule with time+place: ${JSON.stringify(VERIFICATION_POLICIES.schedule.withTimeAndPlace)}
- Schedule with time only: ${JSON.stringify(VERIFICATION_POLICIES.schedule.withTimeOnly)} or ${JSON.stringify(VERIFICATION_POLICIES.schedule.fallback)}
- Frequency goals: ${JSON.stringify(VERIFICATION_POLICIES.frequency.primary)} (add location when meaningful)
- Partner type: MUST include ${JSON.stringify(VERIFICATION_POLICIES.partner.required)}, optionally combine with others if independently verifiable`;
}

/**
 * Get examples for prompt inclusion
 */
export function getExamplesForPrompt(): string {
  return `EXAMPLES:
GOOD: {"type":"schedule","originalText":"월수금 6시 러닝","schedule":{"events":[{"dayOfWeek":"mon","time":"06:00"},{"dayOfWeek":"wed","time":"06:00"},{"dayOfWeek":"fri","time":"06:00"}]},"verification":{"signals":${JSON.stringify(VERIFICATION_POLICIES.schedule.withTimeOnly)}}}
GOOD: {"type":"frequency","originalText":"일주일에 3번 독서","frequency":{"targetPerWeek":3,"windowDays":7},"verification":{"signals":${JSON.stringify(VERIFICATION_POLICIES.frequency.primary)}}}
GOOD: {"type":"partner","originalText":"매일 코치와 운동 검토","partner":{"required":true,"name":"코치"},"verification":{"signals":${JSON.stringify(VERIFICATION_POLICIES.partner.required)}}}`;
}

/**
 * Allowed verification signal combinations (for testing)
 */
export const ALLOWED_SIGNAL_COMBINATIONS = [
  // Schedule combinations
  ['time', 'location'],
  ['time', 'photo'],
  ['time', 'manual'],
  ['time', 'location', 'photo'],
  ['time', 'location', 'manual'],
  ['time', 'photo', 'manual'],
  
  // Frequency combinations
  ['manual', 'photo'],
  ['manual', 'location'],
  ['manual', 'photo', 'location'],
  
  // Partner combinations
  ['partner'],
  ['partner', 'manual'],
  ['partner', 'photo'],
  ['partner', 'location'],
  ['partner', 'manual', 'photo'],
  ['partner', 'manual', 'location'],
  ['partner', 'photo', 'location'],
  
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
