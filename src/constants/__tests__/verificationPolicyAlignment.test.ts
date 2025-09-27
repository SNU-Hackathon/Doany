/**
 * Tests to ensure verification policy alignment between prompts and rules engine
 */

import { describe, expect, it } from 'vitest';
import { evalFrequencyRule, evalPartnerRule, evalScheduleRule } from '../../services/verificationRules';
import {
    ALLOWED_SIGNAL_COMBINATIONS,
    VERIFICATION_POLICIES,
    getExamplesForPrompt,
    getPolicyDescriptionForPrompt,
    isAllowedSignalCombination,
    validateVerificationSignals
} from '../verificationPolicy';

describe('Verification Policy Alignment', () => {
  describe('Policy Constants', () => {
    it('should have consistent signal combinations for schedule goals', () => {
      expect(VERIFICATION_POLICIES.schedule.withTimeAndPlace).toEqual(['time', 'location']);
      expect(VERIFICATION_POLICIES.schedule.withTimeOnly).toEqual(['time', 'photo']);
      expect(VERIFICATION_POLICIES.schedule.fallback).toEqual(['time', 'manual']);
    });

    it('should have consistent signal combinations for frequency goals', () => {
      expect(VERIFICATION_POLICIES.frequency.primary).toEqual(['manual', 'photo']);
      expect(VERIFICATION_POLICIES.frequency.withLocation).toEqual(['manual', 'location']);
      expect(VERIFICATION_POLICIES.frequency.fallback).toEqual(['manual']);
    });

    it('should have consistent signal combinations for partner goals', () => {
      expect(VERIFICATION_POLICIES.partner.required).toEqual(['partner']);
      expect(VERIFICATION_POLICIES.partner.withOthers).toEqual(['partner', 'manual']);
    });
  });

  describe('Prompt Integration', () => {
    it('should generate policy description for prompts', () => {
      const description = getPolicyDescriptionForPrompt();
      
      expect(description).toContain('VERIFICATION SIGNALS POLICY');
      expect(description).toContain('Schedule with time+place');
      expect(description).toContain('Schedule with time only');
      expect(description).toContain('Frequency goals');
      expect(description).toContain('Partner type');
      
      // Should include actual policy values
      expect(description).toContain(JSON.stringify(VERIFICATION_POLICIES.schedule.withTimeAndPlace));
      expect(description).toContain(JSON.stringify(VERIFICATION_POLICIES.schedule.withTimeOnly));
      expect(description).toContain(JSON.stringify(VERIFICATION_POLICIES.frequency.primary));
      expect(description).toContain(JSON.stringify(VERIFICATION_POLICIES.partner.required));
    });

    it('should generate examples for prompts', () => {
      const examples = getExamplesForPrompt();
      
      expect(examples).toContain('EXAMPLES');
      expect(examples).toContain('GOOD:');
      
      // Should include actual policy values in examples
      expect(examples).toContain(JSON.stringify(VERIFICATION_POLICIES.schedule.withTimeOnly));
      expect(examples).toContain(JSON.stringify(VERIFICATION_POLICIES.frequency.primary));
      expect(examples).toContain(JSON.stringify(VERIFICATION_POLICIES.partner.required));
    });
  });

  describe('Policy Validation', () => {
    it('should validate schedule verification signals correctly', () => {
      // Valid combinations
      expect(validateVerificationSignals('schedule', ['time', 'location']).valid).toBe(true);
      expect(validateVerificationSignals('schedule', ['time', 'photo']).valid).toBe(true);
      expect(validateVerificationSignals('schedule', ['time', 'manual']).valid).toBe(true);
      
      // Invalid combinations
      const invalidResult = validateVerificationSignals('schedule', ['location', 'photo']);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Schedule goals must include "time" signal');
    });

    it('should validate frequency verification signals correctly', () => {
      // Valid combinations
      expect(validateVerificationSignals('frequency', ['manual', 'photo']).valid).toBe(true);
      expect(validateVerificationSignals('frequency', ['manual', 'location']).valid).toBe(true);
      
      // Invalid combinations
      const invalidResult = validateVerificationSignals('frequency', ['photo', 'location']);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Frequency goals must include "manual" signal');
    });

    it('should validate partner verification signals correctly', () => {
      // Valid combinations
      expect(validateVerificationSignals('partner', ['partner']).valid).toBe(true);
      expect(validateVerificationSignals('partner', ['partner', 'manual']).valid).toBe(true);
      
      // Invalid combinations
      const invalidResult = validateVerificationSignals('partner', ['manual', 'photo']);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Partner goals must include "partner" signal');
    });
  });

  describe('Allowed Signal Combinations', () => {
    it('should have comprehensive allowed combinations', () => {
      // Schedule combinations
      expect(ALLOWED_SIGNAL_COMBINATIONS).toContainEqual(['time', 'location']);
      expect(ALLOWED_SIGNAL_COMBINATIONS).toContainEqual(['time', 'photo']);
      expect(ALLOWED_SIGNAL_COMBINATIONS).toContainEqual(['time', 'manual']);
      
      // Frequency combinations
      expect(ALLOWED_SIGNAL_COMBINATIONS).toContainEqual(['manual', 'photo']);
      expect(ALLOWED_SIGNAL_COMBINATIONS).toContainEqual(['manual', 'location']);
      
      // Partner combinations
      expect(ALLOWED_SIGNAL_COMBINATIONS).toContainEqual(['partner']);
      expect(ALLOWED_SIGNAL_COMBINATIONS).toContainEqual(['partner', 'manual']);
    });

    it('should validate allowed combinations correctly', () => {
      // Valid combinations
      expect(isAllowedSignalCombination(['time', 'location'])).toBe(true);
      expect(isAllowedSignalCombination(['manual', 'photo'])).toBe(true);
      expect(isAllowedSignalCombination(['partner'])).toBe(true);
      
      // Invalid combinations
      expect(isAllowedSignalCombination(['location', 'photo'])).toBe(false);
      expect(isAllowedSignalCombination(['time'])).toBe(false);
      expect(isAllowedSignalCombination(['manual'])).toBe(true); // Fallback is allowed
    });
  });

  describe('Rules Engine Alignment', () => {
    // Mock verification signals for testing
    const createMockSignals = (signals: string[]) => ({
      time: signals.includes('time') ? { present: true, windowStart: Date.now() - 1000, windowEnd: Date.now() + 1000 } : undefined,
      location: signals.includes('location') ? { present: true, inside: true } : undefined,
      photo: signals.includes('photo') ? { present: true, validationResult: { timeValid: true, freshnessValid: true } } : undefined,
      manual: signals.includes('manual') ? { present: true } : undefined,
      partner: signals.includes('partner') ? { reviewed: true, approved: true } : undefined,
    });

    it('should align schedule rules with policy', () => {
      // Test policy-compliant combinations
      const timeLocationSignals = createMockSignals(['time', 'location']);
      const timeLocationResult = evalScheduleRule(timeLocationSignals);
      expect(timeLocationResult.pass).toBe(true);
      
      const timePhotoSignals = createMockSignals(['time', 'photo']);
      const timePhotoResult = evalScheduleRule(timePhotoSignals);
      expect(timePhotoResult.pass).toBe(true);
      
      const timeManualSignals = createMockSignals(['time', 'manual']);
      const timeManualResult = evalScheduleRule(timeManualSignals);
      expect(timeManualResult.pass).toBe(true);
    });

    it('should align frequency rules with policy', () => {
      // Test policy-compliant combinations
      const manualPhotoSignals = createMockSignals(['manual', 'photo']);
      const manualPhotoResult = evalFrequencyRule(manualPhotoSignals);
      expect(manualPhotoResult.pass).toBe(true);
      
      const manualLocationSignals = createMockSignals(['manual', 'location']);
      const manualLocationResult = evalFrequencyRule(manualLocationSignals);
      expect(manualLocationResult.pass).toBe(true);
    });

    it('should align partner rules with policy', () => {
      // Test policy-compliant combinations
      const partnerSignals = createMockSignals(['partner']);
      const partnerResult = evalPartnerRule(partnerSignals);
      expect(partnerResult.pass).toBe(true);
      
      const partnerManualSignals = createMockSignals(['partner', 'manual']);
      const partnerManualResult = evalPartnerRule(partnerManualSignals);
      expect(partnerManualResult.pass).toBe(true);
    });

    it('should reject policy-violating combinations', () => {
      // Schedule without time should fail
      const locationOnlySignals = createMockSignals(['location']);
      const locationOnlyResult = evalScheduleRule(locationOnlySignals);
      expect(locationOnlyResult.pass).toBe(false);
      
      // Frequency without manual should fail
      const photoOnlySignals = createMockSignals(['photo']);
      const photoOnlyResult = evalFrequencyRule(photoOnlySignals);
      expect(photoOnlyResult.pass).toBe(false);
      
      // Partner without partner signal should fail
      const manualOnlySignals = createMockSignals(['manual']);
      const manualOnlyResult = evalPartnerRule(manualOnlySignals);
      expect(manualOnlyResult.pass).toBe(false);
    });
  });

  describe('Policy Snapshot Tests', () => {
    it('should maintain consistent policy structure', () => {
      // Snapshot test for policy structure
      const policySnapshot = {
        schedule: {
          withTimeAndPlace: VERIFICATION_POLICIES.schedule.withTimeAndPlace,
          withTimeOnly: VERIFICATION_POLICIES.schedule.withTimeOnly,
          fallback: VERIFICATION_POLICIES.schedule.fallback,
        },
        frequency: {
          primary: VERIFICATION_POLICIES.frequency.primary,
          withLocation: VERIFICATION_POLICIES.frequency.withLocation,
          fallback: VERIFICATION_POLICIES.frequency.fallback,
        },
        partner: {
          required: VERIFICATION_POLICIES.partner.required,
          withOthers: VERIFICATION_POLICIES.partner.withOthers,
        },
      };
      
      // This test will fail if the policy structure changes
      expect(policySnapshot).toMatchSnapshot();
    });

    it('should maintain consistent allowed combinations', () => {
      // Snapshot test for allowed combinations
      expect(ALLOWED_SIGNAL_COMBINATIONS).toMatchSnapshot();
    });

    it('should maintain consistent policy descriptions', () => {
      // Snapshot test for policy descriptions
      const descriptionSnapshot = {
        promptDescription: getPolicyDescriptionForPrompt(),
        examples: getExamplesForPrompt(),
      };
      
      expect(descriptionSnapshot).toMatchSnapshot();
    });
  });

  describe('Cross-Validation', () => {
    it('should ensure all policy combinations are in allowed combinations', () => {
      const allPolicyCombinations = [
        ...VERIFICATION_POLICIES.schedule.withTimeAndPlace,
        ...VERIFICATION_POLICIES.schedule.withTimeOnly,
        ...VERIFICATION_POLICIES.schedule.fallback,
        ...VERIFICATION_POLICIES.frequency.primary,
        ...VERIFICATION_POLICIES.frequency.withLocation,
        ...VERIFICATION_POLICIES.frequency.fallback,
        ...VERIFICATION_POLICIES.partner.required,
        ...VERIFICATION_POLICIES.partner.withOthers,
      ];
      
      // Each policy combination should be in allowed combinations
      const policyCombinationArrays = [
        VERIFICATION_POLICIES.schedule.withTimeAndPlace,
        VERIFICATION_POLICIES.schedule.withTimeOnly,
        VERIFICATION_POLICIES.schedule.fallback,
        VERIFICATION_POLICIES.frequency.primary,
        VERIFICATION_POLICIES.frequency.withLocation,
        VERIFICATION_POLICIES.frequency.fallback,
        VERIFICATION_POLICIES.partner.required,
        VERIFICATION_POLICIES.partner.withOthers,
      ];
      
      policyCombinationArrays.forEach(combination => {
        expect(isAllowedSignalCombination(combination)).toBe(true);
      });
    });

    it('should ensure validation passes for all policy combinations', () => {
      // Test schedule combinations
      expect(validateVerificationSignals('schedule', VERIFICATION_POLICIES.schedule.withTimeAndPlace).valid).toBe(true);
      expect(validateVerificationSignals('schedule', VERIFICATION_POLICIES.schedule.withTimeOnly).valid).toBe(true);
      expect(validateVerificationSignals('schedule', VERIFICATION_POLICIES.schedule.fallback).valid).toBe(true);
      
      // Test frequency combinations
      expect(validateVerificationSignals('frequency', VERIFICATION_POLICIES.frequency.primary).valid).toBe(true);
      expect(validateVerificationSignals('frequency', VERIFICATION_POLICIES.frequency.withLocation).valid).toBe(true);
      expect(validateVerificationSignals('frequency', VERIFICATION_POLICIES.frequency.fallback).valid).toBe(true);
      
      // Test partner combinations
      expect(validateVerificationSignals('partner', VERIFICATION_POLICIES.partner.required).valid).toBe(true);
      expect(validateVerificationSignals('partner', VERIFICATION_POLICIES.partner.withOthers).valid).toBe(true);
    });
  });
});
