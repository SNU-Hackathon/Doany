/**
 * Date slicing utilities for 7-day blocks
 * All dates are in Asia/Seoul timezone with local 00:00 boundaries
 */

/**
 * Slice a date range into complete 7-day blocks
 * @param startDate Start date in YYYY-MM-DD format (Asia/Seoul)
 * @param endDate End date in YYYY-MM-DD format (Asia/Seoul)
 * @returns Array of complete week blocks with from/to dates
 */
export function sliceCompleteWeeks(startDate: string, endDate: string): { from: string; to: string }[] {
  // Parse dates and ensure they are in Asia/Seoul timezone
  const start = new Date(`${startDate}T00:00:00+09:00`);
  const end = new Date(`${endDate}T00:00:00+09:00`);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }
  
  if (start > end) {
    throw new Error('Start date must be before or equal to end date');
  }
  
  const blocks: { from: string; to: string }[] = [];
  
  // Start from the startDate (no adjustment to Monday)
  let blockStart = new Date(start);
  
  // Helper function to get local date string in Asia/Seoul
  const getLocalDateString = (date: Date): string => {
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD format
  };
  
  // Generate complete 7-day blocks
  while (true) {
    const blockEnd = new Date(blockStart);
    blockEnd.setDate(blockEnd.getDate() + 6); // 7 days total (start + 6)
    
    // Check if this block fits within the date range
    if (blockStart > end) {
      break; // Block starts after end date
    }
    
    if (blockEnd <= end) {
      // Complete block fits within range
      blocks.push({
        from: getLocalDateString(blockStart),
        to: getLocalDateString(blockEnd)
      });
    } else {
      // Block extends beyond end date, exclude it
      break;
    }
    
    // Move to next week
    blockStart.setDate(blockStart.getDate() + 7);
  }
  
  return blocks;
}

/**
 * Get the number of complete weeks in a date range
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 * @returns Number of complete weeks
 */
export function countCompleteWeeks(startDate: string, endDate: string): number {
  return sliceCompleteWeeks(startDate, endDate).length;
}

/**
 * Check if a date range contains complete weeks
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 * @returns True if the range contains at least one complete week
 */
export function hasCompleteWeeks(startDate: string, endDate: string): boolean {
  return countCompleteWeeks(startDate, endDate) > 0;
}

/**
 * Get the first complete week in a date range
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 * @returns First complete week block or null if none exists
 */
export function getFirstCompleteWeek(startDate: string, endDate: string): { from: string; to: string } | null {
  const blocks = sliceCompleteWeeks(startDate, endDate);
  return blocks.length > 0 ? blocks[0] : null;
}

/**
 * Get the last complete week in a date range
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 * @returns Last complete week block or null if none exists
 */
export function getLastCompleteWeek(startDate: string, endDate: string): { from: string; to: string } | null {
  const blocks = sliceCompleteWeeks(startDate, endDate);
  return blocks.length > 0 ? blocks[blocks.length - 1] : null;
}
