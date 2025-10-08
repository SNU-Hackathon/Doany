// Simple time utilities for verification logic
// Note: dayjs not available, using native Date with Asia/Seoul timezone

export const inTz = (ms: number, timezone: string): Date => {
  // For Asia/Seoul, we'll use native Date with timezone offset
  const date = new Date(ms);
  if (timezone === 'Asia/Seoul') {
    // Korea Standard Time is UTC+9
    const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
    return new Date(utcTime + (9 * 3600000));
  }
  return date;
};

export const isWithin = (ts: number, start: number, end: number): boolean => {
  return ts >= start && ts <= end;
};

export const addMinutes = (timestamp: number, minutes: number): number => {
  return timestamp + (minutes * 60 * 1000);
};

export const formatTimeKST = (timestamp: number): string => {
  const date = inTz(timestamp, 'Asia/Seoul');
  return date.toLocaleString('ko-KR', { 
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};
