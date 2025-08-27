/**
 * timeWindows 생성 및 검증 유틸리티
 * - 부분 지정 방지 (start만 있고 end가 undefined 등)
 * - 빈 원소 방지
 * - 문자열 트림/형식 검증
 * - 중복 병합 정책
 */

export interface TimeWindow {
  label: string;
  range: [string, string]; // [start, end] in "HH:mm" format
  source: 'user_text' | 'inferred';
}

/**
 * 시간 문자열이 유효한 "HH:mm" 형식인지 검증
 * @param time 시간 문자열
 * @returns 유효성 여부
 */
export function isValidTimeFormat(time: string): boolean {
  if (typeof time !== 'string' || !time.trim()) {
    return false;
  }
  
  const trimmed = time.trim();
  const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  
  if (!timePattern.test(trimmed)) {
    return false;
  }
  
  const [hour, minute] = trimmed.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

/**
 * TimeWindow 객체가 유효한지 검증
 * @param timeWindow 검증할 TimeWindow 객체
 * @returns 유효성 여부
 */
export function isValidTimeWindow(timeWindow: any): timeWindow is TimeWindow {
  if (!timeWindow || typeof timeWindow !== 'object') {
    return false;
  }
  
  // 필수 키 존재 여부 확인
  if (typeof timeWindow.label !== 'string' || 
      !Array.isArray(timeWindow.range) || 
      typeof timeWindow.source !== 'string') {
    return false;
  }
  
  // label이 비어있지 않은지 확인
  if (!timeWindow.label.trim()) {
    return false;
  }
  
  // range가 정확히 2개 요소를 가지는지 확인
  if (timeWindow.range.length !== 2) {
    return false;
  }
  
  // range의 각 요소가 유효한 시간 형식인지 확인
  if (!isValidTimeFormat(timeWindow.range[0]) || !isValidTimeFormat(timeWindow.range[1])) {
    return false;
  }
  
  // source가 유효한 값인지 확인
  if (!['user_text', 'inferred'].includes(timeWindow.source)) {
    return false;
  }
  
  return true;
}

/**
 * 안전한 TimeWindow 생성
 * @param label 시간 라벨
 * @param startTime 시작 시간
 * @param endTime 종료 시간
 * @param source 출처
 * @returns 유효한 TimeWindow 또는 null
 */
export function createSafeTimeWindow(
  label: string,
  startTime: string,
  endTime: string,
  source: 'user_text' | 'inferred'
): TimeWindow | null {
  // 입력값 검증
  if (!label || !startTime || !endTime || !source) {
    console.warn('[TimeWindowUtils] Missing required fields:', { label, startTime, endTime, source });
    return null;
  }
  
  // 시간 형식 검증
  if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
    console.warn('[TimeWindowUtils] Invalid time format:', { startTime, endTime });
    return null;
  }
  
  // 라벨 트림
  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    console.warn('[TimeWindowUtils] Empty label after trim');
    return null;
  }
  
  const timeWindow: TimeWindow = {
    label: trimmedLabel,
    range: [startTime, endTime],
    source
  };
  
  // 최종 검증
  if (!isValidTimeWindow(timeWindow)) {
    console.warn('[TimeWindowUtils] Created timeWindow failed validation:', timeWindow);
    return null;
  }
  
  return timeWindow;
}

/**
 * TimeWindow 배열에서 유효하지 않은 항목 제거 및 정제
 * @param timeWindows 원본 TimeWindow 배열
 * @returns 정제된 TimeWindow 배열
 */
export function sanitizeTimeWindows(timeWindows: any[]): TimeWindow[] {
  if (!Array.isArray(timeWindows)) {
    return [];
  }
  
  const validTimeWindows: TimeWindow[] = [];
  
  for (const tw of timeWindows) {
    if (isValidTimeWindow(tw)) {
      validTimeWindows.push(tw);
    } else {
      console.warn('[TimeWindowUtils] Invalid timeWindow filtered out:', tw);
    }
  }
  
  return validTimeWindows;
}

/**
 * 중복 TimeWindow 병합
 * 정책: 동일한 label과 range를 가진 항목은 하나로 병합
 * @param timeWindows TimeWindow 배열
 * @returns 중복이 제거된 TimeWindow 배열
 */
export function mergeDuplicateTimeWindows(timeWindows: TimeWindow[]): TimeWindow[] {
  const seen = new Map<string, TimeWindow>();
  
  for (const tw of timeWindows) {
    const key = `${tw.label}-${tw.range[0]}-${tw.range[1]}-${tw.source}`;
    
    if (!seen.has(key)) {
      seen.set(key, tw);
    } else {
      // 중복 발견 시 user_text 우선 (더 신뢰할 수 있는 정보)
      const existing = seen.get(key)!;
      if (tw.source === 'user_text' && existing.source === 'inferred') {
        seen.set(key, tw);
      }
    }
  }
  
  return Array.from(seen.values());
}

/**
 * 안전한 TimeWindow 배열 생성
 * @param timeData 시간 데이터 배열
 * @returns 유효한 TimeWindow 배열
 */
export function createSafeTimeWindows(
  timeData: Array<{ label?: string; startTime?: string; endTime?: string; source?: 'user_text' | 'inferred' }>
): TimeWindow[] {
  // 🔧 IMMUTABLE PATTERN: 불변 배열 처리 (push 금지)
  const validTimeWindows = timeData
    .filter(data => {
      // 부분 지정 방지: 모든 필수 필드가 존재해야 함
      if (!data.label || !data.startTime || !data.endTime || !data.source) {
        console.warn('[TimeWindowUtils] Skipping incomplete time data:', data);
        return false;
      }
      return true;
    })
    .map(data => createSafeTimeWindow(data.label!, data.startTime!, data.endTime!, data.source!))
    .filter((timeWindow): timeWindow is TimeWindow => timeWindow !== null);
  
  // 중복 제거 및 정제
  const sanitized = sanitizeTimeWindows(validTimeWindows);
  const merged = mergeDuplicateTimeWindows(sanitized);
  
  return merged;
}

/**
 * 단일 시간을 TimeWindow로 변환 (point time)
 * @param time 시간 문자열 ("HH:mm")
 * @param source 출처
 * @returns TimeWindow 또는 null
 */
export function createPointTimeWindow(time: string, source: 'user_text' | 'inferred'): TimeWindow | null {
  if (!isValidTimeFormat(time)) {
    return null;
  }
  
  return createSafeTimeWindow(time, time, time, source);
}

/**
 * 시간 범위를 TimeWindow로 변환
 * @param startTime 시작 시간
 * @param endTime 종료 시간
 * @param label 라벨 (선택사항)
 * @param source 출처
 * @returns TimeWindow 또는 null
 */
export function createRangeTimeWindow(
  startTime: string,
  endTime: string,
  label?: string,
  source: 'user_text' | 'inferred' = 'inferred'
): TimeWindow | null {
  const finalLabel = label || `${startTime}-${endTime}`;
  return createSafeTimeWindow(finalLabel, startTime, endTime, source);
}
