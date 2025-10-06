/**
 * Single Source of Truth for Verification Policies
 * 
 * This file defines the canonical verification policies used by:
 * 1. AI prompt generation (ai.ts)
 * 2. Verification rules engine (verificationRules.ts)
 * 3. Goal creation UI
 * 4. Test harness
 */

export type VerificationSignal = 'time' | 'location' | 'photo' | 'manual' | 'partner';

export interface VerificationPolicy {
  name: string;
  description: string;
  requiredSignals: VerificationSignal[];
  optionalSignals?: VerificationSignal[];
  evaluationLogic: string;
}

/**
 * Canonical verification policies for each goal type
 */
export const VERIFICATION_POLICIES: Record<string, VerificationPolicy[]> = {
  schedule: [
    {
      name: 'time_location',
      description: 'Schedule with specific time and location',
      requiredSignals: ['time', 'location'],
      optionalSignals: ['manual'],
      evaluationLogic: 'time AND (manual+location OR time+photo)'
    },
    {
      name: 'time_photo',
      description: 'Schedule with specific time and photo evidence',
      requiredSignals: ['time', 'photo'],
      optionalSignals: ['manual'],
      evaluationLogic: 'time AND photo_valid'
    },
    {
      name: 'time_manual',
      description: 'Schedule with specific time and manual verification',
      requiredSignals: ['time', 'manual'],
      optionalSignals: ['location'],
      evaluationLogic: 'time AND manual'
    }
  ],
  frequency: [
    {
      name: 'manual_photo',
      description: 'Frequency goal with manual check and photo evidence',
      requiredSignals: ['manual', 'photo'],
      optionalSignals: [],
      evaluationLogic: 'manual AND photo_fresh'
    },
    {
      name: 'manual_location',
      description: 'Frequency goal with manual check and location verification',
      requiredSignals: ['manual', 'location'],
      optionalSignals: [],
      evaluationLogic: 'manual AND location_valid'
    }
  ],
  partner: [
    {
      name: 'partner_required',
      description: 'Goal requiring partner approval',
      requiredSignals: ['partner'],
      optionalSignals: ['manual', 'time', 'photo'],
      evaluationLogic: 'partner_approved AND (manual OR time+photo)'
    }
  ]
};

/**
 * AI Prompt Policy Mapping
 * Used in ai.ts SYSTEM_PROMPT to generate verification signals
 */
export const AI_PROMPT_POLICY_MAPPING: Record<string, VerificationSignal[]> = {
  'schedule_time_place': ['time', 'location'],
  'schedule_time_only': ['time', 'photo'],
  'schedule_time_manual': ['time', 'manual'],
  'frequency_photo': ['manual', 'photo'],
  'frequency_location': ['manual', 'location'],
  'frequency_general': ['manual', 'photo'],
  'partner_required': ['partner'],
  'partner_combined': ['partner', 'manual']
};

/**
 * Verification Rules Engine Mapping
 * Used in verificationRules.ts to evaluate signals
 */
export const VERIFICATION_RULES_MAPPING: Record<string, {
  rule: string;
  description: string;
  logic: string;
}> = {
  schedule: {
    rule: 'evalScheduleRule',
    description: 'Schedule verification rule',
    logic: 'timeOk && (manualLocOk || photoOk)'
  },
  frequency: {
    rule: 'evalFrequencyRule', 
    description: 'Frequency verification rule',
    logic: 'manualLocOk || manualPhotoOk'
  },
  partner: {
    rule: 'evalPartnerRule',
    description: 'Partner verification rule (not yet implemented)',
    logic: 'partnerApproved && (manualOk || timePhotoOk)'
  }
};

/**
 * Policy Alignment Checker
 * Verifies that AI prompts, rules, and policies are aligned
 */
