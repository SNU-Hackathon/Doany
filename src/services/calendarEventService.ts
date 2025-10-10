/**
 * Calendar Event Service - Thin Layer
 * 
 * Calendar events are part of goal/quest scheduling in API v1.3.
 * This service provides stubs for legacy compatibility.
 */

/**
 * Create calendar events (stub)
 * Note: In API v1.3, events are created as part of goal scheduling
 * 
 * @param goalId Goal ID (first parameter in legacy calls)
 * @param events Event data (array or single)
 * @param userId Optional user ID
 */
export async function createCalendarEvents(
  goalId: string,
  events: any[] | any,
  userId?: string
): Promise<void> {
  console.warn('[CalendarEventService.createCalendarEvents] Part of goal scheduling in v1.3');
  console.warn('[CalendarEventService.createCalendarEvents] Create events with POST /goals during goal creation');
  // Stub - calendar events managed through goal schedule
}

/**
 * Delete calendar events (stub)
 * 
 * @param goalId Goal ID (first parameter in legacy calls)
 * @param eventIds Event IDs to delete (array or single)
 * @param userId Optional user ID
 */
export async function deleteCalendarEvents(
  goalId: string,
  eventIds: string[] | string,
  userId?: string
): Promise<void> {
  console.warn('[CalendarEventService.deleteCalendarEvents] Part of goal scheduling in v1.3');
  console.warn('[CalendarEventService.deleteCalendarEvents] Update via PATCH /goals/{goalId}');
  // Stub - calendar events managed through goal schedule
}

/**
 * Create single calendar event (stub)
 */
export async function createCalendarEvent(eventData: any): Promise<void> {
  console.warn('[CalendarEventService.createCalendarEvent] Part of goal scheduling in v1.3');
}

/**
 * Update calendar event (stub)
 */
export async function updateCalendarEvent(eventId: string, updates: any): Promise<void> {
  console.warn('[CalendarEventService.updateCalendarEvent] Part of goal scheduling in v1.3');
}

/**
 * Delete single calendar event (stub)
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  console.warn('[CalendarEventService.deleteCalendarEvent] Part of goal scheduling in v1.3');
}

/**
 * Get calendar events (stub)
 */
export async function getCalendarEvents(query: any): Promise<any[]> {
  console.warn('[CalendarEventService.getCalendarEvents] Part of goal scheduling in v1.3');
  return [];
}

/**
 * CalendarEventService namespace
 */
export const CalendarEventService = {
  createCalendarEvent,
  createCalendarEvents,
  updateCalendarEvent,
  deleteCalendarEvent,
  deleteCalendarEvents,
  getCalendarEvents,
};

// Default export
export default CalendarEventService;

