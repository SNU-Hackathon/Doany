/**
 * Calendar Event Service
 * 
 * 경계/정합성 규칙:
 * 1. 기간이 7일 미만이면 검증 스킵 (불완전 주만 존재)
 * 2. 중복 이벤트 카운트 정책: 동일 날짜·시간 다중 등록은 개수만큼 집계 (기본)
 * 3. 타임존: Asia/Seoul 고정, 날짜 문자열은 YYYY-MM-DD
 */

import { collection, doc, getDocs, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { CalendarEvent } from '../types';
import { db } from './firebase';

export class CalendarEventService {
  /**
   * Create calendar events for a goal
   * @param goalId Goal ID
   * @param events Array of calendar events to create
   */
  static async createCalendarEvents(goalId: string, events: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    if (!goalId || !events || events.length === 0) {
      throw new Error('Invalid parameters: goalId and events array are required');
    }

    try {
      const batch = writeBatch(db);
      
      events.forEach(event => {
        const eventRef = doc(collection(db, 'users', goalId, 'calendarEvents'));
        batch.set(eventRef, {
          ...event,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      
      await batch.commit();
      console.log(`[CalendarEventService] Created ${events.length} calendar events for goal ${goalId}`);
    } catch (error) {
      console.error('[CalendarEventService] Error creating calendar events:', error);
      throw new Error(`Failed to create calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get calendar events for a goal within a date range
   * @param goalId Goal ID
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   */
  static async getCalendarEvents(goalId: string, startDate?: string, endDate?: string): Promise<CalendarEvent[]> {
    if (!goalId) {
      throw new Error('goalId is required');
    }

    try {
      let q = query(
        collection(db, 'users', goalId, 'calendarEvents'),
        orderBy('date', 'asc')
      );

      if (startDate) {
        q = query(q, where('date', '>=', startDate));
      }
      if (endDate) {
        q = query(q, where('date', '<=', endDate));
      }

      const querySnapshot = await getDocs(q);
      const events: CalendarEvent[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        events.push({
          id: doc.id,
          date: data.date,
          time: data.time,
          goalId: data.goalId,
          source: data.source,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        });
      });

      console.log(`[CalendarEventService] Retrieved ${events.length} calendar events for goal ${goalId}`);
      return events;
    } catch (error) {
      console.error('[CalendarEventService] Error getting calendar events:', error);
      throw new Error(`Failed to get calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update calendar events for a goal (preserves source field)
   * @param goalId Goal ID
   * @param events Array of calendar events to update
   */
  static async updateCalendarEvents(goalId: string, events: CalendarEvent[]): Promise<void> {
    if (!goalId || !events || events.length === 0) {
      throw new Error('Invalid parameters: goalId and events array are required');
    }

    try {
      const batch = writeBatch(db);
      
      events.forEach(event => {
        if (!event.id) {
          throw new Error('Event ID is required for updates');
        }
        const eventRef = doc(db, 'users', goalId, 'calendarEvents', event.id);
        batch.update(eventRef, {
          date: event.date,
          time: event.time,
          source: event.source, // Preserve source field
          updatedAt: serverTimestamp()
        });
      });
      
      await batch.commit();
      console.log(`[CalendarEventService] Updated ${events.length} calendar events for goal ${goalId}`);
    } catch (error) {
      console.error('[CalendarEventService] Error updating calendar events:', error);
      throw new Error(`Failed to update calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete calendar events for a goal
   * @param goalId Goal ID
   * @param eventIds Array of event IDs to delete
   */
  static async deleteCalendarEvents(goalId: string, eventIds: string[]): Promise<void> {
    if (!goalId || !eventIds || eventIds.length === 0) {
      throw new Error('Invalid parameters: goalId and eventIds array are required');
    }

    try {
      const batch = writeBatch(db);
      
      eventIds.forEach(eventId => {
        if (!eventId) {
          throw new Error('Event ID is required for deletion');
        }
        const eventRef = doc(db, 'users', goalId, 'calendarEvents', eventId);
        batch.delete(eventRef);
      });
      
      await batch.commit();
      console.log(`[CalendarEventService] Deleted ${eventIds.length} calendar events for goal ${goalId}`);
    } catch (error) {
      console.error('[CalendarEventService] Error deleting calendar events:', error);
      throw new Error(`Failed to delete calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert weekly schedule to calendar events
   * @param goalId Goal ID
   * @param weeklyWeekdays Array of weekday indices (0=Sun, 1=Mon, etc.)
   * @param weeklyTimeSettings Object mapping weekday indices to time arrays
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   */
  static convertWeeklyScheduleToEvents(
    goalId: string,
    weeklyWeekdays: number[],
    weeklyTimeSettings: Record<string | number, string[]>,
    startDate: string,
    endDate: string
  ): Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>[] {
    const events: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const weekday = d.getDay();
      const dateStr = d.toISOString().split('T')[0];
      
      if (weeklyWeekdays.includes(weekday)) {
        const times = weeklyTimeSettings[weekday] || weeklyTimeSettings[String(weekday)] || [];
        
        if (times.length > 0) {
          // Create event for each time slot
          times.forEach((time: string) => {
            events.push({
              date: dateStr,
              time: time,
              goalId,
              source: 'weekly'
            });
          });
        } else {
          // Create event without specific time
          events.push({
            date: dateStr,
            goalId,
            source: 'weekly'
          });
        }
      }
    }
    
    return events;
  }

  /**
   * Convert include/exclude dates to calendar events
   * @param goalId Goal ID
   * @param includeDates Array of dates to include (YYYY-MM-DD)
   * @param excludeDates Array of dates to exclude (YYYY-MM-DD)
   */
  static convertIncludeExcludeToEvents(
    goalId: string,
    includeDates: string[],
    excludeDates: string[]
  ): Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>[] {
    const events: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    
    // Add include dates
    includeDates.forEach(date => {
      events.push({
        date,
        goalId,
        source: 'override'
      });
    });
    
    // Add exclude dates (with source 'override' for tracking)
    excludeDates.forEach(date => {
      events.push({
        date,
        goalId,
        source: 'override'
      });
    });
    
    return events;
  }

  /**
   * Synchronize weekly schedule with calendar events
   * This function updates calendar events when weekly schedule changes
   * Preserves existing override events (merge policy)
   * @param goalId Goal ID
   * @param weeklyWeekdays Array of weekday indices (0=Sun, 1=Mon, etc.)
   * @param weeklyTimeSettings Object mapping weekday indices to time arrays
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   */
  static async syncWeeklyScheduleToCalendar(
    goalId: string,
    weeklyWeekdays: number[],
    weeklyTimeSettings: Record<string | number, string[]>,
    startDate: string,
    endDate: string
  ): Promise<void> {
    try {
      // Get existing calendar events in the date range
      const existingEvents = await CalendarEventService.getCalendarEvents(goalId, startDate, endDate);
      
      // Separate weekly and override events
      const existingWeekly = existingEvents.filter(e => e.source === 'weekly');
      const existingOverride = existingEvents.filter(e => e.source === 'override');
      
      // Generate new weekly events from the pattern
      const newWeeklyEvents = CalendarEventService.convertWeeklyScheduleToEvents(
        goalId,
        weeklyWeekdays,
        weeklyTimeSettings,
        startDate,
        endDate
      );
      
      // Prepare batch operations
      const batch = writeBatch(db);
      
      // Delete existing weekly events (they will be replaced)
      existingWeekly.forEach(event => {
        const eventRef = doc(collection(db, 'users', goalId, 'calendarEvents'), event.id);
        batch.delete(eventRef);
      });
      
      // Create new weekly events
      newWeeklyEvents.forEach(event => {
        const eventRef = doc(collection(db, 'users', goalId, 'calendarEvents'));
        batch.set(eventRef, {
          ...event,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      
      // Commit the batch
      await batch.commit();
      
      console.log(`[CalendarEventService] Synced weekly schedule: ${existingWeekly.length} old weekly events replaced with ${newWeeklyEvents.length} new weekly events, ${existingOverride.length} override events preserved`);
    } catch (error) {
      console.error('[CalendarEventService] Error syncing weekly schedule:', error);
      throw new Error(`Failed to sync weekly schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get calendar events grouped by source
   * @param goalId Goal ID
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   */
  static async getCalendarEventsBySource(
    goalId: string, 
    startDate?: string, 
    endDate?: string
  ): Promise<{ weekly: CalendarEvent[], override: CalendarEvent[] }> {
    const events = await CalendarEventService.getCalendarEvents(goalId, startDate, endDate);
    
    return {
      weekly: events.filter(e => e.source === 'weekly'),
      override: events.filter(e => e.source === 'override')
    };
  }
}
