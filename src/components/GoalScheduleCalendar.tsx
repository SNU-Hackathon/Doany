/**
 * GoalScheduleCalendar Component
 * 
 * 경계/정합성 규칙:
 * 1. 기간이 7일 미만이면 검증 스킵 (불완전 주만 존재)
 * 2. 중복 이벤트 카운트 정책: 동일 날짜·시간 다중 등록은 개수만큼 집계 (기본)
 * 3. 타임존: Asia/Seoul 고정, 날짜 문자열은 YYYY-MM-DD
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CalendarEvent, Verification } from '../types';

type WeeklyTimeSettings = { [key: string]: string[] } | { [key: number]: string[] };

interface GoalScheduleCalendarProps {
  startDateISO?: string | null;
  endDateISO?: string | null;
  weeklyWeekdays?: number[];
  weeklyTimeSettings?: WeeklyTimeSettings;
  showScheduledWeekdays?: boolean;
  includeDates?: string[];
  excludeDates?: string[];
  verifications?: Verification[];
  enforcePartialWeeks?: boolean;
  // New prop for calendar events
  calendarEvents?: CalendarEvent[];
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * 스케줄 카운트 계산 함수
 * 
 * 경계/정합성 규칙:
 * 1. 기간이 7일 미만이면 검증 스킵 (불완전 주만 존재)
 * 2. 중복 이벤트 카운트 정책: 동일 날짜·시간 다중 등록은 개수만큼 집계 (기본)
 * 3. 타임존: Asia/Seoul 고정, 날짜 문자열은 YYYY-MM-DD
 * 
 * @param startISO 시작일 (ISO 문자열, Asia/Seoul 기준)
 * @param endISO 종료일 (ISO 문자열, Asia/Seoul 기준)
 * @param weeklyDays 주간 요일 배열 (0=일요일, 6=토요일)
 * @param weeklyTimes 주간 시간 설정 (요일별 시간 배열)
 * @param include 포함할 특정 날짜들 (YYYY-MM-DD)
 * @param exclude 제외할 특정 날짜들 (YYYY-MM-DD)
 * @param enforcePartialWeeks 불완전 주 강제 적용 여부 (현재 미사용)
 * @param calendarEvents 캘린더 이벤트 배열
 * @returns { required: number, perDateRequired: Map<string, number> }
 */
