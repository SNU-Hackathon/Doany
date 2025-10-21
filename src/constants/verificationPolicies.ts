/**
 * Single Source of Truth for Verification Policies
 * 
 * This file defines the canonical verification policies used by:
 * 1. AI prompt generation (ai.ts)
 * 2. Verification rules engine (verificationRules.ts)
 * 3. Goal creation UI
 * 4. Test harness
 */

export type VerificationSignal = 'time' | 'camera' | 'screenshot' | 'manual' | 'partner';

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
      name: 'time_camera',
      description: 'Schedule with specific time and camera evidence',
      requiredSignals: ['time', 'camera'],
      optionalSignals: ['manual'],
      evaluationLogic: 'time AND (manual+camera OR time+screenshot)'
    },
    {
      name: 'time_screenshot',
      description: 'Schedule with specific time and screenshot evidence',
      requiredSignals: ['time', 'screenshot'],
      optionalSignals: ['manual'],
      evaluationLogic: 'time AND screenshot_valid'
    },
    {
      name: 'time_manual',
      description: 'Schedule with specific time and manual verification',
      requiredSignals: ['time', 'manual'],
      optionalSignals: [],
      evaluationLogic: 'time AND manual'
    }
  ],
  frequency: [
    {
      name: 'manual_camera',
      description: 'Frequency goal with manual check and camera evidence',
      requiredSignals: ['manual', 'camera'],
      optionalSignals: [],
      evaluationLogic: 'manual AND camera_fresh'
    },
    {
      name: 'manual_screenshot',
      description: 'Frequency goal with manual check and screenshot verification',
      requiredSignals: ['manual', 'screenshot'],
      optionalSignals: [],
      evaluationLogic: 'manual AND screenshot_valid'
    }
  ],
  partner: [
    {
      name: 'partner_required',
      description: 'Goal requiring partner approval',
      requiredSignals: ['partner'],
      optionalSignals: ['manual', 'time', 'camera'],
      evaluationLogic: 'partner_approved AND (manual OR time+camera)'
    }
  ]
};

/**
 * AI Prompt Policy Mapping
 * Used in ai.ts SYSTEM_PROMPT to generate verification signals
 */
export const AI_PROMPT_POLICY_MAPPING: Record<string, VerificationSignal[]> = {
  'schedule_time_camera': ['time', 'camera'],
  'schedule_time_screenshot': ['time', 'screenshot'],
  'schedule_time_manual': ['time', 'manual'],
  'frequency_camera': ['manual', 'camera'],
  'frequency_screenshot': ['manual', 'screenshot'],
  'frequency_general': ['manual', 'camera'],
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
    logic: 'timeOk && (manualCameraOk || screenshotOk)'
  },
  frequency: {
    rule: 'evalFrequencyRule', 
    description: 'Frequency verification rule',
    logic: 'manualCameraOk || manualScreenshotOk'
  },
  partner: {
    rule: 'evalPartnerRule',
    description: 'Partner verification rule (not yet implemented)',
    logic: 'partnerApproved && (manualOk || timeCameraOk)'
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
    AI_PROMPT_POLICY_MAPPING.schedule_time_camera,
    AI_PROMPT_POLICY_MAPPING.schedule_time_screenshot,
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
    AI_PROMPT_POLICY_MAPPING.frequency_camera,
    AI_PROMPT_POLICY_MAPPING.frequency_screenshot
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
  hasCamera: boolean = false,
  hasSpecificTime: boolean = false,
  isPartnerRequired: boolean = false
): VerificationSignal[] {
  if (isPartnerRequired) {
    return AI_PROMPT_POLICY_MAPPING.partner_required;
  }

  switch (goalType) {
    case 'schedule':
      if (hasCamera && hasSpecificTime) {
        return AI_PROMPT_POLICY_MAPPING.schedule_time_camera;
      } else if (hasSpecificTime) {
        return AI_PROMPT_POLICY_MAPPING.schedule_time_screenshot;
      } else {
        return AI_PROMPT_POLICY_MAPPING.schedule_time_manual;
      }
    
    case 'frequency':
      if (hasCamera) {
        return AI_PROMPT_POLICY_MAPPING.frequency_screenshot;
      } else {
        return AI_PROMPT_POLICY_MAPPING.frequency_camera;
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
