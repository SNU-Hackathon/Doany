/**
 * Date utility functions for consistent date formatting
 * 
 * DATE FORMAT POLICY:
 * - All dates must be stored and handled as "YYYY-MM-DD" strings
 * - Firestore Timestamps are converted to "YYYY-MM-DD" 
 * - ISO strings are converted to "YYYY-MM-DD"
 * - Partial formats (yyyy-M-D) are zero-padded to "YYYY-MM-DD"
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Normalize various date formats to "YYYY-MM-DD" string
 * @param input Date, Timestamp, or string in various formats
 * @returns "YYYY-MM-DD" string
 * @throws Error if input format is invalid
 */
export function normalizeDate(input: Date | Timestamp | string): string {
  if (!input) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  try {
    let date: Date;

    if (input instanceof Date) {
      date = input;
    } else if (input instanceof Timestamp) {
      date = input.toDate();
    } else if (typeof input === 'string') {
      // Handle ISO string format (yyyy-MM-ddTHH:mm:ssZ)
      if (input.includes('T')) {
        const datePart = input.split('T')[0];
        if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(datePart)) {
          throw new Error('Invalid ISO date format');
        }
        return padDateString(datePart);
      }
      
      // Handle YYYY-MM-DD or YYYY-M-D format
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(input)) {
        return padDateString(input);
      }
      
      // Try to parse as Date if other string formats
      date = new Date(input);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date string format');
      }
    } else {
      throw new Error('Unsupported date type');
    }

    // Convert Date to YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    throw new Error(`Invalid date format. Use YYYY-MM-DD. Input: ${input}, Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Pad date string to ensure YYYY-MM-DD format
 * @param dateStr Date string in YYYY-M-D or YYYY-MM-DD format
 * @returns "YYYY-MM-DD" string
 */
function padDateString(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }
  
  const [year, month, day] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Format Date object to YYYY-MM-DD string
 * @param date Date object
 * @returns "YYYY-MM-DD" string
 */
export function formatDateToYYYYMMDD(date: Date): string {
  return normalizeDate(date);
}

/**
 * Validate if string is in YYYY-MM-DD format
 * @param dateStr Date string to validate
 * @returns true if valid YYYY-MM-DD format
 */
export function isValidYYYYMMDD(dateStr: string): boolean {
  if (typeof dateStr !== 'string') return false;
  
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  
  // Check if it's a valid date
  const date = new Date(dateStr + 'T00:00:00.000Z');
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateStr;
}

/**
 * Convert Date object to local YYYY-MM-DD string (timezone-safe)
 * @param d Date object
 * @returns YYYY-MM-DD string in local timezone
 */
export const getLocalYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

