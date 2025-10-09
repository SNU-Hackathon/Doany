/**
 * Calendar Event Service
 * 
 * 경계/정합성 규칙:
 * 1. 기간이 7일 미만이면 검증 스킵 (불완전 주만 존재)
 * 2. 중복 이벤트 카운트 정책: 동일 날짜·시간 다중 등록은 개수만큼 집계 (기본)
 * 3. 타임존: Asia/Seoul 고정, 날짜 문자열은 YYYY-MM-DD
 */

import { collection, doc, getDocs, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { CalendarEvent } from '../types';
import { auth, db } from './firebase';

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

    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');

    try {
      const batch = writeBatch(db);
      
      events.forEach(event => {
        const eventRef = doc(collection(db, 'users', uid, 'calendarEvents'));
        batch.set(eventRef, {
          ...event,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      
      await batch.commit();
      console.log(`[CalendarEventService] Created ${events.length} calendar events for user ${uid}`);
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

    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');

    try {
      let q = query(
        collection(db, 'users', uid, 'calendarEvents'),
        where('goalId', '==', goalId),
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
          source: data.source as 'single' | 'pattern',
          groupId: data.groupId,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        });
      });

      console.log(`[CalendarEventService] Retrieved ${events.length} calendar events for user ${uid}`);
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

    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');

    try {
      const batch = writeBatch(db);
      
      events.forEach(event => {
        if (!event.id) {
          throw new Error('Event ID is required for updates');
        }
        const eventRef = doc(db, 'users', uid, 'calendarEvents', event.id);
        batch.update(eventRef, {
          date: event.date,
          time: event.time,
          source: event.source, // Preserve source field
          groupId: event.groupId, // Preserve groupId field
          updatedAt: serverTimestamp()
        });
      });
      
      await batch.commit();
      console.log(`[CalendarEventService] Updated ${events.length} calendar events for user ${uid}`);
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

    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');

    try {
      const batch = writeBatch(db);
      
      eventIds.forEach(eventId => {
        if (!eventId) {
          throw new Error('Event ID is required for deletion');
        }
        const eventRef = doc(db, 'users', uid, 'calendarEvents', eventId);
        batch.delete(eventRef);
      });
      
      await batch.commit();
      console.log(`[CalendarEventService] Deleted ${eventIds.length} calendar events for user ${uid}`);
    } catch (error) {
      console.error('[CalendarEventService] Error deleting calendar events:', error);
      throw new Error(`Failed to delete calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create pattern events for a goal (replaces weekly schedule)
   * @param goalId Goal ID
   * @param options Pattern creation options
   */
  static async createPatternEvents(goalId: string, options: {
    startDate: string; 
    endDate: string;
    weekdays: number[];  // 0~6
    time: string;        // 'HH:mm'
  }): Promise<string> {
    const groupId = uuidv4();
    const { startDate, endDate, weekdays, time } = options;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const ymd = (d: Date) => d.toISOString().slice(0,10);

    const events: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (weekdays.includes(d.getDay())) {
        events.push({
          goalId,
          date: ymd(d),
          time,
          source: 'pattern',
          groupId,
        });
      }
    }
    if (events.length) await this.createCalendarEvents(goalId, events);
    return groupId;
  }

  /**
   * Delete pattern group events
   * @param goalId Goal ID
   * @param groupId Pattern group ID
   */
  static async deletePatternGroup(goalId: string, groupId: string): Promise<void> {
    const all = await this.getCalendarEvents(goalId);
    const ids = all.filter(e => e.groupId === groupId).map(e => e.id).filter(Boolean) as string[];
    if (ids.length) await this.deleteCalendarEvents(goalId, ids);
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
  ): Promise<{ single: CalendarEvent[], pattern: CalendarEvent[] }> {
    const events = await CalendarEventService.getCalendarEvents(goalId, startDate, endDate);
    
    return {
      single: events.filter(e => e.source === 'single'),
      pattern: events.filter(e => e.source === 'pattern')
    };
  }
}
