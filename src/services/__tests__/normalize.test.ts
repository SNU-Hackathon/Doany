/**
 * Unit tests for normalize.ts
 * 
 * Tests cover all slot types and edge cases
 */

import { normalize } from '../normalize';

describe('normalize', () => {
  const TZ = 'Asia/Seoul';

  describe('period normalization', () => {
    it('should normalize date objects to ISO strings', () => {
      const result = normalize('period', {
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-10-31')
      }, TZ);
      
      expect(result).toEqual({
        start: '2025-10-01',
        end: '2025-10-31'
      });
    });

    it('should handle string dates', () => {
      const result = normalize('period', {
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      }, TZ);
      
      expect(result).toEqual({
        start: '2025-10-01',
        end: '2025-10-31'
      });
    });

    it('should swap if end before start', () => {
      const result = normalize('period', {
        startDate: '2025-10-31',
        endDate: '2025-10-01'
      }, TZ);
      
      expect(result).toEqual({
        start: '2025-10-01',
        end: '2025-10-31'
      });
    });
  });

  describe('weekdays normalization', () => {
    it('should normalize numeric weekdays', () => {
      const result = normalize('baseRule.weekdays', [1, 3, 5], TZ);
      expect(result).toEqual([1, 3, 5]);
    });

    it('should convert English day names', () => {
      const result = normalize('baseRule.weekdays', ['mon', 'wed', 'fri'], TZ);
      expect(result).toEqual([1, 3, 5]);
    });

    it('should convert Korean day names', () => {
      const result = normalize('baseRule.weekdays', ['월요일', '수요일', '금요일'], TZ);
      expect(result).toEqual([1, 3, 5]);
    });

    it('should handle mixed formats', () => {
      const result = normalize('baseRule.weekdays', [1, 'wed', '금요일'], TZ);
      expect(result).toEqual([1, 3, 5]);
    });

    it('should remove duplicates and sort', () => {
      const result = normalize('baseRule.weekdays', [5, 1, 3, 1, 5], TZ);
      expect(result).toEqual([1, 3, 5]);
    });
  });

  describe('time normalization', () => {
    it('should normalize HH:mm format', () => {
      const result = normalize('baseRule.time', '07:00', TZ);
      expect(result).toBe('07:00');
    });

    it('should pad single digit hours', () => {
      const result = normalize('baseRule.time', '7:00', TZ);
      expect(result).toBe('07:00');
    });

    it('should handle Korean AM format', () => {
      const result = normalize('baseRule.time', '오전 7시', TZ);
      expect(result).toBe('07:00');
    });

    it('should handle Korean PM format', () => {
      const result = normalize('baseRule.time', '오후 7시', TZ);
      expect(result).toBe('19:00');
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-10-01T19:30:00');
      const result = normalize('baseRule.time', date, TZ);
      expect(result).toBe('19:30');
    });
  });

  describe('perWeek normalization', () => {
    it('should normalize number', () => {
      const result = normalize('perWeek', 3, TZ);
      expect(result).toEqual({ targetPerWeek: 3, windowDays: 7 });
    });

    it('should clamp to 1-7 range', () => {
      expect(normalize('perWeek', 0, TZ)).toEqual({ targetPerWeek: 1, windowDays: 7 });
      expect(normalize('perWeek', 10, TZ)).toEqual({ targetPerWeek: 7, windowDays: 7 });
    });

    it('should handle string numbers', () => {
      const result = normalize('perWeek', '5', TZ);
      expect(result).toEqual({ targetPerWeek: 5, windowDays: 7 });
    });
  });

  describe('verification normalization', () => {
    it('should convert Korean labels to signals', () => {
      const result = normalize('verification', ['사진', '위치 등록'], TZ);
      expect(result).toEqual({ signals: ['photo', 'location'] });
    });

    it('should handle English signals', () => {
      const result = normalize('verification', ['photo', 'manual'], TZ);
      expect(result).toEqual({ signals: ['photo', 'manual'] });
    });

    it('should remove duplicates', () => {
      const result = normalize('verification', ['사진', 'photo', '위치', 'location'], TZ);
      expect(result.signals.length).toBeLessThanOrEqual(2);
    });

    it('should default to manual if invalid', () => {
      const result = normalize('verification', ['invalid'], TZ);
      expect(result).toEqual({ signals: ['manual'] });
    });
  });

  describe('milestones normalization', () => {
    it('should convert string array to milestone objects', () => {
      const result = normalize('milestones', ['시작', '중간', '완료'], TZ);
      expect(result).toEqual([
        { key: 'm1', label: '시작' },
        { key: 'm2', label: '중간' },
        { key: 'm3', label: '완료' }
      ]);
    });

    it('should handle already normalized milestones', () => {
      const input = [
        { key: 'custom1', label: 'First' },
        { key: 'custom2', label: 'Second' }
      ];
      const result = normalize('milestones', input, TZ);
      expect(result).toEqual(input);
    });
  });

  describe('successRate normalization', () => {
    it('should normalize number to targetRate', () => {
      const result = normalize('successRate', 80, TZ);
      expect(result).toEqual({ targetRate: 80 });
    });

    it('should clamp to 0-100 range', () => {
      expect(normalize('successRate', -10, TZ)).toEqual({ targetRate: 0 });
      expect(normalize('successRate', 150, TZ)).toEqual({ targetRate: 100 });
    });

    it('should default to 70 if invalid', () => {
      const result = normalize('successRate', 'invalid', TZ);
      expect(result).toEqual({ targetRate: 70 });
    });
  });

  describe('type and title normalization', () => {
    it('should normalize valid goal types', () => {
      expect(normalize('type', 'schedule', TZ)).toBe('schedule');
      expect(normalize('type', 'frequency', TZ)).toBe('frequency');
      expect(normalize('type', 'milestone', TZ)).toBe('milestone');
    });

    it('should default to frequency for invalid type', () => {
      expect(normalize('type', 'invalid', TZ)).toBe('frequency');
    });

    it('should trim title strings', () => {
      const result = normalize('title', '  My Goal  ', TZ);
      expect(result).toBe('My Goal');
    });
  });
});

