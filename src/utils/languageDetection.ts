/**
 * Language detection utilities for AI goal generation
 */

export interface LocaleConfig {
  locale: string;
  timezone: string;
  weekdays: Record<string, string>;
  timeAnchors: Record<string, string>;
}

// Korean configuration
const KOREAN_CONFIG: LocaleConfig = {
  locale: 'ko-KR',
  timezone: 'Asia/Seoul',
  weekdays: {
    '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat', '일': 'sun',
    '월요일': 'mon', '화요일': 'tue', '수요일': 'wed', '목요일': 'thu', '금요일': 'fri', '토요일': 'sat', '일요일': 'sun'
  },
  timeAnchors: {
    '새벽': '05:00', '아침': '07:00', '점심': '12:00', '저녁': '18:00', '밤': '21:00'
  }
};

// English configuration
const ENGLISH_CONFIG: LocaleConfig = {
  locale: 'en-US',
  timezone: 'America/New_York', // Default to EST, can be made configurable
  weekdays: {
    'monday': 'mon', 'tuesday': 'tue', 'wednesday': 'wed', 'thursday': 'thu', 'friday': 'fri', 'saturday': 'sat', 'sunday': 'sun',
    'mon': 'mon', 'tue': 'tue', 'wed': 'wed', 'thu': 'thu', 'fri': 'fri', 'sat': 'sat', 'sun': 'sun'
  },
  timeAnchors: {
    'morning': '07:00', 'before work': '07:00', 'lunchtime': '12:00', 'evening': '19:00', 'after work': '19:00', 'night': '21:00'
  }
};

/**
 * Detect if text contains Korean characters
 */
export const containsKorean = (text: string): boolean => {
  const koreanRegex = /[\u3131-\u3163\uac00-\ud7a3]/;
  return koreanRegex.test(text);
};

/**
 * Detect if text contains English patterns
 */
export const containsEnglish = (text: string): boolean => {
  const englishPatterns = [
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(mon|tue|wed|thu|fri|sat|sun)\b/i,
    /\b(morning|afternoon|evening|night)\b/i,
    /\b(times? a week|per week|weekly)\b/i,
    /\b(daily|every day)\b/i,
    /\b(am|pm)\b/i,
    /\b(gym|exercise|workout|running)\b/i
  ];
  
  return englishPatterns.some(pattern => pattern.test(text));
};

/**
 * Detect the primary language of the input text
 */
export const detectLanguage = (text: string): 'ko' | 'en' | 'mixed' => {
  const hasKorean = containsKorean(text);
  const hasEnglish = containsEnglish(text);
  
  if (hasKorean && hasEnglish) {
    return 'mixed';
  } else if (hasKorean) {
    return 'ko';
  } else if (hasEnglish) {
    return 'en';
  } else {
    // Default to Korean if no clear language detected
    return 'ko';
  }
};

/**
 * Get locale configuration based on detected language
 */
export const getLocaleConfig = (text: string): LocaleConfig => {
  const language = detectLanguage(text);
  
  switch (language) {
    case 'en':
      return ENGLISH_CONFIG;
    case 'mixed':
    case 'ko':
    default:
      return KOREAN_CONFIG;
  }
};

/**
 * Get system prompt with language-specific instructions
 */
export const getLanguageAwareSystemPrompt = (basePrompt: string, config: LocaleConfig): string => {
  const languageInstructions = config.locale === 'ko-KR' ? `
LOCALE NORMALIZATION:
Korean weekdays: 월→mon, 화→tue, 수→wed, 목→thu, 금→fri, 토→sat, 일→sun
Time anchors: 새벽→05:00, 아침→07:00, 점심→12:00, 저녁→18:00, 밤→21:00
Times must be HH:MM format (24h). Parse "6am"→"06:00", "6pm"→"18:00"
` : `
LOCALE NORMALIZATION:
English weekdays: monday→mon, tuesday→tue, wednesday→wed, thursday→thu, friday→fri, saturday→sat, sunday→sun
Time anchors: morning→07:00, afternoon→14:00, evening→19:00, night→21:00
Times must be HH:MM format (24h). Parse "6am"→"06:00", "6pm"→"18:00"
Parse "3 times a week" → frequency with targetPerWeek: 3
`;

  // Replace the LOCALE NORMALIZATION section
  const localeSectionRegex = /LOCALE NORMALIZATION:[\s\S]*?Times must be HH:MM format \(24h\)\. Parse "6am"→"06:00", "6pm"→"18:00"/;
  
  if (localeSectionRegex.test(basePrompt)) {
    return basePrompt.replace(localeSectionRegex, languageInstructions.trim());
  } else {
    // If no LOCALE NORMALIZATION section found, append it
    return basePrompt + '\n\n' + languageInstructions.trim();
  }
};

/**
 * Test function to verify language detection
 */
export const testLanguageDetection = () => {
  const testCases = [
    { input: '월수금 6시 러닝', expected: 'ko' },
    { input: 'Monday Wednesday Friday at 6am running', expected: 'en' },
    { input: '3 times a week exercise', expected: 'en' },
    { input: '일주일에 3번 운동', expected: 'ko' },
    { input: 'Go to gym every morning', expected: 'en' },
    { input: '매일 아침 헬스장 가기', expected: 'ko' },
    { input: 'Monday 헬스장 가기', expected: 'mixed' },
  ];

  console.log('Language Detection Test Results:');
  testCases.forEach(({ input, expected }) => {
    const detected = detectLanguage(input);
    const config = getLocaleConfig(input);
    console.log(`Input: "${input}"`);
    console.log(`Expected: ${expected}, Detected: ${detected}`);
    console.log(`Config: ${config.locale}, ${config.timezone}`);
    console.log('---');
  });
};
