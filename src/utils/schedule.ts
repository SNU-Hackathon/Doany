/**
 * Schedule utility functions for goal creation and validation
 */

/**
 * Convert an object with string keys to an object with number keys
 * Useful for converting weeklySchedule (string keys) to weeklyTimeSettings (number keys)
 */
export function toIndexKeyMap(obj: Record<string, string[]> | Record<number, string[]> | undefined): Record<number, string[]> {
  if (!obj) return {};
  
  const result: Record<number, string[]> = {};
  Object.entries(obj).forEach(([key, times]) => {
    const numKey = parseInt(key, 10);
    if (!isNaN(numKey) && Array.isArray(times)) {
      result[numKey] = times;
    }
  });
  return result;
}

/**
 * Count how many weekdays have scheduled times
 * @param weekdays Array of weekday indices (0=Sun, 1=Mon, etc.)
 * @param timeMap Object mapping weekday indices to time arrays
 * @returns Number of weekdays that have at least one scheduled time
 */
export function countDaysWithTimes(weekdays: number[], timeMap: Record<number, string[]>): number {
  return weekdays.filter(day => {
    const times = timeMap[day] || [];
    return times.length > 0;
  }).length;
}

/**
 * Convert number keys back to string keys for form state compatibility
 * Useful for converting weeklyTimeSettings (number keys) back to weeklySchedule (string keys)
 */
export function toStringKeyMap(obj: Record<number, string[]> | undefined): Record<string, string[]> {
  if (!obj) return {};
  
  const result: Record<string, string[]> = {};
  Object.entries(obj).forEach(([key, times]) => {
    const numKey = parseInt(key, 10);
    if (!isNaN(numKey) && Array.isArray(times)) {
      result[key] = times; // Keep as string key for form compatibility
    }
  });
  return result;
}
