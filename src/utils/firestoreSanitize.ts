/**
 * Firestore에 쓰기 전에 payload에서 undefined를 제거하는 유틸리티
 * - 깊은 복사하며 undefined 필드 제거
 * - 배열 내 undefined/null 원소 제거
 * - 빈 문자열/공백은 유지 (데이터 손실 방지)
 * - null은 유지 (필요 시 정책화 주석 참고)
 */

export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Primitive types
  if (typeof obj !== 'object') {
    return obj;
  }

  // Date objects
  if (obj instanceof Date) {
    return obj;
  }

  // Arrays
  if (Array.isArray(obj)) {
    // Remove undefined/null elements and sanitize remaining ones
    const filtered = obj.filter(item => item !== undefined && item !== null);
    return filtered.map(item => sanitizeForFirestore(item)) as T;
  }

  // Objects
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip undefined values
    if (value === undefined) {
      continue;
    }
    
    // Recursively sanitize nested values
    sanitized[key] = sanitizeForFirestore(value);
  }

  return sanitized;
}

/**
 * schedule.timeWindows 특화 정제 함수
 * - timeWindows가 비어있으면 []로 설정
 * - 필수 키가 누락된 원소는 제거
 * - Firestore 스키마 호환성 보장
 */
export function sanitizeScheduleTimeWindows(schedule: any): any {
  if (!schedule || typeof schedule !== 'object') {
    return schedule;
  }

  const sanitized = { ...schedule };

  // Handle timeWindows specifically
  if (sanitized.timeWindows) {
    if (Array.isArray(sanitized.timeWindows)) {
      // Filter out invalid timeWindow objects
      sanitized.timeWindows = sanitized.timeWindows
        .filter((tw: any) => {
          // Must have all required fields
          return tw && 
                 typeof tw === 'object' &&
                 tw.label !== undefined &&
                 tw.range !== undefined &&
                 tw.source !== undefined &&
                 Array.isArray(tw.range) &&
                 tw.range.length === 2 &&
                 tw.range[0] !== undefined &&
                 tw.range[1] !== undefined;
        })
        .map((tw: any) => sanitizeForFirestore(tw));
      
      // If no valid timeWindows remain, set to empty array
      if (sanitized.timeWindows.length === 0) {
        sanitized.timeWindows = [];
      }
    } else {
      // If timeWindows is not an array, remove it
      delete sanitized.timeWindows;
    }
  }

  return sanitized;
}

/**
 * Goal payload 전용 정제 함수
 * - schedule.timeWindows 특화 정제 적용
 * - 전체 payload에 대한 일반 정제 적용
 */
export function sanitizeGoalPayload<T extends { schedule?: any }>(payload: T): T {
  // First sanitize schedule specifically
  if (payload.schedule) {
    payload.schedule = sanitizeScheduleTimeWindows(payload.schedule);
  }
  
  // Then apply general sanitization
  return sanitizeForFirestore(payload);
}
