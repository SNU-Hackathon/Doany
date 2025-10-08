// Parse natural language goal text to extract schedule information

export interface ParsedSchedule {
  weekdays: number[];
  times: string[];
  defaultTime?: string;
}

export function parseGoalText(text: string): ParsedSchedule {
  const result: ParsedSchedule = {
    weekdays: [],
    times: [],
    defaultTime: undefined
  };

  const lowerText = text.toLowerCase();

  // Parse weekdays
  const weekdayPatterns = [
    { pattern: /월요?일?/g, day: 1 },
    { pattern: /화요?일?/g, day: 2 },
    { pattern: /수요?일?/g, day: 3 },
    { pattern: /목요?일?/g, day: 4 },
    { pattern: /금요?일?/g, day: 5 },
    { pattern: /토요?일?/g, day: 6 },
    { pattern: /일요?일?/g, day: 0 },
    { pattern: /monday|mon/g, day: 1 },
    { pattern: /tuesday|tue/g, day: 2 },
    { pattern: /wednesday|wed/g, day: 3 },
    { pattern: /thursday|thu/g, day: 4 },
    { pattern: /friday|fri/g, day: 5 },
    { pattern: /saturday|sat/g, day: 6 },
    { pattern: /sunday|sun/g, day: 0 }
  ];

  weekdayPatterns.forEach(({ pattern, day }) => {
    if (pattern.test(text)) {
      if (!result.weekdays.includes(day)) {
        result.weekdays.push(day);
      }
    }
  });

  // Parse times
  const timePatterns = [
    // 한국어 시간 패턴
    { pattern: /(\d{1,2})시/g, extract: (match: RegExpMatchArray) => `${match[1].padStart(2, '0')}:00` },
    { pattern: /오전\s*(\d{1,2})시?/g, extract: (match: RegExpMatchArray) => `${match[1].padStart(2, '0')}:00` },
    { pattern: /오후\s*(\d{1,2})시?/g, extract: (match: RegExpMatchArray) => {
      const hour = parseInt(match[1]);
      return `${(hour === 12 ? 12 : hour + 12).toString().padStart(2, '0')}:00`;
    }},
    { pattern: /아침\s*(\d{1,2})시?/g, extract: (match: RegExpMatchArray) => `${match[1].padStart(2, '0')}:00` },
    { pattern: /저녁\s*(\d{1,2})시?/g, extract: (match: RegExpMatchArray) => {
      const hour = parseInt(match[1]);
      return `${(hour < 12 ? hour + 12 : hour).toString().padStart(2, '0')}:00`;
    }},
    // 영어 시간 패턴
    { pattern: /(\d{1,2}):(\d{2})/g, extract: (match: RegExpMatchArray) => `${match[1].padStart(2, '0')}:${match[2]}` },
    { pattern: /(\d{1,2})\s*(am|a\.m\.)/g, extract: (match: RegExpMatchArray) => `${match[1].padStart(2, '0')}:00` },
    { pattern: /(\d{1,2})\s*(pm|p\.m\.)/g, extract: (match: RegExpMatchArray) => {
      const hour = parseInt(match[1]);
      return `${(hour === 12 ? 12 : hour + 12).toString().padStart(2, '0')}:00`;
    }}
  ];

  timePatterns.forEach(({ pattern, extract }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const time = extract(match);
      if (!result.times.includes(time)) {
        result.times.push(time);
      }
    }
  });

  // 시간 대명사 처리
  const timeAliases = [
    { pattern: /아침/g, time: '07:00' },
    { pattern: /점심/g, time: '12:00' },
    { pattern: /저녁/g, time: '18:00' },
    { pattern: /밤/g, time: '21:00' },
    { pattern: /새벽/g, time: '05:00' },
    { pattern: /morning/g, time: '07:00' },
    { pattern: /lunch/g, time: '12:00' },
    { pattern: /evening/g, time: '18:00' },
    { pattern: /night/g, time: '21:00' }
  ];

  timeAliases.forEach(({ pattern, time }) => {
    if (pattern.test(lowerText) && result.times.length === 0) {
      result.times.push(time);
    }
  });

  // 기본 시간 설정
  if (result.times.length > 0) {
    result.defaultTime = result.times[0];
  } else if (result.weekdays.length > 0) {
    result.defaultTime = '09:00'; // 기본 시간
  }

  return result;
}

// Generate weekly schedule from parsed data
export function generateWeeklySchedule(parsedSchedule: ParsedSchedule): { [key: string]: string[] } {
  const schedule: { [key: string]: string[] } = {};
  
  if (parsedSchedule.weekdays.length === 0 || !parsedSchedule.defaultTime) {
    return schedule;
  }

  const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  parsedSchedule.weekdays.forEach(day => {
    const dayName = weekdayNames[day];
    schedule[dayName] = [parsedSchedule.defaultTime!];
  });

  return schedule;
}

// Example usage and test
export function testParser() {
  console.log('Testing goal text parser:');
  
  const testCases = [
    '월, 수, 금 아침 7시에 헬스장 가기',
    '매주 화요일 오후 6시 요가',
    '주말 저녁 8시 독서',
    'Monday, Wednesday, Friday at 9:00 AM gym',
    '매일 아침 운동'
  ];

  testCases.forEach(text => {
    const parsed = parseGoalText(text);
    const schedule = generateWeeklySchedule(parsed);
    console.log(`Text: "${text}"`);
    console.log('Parsed:', parsed);
    console.log('Schedule:', schedule);
    console.log('---');
  });
}
