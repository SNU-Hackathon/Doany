/**
 * Tests for language detection utilities
 */

import { describe, expect, it } from 'vitest';
import {
    containsEnglish,
    containsKorean,
    detectLanguage,
    getLanguageAwareSystemPrompt,
    getLocaleConfig,
    testLanguageDetection
} from '../languageDetection';

describe('Language Detection', () => {
  describe('containsKorean', () => {
    it('should detect Korean characters', () => {
      expect(containsKorean('월수금 6시 러닝')).toBe(true);
      expect(containsKorean('일주일에 3번 독서')).toBe(true);
      expect(containsKorean('매일 아침 헬스장 가기')).toBe(true);
    });

    it('should not detect Korean in English text', () => {
      expect(containsKorean('Monday Wednesday Friday at 6am running')).toBe(false);
      expect(containsKorean('3 times a week exercise')).toBe(false);
      expect(containsKorean('Go to gym every morning')).toBe(false);
    });
  });

  describe('containsEnglish', () => {
    it('should detect English patterns', () => {
      expect(containsEnglish('Monday Wednesday Friday at 6am running')).toBe(true);
      expect(containsEnglish('3 times a week exercise')).toBe(true);
      expect(containsEnglish('Go to gym every morning')).toBe(true);
      expect(containsEnglish('mon wed fri at 6am')).toBe(true);
    });

    it('should not detect English in Korean text', () => {
      expect(containsEnglish('월수금 6시 러닝')).toBe(false);
      expect(containsEnglish('일주일에 3번 독서')).toBe(false);
      expect(containsEnglish('매일 아침 헬스장 가기')).toBe(false);
    });
  });

  describe('detectLanguage', () => {
    it('should detect Korean language', () => {
      expect(detectLanguage('월수금 6시 러닝')).toBe('ko');
      expect(detectLanguage('일주일에 3번 독서')).toBe('ko');
      expect(detectLanguage('매일 아침 헬스장 가기')).toBe('ko');
    });

    it('should detect English language', () => {
      expect(detectLanguage('Monday Wednesday Friday at 6am running')).toBe('en');
      expect(detectLanguage('3 times a week exercise')).toBe('en');
      expect(detectLanguage('Go to gym every morning')).toBe('en');
    });

    it('should detect mixed language', () => {
      expect(detectLanguage('Monday 헬스장 가기')).toBe('mixed');
      expect(detectLanguage('월수금 gym 가기')).toBe('mixed');
    });

    it('should default to Korean for unclear text', () => {
      expect(detectLanguage('123456')).toBe('ko');
      expect(detectLanguage('!!!')).toBe('ko');
    });
  });

  describe('getLocaleConfig', () => {
    it('should return Korean config for Korean text', () => {
      const config = getLocaleConfig('월수금 6시 러닝');
      expect(config.locale).toBe('ko-KR');
      expect(config.timezone).toBe('Asia/Seoul');
      expect(config.weekdays['월']).toBe('mon');
      expect(config.timeAnchors['아침']).toBe('07:00');
    });

    it('should return English config for English text', () => {
      const config = getLocaleConfig('Monday Wednesday Friday at 6am running');
      expect(config.locale).toBe('en-US');
      expect(config.timezone).toBe('America/New_York');
      expect(config.weekdays['monday']).toBe('mon');
      expect(config.timeAnchors['morning']).toBe('07:00');
    });

    it('should return Korean config for mixed text', () => {
      const config = getLocaleConfig('Monday 헬스장 가기');
      expect(config.locale).toBe('ko-KR');
      expect(config.timezone).toBe('Asia/Seoul');
    });
  });

  describe('getLanguageAwareSystemPrompt', () => {
    it('should generate Korean-specific instructions for Korean text', () => {
      const basePrompt = 'You are a JSON classifier.\n\nLOCALE NORMALIZATION:\nKorean weekdays: 월→mon';
      const config = getLocaleConfig('월수금 6시 러닝');
      const result = getLanguageAwareSystemPrompt(basePrompt, config);
      
      expect(result).toContain('Korean weekdays: 월→mon, 화→tue');
      expect(result).toContain('Time anchors: 새벽→05:00, 아침→07:00');
    });

    it('should generate English-specific instructions for English text', () => {
      const basePrompt = 'You are a JSON classifier.\n\nLOCALE NORMALIZATION:\nKorean weekdays: 월→mon';
      const config = getLocaleConfig('Monday Wednesday Friday at 6am running');
      const result = getLanguageAwareSystemPrompt(basePrompt, config);
      
      expect(result).toContain('English weekdays: monday→mon, tuesday→tue');
      expect(result).toContain('Time anchors: morning→07:00, afternoon→14:00');
      expect(result).toContain('Parse "3 times a week" → frequency with targetPerWeek: 3');
    });
  });

  describe('testLanguageDetection', () => {
    it('should run without errors', () => {
      expect(() => testLanguageDetection()).not.toThrow();
    });
  });
});
