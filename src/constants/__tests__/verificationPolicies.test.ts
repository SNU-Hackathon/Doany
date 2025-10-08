/**
 * Tests for Verification Policies - Single Source of Truth
 */

import { describe, expect, it } from 'vitest';
import {
    AI_PROMPT_POLICY_MAPPING,
    VERIFICATION_POLICIES,
    VERIFICATION_RULES_MAPPING,
    checkPolicyAlignment,
    getAIPromptMapping,
    getVerificationPolicy
} from '../verificationPolicies';

describe('Verification Policies', () => {
  describe('Policy Definitions', () => {
    it('should define policies for all goal types', () => {
      expect(VERIFICATION_POLICIES.schedule).toBeDefined();
      expect(VERIFICATION_POLICIES.frequency).toBeDefined();
      expect(VERIFICATION_POLICIES.partner).toBeDefined();
    });

    it('should have valid schedule policies', () => {
      const schedulePolicies = VERIFICATION_POLICIES.schedule;
      expect(schedulePolicies).toHaveLength(3);
      
      expect(schedulePolicies[0].name).toBe('time_location');
      expect(schedulePolicies[0].requiredSignals).toEqual(['time', 'location']);
      
      expect(schedulePolicies[1].name).toBe('time_photo');
      expect(schedulePolicies[1].requiredSignals).toEqual(['time', 'photo']);
      
      expect(schedulePolicies[2].name).toBe('time_manual');
      expect(schedulePolicies[2].requiredSignals).toEqual(['time', 'manual']);
    });

    it('should have valid frequency policies', () => {
      const frequencyPolicies = VERIFICATION_POLICIES.frequency;
      expect(frequencyPolicies).toHaveLength(2);
      
      expect(frequencyPolicies[0].name).toBe('manual_photo');
      expect(frequencyPolicies[0].requiredSignals).toEqual(['manual', 'photo']);
      
      expect(frequencyPolicies[1].name).toBe('manual_location');
      expect(frequencyPolicies[1].requiredSignals).toEqual(['manual', 'location']);
    });

    it('should have valid partner policies', () => {
      const partnerPolicies = VERIFICATION_POLICIES.partner;
      expect(partnerPolicies).toHaveLength(1);
      
      expect(partnerPolicies[0].name).toBe('partner_required');
      expect(partnerPolicies[0].requiredSignals).toEqual(['partner']);
    });
  });

  describe('AI Prompt Policy Mapping', () => {
    it('should map schedule policies correctly', () => {
      expect(AI_PROMPT_POLICY_MAPPING.schedule_time_place).toEqual(['time', 'location']);
      expect(AI_PROMPT_POLICY_MAPPING.schedule_time_only).toEqual(['time', 'photo']);
      expect(AI_PROMPT_POLICY_MAPPING.schedule_time_manual).toEqual(['time', 'manual']);
    });

    it('should map frequency policies correctly', () => {
      expect(AI_PROMPT_POLICY_MAPPING.frequency_photo).toEqual(['manual', 'photo']);
      expect(AI_PROMPT_POLICY_MAPPING.frequency_location).toEqual(['manual', 'location']);
      expect(AI_PROMPT_POLICY_MAPPING.frequency_general).toEqual(['manual', 'photo']);
    });

    it('should map partner policies correctly', () => {
      expect(AI_PROMPT_POLICY_MAPPING.partner_required).toEqual(['partner']);
      expect(AI_PROMPT_POLICY_MAPPING.partner_combined).toEqual(['partner', 'manual']);
    });
  });

  describe('Verification Rules Mapping', () => {
    it('should map schedule rules correctly', () => {
      expect(VERIFICATION_RULES_MAPPING.schedule.rule).toBe('evalScheduleRule');
      expect(VERIFICATION_RULES_MAPPING.schedule.logic).toBe('timeOk && (manualLocOk || photoOk)');
    });

    it('should map frequency rules correctly', () => {
      expect(VERIFICATION_RULES_MAPPING.frequency.rule).toBe('evalFrequencyRule');
      expect(VERIFICATION_RULES_MAPPING.frequency.logic).toBe('manualLocOk || manualPhotoOk');
    });

    it('should map partner rules correctly', () => {
      expect(VERIFICATION_RULES_MAPPING.partner.rule).toBe('evalPartnerRule');
      expect(VERIFICATION_RULES_MAPPING.partner.logic).toBe('partnerApproved && (manualOk || timePhotoOk)');
    });
  });

  describe('Policy Alignment Checker', () => {
    it('should identify policy gaps', () => {
      const alignment = checkPolicyAlignment();
      
      expect(alignment).toHaveProperty('aligned');
      expect(alignment).toHaveProperty('gaps');
      expect(alignment).toHaveProperty('recommendations');
      
      expect(Array.isArray(alignment.gaps)).toBe(true);
      expect(Array.isArray(alignment.recommendations)).toBe(true);
    });

    it('should report specific gaps found', () => {
      const alignment = checkPolicyAlignment();
      
      // We expect some gaps due to current implementation
      console.log('Policy Alignment Report:');
      console.log(`Aligned: ${alignment.aligned}`);
      console.log('Gaps:', alignment.gaps);
      console.log('Recommendations:', alignment.recommendations);
      
      // The checker should identify at least the partner rule gap
      expect(alignment.gaps.some(gap => gap.includes('Partner verification rule not implemented'))).toBe(true);
    });
  });

  describe('Policy Helper Functions', () => {
    it('should get verification policy for matching signals', () => {
      const policy = getVerificationPolicy('schedule', ['time', 'location']);
      
      expect(policy).toBeDefined();
      expect(policy!.name).toBe('time_location');
      expect(policy!.requiredSignals.sort()).toEqual(['time', 'location'].sort());
    });

    it('should return null for non-matching signals', () => {
      const policy = getVerificationPolicy('schedule', ['manual', 'photo'] as any);
      
      expect(policy).toBeNull();
    });

    it('should return null for invalid goal type', () => {
      const policy = getVerificationPolicy('invalid', ['time', 'location']);
      
      expect(policy).toBeNull();
    });

    it('should get AI prompt mapping for schedule goals', () => {
      const mapping1 = getAIPromptMapping('schedule', true, true, false);
      expect(mapping1).toEqual(['time', 'location']);

      const mapping2 = getAIPromptMapping('schedule', false, true, false);
      expect(mapping2).toEqual(['time', 'photo']);

      const mapping3 = getAIPromptMapping('schedule', false, false, false);
      expect(mapping3).toEqual(['time', 'manual']);
    });

    it('should get AI prompt mapping for frequency goals', () => {
      const mapping1 = getAIPromptMapping('frequency', true, false, false);
      expect(mapping1).toEqual(['manual', 'location']);

      const mapping2 = getAIPromptMapping('frequency', false, false, false);
      expect(mapping2).toEqual(['manual', 'photo']);
    });

    it('should get AI prompt mapping for partner goals', () => {
      const mapping = getAIPromptMapping('schedule', false, false, true);
      expect(mapping).toEqual(['partner']);
    });

    it('should default to frequency general for unknown types', () => {
      const mapping = getAIPromptMapping('unknown', false, false, false);
      expect(mapping).toEqual(['manual', 'photo']);
    });
  });

  describe('Policy Consistency', () => {
    it('should have consistent signal definitions across all policies', () => {
      const allSignals = new Set<string>();
      
      // Collect all signals from policies
      Object.values(VERIFICATION_POLICIES).forEach(policies => {
        policies.forEach(policy => {
          policy.requiredSignals.forEach(signal => allSignals.add(signal));
          policy.optionalSignals?.forEach(signal => allSignals.add(signal));
        });
      });

      // Collect all signals from AI mappings
      Object.values(AI_PROMPT_POLICY_MAPPING).forEach(signals => {
        signals.forEach(signal => allSignals.add(signal));
      });

      const validSignals = ['time', 'location', 'photo', 'manual', 'partner'];
      
      // All used signals should be valid
      allSignals.forEach(signal => {
        expect(validSignals).toContain(signal);
      });
    });

    it('should have no duplicate policy names within goal types', () => {
      Object.entries(VERIFICATION_POLICIES).forEach(([goalType, policies]) => {
        const names = policies.map(p => p.name);
        const uniqueNames = new Set(names);
        
        expect(names.length).toBe(uniqueNames.size);
      });
    });
  });
});
