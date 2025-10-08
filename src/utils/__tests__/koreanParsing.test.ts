import { describe, expect, it } from 'vitest';
import {
    parseKoreanSchedule,
    parseRelativeSpanKo,
    parseTimePhrasesKo,
    parseWeekdaysKo
} from '../koreanParsing';

describe('Korean Parsing Utilities', () => {
  describe('parseWeekdaysKo', () => {
    it('should parse Korean full weekday names', () => {
      expect(parseWeekdaysKo('월요일 운동')).toEqual(['mon']);
      expect(parseWeekdaysKo('화요일과 목요일 헬스')).toEqual(['tue', 'thu']);
      expect(parseWeekdaysKo('월수금 러닝')).toEqual(['mon', 'wed', 'fri']);
    });

    it('should parse Korean short weekday names', () => {
      expect(parseWeekdaysKo('월 운동')).toEqual(['mon']);
      expect(parseWeekdaysKo('화/목 헬스')).toEqual(['tue', 'thu']);
      expect(parseWeekdaysKo('토 일 요가')).toEqual(['sat', 'sun']);
    });

    it('should parse English weekday names', () => {
      expect(parseWeekdaysKo('monday workout')).toEqual(['mon']);
      expect(parseWeekdaysKo('tuesday and thursday gym')).toEqual(['tue', 'thu']);
      expect(parseWeekdaysKo('mon/wed/fri running')).toEqual(['mon', 'wed', 'fri']);
    });

    it('should prefer Korean over English when both present', () => {
      expect(parseWeekdaysKo('월요일 monday 운동')).toEqual(['mon']); // Korean takes precedence
    });

    it('should handle mixed Korean and English', () => {
      expect(parseWeekdaysKo('월요일과 friday 운동')).toEqual(['mon', 'fri']);
    });

    it('should remove duplicates and preserve order', () => {
      expect(parseWeekdaysKo('월요일 월 화요일')).toEqual(['mon', 'tue']); // 월요일 and 월 both map to 'mon'
      expect(parseWeekdaysKo('월 화 수 목 금 토 일')).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    });

    it('should return empty array for no weekdays', () => {
      expect(parseWeekdaysKo('운동하기')).toEqual([]);
      expect(parseWeekdaysKo('일주일에 3번 독서')).toEqual([]);
    });

    it('should handle edge cases', () => {
      expect(parseWeekdaysKo('')).toEqual([]);
      expect(parseWeekdaysKo('월요일요일')).toEqual(['mon', 'sun']); // Contains 월요일 and 일요일
      expect(parseWeekdaysKo('월화수목금토일')).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']); // All weekdays
    });
  });

  describe('parseTimePhrasesKo', () => {
    it('should parse Korean time anchors', () => {
      expect(parseTimePhrasesKo('새벽 운동')).toEqual({ start: '05:00' });
      expect(parseTimePhrasesKo('아침 러닝')).toEqual({ start: '07:00' });
      expect(parseTimePhrasesKo('점심 시간')).toEqual({ start: '12:00' });
      expect(parseTimePhrasesKo('저녁 헬스')).toEqual({ start: '18:00' });
      expect(parseTimePhrasesKo('밤 요가')).toEqual({ start: '21:00' });
    });

    it('should parse Korean time format', () => {
      expect(parseTimePhrasesKo('6시 운동')).toEqual({ start: '06:00' });
      expect(parseTimePhrasesKo('6시 30분 운동')).toEqual({ start: '06:30' });
      expect(parseTimePhrasesKo('18시 헬스')).toEqual({ start: '18:00' });
      expect(parseTimePhrasesKo('18시 30분 헬스')).toEqual({ start: '18:30' });
    });

    it('should parse time ranges', () => {
      expect(parseTimePhrasesKo('18:30~19:10 헬스')).toEqual({ start: '18:30', end: '19:10' });
      expect(parseTimePhrasesKo('6-7시 운동')).toEqual({ start: '06:00', end: '07:00' });
      expect(parseTimePhrasesKo('18:30-19:10 헬스')).toEqual({ start: '18:30', end: '19:10' });
    });

    it('should parse English time format', () => {
      expect(parseTimePhrasesKo('6am workout')).toEqual({ start: '06:00' });
      expect(parseTimePhrasesKo('6:30pm gym')).toEqual({ start: '18:30' });
      expect(parseTimePhrasesKo('18:30 training')).toEqual({ start: '18:30' });
      expect(parseTimePhrasesKo('12pm lunch')).toEqual({ start: '12:00' });
    });

    it('should handle 12-hour to 24-hour conversion', () => {
      expect(parseTimePhrasesKo('12am midnight')).toEqual({ start: '00:00' });
      expect(parseTimePhrasesKo('12pm noon')).toEqual({ start: '12:00' });
      expect(parseTimePhrasesKo('1am early')).toEqual({ start: '01:00' });
      expect(parseTimePhrasesKo('1pm afternoon')).toEqual({ start: '13:00' });
    });

    it('should prefer first time found', () => {
      expect(parseTimePhrasesKo('6시 7시 운동')).toEqual({ start: '06:00' }); // Takes first
    });

    it('should return empty for no time', () => {
      expect(parseTimePhrasesKo('운동하기')).toEqual({});
      expect(parseTimePhrasesKo('독서')).toEqual({});
    });
  });

  describe('parseRelativeSpanKo', () => {
    it('should parse start offset days', () => {
      expect(parseRelativeSpanKo('내일부터 운동')).toEqual({ startOffsetDays: 1 });
      expect(parseRelativeSpanKo('모레부터 시작')).toEqual({ startOffsetDays: 2 });
      expect(parseRelativeSpanKo('다음주부터 헬스')).toEqual({ startOffsetDays: 7 });
      expect(parseRelativeSpanKo('다음달부터 요가')).toEqual({ startOffsetDays: 30 });
    });

    it('should parse duration patterns', () => {
      expect(parseRelativeSpanKo('2주간 운동')).toEqual({ durationDays: 14 });
      expect(parseRelativeSpanKo('1개월 헬스')).toEqual({ durationDays: 30 });
      expect(parseRelativeSpanKo('7일 독서')).toEqual({ durationDays: 7 });
      expect(parseRelativeSpanKo('3 weeks training')).toEqual({ durationDays: 21 });
      expect(parseRelativeSpanKo('2 months diet')).toEqual({ durationDays: 60 });
      expect(parseRelativeSpanKo('5 days meditation')).toEqual({ durationDays: 5 });
    });

    it('should parse combined start and duration', () => {
      expect(parseRelativeSpanKo('내일부터 2주간 운동')).toEqual({ 
        startOffsetDays: 1, 
        durationDays: 14 
      });
      expect(parseRelativeSpanKo('다음주부터 1개월 헬스')).toEqual({ 
        startOffsetDays: 7, 
        durationDays: 30 
      });
    });

    it('should handle English equivalents', () => {
      expect(parseRelativeSpanKo('tomorrow start')).toEqual({ startOffsetDays: 1 });
      expect(parseRelativeSpanKo('next week begin')).toEqual({ startOffsetDays: 7 });
      expect(parseRelativeSpanKo('next month plan')).toEqual({ startOffsetDays: 30 });
    });

    it('should return empty for no relative span', () => {
      expect(parseRelativeSpanKo('운동하기')).toEqual({});
      expect(parseRelativeSpanKo('일주일에 3번')).toEqual({});
    });
  });

  describe('parseKoreanSchedule', () => {
    it('should parse complete schedule information', () => {
      const result = parseKoreanSchedule('월수금 6시 러닝');
      expect(result.weekdays).toEqual(['mon', 'wed', 'fri']);
      expect(result.timeRange).toEqual({ start: '06:00' });
      expect(result.relativeSpan).toEqual({});
    });

    it('should parse complex schedule with range', () => {
      const result = parseKoreanSchedule('화/목 18:30~19:10 헬스');
      expect(result.weekdays).toEqual(['tue', 'thu']);
      expect(result.timeRange).toEqual({ start: '18:30', end: '19:10' });
      expect(result.relativeSpan).toEqual({});
    });

    it('should parse schedule with relative span', () => {
      const result = parseKoreanSchedule('내일부터 2주간 매일 오전 7시 운동');
      expect(result.weekdays).toEqual([]); // "매일" doesn't specify specific weekdays
      expect(result.timeRange).toEqual({ start: '07:00' }); // 오전 7시 = 07:00
      expect(result.relativeSpan).toEqual({ startOffsetDays: 1, durationDays: 14 });
    });

    it('should parse weekend schedule', () => {
      const result = parseKoreanSchedule('주말 오후 3시 요가');
      expect(result.weekdays).toEqual([]); // "주말" doesn't specify sat/sun explicitly
      expect(result.timeRange).toEqual({ start: '15:00' });
      expect(result.relativeSpan).toEqual({});
    });

    it('should parse weekday schedule', () => {
      const result = parseKoreanSchedule('주중 오전 7시 러닝');
      expect(result.weekdays).toEqual([]); // "주중" doesn't specify specific weekdays
      expect(result.timeRange).toEqual({ start: '07:00' }); // 오전 = 07:00
      expect(result.relativeSpan).toEqual({});
    });

    it('should handle mixed Korean and English', () => {
      const result = parseKoreanSchedule('monday wednesday friday 6am running');
      expect(result.weekdays).toEqual(['mon', 'wed', 'fri']);
      expect(result.timeRange).toEqual({ start: '06:00' });
      expect(result.relativeSpan).toEqual({});
    });

    it('should handle ambiguous cases', () => {
      const result = parseKoreanSchedule('토 오전 or 일 오후 요가');
      expect(result.weekdays).toEqual(['sat', 'sun']); // Takes both mentioned
      expect(result.timeRange).toEqual({ start: '09:00' }); // Takes first time (오전)
      expect(result.relativeSpan).toEqual({});
    });

    it('should handle frequency-only goals', () => {
      const result = parseKoreanSchedule('일주일에 3번 독서 30분');
      expect(result.weekdays).toEqual([]);
      expect(result.timeRange).toEqual({});
      expect(result.relativeSpan).toEqual({});
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle pathological long strings efficiently', () => {
      const longString = '월요일 '.repeat(1000) + '화요일';
      const result = parseWeekdaysKo(longString);
      expect(result).toEqual(['mon', 'tue']); // Should find both despite length
    });

    it('should handle malformed input gracefully', () => {
      expect(parseWeekdaysKo('월요일요일')).toEqual(['mon', 'sun']);
      expect(parseTimePhrasesKo('25시 운동')).toEqual({});
      expect(parseRelativeSpanKo('invalid input')).toEqual({});
    });

    it('should handle empty and whitespace input', () => {
      expect(parseKoreanSchedule('')).toEqual({ weekdays: [], timeRange: {}, relativeSpan: {} });
      expect(parseKoreanSchedule('   ')).toEqual({ weekdays: [], timeRange: {}, relativeSpan: {} });
    });

    it('should handle special characters and punctuation', () => {
      expect(parseWeekdaysKo('월요일, 화요일!')).toEqual(['mon', 'tue']);
      expect(parseTimePhrasesKo('6시-7시 운동')).toEqual({ start: '06:00', end: '07:00' });
    });
  });

  describe('Determinism Tests', () => {
    it('should produce consistent results for same input', () => {
      const input = '월수금 6시 러닝';
      const result1 = parseKoreanSchedule(input);
      const result2 = parseKoreanSchedule(input);
      expect(result1).toEqual(result2);
    });

    it('should handle precedence rules correctly', () => {
      // Korean takes precedence over English
      expect(parseWeekdaysKo('월요일 monday')).toEqual(['mon']);
      
      // First time found takes precedence
      expect(parseTimePhrasesKo('6시 7시 운동')).toEqual({ start: '06:00' });
      
      // Specific days take precedence over general terms
      expect(parseWeekdaysKo('월요일 주중')).toEqual(['mon']);
    });

    it('should handle ambiguous cases with deterministic rules', () => {
      // Multiple days: take all mentioned
      expect(parseWeekdaysKo('월 화 수 목 금 토 일')).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
      
      // Multiple times: use first found
      expect(parseTimePhrasesKo('6시 7시 8시 운동')).toEqual({ start: '06:00' });
      
      // Mixed ambiguity: follow precedence rules
      expect(parseKoreanSchedule('토 오전 or 일 오후 요가')).toEqual({
        weekdays: ['sat', 'sun'],
        timeRange: { start: '09:00' },
        relativeSpan: {}
      });
    });
  });
});