export function computeScheduleCounts(
  startISO?: string | null,
  endISO?: string | null,
  weeklyDays: number[] = [],
  weeklyTimes: WeeklyTimeSettings = {},
  include: string[] = [],
  exclude: string[] = [],
  enforcePartialWeeks: boolean = false,
  calendarEvents: CalendarEvent[] = []
) {
  // 경계 규칙 1: 기간이 7일 미만이면 검증 스킵
  if (!startISO || !endISO) {
    console.log('[computeScheduleCounts] 경계 규칙: 시작일 또는 종료일이 없음');
    return { required: 0, perDateRequired: new Map<string, number>() };
  }
  
  const start = new Date(startISO);
  const end = new Date(endISO);
  
  // Asia/Seoul 타임존 기준으로 날짜 차이 계산
  const timeDiff = end.getTime() - start.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
  
  // 경계 규칙 1: 7일 미만이면 불완전 주만 존재하므로 검증 스킵
  if (daysDiff < 7) {
    console.log(`[computeScheduleCounts] 경계 규칙: 기간이 7일 미만 (${daysDiff}일) - 검증 스킵`);
    return { required: 0, perDateRequired: new Map<string, number>() };
  }
  
  console.log(`[computeScheduleCounts] 경계 규칙: 기간 ${daysDiff}일 - 완전 주 검증 진행`);
  
  const perDateRequired = new Map<string, number>();

  const normalizeTimes = (weekday: number): string[] => {
    const key = String(weekday);
    // @ts-ignore - support string/number index
    return (weeklyTimes[weekday] || weeklyTimes[key] || []) as string[];
  };

  // Process calendar events to extract include/exclude dates
  // 중복 이벤트 카운트 정책: 동일 날짜·시간 다중 등록은 개수만큼 집계
  const eventIncludeDates = calendarEvents
    .filter(e => e.source === 'override' && !exclude.includes(e.date))
    .map(e => e.date);
  const eventExcludeDates = calendarEvents
    .filter(e => e.source === 'override' && exclude.includes(e.date))
    .map(e => e.date);
  
  // Merge with existing include/exclude dates
  const mergedInclude = [...new Set([...include, ...eventIncludeDates])];
  const mergedExclude = [...new Set([...exclude, ...eventExcludeDates])];

  // Partition the date range into complete weeks (7-day units)
  // 타임존: Asia/Seoul 고정, 날짜 문자열은 YYYY-MM-DD
  const completeWeeks: { start: Date; end: Date; dates: string[]; totalSessions: number }[] = [];
  let currentWeekStart = new Date(start);
  
  while (currentWeekStart <= end) {
    // Calculate the end of the current week (6 days later)
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    
    // Check if this week is complete (all 7 days within the goal period)
    const weekStart = new Date(currentWeekStart);
    const weekEnd = new Date(currentWeekEnd);
    
    // Adjust week boundaries to stay within the goal period
    if (weekStart < start) weekStart.setTime(start.getTime());
    if (weekEnd > end) weekEnd.setTime(end.getTime());
    
    // Calculate the number of days in this week
    const daysInWeek = Math.floor((weekEnd.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    // Only include complete weeks (7 days) in validation
    if (daysInWeek === 7) {
      const weekDates: string[] = [];
      let weekTotalSessions = 0;
      
      // Process each day in this complete week
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const ds = toDateStr(d);
        const weekday = d.getDay();
        const baseIncluded = weeklyDays.includes(weekday);
        const isScheduled = (baseIncluded && !mergedExclude.includes(ds)) || mergedInclude.includes(ds);
        
        if (isScheduled) {
          const times = normalizeTimes(weekday);
          const count = times && times.length > 0 ? times.length : 1;
          perDateRequired.set(ds, count);
          weekDates.push(ds);
          weekTotalSessions += count;
        }
      }
      
      completeWeeks.push({
        start: new Date(weekStart),
        end: new Date(weekEnd),
        dates: weekDates,
        totalSessions: weekTotalSessions
      });
    }
    
    // Move to next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }
  
  const required = completeWeeks.reduce((sum, week) => sum + week.totalSessions, 0);
  
  console.log(`[computeScheduleCounts] 완전 주 ${completeWeeks.length}개, 총 필요 세션: ${required}`);
  
  return { required, perDateRequired };
}

// Long press modal component for date editing
function DateEditModal({ 
  visible, 
  onClose, 
  selectedDate, 
  calendarEvents, 
  onCalendarEventsChange,
  goalId
}: {
  visible: boolean;
  onClose: () => void;
  selectedDate: string | null;
  calendarEvents: CalendarEvent[];
  onCalendarEventsChange: (events: CalendarEvent[]) => void;
  goalId?: string;
}) {
  const [editingTime, setEditingTime] = useState('');
  const [editingTimeIndex, setEditingTimeIndex] = useState(-1);
  const [showTimeInput, setShowTimeInput] = useState(false);
  
  // Get events for the selected date
  const dateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return calendarEvents.filter(e => e.date === selectedDate);
  }, [selectedDate, calendarEvents]);
  
  // Get override events (user-edited times)
  const overrideEvents = useMemo(() => {
    return dateEvents.filter(e => e.source === 'override');
  }, [dateEvents]);
  
  // Get weekly events (pattern-based times)
  const weeklyEvents = useMemo(() => {
    return dateEvents.filter(e => e.source === 'weekly');
  }, [dateEvents]);
  
  const handleAddTime = () => {
    if (!editingTime.trim()) return;
    
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(editingTime)) {
      Alert.alert('Invalid Time', 'Please use HH:MM format (e.g., 09:00)');
      return;
    }
    
    // Create new override event
    const newEvent: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'> = {
      date: selectedDate!,
      time: editingTime,
      goalId: goalId || 'temp-goal-id', // Use actual goalId if available
      source: 'override'
    };
    
    // Add to calendar events
    const updatedEvents = [...calendarEvents, newEvent as CalendarEvent];
    onCalendarEventsChange(updatedEvents);
    
    setEditingTime('');
    setShowTimeInput(false);
  };
  
  const handleEditTime = (timeIndex: number) => {
    const event = overrideEvents[timeIndex];
    if (!event) return;
    
    setEditingTime(event.time || '');
    setEditingTimeIndex(timeIndex);
    setShowTimeInput(true);
  };
  
  const handleUpdateTime = () => {
    if (!editingTime.trim() || editingTimeIndex === -1) return;
    
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(editingTime)) {
      Alert.alert('Invalid Time', 'Please use HH:MM format (e.g., 09:00)');
      return;
    }
    
    // Update existing override event
    const eventToUpdate = overrideEvents[editingTimeIndex];
    if (!eventToUpdate) return;
    
    const updatedEvents = calendarEvents.map(e => 
      e.id === eventToUpdate.id 
        ? { ...e, time: editingTime }
        : e
    );
    
    onCalendarEventsChange(updatedEvents);
    
    setEditingTime('');
    setEditingTimeIndex(-1);
    setShowTimeInput(false);
  };
  
  const handleDeleteTime = (timeIndex: number) => {
    const eventToDelete = overrideEvents[timeIndex];
    if (!eventToDelete) return;
    
    Alert.alert(
      'Delete Time',
      `Are you sure you want to delete ${eventToDelete.time}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedEvents = calendarEvents.filter(e => e.id !== eventToDelete.id);
            onCalendarEventsChange(updatedEvents);
          }
        }
      ]
    );
  };
  
  const handleDeleteAllOverrideTimes = () => {
    if (overrideEvents.length === 0) return;
    
    Alert.alert(
      'Delete All Override Times',
      `Are you sure you want to delete all ${overrideEvents.length} override times for ${selectedDate}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            const updatedEvents = calendarEvents.filter(e => !(e.date === selectedDate && e.source === 'override'));
            onCalendarEventsChange(updatedEvents);
          }
        }
      ]
    );
  };
  
  if (!selectedDate) return null;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
        <View className="bg-white rounded-lg p-6 m-4 w-80 max-h-96">
          <Text className="text-lg font-bold text-gray-800 mb-4">
            Edit Schedule for {selectedDate}
          </Text>
          
          {/* Weekly pattern times (read-only) */}
          {weeklyEvents.length > 0 && (
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-600 mb-2">
                Weekly Pattern Times (read-only)
              </Text>
              {weeklyEvents.map((event, index) => (
                <View key={`weekly-${index}`} className="flex-row items-center justify-between bg-gray-50 p-2 rounded mb-1">
                  <Text className="text-gray-700">{event.time || 'No time'}</Text>
                  <Text className="text-xs text-gray-500">Weekly</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Override times (editable) */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-600 mb-2">
              Override Times ({overrideEvents.length})
            </Text>
            {overrideEvents.map((event, index) => (
              <View key={`override-${index}`} className="flex-row items-center justify-between bg-blue-50 p-2 rounded mb-1">
                <Text className="text-blue-700">{event.time || 'No time'}</Text>
                <View className="flex-row">
                  <TouchableOpacity
                    onPress={() => handleEditTime(index)}
                    className="px-2 py-1 bg-blue-200 rounded mr-1"
                  >
                    <Text className="text-xs text-blue-800">Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteTime(index)}
                    className="px-2 py-1 bg-red-200 rounded"
                  >
                    <Text className="text-xs text-red-800">Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            
            {overrideEvents.length > 0 && (
              <TouchableOpacity
                onPress={handleDeleteAllOverrideTimes}
                className="mt-2 p-2 bg-red-100 rounded"
              >
                <Text className="text-center text-sm text-red-600">Delete All Override Times</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Add new time */}
          {showTimeInput ? (
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-600 mb-2">
                {editingTimeIndex === -1 ? 'Add New Time' : 'Edit Time'}
              </Text>
              <TextInput
                value={editingTime}
                onChangeText={setEditingTime}
                placeholder="HH:MM (e.g., 09:00)"
                className="border border-gray-300 rounded p-2 mb-2"
                autoFocus
              />
              <View className="flex-row">
                <TouchableOpacity
                  onPress={() => {
                    if (editingTimeIndex === -1) {
                      handleAddTime();
                    } else {
                      handleUpdateTime();
                    }
                  }}
                  className="flex-1 bg-blue-500 p-2 rounded mr-2"
                >
                  <Text className="text-center text-white font-semibold">
                    {editingTimeIndex === -1 ? 'Add' : 'Update'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setEditingTime('');
                    setEditingTimeIndex(-1);
                    setShowTimeInput(false);
                  }}
                  className="flex-1 bg-gray-500 p-2 rounded"
                >
                  <Text className="text-center text-white font-semibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowTimeInput(true)}
              className="bg-green-500 p-3 rounded mb-4"
            >
              <Text className="text-center text-white font-semibold">Add New Time</Text>
            </TouchableOpacity>
          )}
          
          {/* Close button */}
          <TouchableOpacity
            onPress={onClose}
            className="bg-gray-500 p-3 rounded"
          >
            <Text className="text-center text-white font-semibold">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Helper function to get week key for grouping
function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${week}`;
}

// Helper function to get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

export default memo(function GoalScheduleCalendar({
  startDateISO,
  endDateISO,
  weeklyWeekdays = [],
  weeklyTimeSettings = {},
  showScheduledWeekdays = true,
  includeDates = [],
  excludeDates = [],
  verifications = [],
  enforcePartialWeeks = false,
  calendarEvents = [],
  goalId
}: GoalScheduleCalendarProps & { goalId?: string }) {
  const getLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const today = getLocalYMD(new Date());

  // Long press modal state
  const [longPressModalVisible, setLongPressModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [localCalendarEvents, setLocalCalendarEvents] = useState<CalendarEvent[]>(calendarEvents);

  // Update local calendar events when prop changes
  useEffect(() => {
    console.log('[GoalScheduleCalendar] calendarEvents prop changed:', {
      count: calendarEvents?.length || 0,
      events: calendarEvents?.slice(0, 3) || [], // Show first 3 events
      hasTime: calendarEvents?.some(e => e.time) || false
    });
    setLocalCalendarEvents(calendarEvents);
  }, [calendarEvents]);

  // Handle calendar events change
  const handleCalendarEventsChange = useCallback((updatedEvents: CalendarEvent[]) => {
    setLocalCalendarEvents(updatedEvents);
    // Here you could also call a callback to sync with parent component
    console.log('[GoalScheduleCalendar] Calendar events updated:', updatedEvents.length);
  }, []);

  // Long press handler
  const handleDateLongPress = useCallback((dateStr: string) => {
    console.log('[GoalScheduleCalendar] Long press detected for date:', dateStr);
    setSelectedDate(dateStr);
    setLongPressModalVisible(true);
    console.log('[GoalScheduleCalendar] Modal state updated:', { selectedDate: dateStr, visible: true });
  }, []);

  // Single tap handler (existing behavior)
  const handleDatePress = useCallback((dateStr: string) => {
    // Existing single tap behavior - could be used for quick actions
    console.log('[GoalScheduleCalendar] Date tapped:', dateStr);
    // Example: Quick add time, mark as completed, etc.
  }, []);

  const { perDateRequired, required } = useMemo(() =>
    computeScheduleCounts(startDateISO, endDateISO, [], {}, includeDates, excludeDates, enforcePartialWeeks, calendarEvents),
    [startDateISO, endDateISO, includeDates, excludeDates, enforcePartialWeeks, calendarEvents]
  );

  const successFailByDate = useMemo(() => {
    const map = new Map<string, { success: number; fail: number }>();
    verifications.forEach(v => {
      const ds = toDateStr(v.timestamp);
      if (!map.has(ds)) map.set(ds, { success: 0, fail: 0 });
      const curr = map.get(ds)!;
      if (v.status === 'success') curr.success += 1; else curr.fail += 1;
    });
    return map;
  }, [verifications]);

  const successCount = useMemo(() => {
    let sum = 0;
    successFailByDate.forEach((counts, ds) => {
      const needed = perDateRequired.get(ds) || 0;
      if (needed <= 0) return;
      // cap successes by required for that day
      sum += Math.min(counts.success, needed);
    });
    return sum;
  }, [successFailByDate, perDateRequired]);

  const monthsInView = useMemo(() => {
    const list: Date[] = [];
    if (startDateISO && endDateISO) {
      const start = new Date(startDateISO);
      const end = new Date(endDateISO);
      const cur = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
      while (cur <= endMonth) {
        list.push(new Date(cur));
        cur.setMonth(cur.getMonth() + 1);
      }
    } else {
      const anchor = new Date();
      const start = new Date(anchor);
      start.setMonth(anchor.getMonth() - 2);
      for (let i = 0; i < 6; i++) {
        const m = new Date(start);
        m.setMonth(start.getMonth() + i);
        list.push(m);
      }
    }
    return list;
  }, [startDateISO, endDateISO]);

  const generateDaysForMonth = (m: Date) => {
    const y = m.getFullYear();
    const mm = m.getMonth();
    const firstDay = new Date(y, mm, 1);
    const lastDay = new Date(y, mm + 1, 0);
    const startingDay = firstDay.getDay();
    const days: any[] = [];
    for (let i = 0; i < startingDay; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const ds = getLocalYMD(new Date(y, mm, d));
      const inRange = !!(startDateISO && endDateISO && ds >= startDateISO && ds <= endDateISO);
      const requiredForDay = inRange ? (perDateRequired.get(ds) || 0) : 0;
      const vf = successFailByDate.get(ds);
      const isToday = ds === today;
      
      // Get time information for this date from calendar events
      const dayEvents = localCalendarEvents?.filter(e => e.date === ds) || [];
      const dayTimes = dayEvents
        .filter(e => e.time)
        .map(e => e.time)
        .sort()
        .filter((time, index, array) => array.indexOf(time) === index); // Remove duplicates
      
      // Debug logging for time display
      if (dayEvents.length > 0) {
        console.log(`[GoalScheduleCalendar] Date ${ds} has ${dayEvents.length} events:`, {
          events: dayEvents.map(e => ({ time: e.time, source: e.source })),
          times: dayTimes,
          overrideCount: dayEvents.filter(e => e.source === 'override').length
        });
      }
      
      // Additional debug for empty times
      if (dayEvents.length > 0 && dayTimes.length === 0) {
        console.warn(`[GoalScheduleCalendar] Date ${ds} has events but no times:`, {
          events: dayEvents,
          eventsWithTime: dayEvents.filter(e => e.time),
          eventsWithoutTime: dayEvents.filter(e => !e.time)
        });
      }
      
      days.push({
        day: d,
        dateStr: ds,
        inRange,
        requiredForDay,
        success: vf?.success || 0,
        fail: vf?.fail || 0,
        isToday,
        times: dayTimes, // Add times array
        overrideTimes: dayEvents.filter(e => e.source === 'override').map(e => e.time), // Add overrideTimes array
        overrideCount: dayEvents.filter(e => e.source === 'override').length, // Add overrideCount
        dayEvents: dayEvents // Add full dayEvents array for debugging
      });
    }
    return days;
  };

  // Achievement rate
  const achievementPct = required > 0 ? Math.round((successCount / required) * 100) : 0;

  // Fixed header month tracking and measurements (match Schedule's UI)
  const calendarScrollRef = useRef<ScrollView | null>(null);
  const monthsLayoutRef = useRef<{ y: number; h: number }[]>([]);
  const VIEWPORT_HEIGHT = 420;
  const [headerMonth, setHeaderMonth] = useState<Date | null>(null);

  useEffect(() => {
    monthsLayoutRef.current = [];
    if (monthsInView.length > 0) setHeaderMonth(monthsInView[0]);
  }, [monthsInView]);

  const onMonthLayout = (index: number, y: number, h: number) => {
    const arr = monthsLayoutRef.current.slice();
    arr[index] = { y, h };
    monthsLayoutRef.current = arr;
  };

  const updateHeaderForScroll = (scrollY: number) => {
    const layouts = monthsLayoutRef.current;
    if (!layouts || layouts.length === 0) return;
    const viewStart = scrollY;
    const viewEnd = scrollY + VIEWPORT_HEIGHT;
    let bestIdx = 0;
    let bestOverlap = -1;
    layouts.forEach((ly, idx) => {
      if (!ly) return;
      const lyStart = ly.y;
      const lyEnd = ly.y + ly.h;
      const overlap = Math.max(0, Math.min(viewEnd, lyEnd) - Math.max(viewStart, lyStart));
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestIdx = idx;
      }
    });
    const m = monthsInView[bestIdx];
    if (m && (!headerMonth || headerMonth.getMonth() !== m.getMonth() || headerMonth.getFullYear() !== m.getFullYear())) {
      setHeaderMonth(m);
    }
  };

  return (
    <View className="bg-white rounded-lg p-4 border border-gray-200">
      <View className="mb-3">
        <Text className="text-lg font-bold text-gray-800">Schedule</Text>
        <Text className="text-gray-600 text-sm">Achievement: {successCount}/{required} ({achievementPct}%)</Text>
      </View>

      {/* Calendar with fixed header month and vertical smooth scroll */}
      <View className="mb-2" style={{ height: VIEWPORT_HEIGHT }}>
        {/* Fixed month/year header and single day-of-week row */}
        <View className="mb-2">
          <Text className="text-center text-lg font-bold text-gray-800">
            {(headerMonth || monthsInView[0] || new Date()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <View className="flex-row mt-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => (
              <View key={day} className="flex-1">
                <Text className="text-center text-sm font-semibold text-gray-600">{day}</Text>
              </View>
            ))}
          </View>
        </View>

        <ScrollView
          ref={calendarScrollRef}
          onScroll={(e: any) => updateHeaderForScroll(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        >
          {monthsInView.map((m, idx) => {
            const monthKey = `${m.getFullYear()}-${m.getMonth()}`;
            const days = generateDaysForMonth(m);
            return (
              <View
                key={monthKey}
                onLayout={(e: any) => onMonthLayout(idx, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
              >
                <View className="flex-row flex-wrap">
                  {days.map((d: any, index: number) => (
                    <TouchableOpacity
                      key={index}
                      className="w-[14.28%] p-1"
                      style={{ aspectRatio: 1 }}
                      onPress={() => d && handleDatePress(d.dateStr)}
                      onLongPress={() => {
                        console.log('[GoalScheduleCalendar] TouchableOpacity onLongPress triggered for date:', d?.dateStr);
                        d && handleDateLongPress(d.dateStr);
                      }}
                      delayLongPress={500}
                      activeOpacity={0.7}
                      pressRetentionOffset={{ top: 20, left: 20, bottom: 20, right: 20 }}
                    >
                      {d ? (
                        <View className={`flex-1 rounded items-center justify-center relative ${
                          !d.inRange ? 'bg-gray-50' : d.requiredForDay > 0 ? 'bg-green-50' : 'bg-white'
                        }`}>
                          <Text className={`text-sm font-semibold ${!d.inRange ? 'text-gray-400' : (d.isToday ? 'text-blue-800' : 'text-gray-800')}`}>{d.day}</Text>
                          
                                                    {/* Time list rendering with improved visibility and debugging */}
                          {d.times && d.times.length > 0 ? (
                            <View className="mt-1 px-1">
                              {/* Show first 2 times with clear formatting */}
                              {d.times.slice(0, 2).map((time: string, timeIndex: number) => {
                                // Check if this time is from an override event
                                const isOverride = d.overrideTimes && d.overrideTimes.includes(time);
                                return (
                                  <View key={timeIndex} className="flex-row items-center justify-center mb-0.5">
                                    <Text className={`text-xs font-medium text-center leading-3 ${
                                      isOverride ? 'text-blue-700' : 'text-gray-700'
                                    }`}>
                                      {time}
                                    </Text>
                                    {isOverride && (
                                      <View className="ml-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                    )}
                                  </View>
                                );
                              })}
                              
                              {/* Show remaining count with override indicator */}
                              {d.times.length > 2 && (
                                <View className="flex-row items-center justify-center">
                                  <Text className="text-xs text-gray-500 text-center leading-3 font-medium">
                                    +{d.times.length - 2}
                                  </Text>
                                  {d.overrideCount > 0 && (
                                    <View className="ml-1 px-1 py-0.5 bg-blue-100 rounded-full border border-blue-200">
                                      <Text className="text-xs text-blue-600 font-medium">
                                        {d.overrideCount}o
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          ) : d.dayEvents && d.dayEvents.length > 0 ? (
                            // Debug: Show event count when no times
                            <View className="mt-1 px-1">
                              <Text className="text-xs text-red-500 text-center leading-3">
                                {d.dayEvents.length}e
                              </Text>
                            </View>
                          ) : null}
                          
                          {d.requiredForDay > 0 && (
                            <View className="absolute -bottom-1 left-1 right-1 flex-row justify-center items-center">
                              {d.success > 0 ? (
                                <View className="w-2 h-2 bg-green-600 rounded-full mr-1" />
                              ) : null}
                              {d.fail > 0 && d.success === 0 ? (
                                <View className="w-2 h-2 bg-red-500 rounded-full" />
                              ) : null}
                              {d.success === 0 && d.fail === 0 ? (
                                <View className="w-2 h-2 bg-green-300 rounded-full" />
                              ) : null}
                            </View>
                          )}
                          {d.isToday && (
                            <View pointerEvents="none" className="absolute inset-0 rounded border-2 border-blue-600" />
                          )}
                        </View>
                      ) : (
                        <View className="flex-1" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
      
      {/* Long press modal for date editing */}
      <DateEditModal
        visible={longPressModalVisible}
        onClose={() => {
          setLongPressModalVisible(false);
          setSelectedDate(null);
        }}
        selectedDate={selectedDate}
        calendarEvents={localCalendarEvents}
        onCalendarEventsChange={handleCalendarEventsChange}
        goalId={goalId}
      />
    </View>
  );
});