export function checkPolicyAlignment(): {
  aligned: boolean;
  gaps: string[];
  recommendations: string[];
} {
  const gaps: string[] = [];
  const recommendations: string[] = [];

  // Check schedule policies
  const schedulePolicies = VERIFICATION_POLICIES.schedule;
  const scheduleAIPolicies = [
    AI_PROMPT_POLICY_MAPPING.schedule_time_place,
    AI_PROMPT_POLICY_MAPPING.schedule_time_only,
    AI_PROMPT_POLICY_MAPPING.schedule_time_manual
  ];

  schedulePolicies.forEach((policy, index) => {
    const aiPolicy = scheduleAIPolicies[index];
    if (aiPolicy && !arraysEqual(policy.requiredSignals, aiPolicy)) {
      gaps.push(`Schedule policy ${policy.name}: Required signals mismatch`);
      recommendations.push(`Align AI prompt mapping for schedule_time_${policy.name.split('_')[1]}`);
    }
  });

  // Check frequency policies
  const frequencyPolicies = VERIFICATION_POLICIES.frequency;
  const frequencyAIPolicies = [
    AI_PROMPT_POLICY_MAPPING.frequency_photo,
    AI_PROMPT_POLICY_MAPPING.frequency_location
  ];

  frequencyPolicies.forEach((policy, index) => {
    const aiPolicy = frequencyAIPolicies[index];
    if (aiPolicy && !arraysEqual(policy.requiredSignals, aiPolicy)) {
      gaps.push(`Frequency policy ${policy.name}: Required signals mismatch`);
      recommendations.push(`Align AI prompt mapping for frequency_${policy.name.split('_')[1]}`);
    }
  });

  // Check partner policies
  const partnerPolicies = VERIFICATION_POLICIES.partner;
  const partnerAIPolicies = [
    AI_PROMPT_POLICY_MAPPING.partner_required
  ];

  partnerPolicies.forEach((policy, index) => {
    const aiPolicy = partnerAIPolicies[index];
    if (aiPolicy && !arraysEqual(policy.requiredSignals, aiPolicy)) {
      gaps.push(`Partner policy ${policy.name}: Required signals mismatch`);
      recommendations.push(`Align AI prompt mapping for partner_required`);
    }
  });

  // Check rules engine implementation
  if (VERIFICATION_RULES_MAPPING.partner.rule === 'evalPartnerRule') {
    gaps.push('Partner verification rule not implemented in verificationRules.ts');
    recommendations.push('Implement evalPartnerRule function in verificationRules.ts');
  }

  return {
    aligned: gaps.length === 0,
    gaps,
    recommendations
  };
}

/**
 * Get verification policy for a specific goal type and signals
 */
export function getVerificationPolicy(
  goalType: string, 
  signals: VerificationSignal[]
): VerificationPolicy | null {
  const policies = VERIFICATION_POLICIES[goalType];
  if (!policies) return null;

  // Find policy that matches the required signals
  return policies.find(policy => 
    arraysEqual(policy.requiredSignals.sort(), signals.sort())
  ) || null;
}

/**
 * Get AI prompt mapping for goal type and context
 */
export function getAIPromptMapping(
  goalType: string,
  hasLocation: boolean = false,
  hasSpecificTime: boolean = false,
  isPartnerRequired: boolean = false
): VerificationSignal[] {
  if (isPartnerRequired) {
    return AI_PROMPT_POLICY_MAPPING.partner_required;
  }

  switch (goalType) {
    case 'schedule':
      if (hasLocation && hasSpecificTime) {
        return AI_PROMPT_POLICY_MAPPING.schedule_time_place;
      } else if (hasSpecificTime) {
        return AI_PROMPT_POLICY_MAPPING.schedule_time_only;
      } else {
        return AI_PROMPT_POLICY_MAPPING.schedule_time_manual;
      }
    
    case 'frequency':
      if (hasLocation) {
        return AI_PROMPT_POLICY_MAPPING.frequency_location;
      } else {
        return AI_PROMPT_POLICY_MAPPING.frequency_photo;
      }
    
    default:
      return AI_PROMPT_POLICY_MAPPING.frequency_general;
  }
}

// Helper function to compare arrays
function arraysEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, index) => val === sortedB[index]);
}

// Export types for use in other files
// Note: VerificationPolicy interface is already exported above
