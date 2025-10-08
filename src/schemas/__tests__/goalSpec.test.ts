import { describe, expect, it } from 'vitest';
import { validateGoalSpec, validateGoalSpecWithRecovery, validateTypeSpecificFields } from '../goalSpec';

describe('GoalSpecSchema', () => {
  describe('Valid samples', () => {
    it('should validate a valid schedule goal', () => {
      const validSchedule = {
        type: 'schedule',
        originalText: '월수금 6시 러닝',
        schedule: {
          events: [
            { dayOfWeek: 'mon', time: '06:00' },
            { dayOfWeek: 'wed', time: '06:00' },
            { dayOfWeek: 'fri', time: '06:00' }
          ]
        },
        verification: {
          signals: ['time', 'location', 'manual']
        }
      };

      expect(() => validateGoalSpec(validSchedule)).not.toThrow();
      const result = validateGoalSpec(validSchedule);
      expect(result.type).toBe('schedule');
      expect(result.schedule?.events).toHaveLength(3);
    });

    it('should validate a valid frequency goal', () => {
      const validFrequency = {
        type: 'frequency',
        originalText: '일주일에 3번 독서 30분',
        frequency: {
          targetPerWeek: 3,
          windowDays: 7
        },
        verification: {
          signals: ['manual']
        }
      };

      expect(() => validateGoalSpec(validFrequency)).not.toThrow();
      const result = validateGoalSpec(validFrequency);
      expect(result.type).toBe('frequency');
      expect(result.frequency?.targetPerWeek).toBe(3);
    });

    it('should validate a valid partner goal', () => {
      const validPartner = {
        type: 'partner',
        originalText: '매일 코치와 함께 운동 계획 검토',
        partner: {
          required: true,
          name: '코치'
        },
        verification: {
          signals: ['partner', 'manual']
        }
      };

      expect(() => validateGoalSpec(validPartner)).not.toThrow();
      const result = validateGoalSpec(validPartner);
      expect(result.type).toBe('milestone');
      expect(result.milestone?.milestones).toBeDefined();
    });

    it('should validate schedule with location data', () => {
      const scheduleWithLocation = {
        type: 'schedule',
        originalText: '매주 화/목 18:30~19:10 헬스',
        schedule: {
          events: [
            { 
              dayOfWeek: 'tue', 
              time: '18:30',
              locationName: '헬스장',
              lat: 37.5665,
              lng: 126.9780
            }
          ]
        },
        verification: {
          signals: ['time', 'location', 'manual']
        }
      };

      expect(() => validateGoalSpec(scheduleWithLocation)).not.toThrow();
      const result = validateGoalSpec(scheduleWithLocation);
      expect(result.schedule?.events[0].locationName).toBe('헬스장');
    });
  });

  describe('Near-miss samples (should fail)', () => {
    it('should fail for missing time in schedule type', () => {
      const invalidSchedule = {
        type: 'schedule',
        originalText: '매일 운동',
        schedule: {
          events: [
            { dayOfWeek: 'mon' } // Missing time
          ]
        },
        verification: {
          signals: ['manual']
        }
      };

      expect(() => validateGoalSpec(invalidSchedule)).toThrow();
    });

    it('should fail for non-integer targetPerWeek in frequency', () => {
      const invalidFrequency = {
        type: 'frequency',
        originalText: '일주일에 3.5번 독서',
        frequency: {
          targetPerWeek: 3.5, // Non-integer
          windowDays: 7
        },
        verification: {
          signals: ['manual']
        }
      };

      expect(() => validateGoalSpec(invalidFrequency)).toThrow('Invalid input: expected int, received number');
    });

    it('should fail for negative targetPerWeek', () => {
      const invalidFrequency = {
        type: 'frequency',
        originalText: '일주일에 -1번 독서',
        frequency: {
          targetPerWeek: -1, // Negative
          windowDays: 7
        },
        verification: {
          signals: ['manual']
        }
      };

      expect(() => validateGoalSpec(invalidFrequency)).toThrow('targetPerWeek must be a positive integer');
    });

    it('should fail for partner.required=false but partner.name present', () => {
      const invalidPartner = {
        type: 'partner',
        originalText: '선택적 코칭',
        partner: {
          required: false, // False but name present
          name: '코치'
        },
        verification: {
          signals: ['partner']
        }
      };

      // This should pass schema validation but fail type-specific validation
      expect(() => validateGoalSpec(invalidPartner)).not.toThrow();
      
      const result = validateGoalSpec(invalidPartner);
      const typeValidation = validateTypeSpecificFields(result);
      expect(typeValidation.valid).toBe(false);
      expect(typeValidation.errors).toContain('Partner type requires partner.required to be true');
    });

    it('should fail for invalid time format', () => {
      const invalidTime = {
        type: 'schedule',
        originalText: '매일 25:00 운동',
        schedule: {
          events: [
            { dayOfWeek: 'mon', time: '25:00' } // Invalid time
          ]
        },
        verification: {
          signals: ['time']
        }
      };

      expect(() => validateGoalSpec(invalidTime)).toThrow('Invalid time format');
    });

    it('should fail for invalid dayOfWeek', () => {
      const invalidDay = {
        type: 'schedule',
        originalText: '매일 운동',
        schedule: {
          events: [
            { dayOfWeek: 'invalidday', time: '09:00' }
          ]
        },
        verification: {
          signals: ['manual']
        }
      };

      expect(() => validateGoalSpec(invalidDay)).toThrow();
    });

    it('should fail for empty verification signals', () => {
      const noSignals = {
        type: 'frequency',
        originalText: '독서',
        frequency: {
          targetPerWeek: 1,
          windowDays: 7
        },
        verification: {
          signals: [] // Empty array
        }
      };

      expect(() => validateGoalSpec(noSignals)).toThrow('At least one verification signal is required');
    });

    it('should reject unknown keys (strict mode)', () => {
      const withUnknownKeys = {
        type: 'frequency',
        originalText: '독서',
        frequency: {
          targetPerWeek: 1,
          windowDays: 7
        },
        verification: {
          signals: ['manual']
        },
        unknownField: 'should be rejected' // Unknown key
      };

      expect(() => validateGoalSpec(withUnknownKeys)).toThrow();
    });
  });

  describe('Recovery functionality', () => {
    it('should handle missing type field (now optional)', () => {
      const missingType = {
        originalText: '독서',
        frequency: {
          targetPerWeek: 1,
          windowDays: 7
        },
        verification: {
          signals: ['manual']
        }
      };

      const result = validateGoalSpecWithRecovery(missingType);
      expect(result.spec).not.toBeNull();
      // Type is now optional, so no warning needed
      expect(result.spec?.type).toBeUndefined();
    });

    it('should recover from invalid time format', () => {
      const invalidTime = {
        type: 'schedule',
        originalText: '매일 9시 운동',
        schedule: {
          events: [
            { dayOfWeek: 'mon', time: '9' } // Invalid format
          ]
        },
        verification: {
          signals: ['time']
        }
      };

      const result = validateGoalSpecWithRecovery(invalidTime);
      expect(result.spec).not.toBeNull();
      expect(result.warnings.some(w => w.includes('Invalid time format'))).toBe(true);
      expect(result.spec?.schedule?.events[0].time).toBe('09:00');
    });

    it('should recover from string targetPerWeek', () => {
      const stringFrequency = {
        type: 'frequency',
        originalText: '일주일에 3번 독서',
        frequency: {
          targetPerWeek: '3', // String instead of number
          windowDays: 7
        },
        verification: {
          signals: ['manual']
        }
      };

      const result = validateGoalSpecWithRecovery(stringFrequency);
      expect(result.spec).not.toBeNull();
      expect(result.warnings).toContain('Converted string targetPerWeek to integer');
      expect(result.spec?.frequency?.targetPerWeek).toBe(3);
    });

    it('should fail recovery for completely invalid data', () => {
      const invalidData = {
        type: 'invalidtype',
        originalText: '',
        verification: {
          signals: []
        }
      };

      const result = validateGoalSpecWithRecovery(invalidData);
      expect(result.spec).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Type-specific validation', () => {
    it('should validate schedule type requires events', () => {
      const scheduleWithoutEvents = {
        type: 'schedule',
        originalText: '운동',
        verification: {
          signals: ['manual']
        }
      };

      const result = validateGoalSpec(scheduleWithoutEvents);
      const typeValidation = validateTypeSpecificFields(result);
      expect(typeValidation.valid).toBe(false);
      expect(typeValidation.errors).toContain('Schedule type requires at least one event');
    });

    it('should validate frequency type requires positive targetPerWeek', () => {
      const frequencyWithoutTarget = {
        type: 'frequency',
        originalText: '독서',
        verification: {
          signals: ['manual']
        }
      };

      const result = validateGoalSpec(frequencyWithoutTarget);
      const typeValidation = validateTypeSpecificFields(result);
      expect(typeValidation.valid).toBe(false);
      expect(typeValidation.errors).toContain('Frequency type requires positive targetPerWeek');
    });

    it('should validate partner type requires partner.required=true', () => {
      const partnerWithoutRequired = {
        type: 'partner',
        originalText: '코칭',
        verification: {
          signals: ['partner']
        }
      };

      const result = validateGoalSpec(partnerWithoutRequired);
      const typeValidation = validateTypeSpecificFields(result);
      expect(typeValidation.valid).toBe(false);
      expect(typeValidation.errors).toContain('Partner type requires partner.required to be true');
    });

    it('should pass validation when type is not specified', () => {
      const legacySpec = {
        title: '운동',
        verification: {
          methods: ['manual'],
          mandatory: ['manual'],
          sufficiency: true,
          rationale: 'Legacy format'
        },
        schedule: {
          weekBoundary: 'startWeekday',
          enforcePartialWeeks: false
        }
      };

      const result = validateGoalSpec(legacySpec);
      const typeValidation = validateTypeSpecificFields(result);
      expect(typeValidation.valid).toBe(true);
      expect(typeValidation.errors).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle default windowDays', () => {
      const frequencyWithoutWindowDays = {
        type: 'frequency',
        originalText: '독서',
        frequency: {
          targetPerWeek: 1
          // windowDays omitted
        },
        verification: {
          signals: ['manual']
        }
      };

      const result = validateGoalSpec(frequencyWithoutWindowDays);
      expect(result.frequency?.windowDays).toBe(7); // Default value
    });

    it('should handle optional partner name', () => {
      const partnerWithoutName = {
        type: 'partner',
        originalText: '파트너와 함께',
        partner: {
          required: true
          // name omitted
        },
        verification: {
          signals: ['partner']
        }
      };

      expect(() => validateGoalSpec(partnerWithoutName)).not.toThrow();
      const result = validateGoalSpec(partnerWithoutName);
      expect(result.milestone?.milestones).toBeDefined();
    });

    it('should handle optional location data', () => {
      const scheduleWithoutLocation = {
        type: 'schedule',
        originalText: '운동',
        schedule: {
          events: [
            { dayOfWeek: 'mon', time: '09:00' }
            // No location data
          ]
        },
        verification: {
          signals: ['time']
        }
      };

      expect(() => validateGoalSpec(scheduleWithoutLocation)).not.toThrow();
      const result = validateGoalSpec(scheduleWithoutLocation);
      expect(result.schedule?.events[0].locationName).toBeUndefined();
    });

    it('should handle optional meta field for uncertainty', () => {
      const uncertainGoal = {
        type: 'frequency',
        originalText: '모호한 목표',
        verification: {
          signals: ['manual']
        },
        meta: {
          reason: 'Uncertain classification due to ambiguous wording'
        }
      };

      expect(() => validateGoalSpec(uncertainGoal)).not.toThrow();
      const result = validateGoalSpec(uncertainGoal);
      expect(result.meta?.reason).toBe('Uncertain classification due to ambiguous wording');
    });
  });
});
