/**
 * Unit tests for scheduleCompute.ts
 * 
 * Tests core schedule expansion and override logic
 */

import { GoalSpecV2 } from '../../schemas/goalSpecV2';
import { buildOccurrences, previewOccurrences, validateOccurrences } from '../scheduleCompute';

describe('scheduleCompute', () => {
  const baseSpec: GoalSpecV2 = {
    type: 'schedule',
    title: '헬스장 가기',
    timezone: 'Asia/Seoul',
    period: {
      start: '2025-10-01',
      end: '2025-10-14'
    },
    version: 1
  };

  describe('buildOccurrences', () => {
    it('should expand simple Mon/Wed/Fri rule for 2 weeks', () => {
      const spec: GoalSpecV2 = {
        ...baseSpec,
        schedule: {
          rules: [
            {
              byWeekday: [1, 3, 5], // Mon, Wed, Fri
              time: '19:00'
            }
          ],
          defaultDurationMin: 60
        }
      };

      const occurrences = buildOccurrences(spec);
      
      // 2 weeks × 3 days = 6 occurrences
      expect(occurrences.length).toBe(6);
      
      // Check first occurrence (UTC time)
      // 19:00 KST = 10:00 UTC
      expect(occurrences[0].start).toMatch(/2025-10-0[13]T10:00/); // Mon or Wed in UTC
      
      // All should have end time
      expect(occurrences[0].end).toBeDefined();
    });

    it('should handle multiple rules with different times', () => {
      const spec: GoalSpecV2 = {
        ...baseSpec,
        schedule: {
          rules: [
            { byWeekday: [1, 3], time: '07:00' }, // Mon, Wed morning
            { byWeekday: [5], time: '19:00' }      // Fri evening
          ],
          defaultDurationMin: 60
        }
      };

      const occurrences = buildOccurrences(spec);
      
      // 2 weeks × (2 + 1) = 6 occurrences
      expect(occurrences.length).toBe(6);
    });

    it('should apply cancel override', () => {
      const spec: GoalSpecV2 = {
        ...baseSpec,
        schedule: {
          rules: [
            { byWeekday: [1, 3, 5], time: '19:00' }
          ],
          overrides: [
            { kind: 'cancel', date: '2025-10-03' } // Cancel Wednesday
          ],
          defaultDurationMin: 60
        }
      };

      const occurrences = buildOccurrences(spec);
      
      // 6 - 1 = 5 occurrences
      expect(occurrences.length).toBe(5);
      
      // Should not contain Oct 3
      const dates = occurrences.map(o => o.start.split('T')[0]);
      expect(dates).not.toContain('2025-10-03');
    });

    it('should apply retime override', () => {
      const spec: GoalSpecV2 = {
        ...baseSpec,
        schedule: {
          rules: [
            { byWeekday: [1, 3, 5], time: '19:00' }
          ],
          overrides: [
            { kind: 'retime', date: '2025-10-03', time: '20:00' }
          ],
          defaultDurationMin: 60
        }
      };

      const occurrences = buildOccurrences(spec);
      
      // Still 6 occurrences
      expect(occurrences.length).toBe(6);
      
      // Oct 3 should be at 20:00 KST = 11:00 UTC instead of 19:00 KST = 10:00 UTC
      const oct3 = occurrences.find(o => o.start.includes('2025-10-03'));
      expect(oct3?.start).toMatch(/T11:00/);
    });

    it('should apply add override', () => {
      const spec: GoalSpecV2 = {
        ...baseSpec,
        schedule: {
          rules: [
            { byWeekday: [1, 3, 5], time: '19:00' }
          ],
          overrides: [
            { kind: 'add', date: '2025-10-04', time: '10:00' } // Add Saturday
          ],
          defaultDurationMin: 60
        }
      };

      const occurrences = buildOccurrences(spec);
      
      // 6 + 1 = 7 occurrences
      expect(occurrences.length).toBe(7);
      
      // Should contain Oct 4 at 10:00 KST = 01:00 UTC
      const oct4 = occurrences.find(o => o.start.includes('2025-10-04'));
      expect(oct4).toBeDefined();
      expect(oct4?.start).toMatch(/T01:00/);
    });

    it('should apply move override', () => {
      const spec: GoalSpecV2 = {
        ...baseSpec,
        schedule: {
          rules: [
            { byWeekday: [1, 3, 5], time: '19:00' }
          ],
          overrides: [
            { kind: 'move', from: '2025-10-03', toDate: '2025-10-04', toTime: '10:00' }
          ],
          defaultDurationMin: 60
        }
      };

      const occurrences = buildOccurrences(spec);
      
      // Still 6 occurrences
      expect(occurrences.length).toBe(6);
      
      // Should not contain Oct 3
      const dates = occurrences.map(o => o.start.split('T')[0]);
      expect(dates).not.toContain('2025-10-03');
      
      // Should contain Oct 4 at 10:00
      const oct4 = occurrences.find(o => o.start.includes('2025-10-04'));
      expect(oct4).toBeDefined();
    });

    it('should handle complex combination of overrides', () => {
      const spec: GoalSpecV2 = {
        ...baseSpec,
        period: {
          start: '2025-10-01',
          end: '2025-10-31' // Full month
        },
        schedule: {
          rules: [
            { byWeekday: [1, 3, 5], time: '19:00' }
          ],
          overrides: [
            { kind: 'cancel', date: '2025-10-03' },
            { kind: 'cancel', date: '2025-10-13' },
            { kind: 'retime', date: '2025-10-06', time: '20:00' },
            { kind: 'add', date: '2025-10-04', time: '10:00' },
            { kind: 'add', date: '2025-10-11', time: '10:00' }
          ],
          defaultDurationMin: 60
        }
      };

      const occurrences = buildOccurrences(spec);
      
      // Base: Oct has 5 Mon + 5 Wed + 4 Fri = 14
      // Cancel: -2
      // Add: +2
      // Retime: no change in count
      // Total: 14 - 2 + 2 = 14
      expect(occurrences.length).toBe(14);
      
      // Verify specific overrides (all times in UTC)
      expect(occurrences.find(o => o.start.includes('2025-10-03'))).toBeUndefined();
      expect(occurrences.find(o => o.start.includes('2025-10-13'))).toBeUndefined();
      // 20:00 KST = 11:00 UTC
      expect(occurrences.find(o => o.start.includes('2025-10-06'))?.start).toMatch(/T11:00/);
      // 10:00 KST = 01:00 UTC
      expect(occurrences.find(o => o.start.includes('2025-10-04'))?.start).toMatch(/T01:00/);
    });

    it('should sort occurrences chronologically', () => {
      const spec: GoalSpecV2 = {
        ...baseSpec,
        schedule: {
          rules: [
            { byWeekday: [1, 3, 5], time: '19:00' }
          ],
          overrides: [
            { kind: 'add', date: '2025-10-02', time: '08:00' } // Add early
          ],
          defaultDurationMin: 60
        }
      };

      const occurrences = buildOccurrences(spec);
      
      // Verify chronological order
      for (let i = 1; i < occurrences.length; i++) {
        const prev = new Date(occurrences[i - 1].start);
        const curr = new Date(occurrences[i].start);
        expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
      }
    });
  });

  describe('previewOccurrences', () => {
    it('should format occurrences for UI display', () => {
      const spec: Partial<GoalSpecV2> = {
        type: 'schedule',
        timezone: 'Asia/Seoul',
        period: {
          start: '2025-10-01',
          end: '2025-10-07'
        },
        schedule: {
          rules: [
            { byWeekday: [1, 3, 5], time: '19:00' }
          ]
        }
      };

      const preview = previewOccurrences(spec);
      
      expect(preview.length).toBe(3);
      
      // Check format
      expect(preview[0]).toHaveProperty('date');
      expect(preview[0]).toHaveProperty('time');
      expect(preview[0]).toHaveProperty('dayName');
      expect(preview[0]).toHaveProperty('weekNumber');
      
      // Check Korean day names
      expect(['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'])
        .toContain(preview[0].dayName);
    });

    it('should include overrides in preview', () => {
      const spec: Partial<GoalSpecV2> = {
        type: 'schedule',
        timezone: 'Asia/Seoul',
        period: {
          start: '2025-10-01',
          end: '2025-10-07'
        },
        schedule: {
          rules: [
            { byWeekday: [1], time: '19:00' } // Only Monday
          ],
          overrides: [
            { kind: 'add', date: '2025-10-04', time: '10:00' }
          ]
        }
      };

      const preview = previewOccurrences(spec);
      
      // 1 Mon + 1 added = 2
      expect(preview.length).toBe(2);
      // Preview shows local time (10:00), not UTC
      expect(preview.some(p => p.date === '2025-10-04' && p.time === '10:00')).toBe(true);
    });
  });

  describe('validateOccurrences', () => {
    it('should accept valid occurrences', () => {
      const occurrences = [
        { start: '2025-10-01T19:00:00.000Z', end: '2025-10-01T20:00:00.000Z' },
        { start: '2025-10-03T19:00:00.000Z', end: '2025-10-03T20:00:00.000Z' }
      ];

      const result = validateOccurrences(occurrences);
      
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject empty occurrences', () => {
      const result = validateOccurrences([]);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('최소 1개 이상의 일정이 필요합니다');
    });

    it('should reject too many occurrences', () => {
      const occurrences = Array(101).fill(null).map((_, i) => ({
        start: `2025-10-${String(i + 1).padStart(2, '0')}T19:00:00.000Z`,
        end: `2025-10-${String(i + 1).padStart(2, '0')}T20:00:00.000Z`
      }));

      const result = validateOccurrences(occurrences);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('100개'))).toBe(true);
    });
  });
});

