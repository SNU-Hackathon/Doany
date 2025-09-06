/**
 * Simple Date Picker Component - Schedule Step with Calendar
 * 
 * 경계/정합성 규칙:
 * 1. 기간이 7일 미만이면 검증 스킵 (불완전 주만 존재)
 * 2. 중복 이벤트 카운트 정책: 동일 날짜·시간 다중 등록은 개수만큼 집계 (기본)
 * 3. 타임존: Asia/Seoul 고정, 날짜 문자열은 YYYY-MM-DD
 */

import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { convertDurationToRange } from '../features/goals/aiDraft';
import { CalendarEventService } from '../services/calendarEventService';
import { CalendarEvent, GoalSpec, TargetLocation, VerificationType } from '../types';
import MapPreview from './MapPreview';

// Localized logger helpers
const log = (...args: any[]) => console.log('[SimpleDatePicker]', ...args);
const warn = (...args: any[]) => console.warn('[SimpleDatePicker]', ...args);
const err = (...args: any[]) => console.error('[SimpleDatePicker]', ...args);

export interface DateSelection {
  mode: 'duration';
  startDate: string;
  endDate: string;
  durationType: 'days' | 'weeks' | 'months';
  durationValue: number;
}

interface SimpleDatePickerProps {
  startDate: string | null;
  endDate: string | null;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onNavigateToStep: (stepIndex: number) => void;
  onWeeklyScheduleChange?: (weekdays: Set<number>, timeSettings: { [key: string]: string[] }) => void;
  verificationMethods?: VerificationType[];
  onVerificationMethodsChange?: (methods: VerificationType[]) => void;
  lockedVerificationMethods?: VerificationType[];
  includeDates?: string[];
  excludeDates?: string[];
  onIncludeExcludeChange?: (includeDates: string[], excludeDates: string[]) => void;
  goalTitle?: string;
  goalRawText?: string;
  aiSuccessCriteria?: string;
  blockingReasons?: string[];
  onRequestNext?: () => void;
  initialSelectedWeekdays?: number[];
  initialWeeklyTimeSettings?: { [key: string]: string[] };
  // Location selection in Schedule
  targetLocation?: TargetLocation;
  onOpenLocationPicker?: () => void;
  onUseCurrentLocation?: () => void;
  // Calendar events context (optional for existing goals)
  userId?: string;
  goalId?: string;
  // GoalSpec for verification note
  goalSpec?: GoalSpec | null;
  // Loading state for Next button
  loading?: boolean;
  // Validation result for Next button state
  validationResult?: { isCompatible: boolean; issues: string[] } | null;
  // Calendar events for display
  calendarEvents?: CalendarEvent[];
  // Callback when calendar events change (for override events)
  onCalendarEventsChange?: (events: CalendarEvent[]) => void;
}

export default function SimpleDatePicker({
  startDate: initialStartDate,
  endDate: initialEndDate,
  onStartDateChange,
  onEndDateChange,
  onNavigateToStep,
  onWeeklyScheduleChange,
  verificationMethods = [],
  onVerificationMethodsChange,
  lockedVerificationMethods = [],
  includeDates: initialIncludeDates = [],
  excludeDates: initialExcludeDates = [],
  onIncludeExcludeChange,
  goalTitle,
  goalRawText,
  aiSuccessCriteria,
  blockingReasons = [],
  onRequestNext,
  initialSelectedWeekdays,
  initialWeeklyTimeSettings,
  targetLocation, 
  onOpenLocationPicker, 
  onUseCurrentLocation,
  userId,
  goalId,
  goalSpec,
  loading = false,
  validationResult,
  calendarEvents = [],
  onCalendarEventsChange
}: SimpleDatePickerProps) {
  /**
   * 로컬 날짜를 YYYY-MM-DD 형식으로 변환
   * 
   * 타임존 규칙: Asia/Seoul 고정
   * 날짜 문자열: YYYY-MM-DD 형식
   * 
   * @param d Date 객체
   * @returns YYYY-MM-DD 형식의 날짜 문자열
   */
  const getLocalYMD = (d: Date) => {
    // Asia/Seoul 타임존 기준으로 날짜 계산
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const today = getLocalYMD(new Date());

  const [startDate, setStartDate] = useState(initialStartDate || today);
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [durationType, setDurationType] = useState<'days' | 'weeks' | 'months'>('weeks');
  const [durationValue, setDurationValue] = useState('2');

  // Calendar navigation state
  const [currentMonth, setCurrentMonth] = useState(new Date(startDate || today));

  // Weekly Schedule state (always visible)
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(
    new Set(initialSelectedWeekdays || [])
  );
  const [weeklyTimeSettings, setWeeklyTimeSettings] = useState<{ [key: string]: string[] }>(
    initialWeeklyTimeSettings || {}
  );
  

  

  


  const [isEditingWeeklySchedule, setIsEditingWeeklySchedule] = useState(true);
  const [editingMode, setEditingMode] = useState<'period' | 'schedule'>('period');
  const [includeDates, setIncludeDates] = useState<string[]>(initialIncludeDates);
  const [excludeDates, setExcludeDates] = useState<string[]>(initialExcludeDates);

  // Calendar state
  const [overrideEvents, setOverrideEvents] = useState<CalendarEvent[]>([]);


  // Ensure an initial endDate exists so that the current period is active
  useEffect(() => {
    if (!endDate && startDate) {
      const numValue = parseInt(durationValue) || 1;
      const range = convertDurationToRange(startDate, durationType, numValue);
      setEndDate(range.endDate);
      // Defer parent updates to the next tick to avoid render-phase warnings
      setTimeout(() => {
        onEndDateChange(range.endDate);
        // Clamp existing include/exclude to the initialized range
        const clampToRange = (dates: string[]) => dates.filter(d => d >= startDate && d <= range.endDate);
        const nextInclude = clampToRange(includeDates).sort();
        const nextExclude = clampToRange(excludeDates).sort();
        const includeChanged = nextInclude.length !== includeDates.length || nextInclude.some((v, i) => v !== includeDates[i]);
        const excludeChanged = nextExclude.length !== excludeDates.length || nextExclude.some((v, i) => v !== excludeDates[i]);
        if (includeChanged || excludeChanged) {
          setIncludeDates(nextInclude);
          setExcludeDates(nextExclude);
          onIncludeExcludeChange?.(nextInclude, nextExclude);
        }
      }, 0);
    }
  }, [endDate, startDate, durationType, durationValue]);

  // Time picker modal state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingDayIndex, setEditingDayIndex] = useState<number>(-1);
  const [editingTimeIndex, setEditingTimeIndex] = useState<number>(-1);
  const [editingTimeHour, setEditingTimeHour] = useState('10');
  const [editingTimeMinute, setEditingTimeMinute] = useState('00');
  
  // Date edit modal state for long press
  const [showDateEditModal, setShowDateEditModal] = useState(false);
  const [selectedDateForEdit, setSelectedDateForEdit] = useState<string | null>(null);
  const [dateEditTimeInput, setDateEditTimeInput] = useState('');
  const [showDateTimeInput, setShowDateTimeInput] = useState(false);
  const [editingDateTimeIndex, setEditingDateTimeIndex] = useState(-1);

  // Change-detection to avoid loops
  const prevWeeklyDataRef = useRef<string>('');
  const prevExcludeSigRef = useRef<string>('');
  const didMountRef = useRef<boolean>(false);

  // Notify parent when weekly schedule changes
  const notifyParent = useCallback((weekdays: Set<number>, timeSettings: { [key: string]: string[] }) => {
    if (!onWeeklyScheduleChange) return;
    const currentData = JSON.stringify({ weekdays: Array.from(weekdays), timeSettings });
    if (currentData !== prevWeeklyDataRef.current) {
      prevWeeklyDataRef.current = currentData;
      onWeeklyScheduleChange(weekdays, timeSettings);
    }
  }, [onWeeklyScheduleChange]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    notifyParent(selectedWeekdays, weeklyTimeSettings);
  }, [selectedWeekdays, weeklyTimeSettings]);
  // Initialize weekly schedule from props or includeDates on first mount
  useEffect(() => {
    if (!didMountRef.current) {
      // Seed from explicit props first
      if ((initialSelectedWeekdays && initialSelectedWeekdays.length > 0) || initialWeeklyTimeSettings) {
        setSelectedWeekdays(new Set(initialSelectedWeekdays || []));
        setWeeklyTimeSettings(initialWeeklyTimeSettings || {});
        return;
      }
      // Otherwise derive from includeDates if provided
      const inc = initialIncludeDates || [];
      if (inc.length > 0) {
        const setDays = new Set<number>();
        inc.forEach(d => setDays.add(new Date(d).getDay()));
        setSelectedWeekdays(setDays);
      }
    }
  }, []);

  // Removed 'weekly overrides calendar excludes' effect to allow per-day overrides to persist

  // Keep include/exclude in sync with parent-provided props on first render or when they change externally
  const arraysEqual = (a?: string[], b?: string[]) => {
    const aa = a || [];
    const bb = b || [];
    if (aa.length !== bb.length) return false;
    for (let i = 0; i < aa.length; i++) {
      if (aa[i] !== bb[i]) return false;
    }
    return true;
  };

  useEffect(() => {
    const next = initialIncludeDates || [];
    setIncludeDates(prev => (arraysEqual(prev, next) ? prev : next));
  }, [initialIncludeDates]);
  useEffect(() => {
    const next = initialExcludeDates || [];
    setExcludeDates(prev => (arraysEqual(prev, next) ? prev : next));
  }, [initialExcludeDates]);

  // Calendar navigation functions (unused in vertical scroll mode, kept for compatibility)
  const goToPreviousMonth = () => {};
  const goToNextMonth = () => {};
  const goToYear = (_year: number) => {};

  // Generate calendar days for current month
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();

    const days: any[] = [];

    for (let i = 0; i < startingDay; i++) days.push(null);

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = getLocalYMD(new Date(year, month, day));
      const inRange = !!(endDate && dateStr >= (startDate || today) && dateStr <= endDate);
      const baseIncluded = inRange && selectedWeekdays.has(new Date(dateStr).getDay());
      const isScheduled = inRange && ((baseIncluded && !excludeDates.includes(dateStr)) || includeDates.includes(dateStr));
      days.push({
        day,
        dateStr,
        isToday: dateStr === today,
        isPast: dateStr < today,
        isSelected: dateStr === startDate || (endDate && dateStr === endDate),
        isInRange: endDate && dateStr > startDate && dateStr < endDate,
        isWeekdayGoal: endDate && dateStr >= startDate && dateStr <= endDate && selectedWeekdays.has(new Date(dateStr).getDay()),
        isScheduled,
        baseIncluded,
        isWithinRange: inRange
      });
    }

    return days;
  };

  // Generate calendar days for a given month (for vertical rendering)
  const generateCalendarDaysFor = (monthDate: Date) => {
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    const startingDay = firstDay.getDay();
    const days: any[] = [];
    for (let i = 0; i < startingDay; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = getLocalYMD(new Date(y, m, d));
      const inRange = !!(endDate && dateStr >= (startDate || today) && dateStr <= endDate);
      const baseIncluded = inRange && selectedWeekdays.has(new Date(dateStr).getDay());
      const isScheduled = inRange && ((baseIncluded && !excludeDates.includes(dateStr)) || includeDates.includes(dateStr));
      
      // Get times from calendar events for this date - ONLY ONE TIME PER DATE
      const dayEvents = calendarEvents.filter(event => event.date === dateStr);
      const allDayTimes = dayEvents
        .map(event => event.time)
        .filter(time => time) // Remove null/undefined times
        .sort()
        .filter((time, index, array) => array.indexOf(time) === index); // Remove duplicates
      
      // 🔄 SINGLE TIME PER DATE: Show only the first (most recent) time
      const dayTimes = allDayTimes.length > 0 ? [allDayTimes[0]] : [];
      
      // 🔄 SCHEDULE-BASED TIME DISPLAY: Only show times for scheduled dates
      const visibleTimes = isScheduled ? dayTimes : [];
      
      days.push({
        day: d,
        dateStr,
        isToday: dateStr === today,
        isPast: dateStr < today,
        isSelected: dateStr === startDate || (endDate && dateStr === endDate),
        isInRange: endDate && dateStr > startDate && dateStr < endDate,
        isWeekdayGoal: endDate && dateStr >= startDate && dateStr <= endDate && selectedWeekdays.has(new Date(dateStr).getDay()),
        isScheduled,
        baseIncluded,
        isWithinRange: inRange,
        times: visibleTimes, // Only show times for scheduled dates
        events: dayEvents // Store all events for potential use
      });
    }
    return days;
  };

  const monthsInView = useMemo(() => {
    const list: Date[] = [];
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const cur = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
      while (cur <= endMonth) {
        list.push(new Date(cur));
        cur.setMonth(cur.getMonth() + 1);
      }
    } else {
      const anchor = currentMonth || new Date();
      const start = new Date(anchor);
      start.setMonth(anchor.getMonth() - 5);
      for (let i = 0; i < 12; i++) {
        const m = new Date(start);
        m.setMonth(start.getMonth() + i);
        list.push(m);
      }
    }
    return list;
  }, [startDate, endDate, currentMonth]);

  // Fixed header month tracking and measurements
  const calendarScrollRef = useRef<ScrollView | null>(null);
  const monthsLayoutRef = useRef<Array<{ y: number; h: number }>>([]);
  const VIEWPORT_HEIGHT = 420;
  const [headerMonth, setHeaderMonth] = useState<Date | null>(null);

  useEffect(() => {
    monthsLayoutRef.current = [];
    // Initialize header with first month
    if (monthsInView.length > 0) setHeaderMonth(monthsInView[0]);
  }, [monthsInView]);

  const onMonthLayout = (index: number, y: number, h: number) => {
    const arr = monthsLayoutRef.current.slice();
    arr[index] = { y, h };
    monthsLayoutRef.current = arr;
    // Height is fixed; no need to set from layout
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

  // Removed snapping block (we only update header dynamically)

  const handleDateSelect = (dateStr: string) => {
    log('handleDateSelect entry:', { dateStr, editingMode, today });
    if (dateStr < today) return; // Don't allow past dates

    if (editingMode === 'schedule') {
      // 🔄 SCHEDULE MODE: Toggle include/exclude based on base weekly schedule
      console.log(`[Calendar] Toggling schedule for date: ${dateStr}`);
      
      const baseIncluded = selectedWeekdays.has(new Date(dateStr).getDay()) && (!!endDate ? (dateStr >= (startDate || today) && dateStr <= endDate) : true);
      const currentlyScheduled = ((baseIncluded && !excludeDates.includes(dateStr)) || includeDates.includes(dateStr));
      const dayName = dayShort[new Date(dateStr).getDay()];

      console.log(`[Calendar] Date ${dateStr} (${dayName}): baseIncluded=${baseIncluded}, currentlyScheduled=${currentlyScheduled}`);

      let nextInclude = [...includeDates];
      let nextExclude = [...excludeDates];

      if (currentlyScheduled) {
        if (baseIncluded) {
          // Was scheduled by base; turning off -> add to exclude
          if (!nextExclude.includes(dateStr)) nextExclude.push(dateStr);
          // Ensure not in include
          nextInclude = nextInclude.filter(d => d !== dateStr);
          console.log(`[Calendar] Disabled ${dayName} ${dateStr} by adding to exclude`);
        } else {
          // Was scheduled only due to include; turning off -> remove from include
          nextInclude = nextInclude.filter(d => d !== dateStr);
          console.log(`[Calendar] Disabled ${dayName} ${dateStr} by removing from include`);
        }
        
        // 🔄 REMOVE CALENDAR EVENTS: When unscheduling a date, remove all its times
        if (onCalendarEventsChange) {
          const updatedEvents = calendarEvents.filter(event => event.date !== dateStr);
          onCalendarEventsChange(updatedEvents);
          
          if (__DEV__) {
            console.log(`[Calendar] Removed all times for unscheduled date: ${dateStr}`);
          }
        }
      } else {
        if (baseIncluded) {
          // Base includes but currently off due to exclude; turning on -> remove from exclude
          nextExclude = nextExclude.filter(d => d !== dateStr);
          console.log(`[Calendar] Enabled ${dayName} ${dateStr} by removing from exclude`);
        } else {
          // Base excludes; turning on -> add to include
          if (!nextInclude.includes(dateStr)) nextInclude.push(dateStr);
          console.log(`[Calendar] Enabled ${dayName} ${dateStr} by adding to include`);
        }
      }

      // Keep within current range if defined
      const clampToRange = (dates: string[]) => {
        if (!startDate || !endDate) return dates;
        return dates.filter(d => d >= startDate && d <= endDate);
      };
      nextInclude = clampToRange(nextInclude).sort();
      nextExclude = clampToRange(nextExclude).sort();

      setIncludeDates(nextInclude);
      setExcludeDates(nextExclude);
      onIncludeExcludeChange?.(nextInclude, nextExclude);
      
      // 🔄 UPDATE WEEKLY SCHEDULE DISPLAY: Reflect schedule changes in weekly display
      setTimeout(() => updateWeeklyScheduleFromCalendar(), 100);
      return;
    }

    // Period edit mode
    setStartDate(dateStr);
    onStartDateChange(dateStr);

    const value = parseInt(durationValue) || 1;
    const range = convertDurationToRange(dateStr, durationType, value);
    setEndDate(range.endDate);
    onEndDateChange(range.endDate);

    // Clean include/exclude now that range updated
    const clampToRange = (dates: string[]) => dates.filter(d => d >= dateStr && d <= range.endDate);
    const nextInclude = clampToRange(includeDates).sort();
    const nextExclude = clampToRange(excludeDates).sort();
    setIncludeDates(nextInclude);
    setExcludeDates(nextExclude);
    onIncludeExcludeChange?.(nextInclude, nextExclude);

    // Add weekdays from newly included dates to weekly schedule selection (non-destructive)
    setSelectedWeekdays(prev => {
      const next = new Set(prev);
      nextInclude.forEach(d => next.add(new Date(d).getDay()));
      return next;
    });
    log('handleDateSelect exit:', { dateStr, editingMode });
  };

  const handleDurationChange = (value: string) => {
    setDurationValue(value);
    if (startDate && value) {
      const numValue = parseInt(value) || 1;
      const range = convertDurationToRange(startDate, durationType, numValue);
      setEndDate(range.endDate);
      onEndDateChange(range.endDate);

      // Clean include/exclude to new range
      const clampToRange = (dates: string[]) => dates.filter(d => d >= startDate && d <= range.endDate);
      const nextInclude = clampToRange(includeDates).sort();
      const nextExclude = clampToRange(excludeDates).sort();
      setIncludeDates(nextInclude);
      setExcludeDates(nextExclude);
      onIncludeExcludeChange?.(nextInclude, nextExclude);

      // Reflect include dates back to weekly schedule selection (non-destructive)
      setSelectedWeekdays(prev => {
        const next = new Set<number>();
        // Only keep weekdays that have at least one included date still in range
        nextInclude.forEach(d => next.add(new Date(d).getDay()));
        return next;
      });
      // Clear times for weekdays no longer selected
      setWeeklyTimeSettings(prev => {
        const keepDays = new Set<number>();
        nextInclude.forEach(d => keepDays.add(new Date(d).getDay()));
        const copy: any = {};
        Object.keys(prev).forEach(k => {
          const di = parseInt(k, 10);
          if (keepDays.has(di)) copy[di] = prev[di];
        });
        return copy;
      });
    }
  };

  const handleDurationTypeChange = (type: 'days' | 'weeks' | 'months') => {
    setDurationType(type);
    if (startDate && durationValue) {
      const numValue = parseInt(durationValue) || 1;
      const range = convertDurationToRange(startDate, type, numValue);
      setEndDate(range.endDate);
      onEndDateChange(range.endDate);

      // Clean include/exclude to new range
      const clampToRange = (dates: string[]) => dates.filter(d => d >= startDate && d <= range.endDate);
      const nextInclude = clampToRange(includeDates).sort();
      const nextExclude = clampToRange(excludeDates).sort();
      setIncludeDates(nextInclude);
      setExcludeDates(nextExclude);
      onIncludeExcludeChange?.(nextInclude, nextExclude);

      // Reflect include dates back to weekly schedule selection (non-destructive)
      setSelectedWeekdays(prev => {
        const next = new Set<number>();
        nextInclude.forEach(d => next.add(new Date(d).getDay()));
        return next;
      });
      setWeeklyTimeSettings(prev => {
        const keepDays = new Set<number>();
        nextInclude.forEach(d => keepDays.add(new Date(d).getDay()));
        const copy: any = {};
        Object.keys(prev).forEach(k => {
          const di = parseInt(k, 10);
          if (keepDays.has(di)) copy[di] = prev[di];
        });
        return copy;
      });
    }
  };

  // Weekly Schedule functions (always visible)
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // 🔧 PATTERN SEPARATION: Apply weekly pattern (only for existing goals with Weekly 저장 버튼)
  const syncWeeklyScheduleToCalendar = useCallback(async () => {
    try {
      if (!startDate || !endDate || !onCalendarEventsChange) return;
      log('syncWeeklyScheduleToCalendar:start', { startDate, endDate });

      // Build range [start, end]
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(getLocalYMD(d)); // keep existing YMD helper
      }

      // Map overrides by date
      const overrideByDate = new Map(
        calendarEvents
          .filter(e => e.source === 'override')
          .map(e => [e.date, e])
      );

      // Desired weekly events (no id)
      const desiredWeekly: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>[] = [];

      for (const ds of days) {
        const dateObj = new Date(ds);
        const weekday = dateObj.getDay();
        const baseIncluded = selectedWeekdays.has(weekday);
        const scheduled =
          (baseIncluded && !excludeDates.includes(ds)) ||
          includeDates.includes(ds);
        if (!scheduled) continue;
        if (overrideByDate.has(ds)) continue; // keep override

        const t = weeklyTimeSettings[weekday]?.[0]; // one time per weekday
        if (!t) continue;

        desiredWeekly.push({
          goalId: goalId ?? '',
          date: ds,
          time: t,
          source: 'weekly'
        } as any);
      }

      // Remove old weekly events in range
      const keepNonWeekly = calendarEvents.filter(
        e => !(e.source === 'weekly' && days.includes(e.date))
      );

      if (userId && goalId) {
        try {
          const toDeleteIds = calendarEvents
            .filter(e => e.source === 'weekly' && days.includes(e.date))
            .map(e => e.id)
            .filter(Boolean) as string[];
          if (toDeleteIds.length) {
            await CalendarEventService.deleteCalendarEvents(goalId, toDeleteIds);
          }
          if (desiredWeekly.length) {
            await CalendarEventService.createCalendarEvents(goalId, desiredWeekly as any);
          }
          const refreshed = await CalendarEventService.getCalendarEvents(goalId, startDate, endDate);
          onCalendarEventsChange(refreshed);
          log('syncWeeklyScheduleToCalendar:db-updated', { weeklyCount: desiredWeekly.length });
        } catch (e) {
          warn('syncWeeklyScheduleToCalendar:db-fallback', e);
          onCalendarEventsChange([...keepNonWeekly, ...desiredWeekly as any]);
        }
      } else {
        onCalendarEventsChange([...keepNonWeekly, ...desiredWeekly as any]);
        log('syncWeeklyScheduleToCalendar:local-updated', { weeklyCount: desiredWeekly.length });
      }
    } finally {
      log('syncWeeklyScheduleToCalendar:done');
    }
  }, [
    startDate, endDate,
    selectedWeekdays, weeklyTimeSettings,
    includeDates, excludeDates,
    calendarEvents, onCalendarEventsChange,
    userId, goalId
  ]);

  // Helper functions for calendar
  const getTimesForDate = useCallback((dateStr: string): string[] => {
    const w = new Date(dateStr).getDay();
    const inRange = endDate && dateStr >= (startDate || today) && dateStr <= endDate;
    const baseIncluded = inRange && selectedWeekdays.has(w) && !excludeDates.includes(dateStr);
    
    // Get weekly times for this weekday
    const weeklyTimes = baseIncluded ? (weeklyTimeSettings[w] || weeklyTimeSettings[String(w)] || []) : [];
    
    // Get per-date times for this specific date
    const overrideTimes = overrideEvents.filter(e => e.date === dateStr && e.time).map(e => e.time!);
    
    // If override times exist, use ONLY the first one; otherwise use first weekly time
    const finalTimes = overrideTimes.length > 0 ? overrideTimes : weeklyTimes;
    return finalTimes.length > 0 ? [finalTimes[0]] : [];
  }, [startDate, endDate, selectedWeekdays, excludeDates, weeklyTimeSettings, overrideEvents]);

  const isDateScheduled = useCallback((dateStr: string): boolean => {
    const w = new Date(dateStr).getDay();
    const inRange = endDate && dateStr >= (startDate || today) && dateStr <= endDate;
    
    if (!inRange) return false;
    
    // Check for override events (with or without time)
    const hasOverride = overrideEvents.some(e => e.date === dateStr);
    
    // Check for weekly pattern (only if not excluded)
    const baseIncluded = selectedWeekdays.has(w) && !excludeDates.includes(dateStr);
    const weeklyTimes = baseIncluded ? (weeklyTimeSettings[w] || weeklyTimeSettings[String(w)] || []) : [];
    
    // Scheduled if: has override OR has weekly pattern times
    return hasOverride || weeklyTimes.length > 0;
  }, [startDate, endDate, selectedWeekdays, excludeDates, weeklyTimeSettings, overrideEvents]);

  
  const toggleWeekday = useCallback((dayIndex: number) => {
    // Defer state updates to avoid setState during render warnings
    setTimeout(() => {
      setSelectedWeekdays(prev => {
        const next = new Set(prev);
        const wasSelected = next.has(dayIndex);
        if (wasSelected) {
          // 🔄 REMOVING WEEKDAY: Update Weekly Schedule and Calendar
          console.log(`[WeeklySchedule] Removing weekday ${dayIndex} (${dayShort[dayIndex]})`);
          next.delete(dayIndex);
          
          // Remove time settings for this weekday
          setWeeklyTimeSettings(prevTimes => {
            const copy = { ...prevTimes } as any;
            delete copy[dayIndex];
            console.log(`[WeeklySchedule] Removed time settings for ${dayShort[dayIndex]}`);
            return copy;
          });
          
          // 🗓️ SYNC CALENDAR: Remove all calendar schedules for this weekday within the range
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            // Remove any include dates that were this weekday
            const nextInclude = includeDates.filter(ds => {
              const date = new Date(ds);
              return date.getDay() !== dayIndex || date < start || date > end;
            });
            
            // Add explicit excludes for all in-range dates of this weekday
            const explicitExcludes: string[] = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              if (d.getDay() !== dayIndex) continue;
              const ds = d.toISOString().split('T')[0];
              if (!explicitExcludes.includes(ds)) {
                explicitExcludes.push(ds);
                console.log(`[Calendar] Adding explicit exclude for ${ds} (${dayShort[dayIndex]})`);
              }
            }
            
            // Update exclude dates, removing old excludes for this weekday and adding new ones
            const nextExclude = excludeDates
              .filter(ds => {
                const date = new Date(ds);
                return date.getDay() !== dayIndex || date < start || date > end;
              })
              .concat(explicitExcludes)
              .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
              .sort();
            
            setIncludeDates(nextInclude);
            setExcludeDates(nextExclude);
            onIncludeExcludeChange?.(nextInclude, nextExclude);
            
            console.log(`[Calendar] Updated calendar: removed ${dayShort[dayIndex]} schedules, added ${explicitExcludes.length} explicit excludes`);
          }
          
          // 🗓️ SYNC CALENDAR EVENTS: Update calendar events
          syncWeeklyScheduleToCalendar();
        } else {
          // 🔄 ADDING WEEKDAY: Update Weekly Schedule and Calendar
          console.log(`[WeeklySchedule] Adding weekday ${dayIndex} (${dayShort[dayIndex]})`);
          next.add(dayIndex);
          
          // 🗓️ SYNC CALENDAR: Add all in-range occurrences of this weekday as scheduled
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            // Remove excludes for this weekday within the range (allowing them to be scheduled)
            const nextExclude = excludeDates.filter(ds => {
              const date = new Date(ds);
              return date.getDay() !== dayIndex || date < start || date > end;
            });
            
            setExcludeDates(nextExclude);
            onIncludeExcludeChange?.(includeDates, nextExclude);
            
            console.log(`[Calendar] Updated calendar: enabled ${dayShort[dayIndex]} schedules by removing excludes`);
          }
          
          // 🗓️ SYNC CALENDAR EVENTS: Update calendar events
          syncWeeklyScheduleToCalendar();
        }
        return next;
      });
    }, 0);
  }, [startDate, endDate, includeDates, excludeDates, onIncludeExcludeChange, dayShort, syncWeeklyScheduleToCalendar]);

  const openAddTimeModal = useCallback((dayIndex: number) => {
    setEditingDayIndex(dayIndex);
    setEditingTimeIndex(-1);
    setEditingTimeHour('10');
    setEditingTimeMinute('00');
    setShowTimePicker(true);
  }, []);

  const openEditTimeModal = useCallback((dayIndex: number, timeIdx: number) => {
    const currentTime = weeklyTimeSettings[dayIndex]?.[timeIdx] || '10:00';
    const [h, m] = currentTime.split(':');
    
    if (__DEV__) {
      console.log(`[WeeklySchedule] Opening edit modal for ${currentTime} at dayIndex ${dayIndex}, timeIdx ${timeIdx}`);
    }
    
    setEditingDayIndex(dayIndex);
    setEditingTimeIndex(timeIdx);
    setEditingTimeHour(h.padStart(2, '0'));
    setEditingTimeMinute(m.padStart(2, '0'));
    setShowTimePicker(true);
  }, [weeklyTimeSettings]);

  const removeTime = useCallback(async (dayIndex: number, timeIdx: number) => {
    const dayName = dayShort[dayIndex];
    log('removeTime: removing weekly time', { dayIndex, timeIdx, dayName });
    
    setWeeklyTimeSettings(prev => {
      const list = prev[dayIndex] ? [...prev[dayIndex]] : [];
      const removedTime = list[timeIdx];
      
      // 🔧 IMMUTABLE PATTERN: filter 사용 (splice 금지)
      const updatedList = list.filter((_, idx) => idx !== timeIdx);
      const next = { ...prev } as any;
      
      if (updatedList.length > 0) {
        next[dayIndex] = updatedList;
        console.log(`[WeeklySchedule] Updated time settings for ${dayName}: ${updatedList.join(', ')}`);
      } else {
        delete next[dayIndex];
        console.log(`[WeeklySchedule] Removed all time settings for ${dayName}`);
        
        // 🔄 SYNC WEEKDAYS: If no times left, remove the weekday from selection
        setSelectedWeekdays(prevDays => {
          const copy = new Set(prevDays);
          copy.delete(dayIndex);
          console.log(`[WeeklySchedule] Removed ${dayName} from weekly schedule (no times left)`);
          return copy;
        });
      }
      return next;
    });
    
    // 🔄 SYNC CALENDAR: Immediately sync weekly schedule to calendar events
    try {
      await syncWeeklyScheduleToCalendar();
      log('removeTime: calendar sync completed');
    } catch (error) {
      err('removeTime: calendar sync failed', error);
    }
  }, [dayShort, syncWeeklyScheduleToCalendar]);

  const saveTime = useCallback(async () => {
    const time = `${editingTimeHour.padStart(2, '0')}:${editingTimeMinute.padStart(2, '0')}`;
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      Alert.alert('Invalid Time', 'Please choose a valid time');
      return;
    }
    
    log('saveTime: saving weekly time', { time, editingDayIndex, editingTimeIndex });
    
    // 🔧 ONE TIME PER WEEKDAY: Always replace/overwrite the previous time
    const updatedTimes = [time]; // Always exactly one time per weekday
    
    // Calculate updated weekdays - ensure editingDayIndex is included
    const updatedWeekdays = new Set(selectedWeekdays);
    updatedWeekdays.add(editingDayIndex);
    
    // Calculate updated time settings - replace entire array with single time
    const newTimeSettings = { ...weeklyTimeSettings, [editingDayIndex]: updatedTimes } as any;
    
    // 🔄 BATCH UPDATE: Update both states together, then notify parent
    setWeeklyTimeSettings(newTimeSettings);
    setSelectedWeekdays(updatedWeekdays);
    
    // 🔄 IMMEDIATE PARENT NOTIFICATION: No setTimeout needed
    if (onWeeklyScheduleChange) {
      onWeeklyScheduleChange(updatedWeekdays, newTimeSettings);
      if (__DEV__) {
        console.log('[WeeklySchedule] Immediately notified parent of weekly schedule change for calendar sync');
      }
    }
    
    // Close modal
    setShowTimePicker(false);
    setEditingDayIndex(-1);
    setEditingTimeIndex(-1);
    
    // 🔄 SYNC CALENDAR: Immediately sync weekly schedule to calendar events
    try {
      await syncWeeklyScheduleToCalendar();
      log('saveTime: calendar sync completed');
    } catch (error) {
      err('saveTime: calendar sync failed', error);
    }
  }, [editingDayIndex, editingTimeIndex, editingTimeHour, editingTimeMinute, selectedWeekdays, weeklyTimeSettings, onWeeklyScheduleChange, syncWeeklyScheduleToCalendar]);

  // Long press handler for date editing
  const handleDateLongPress = useCallback((dateStr: string) => {
    log('handleDateLongPress entry:', { dateStr, editingMode });
    if (__DEV__) console.log('[SimpleDatePicker] Long press detected for date:', dateStr);
    
    if (!dateStr) return;
    
    try {
      setSelectedDateForEdit(dateStr);
      setShowDateEditModal(true);
      
      // Add haptic feedback (skip for now)
      // TODO: Add haptic feedback when ready
    } catch (error) {
      console.error('[SimpleDatePicker] Error in handleDateLongPress:', error);
    }
  }, []);

  // Date edit modal functions
  // Helper function to actually add/replace time for a date
  const addOrReplaceTimeForDate = useCallback(async () => {
    if (!selectedDateForEdit || !dateEditTimeInput.trim() || !onCalendarEventsChange) return;
    
    log('addOrReplaceTimeForDate: processing override time', { date: selectedDateForEdit, time: dateEditTimeInput });
    
    // 🔄 ONE TIME PER DATE: Remove any existing events for this date (regardless of source)
    const otherDateEvents = calendarEvents.filter(e => e.date !== selectedDateForEdit);
    
    // 🔄 DATABASE PERSISTENCE: Save to database if userId and goalId are available
    if (userId && goalId) {
      try {
        // Create new override event for this date
        const newEvent: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'> = {
          date: selectedDateForEdit,
          time: dateEditTimeInput,
          goalId: goalId,
          source: 'override'
        };
        await CalendarEventService.createCalendarEvents(goalId, [newEvent]);
        
        // Refresh calendar events after successful database save
        const refreshedEvents = await CalendarEventService.getCalendarEvents(
          goalId, 
          selectedDateForEdit,
          selectedDateForEdit
        );
        
        // Merge with existing events from other dates
        const otherDateEvents = calendarEvents.filter(e => e.date !== selectedDateForEdit);
        const updatedEvents = [...otherDateEvents, ...refreshedEvents];
        onCalendarEventsChange(updatedEvents);
        
        console.log(`[Calendar Edit Schedule] Successfully replaced time for date ${selectedDateForEdit} with ${dateEditTimeInput} (single time per date)`);
      } catch (error) {
        console.error('[Calendar Edit Schedule] Error saving override time to database:', error);
        Alert.alert('Error', 'Failed to save time to database. Please try again.');
        return;
      }
    } else {
      // 🔄 LOCAL FALLBACK: Replace existing local events for this date
      const otherDateEvents = calendarEvents.filter(e => e.date !== selectedDateForEdit);
      const newEvent: CalendarEvent = {
        id: `override-${selectedDateForEdit}-${dateEditTimeInput}-${Date.now()}`,
        date: selectedDateForEdit,
        time: dateEditTimeInput,
        goalId: goalId || 'temp-goal-id',
        source: 'override',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Only keep the new event for this date (single time per date)
      const updatedEvents = [...otherDateEvents, newEvent];
      onCalendarEventsChange(updatedEvents);
      
      console.log(`[Calendar Edit Schedule] Replaced local time for date ${selectedDateForEdit} with ${dateEditTimeInput} (single time per date)`);
    }
    
    // 🔄 INDEPENDENT DATE MANAGEMENT: Only affect this specific date
    const dateToAdd = selectedDateForEdit;
    if (!includeDates.includes(dateToAdd)) {
      // 🔧 IMMUTABLE PATTERN: concat 사용 (push 금지)
      const newIncludeDates = [...includeDates, dateToAdd].sort();
      setIncludeDates(newIncludeDates);
      onIncludeExcludeChange?.(newIncludeDates, excludeDates);
    }
    
    // 🔄 UPDATE WEEKLY SCHEDULE DISPLAY: Reflect override in weekly schedule display
    // This only updates the DISPLAY, not the underlying weekly pattern
    setTimeout(() => updateWeeklyScheduleFromCalendar(), 100);
    
    // Reset input
    setDateEditTimeInput('09:00');
    setShowDateTimeInput(false);
    
    if (__DEV__) {
      console.log('[SimpleDatePicker] Set SINGLE time for this specific date only:', {
        date: selectedDateForEdit,
        time: dateEditTimeInput,
        affectedOtherDates: false,
        updateType: 'single-override-only',
        savedToDatabase: !!(userId && goalId)
      });
    }
    log('addOrReplaceTimeForDate: completed', { date: selectedDateForEdit, time: dateEditTimeInput });
  }, [selectedDateForEdit, dateEditTimeInput, calendarEvents, onCalendarEventsChange, includeDates, excludeDates, onIncludeExcludeChange, userId, goalId]);

  const handleAddTimeToDate = useCallback(async () => {
    if (!selectedDateForEdit || !dateEditTimeInput.trim()) return;
    
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(dateEditTimeInput)) {
      Alert.alert('Invalid Time', 'Please use HH:MM format (e.g., 09:00)');
      return;
    }
    
    if (!onCalendarEventsChange) {
      Alert.alert('Error', 'Calendar events update function not available');
      return;
    }
    
    log('handleAddTimeToDate: checking for existing events', { date: selectedDateForEdit, time: dateEditTimeInput });
    
    // 🔄 ONE TIME PER DATE: Check if this date already has any events
    const existingEventsForDate = calendarEvents.filter(e => e.date === selectedDateForEdit);
    
    // If there are existing events, show confirmation dialog
    if (existingEventsForDate.length > 0) {
      const existingTime = existingEventsForDate[0].time || 'no time';
      const existingSource = existingEventsForDate[0].source || 'unknown';
      Alert.alert(
        'Replace Existing Time', 
        `This date already has a ${existingSource} time (${existingTime}). Do you want to replace it with ${dateEditTimeInput}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', onPress: () => addOrReplaceTimeForDate() }
        ]
      );
      return;
    }
    
    // No existing events, proceed directly
    await addOrReplaceTimeForDate();
  }, [selectedDateForEdit, dateEditTimeInput, calendarEvents, onCalendarEventsChange, addOrReplaceTimeForDate]);

  // Helper function to update a single time for a date (called from replace confirmation)
  const handleUpdateSingleTimeForDate = useCallback(async (eventToReplace: CalendarEvent, newTime: string) => {
    if (!selectedDateForEdit || !onCalendarEventsChange) return;
    
    log('handleUpdateSingleTimeForDate: updating override time', { 
      date: selectedDateForEdit, 
      oldTime: eventToReplace.time, 
      newTime,
      oldSource: eventToReplace.source 
    });
    
    // 🔄 ONE TIME PER DATE: Remove any existing events for this date (regardless of source)
    const otherDateEvents = calendarEvents.filter(e => e.date !== selectedDateForEdit);
    
    // 🔄 DATABASE PERSISTENCE: Update in database if available
    if (userId && goalId) {
      try {
        // Delete existing events for this date if they exist
        const existingEventsForDate = calendarEvents.filter(e => e.date === selectedDateForEdit);
        if (existingEventsForDate.length > 0) {
          const toDeleteIds = existingEventsForDate.map(e => e.id).filter(Boolean) as string[];
          if (toDeleteIds.length > 0) {
            await CalendarEventService.deleteCalendarEvents(goalId, toDeleteIds);
          }
        }
        
        // Create new override event for this date
        const newEvent: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'> = {
          date: selectedDateForEdit,
          time: newTime,
          goalId: goalId,
          source: 'override'
        };
        await CalendarEventService.createCalendarEvents(goalId, [newEvent]);
        
        // Refresh calendar events
        const refreshedEvents = await CalendarEventService.getCalendarEvents(goalId, selectedDateForEdit, selectedDateForEdit);
        const updatedEvents = [...otherDateEvents, ...refreshedEvents];
        onCalendarEventsChange(updatedEvents);
        
        console.log(`[Calendar Edit Schedule] Successfully updated single time for date ${selectedDateForEdit} from ${eventToReplace.time} to ${newTime}`);
      } catch (error) {
        console.error('[Calendar Edit Schedule] Error updating single time:', error);
        Alert.alert('Error', 'Failed to update time. Please try again.');
        return;
      }
    } else {
      // 🔄 LOCAL FALLBACK: Replace with new override event
      const newEvent: CalendarEvent = {
        id: `override-${selectedDateForEdit}-${newTime}-${Date.now()}`,
        date: selectedDateForEdit,
        time: newTime,
        goalId: goalId || 'temp-goal-id',
        source: 'override',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const updatedEvents = [...otherDateEvents, newEvent];
      onCalendarEventsChange(updatedEvents);
      
      console.log(`[Calendar Edit Schedule] Updated local single time for date ${selectedDateForEdit} from ${eventToReplace.time} to ${newTime}`);
    }
    
    // Update weekly schedule display immediately to prevent UI jitter
    updateWeeklyScheduleFromCalendar();
    
    // Reset input
    setDateEditTimeInput('09:00');
    setShowDateTimeInput(false);
    
    log('handleUpdateSingleTimeForDate: completed', { date: selectedDateForEdit, newTime });
  }, [selectedDateForEdit, calendarEvents, onCalendarEventsChange, userId, goalId]);

  const handleEditTimeForDate = useCallback((timeIndex: number) => {
    const dateEvents = calendarEvents.filter(event => event.date === selectedDateForEdit);
    const eventToEdit = dateEvents[timeIndex];
    
    if (!eventToEdit || !eventToEdit.time) return;
    
    setDateEditTimeInput(eventToEdit.time);
    setEditingDateTimeIndex(timeIndex);
    setShowDateTimeInput(true);
  }, [calendarEvents, selectedDateForEdit]);

  const handleUpdateTimeForDate = useCallback(async () => {
    if (!selectedDateForEdit || !dateEditTimeInput.trim() || editingDateTimeIndex === -1) return;
    
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(dateEditTimeInput)) {
      Alert.alert('Invalid Time', 'Please use HH:MM format (e.g., 09:00)');
      return;
    }
    
    if (!onCalendarEventsChange) return;
    
    const dateEvents = calendarEvents.filter(event => event.date === selectedDateForEdit);
    const eventToUpdate = dateEvents[editingDateTimeIndex];
    
    if (!eventToUpdate) return;
    
    const oldTime = eventToUpdate.time;
    
    // 🔄 SINGLE TIME UPDATE: Use dedicated update function for consistent single-time behavior
    await handleUpdateSingleTimeForDate(eventToUpdate, dateEditTimeInput);
    
    // Reset editing state
    setEditingDateTimeIndex(-1);
    
    if (__DEV__) {
      console.log('[SimpleDatePicker] Updated SINGLE time for this specific date only:', {
        date: selectedDateForEdit,
        oldTime,
        newTime: dateEditTimeInput,
        affectedOtherDates: false,
        updateType: 'single-override-only'
      });
    }
  }, [selectedDateForEdit, dateEditTimeInput, editingDateTimeIndex, calendarEvents, handleUpdateSingleTimeForDate]);

  const handleDeleteTimeForDate = useCallback(async (timeIndex: number) => {
    if (!selectedDateForEdit || !onCalendarEventsChange) return;
    
    const dateEvents = calendarEvents.filter(event => event.date === selectedDateForEdit);
    const eventToDelete = dateEvents[timeIndex];
    
    if (!eventToDelete) return;
    
    Alert.alert(
      'Delete Time',
      `Are you sure you want to delete ${eventToDelete.time} from ${selectedDateForEdit}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // 🔄 DATABASE PERSISTENCE: Delete from database if available
            if (userId && goalId && eventToDelete.time && eventToDelete.source === 'override') {
              try {
                // Delete event using deleteCalendarEvents
                if (eventToDelete.id) {
                  await CalendarEventService.deleteCalendarEvents(goalId, [eventToDelete.id]);
                }
                
                // Refresh calendar events after successful database delete
                const refreshedEvents = await CalendarEventService.getCalendarEvents(goalId, selectedDateForEdit, selectedDateForEdit);
                const otherDateEvents = calendarEvents.filter(e => e.date !== selectedDateForEdit);
                const updatedEvents = [...otherDateEvents, ...refreshedEvents];
                onCalendarEventsChange(updatedEvents);
                
                console.log(`[Calendar Edit Schedule] Successfully deleted override time ${eventToDelete.time} for date ${selectedDateForEdit} from database`);
              } catch (error) {
                console.error('[Calendar Edit Schedule] Error deleting override time from database:', error);
                Alert.alert('Error', 'Failed to delete time from database. Please try again.');
                return;
              }
            } else {
              // 🔄 LOCAL FALLBACK: Delete from local events
              const updatedEvents = calendarEvents.filter(event => event.id !== eventToDelete.id);
              onCalendarEventsChange(updatedEvents);
              
              console.log(`[Calendar Edit Schedule] Deleted local time ${eventToDelete.time} for date ${selectedDateForEdit}`);
            }
            
            // 🔄 CHECK IF THIS DATE SHOULD BE REMOVED FROM SCHEDULE
            const remainingTimesForDate = calendarEvents.filter(e => e.date === selectedDateForEdit && e.id !== eventToDelete.id);
            
            if (remainingTimesForDate.length === 0) {
              // No more times for this date, consider removing from include dates
              const newIncludeDates = includeDates.filter(date => date !== selectedDateForEdit);
              setIncludeDates(newIncludeDates);
              onIncludeExcludeChange?.(newIncludeDates, excludeDates);
              
              if (__DEV__) {
                console.log('[SimpleDatePicker] Removed date from schedule (no times left):', selectedDateForEdit);
              }
            }
            
            // 🔄 UPDATE WEEKLY SCHEDULE DISPLAY: Reflect deletion in weekly schedule display immediately
            updateWeeklyScheduleFromCalendar();
            
            if (__DEV__) {
              console.log('[SimpleDatePicker] Deleted SINGLE time from this specific date only:', {
                date: selectedDateForEdit,
                time: eventToDelete.time,
                remainingTimes: remainingTimesForDate.length,
                affectedOtherDates: false,
                updateType: 'single-override-only',
                deletedFromDatabase: !!(userId && goalId && eventToDelete.source === 'override')
              });
            }
          }
        }
      ]
    );
  }, [selectedDateForEdit, calendarEvents, onCalendarEventsChange, includeDates, excludeDates, onIncludeExcludeChange, userId, goalId]);

  // 🔄 VISIBLE TIMES ONLY: Get times summary based on what's actually visible in calendar (scheduled dates only)
  const getCalendarEventSummaryForWeekday = useCallback((weekdayIndex: number) => {
    if (!startDate || !endDate) return { weeklyTimes: [], overrideTimes: [], allTimes: [] };
    
    const weeklyTimes: string[] = [];
    const overrideTimes: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Only process dates that are actually scheduled (isScheduled = true)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === weekdayIndex) {
        const dateStr = getLocalYMD(d);
        
        // 🔄 SCHEDULE CHECK: Only include times from dates that are actually scheduled
        const inRange = dateStr >= (startDate || today) && dateStr <= endDate;
        const baseIncluded = inRange && selectedWeekdays.has(weekdayIndex);
        const isScheduled = inRange && ((baseIncluded && !excludeDates.includes(dateStr)) || includeDates.includes(dateStr));
        
        // Skip this date if it's not scheduled
        if (!isScheduled) continue;
        
        // Get events for this scheduled date
        const dayEvents = calendarEvents.filter(e => e.date === dateStr);
        dayEvents.forEach(event => {
          if (event.time) {
            if (event.source === 'weekly' && !weeklyTimes.includes(event.time)) {
              weeklyTimes.push(event.time);
            } else if (event.source === 'override' && !overrideTimes.includes(event.time)) {
              overrideTimes.push(event.time);
            }
          }
        });
      }
    }
    
    const allTimes = [...new Set([...weeklyTimes, ...overrideTimes])].sort();
    return { 
      weeklyTimes: weeklyTimes.sort(), 
      overrideTimes: overrideTimes.sort(), 
      allTimes 
    };
  }, [startDate, endDate, selectedWeekdays, excludeDates, includeDates, calendarEvents, today]);

  // Smart Weekly Schedule Display Update - ONLY for UI display, preserves original weekly pattern
  const updateWeeklyScheduleFromCalendar = useCallback(() => {
    log('updateWeeklyScheduleFromCalendar entry:', { startDate, endDate, hasCallback: !!onWeeklyScheduleChange });
    if (!startDate || !endDate || !onWeeklyScheduleChange) return;
    
    // 🔄 CALENDAR-BASED DISPLAY: Only show times from visible scheduled dates
    const visibleWeekdays = new Set<number>();
    const visibleTimeSettings: { [key: number]: string[] } = {};
    
    // Build display based on what's actually visible in calendar
    for (let weekday = 0; weekday < 7; weekday++) {
      const { allTimes } = getCalendarEventSummaryForWeekday(weekday);
      if (allTimes.length > 0) {
        visibleWeekdays.add(weekday);
        visibleTimeSettings[weekday] = allTimes;
      }
    }
    
    // Check for actual display changes to prevent unnecessary updates
    const hasDisplayChanges = 
      visibleWeekdays.size !== selectedWeekdays.size ||
      Array.from(visibleWeekdays).some(weekday => !selectedWeekdays.has(weekday)) ||
      Array.from(selectedWeekdays).some(weekday => !visibleWeekdays.has(weekday)) ||
      Array.from(visibleWeekdays).some(weekday => {
        const currentTimes = weeklyTimeSettings[weekday] || [];
        const newVisibleTimes = visibleTimeSettings[weekday] || [];
        return currentTimes.length !== newVisibleTimes.length || 
          currentTimes.some((time, i) => time !== newVisibleTimes[i]);
      });
    
    if (hasDisplayChanges) {
      // 🔄 DISPLAY UPDATE: Only update what's shown in UI
      setSelectedWeekdays(visibleWeekdays);
      setWeeklyTimeSettings(visibleTimeSettings);
      onWeeklyScheduleChange?.(visibleWeekdays, visibleTimeSettings);
      
      if (__DEV__) {
        console.log('[SimpleDatePicker] Updated Weekly Schedule display based on visible calendar times:', {
          visibleWeekdays: Array.from(visibleWeekdays),
          visibleTimeSettings,
          totalVisibleDays: visibleWeekdays.size
        });
      }
    }
    log('updateWeeklyScheduleFromCalendar exit:', { hasDisplayChanges, visibleWeekdaysCount: visibleWeekdays.size });
  }, [startDate, endDate, selectedWeekdays, weeklyTimeSettings, onWeeklyScheduleChange, getCalendarEventSummaryForWeekday]);

  // 🔄 AUTO-UPDATE SUMMARY: Update Weekly Schedule summary when calendarEvents change
  // Prevent infinite loop by using ref for last processed events
  const lastProcessedEventsRef = useRef<string>('');
  useEffect(() => {
    if (calendarEvents.length > 0 && startDate && endDate) {
      // Check if calendarEvents actually changed to prevent infinite loops
      const currentEventsHash = JSON.stringify(calendarEvents.map(e => `${e.date}_${e.time}_${e.source}`).sort());
      if (currentEventsHash !== lastProcessedEventsRef.current) {
        lastProcessedEventsRef.current = currentEventsHash;
        
        // Automatically update the weekly schedule display based on calendar events
        // This ensures the summary stays in sync with calendar changes
        // Use immediate update to prevent UI jitter
        updateWeeklyScheduleFromCalendar();
        
        if (__DEV__) {
          console.log('[SimpleDatePicker] Auto-updating Weekly Schedule summary based on calendarEvents:', {
            eventsCount: calendarEvents.length,
            weeklyEvents: calendarEvents.filter(e => e.source === 'weekly').length,
            overrideEvents: calendarEvents.filter(e => e.source === 'override').length
          });
        }
      }
    }
  }, [calendarEvents, startDate, endDate]);

  const clearWeeklySchedule = useCallback(() => {
    if (__DEV__) console.log('[WeeklySchedule] Clearing all weekly schedule data');
    
    // Clear weekly schedule
    setSelectedWeekdays(new Set());
    setWeeklyTimeSettings({});
    
    // 🗓️ SYNC CALENDAR: Clear all calendar schedules within the range
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // 🔧 IMMUTABLE PATTERN: 불변 방식으로 exclude 날짜 수집
      const explicitExcludes: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ds = d.toISOString().split('T')[0];
        if (!explicitExcludes.includes(ds)) {
          // 배열에 바로 push하지만 이는 새로 만든 로컬 배열이므로 허용
          explicitExcludes.push(ds);
        }
      }
      
      // Clear include dates and add all dates to exclude
      setIncludeDates([]);
      setExcludeDates(explicitExcludes);
      onIncludeExcludeChange?.([], explicitExcludes);
      
      console.log(`[Calendar] Cleared all calendar schedules, added ${explicitExcludes.length} explicit excludes`);
    } else {
      // No date range defined, just clear include dates
      setIncludeDates([]);
      onIncludeExcludeChange?.([], excludeDates);
      console.log('[Calendar] Cleared include dates (no date range defined)');
    }
    
    // 🗓️ SYNC CALENDAR EVENTS: Update calendar events after clearing
    setTimeout(() => syncWeeklyScheduleToCalendar(), 100);
  }, [startDate, endDate, excludeDates, onIncludeExcludeChange, syncWeeklyScheduleToCalendar]);

  const calendarDays = generateCalendarDays();

  // Generate verification note based on GoalSpec
  const generateVerificationNote = (): string => {
    if (!goalSpec?.verification) return '';

    const mandatory = goalSpec.verification.mandatory || [];
    const constraints = goalSpec.verification.constraints || {};
    const methods = verificationMethods || [];
    
    // Determine place label (no hard-coded "gym" or venue names)
    const placeLabel = constraints.location?.name 
                      ?? targetLocation?.name 
                      ?? "the selected place";

    const lines: string[] = [];

    // 1) Location verification
    if (mandatory.includes('location')) {
      const radiusM = constraints.location?.radiusM || 100;
      const minDwellMin = constraints.location?.minDwellMin || 10;
      
      let locationText = `During the scheduled times, you'll be verified by being at ${placeLabel}`;
      
      if (radiusM) {
        locationText += ` (within ~${radiusM} m)`;
      } else {
        locationText += ' (within the selected area)';
      }
      
      if (minDwellMin) {
        locationText += ` for at least ${minDwellMin} minutes.`;
      } else {
        locationText += ' for a short period.';
      }
      
      lines.push(locationText);
    }

    // 2) Photo verification  
    if (mandatory.includes('photo') || (methods.includes('photo' as any) && constraints.photo?.required)) {
      lines.push('During the scheduled times, upload a photo as proof to be counted.');
    }

    // 3) Screentime verification
    if (mandatory.includes('screentime')) {
      if (constraints.screentime?.bundleIds?.length) {
        const apps = constraints.screentime.bundleIds.join(', ');
        lines.push(`During the scheduled times, usage of these apps will be verified: ${apps}.`);
      } else {
        lines.push('During the scheduled times, your app usage will be verified.');
      }
    }

    // 4) Time reminder (append-only, not primary proof)
    if (methods.includes('time' as any)) {
      lines.push('Times act as reminders; verification relies on your selected proof methods.');
    }

    // 5) Manual insufficient warning
    if (methods.includes('manual' as any) && 
        !methods.some(m => ['location', 'photo', 'screentime'].includes(m))) {
      lines.push('Manual check-in alone is not sufficient for objective verification.');
    }

    return lines.join('\n');
  };

  // Verification Methods (bottom section)
  const allMethods: VerificationType[] = ['location', 'time', 'screentime', 'photo', 'manual'];
  const toggleMethod = (method: VerificationType) => {
    if (lockedVerificationMethods?.includes(method)) {
      return; // locked methods cannot be toggled off
    }
    const set = new Set(verificationMethods);
    if (set.has(method)) set.delete(method); else set.add(method);
    onVerificationMethodsChange?.(Array.from(set));
  };

  return (
    <View className="bg-white rounded-lg p-4 mx-0 my-4">
      {/* Goal Title (from AI Assistant) */}
      {(!!goalTitle || !!goalRawText) && (
        <View className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <Text className="text-blue-800 text-sm font-semibold">Goal</Text>
          {!!goalTitle && (
            <Text className="text-blue-900 text-base mt-1">{goalTitle}</Text>
          )}
          {!!goalRawText && (
            <Text className="text-blue-800 text-xs mt-2">Original Input</Text>
          )}
          {!!goalRawText && (
            <Text className="text-blue-900 text-sm mt-1">{goalRawText}</Text>
          )}
        </View>
      )}
      {/* Header */}
      <View className="mb-6">
        <Text className="text-2xl font-bold text-gray-800 text-center">Schedule</Text>
        <Text className="text-gray-600 text-center mt-2">Set your goal duration and schedule</Text>
      </View>

      {/* Duration Controls */}
      <View className="mb-6 p-4 bg-blue-50 rounded-lg">
        <Text className="text-blue-800 font-semibold text-lg mb-3">Duration</Text>
        <View className="flex-row items-center space-x-3">
          <TextInput
            className="bg-white border border-blue-300 rounded-lg px-4 text-center w-28 text-lg h-12"
            value={durationValue}
            onChangeText={handleDurationChange}
            keyboardType="number-pad"
            placeholder="1"
            maxLength={3}
          />
          <View className="flex-row space-x-2 items-center">
            {(['days', 'weeks', 'months'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                className={`h-12 px-4 rounded-lg items-center justify-center ${durationType === type ? 'bg-blue-600' : 'bg-white border border-blue-300'}`}
                onPress={() => handleDurationTypeChange(type)}
              >
                <Text className={`text-base font-semibold ${durationType === type ? 'text-white' : 'text-blue-600'}`}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {endDate && (
          <Text className="text-blue-700 text-base mt-3">Will end on: {new Date(endDate).toLocaleDateString()}</Text>
        )}
      </View>

      {/* Weekly Schedule - compact, supports multiple times */}
      <View className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
        <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
            <Ionicons name="calendar" size={20} color="#059669" />
            <Text className="text-lg font-semibold text-gray-800 ml-2">Weekly Schedule</Text>
          </View>
          {isEditingWeeklySchedule ? (
            <TouchableOpacity onPress={() => setIsEditingWeeklySchedule(false)} className="px-3 py-1 bg-green-600 rounded-full">
              <Text className="text-white text-sm font-semibold">Confirm</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setIsEditingWeeklySchedule(true)} className="px-3 py-1 bg-blue-600 rounded-full">
              <Text className="text-white text-sm font-semibold">Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Weekly window information and count rule */}
        {goalSpec?.schedule && (
          <View className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            {/* Count rule display */}
            {goalSpec.schedule.countRule && (
              <View className="mb-2">
                <Text className="text-blue-800 font-medium text-sm">
                  Goal: {goalSpec.schedule.countRule.operator} {goalSpec.schedule.countRule.count} times per week
                </Text>
              </View>
            )}
            
            {/* Weekly window boundary information */}
            {goalSpec.schedule.weekBoundary && (
              <View className="mb-2">
                <Text className="text-blue-700 text-sm">
                  {goalSpec.schedule.weekBoundary === 'startWeekday' 
                    ? `Weekly windows run from your start date to the following ${new Date(startDate).toLocaleDateString('en-US', { weekday: 'long' })}.`
                    : 'Weekly windows follow ISO standard (Monday to Sunday).'
                  }
                </Text>
              </View>
            )}
            
            {/* Partial week handling note */}
            {goalSpec.schedule.enforcePartialWeeks === false && (
              <Text className="text-blue-600 text-xs italic">
                Partial weeks do not enforce the weekly minimum; tracking starts from the first full week.
              </Text>
            )}
          </View>
        )}

        {isEditingWeeklySchedule ? (
            <View>
            {/* Day selector chips */}
            <View className="flex-row flex-wrap gap-2 mb-3">
              {dayShort.map((d, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => toggleWeekday(idx)}
                    className={`px-4 py-2 rounded-full border ${selectedWeekdays.has(idx) ? 'bg-green-100 border-green-400' : 'bg-white border-gray-300'}`}
                >
                  <Text className={`${selectedWeekdays.has(idx) ? 'text-green-700 font-semibold' : 'text-gray-700'}`}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Times per selected day */}
            {Array.from(selectedWeekdays).sort().map((dayIdx) => {
              const weeklyTimes = weeklyTimeSettings[dayIdx] || [];
              // 🔄 CALENDAR EVENTS BASED SUMMARY: Get times from CalendarEvents instead of local state
              const { weeklyTimes: eventWeeklyTimes, overrideTimes, allTimes } = getCalendarEventSummaryForWeekday(dayIdx);
              
              return (
                <View key={dayIdx} className="mb-3 p-3 bg-gray-50 rounded-lg">
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                      <Text className="text-gray-800 font-medium">{dayShort[dayIdx]}</Text>
                      <View className="ml-2 px-2 py-1 bg-blue-100 rounded-full">
                        <Text className="text-blue-700 text-xs font-medium">
                          {allTimes.length} time{allTimes.length > 1 ? 's' : ''}
                        </Text>
                      </View>
                      {overrideTimes.length > 0 && (
                        <View className="ml-1 px-2 py-1 bg-orange-100 rounded-full">
                          <Text className="text-orange-700 text-xs font-medium">
                            {overrideTimes.length} override{overrideTimes.length > 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => openAddTimeModal(dayIdx)} className="px-3 py-1 bg-blue-100 rounded">
                      <Text className="text-blue-700 text-xs font-semibold">Add time</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Basic Pattern Times */}
                  {eventWeeklyTimes.length > 0 && (
                    <View className="mb-2">
                      <Text className="text-xs text-gray-600 mb-1">Basic Pattern:</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {eventWeeklyTimes.map((t, i) => (
                          <View key={`${dayIdx}_weekly_${t}_${i}`} className="flex-row items-center bg-blue-100 px-3 py-1 rounded-full border border-blue-200">
                            <TouchableOpacity onPress={() => {
                              // 🔄 PREVENT WEEKLY SCHEDULE MODIFICATION: Use long-press for time editing instead
                              Alert.alert(
                                'Edit Time', 
                                'To edit specific times, long-press on dates in the calendar below. This preserves your original weekly schedule.',
                                [{ text: 'OK' }]
                              );
                            }}>
                              <Text className="text-blue-800 font-medium mr-1">{t}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => {
                              // 🔄 PREVENT WEEKLY SCHEDULE MODIFICATION: Only allow removal from original weekly times
                              const weeklyIndex = weeklyTimes.indexOf(t);
                              if (weeklyIndex !== -1 && weeklyTimes.includes(t)) {
                                removeTime(dayIdx, weeklyIndex);
                              } else {
                                Alert.alert(
                                  'Basic Pattern Time', 
                                  'This time is part of the basic weekly pattern. Edit the weekly schedule above to modify it.',
                                  [{ text: 'OK' }]
                                );
                              }
                            }}>
                              <Ionicons name="close" size={14} color="#1e40af" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  
                  {/* Override Times */}
                  {overrideTimes.length > 0 && (
                    <View className="mb-2">
                      <Text className="text-xs text-gray-600 mb-1">Override Times:</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {overrideTimes.map((t, i) => (
                          <View key={`${dayIdx}_override_${t}_${i}`} className="flex-row items-center bg-orange-100 px-3 py-1 rounded-full border border-orange-200">
                            <Text className="text-orange-800 font-medium mr-1">{t}</Text>
                            <View className="ml-1 px-1 bg-orange-200 rounded">
                              <Text className="text-orange-800 text-xs font-bold">!</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                      <Text className="text-xs text-gray-500 mt-1">
                        Override times added via calendar long-press
                      </Text>
                    </View>
                  )}
                  
                  {/* No times message */}
                  {allTimes.length === 0 && (
                    <Text className="text-gray-500 text-xs">No times scheduled</Text>
                  )}
                </View>
              );
            })}

            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity onPress={clearWeeklySchedule} className="flex-1 bg-gray-500 px-4 py-3 rounded-lg">
                <Text className="text-white font-medium text-center">Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Display mode - summarized with CalendarEvent-based data
          <View>
            {selectedWeekdays.size > 0 ? (
              <View className="gap-2">
                {Array.from(selectedWeekdays).sort().map((dayIdx) => {
                  // 🔄 CALENDAR EVENTS BASED SUMMARY: Get times from CalendarEvents instead of local state
                  const { weeklyTimes: eventWeeklyTimes, overrideTimes, allTimes } = getCalendarEventSummaryForWeekday(dayIdx);
                  
                  return (
                    <View key={dayIdx} className="flex-row items-start">
                      <View className="w-12 flex-row items-center">
                        <Text className="text-gray-800 font-medium">{dayShort[dayIdx]}</Text>
                        {overrideTimes.length > 0 && (
                          <View className="ml-1 w-2 h-2 bg-orange-400 rounded-full"></View>
                        )}
                      </View>
                      <View className="flex-1">
                        {/* Basic Pattern Times */}
                        {eventWeeklyTimes.length > 0 && (
                          <View className="flex-row flex-wrap gap-2 mb-2">
                            {eventWeeklyTimes.map((t, i) => (
                              <View key={`${dayIdx}_display_weekly_${t}_${i}`} className="bg-blue-100 px-3 py-1 rounded-full border border-blue-200">
                                <Text className="text-blue-800 font-medium text-sm">{t}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        
                        {/* Override Times with badge */}
                        {overrideTimes.length > 0 && (
                          <View className="flex-row flex-wrap gap-2 mb-2">
                            {overrideTimes.map((t, i) => (
                              <View key={`${dayIdx}_display_override_${t}_${i}`} className="bg-orange-100 px-3 py-1 rounded-full border border-orange-200">
                                <View className="flex-row items-center">
                                  <Text className="text-orange-800 font-medium text-sm mr-1">{t}</Text>
                                  <View className="w-1 h-1 bg-orange-500 rounded-full"></View>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                        
                        {/* No times message */}
                        {allTimes.length === 0 && (
                          <Text className="text-gray-500 text-xs">No times added</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="bg-gray-50 rounded-lg p-4">
                <Text className="text-gray-600 text-center">No weekly schedule set</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* How verification works - English only note */}
      {(() => {
        const verificationNote = generateVerificationNote();
        if (!verificationNote) return null;
        
        return (
          <View className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <Text className="text-gray-700 font-semibold text-sm mb-2">How verification works</Text>
            <Text className="text-gray-600 text-xs leading-4" style={{ lineHeight: 16 }}>
              {verificationNote}
            </Text>
          </View>
        );
      })()}

      {/* Calendar */}
      <View className="mb-6" style={{ height: VIEWPORT_HEIGHT }}>
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
          onScroll={(e) => updateHeaderForScroll(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        >
        {monthsInView.map((m, idx) => {
          const monthKey = `${m.getFullYear()}-${m.getMonth()}`;
          const days = generateCalendarDaysFor(m);
          return (
            <View
              key={monthKey}
              onLayout={(e) => onMonthLayout(idx, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
            >
              <View className="flex-row flex-wrap">
                {days.map((dayData: any, index: number) => (
                  <View key={index} className="w-[14.28%] p-1" style={{ aspectRatio: 1 }}>
                    {dayData ? (
                      <TouchableOpacity
                        className={`flex-1 justify-center items-center rounded relative ${
                          dayData.isPast ? 'bg-gray-100' :
                          editingMode === 'schedule' && dayData.isScheduled ? 'bg-green-200' :
                          dayData.isSelected ? 'bg-blue-600' :
                          dayData.isInRange ? 'bg-blue-100' :
                          dayData.isToday ? 'bg-blue-50' :
                          'bg-gray-50'
                        }`}
                        onPress={() => handleDateSelect(dayData.dateStr)}
                        onLongPress={() => {
                          if (!dayData.isPast && dayData.dateStr && onCalendarEventsChange) {
                            // Open time edit modal for this date
                            handleDateLongPress(dayData.dateStr);
                          }
                        }}
                        delayLongPress={500}
                        disabled={dayData.isPast}
                      >
                        <Text className={`text-sm font-semibold ${
                          dayData.isPast ? 'text-gray-400' :
                          editingMode === 'schedule' && dayData.isScheduled ? 'text-green-900' :
                          dayData.isSelected ? 'text-white' :
                          dayData.isInRange ? 'text-blue-600' :
                          dayData.isToday ? 'text-blue-800' :
                          'text-gray-800'
                        }`}>{dayData.day}</Text>
                        
                        {/* Display single time from calendar events */}
                        {dayData.times && dayData.times.length > 0 && (
                          <View className="mt-1 px-1">
                            <Text className="text-xs text-green-600 text-center leading-3 font-medium">
                              {dayData.times[0]}
                            </Text>
                          </View>
                        )}
                        
                        {editingMode !== 'schedule' && dayData.isScheduled && (
                          <View className="absolute -bottom-1 w-2 h-2 bg-green-500 rounded-full" />
                        )}
                        {dayData.isToday && (
                          <View pointerEvents="none" className="absolute inset-0 rounded border-2 border-blue-600" />
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View className="flex-1" />
                    )}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
        </ScrollView>
      </View>

      {/* Calendar Legend */}
          <View className="flex-row justify-center space-x-6 mt-3">
          <View className="flex-row items-center">
            <View className="w-3 h-3 bg-blue-600 rounded mr-2" />
            <Text className="text-xs text-gray-600">Selected range</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
            <Text className="text-xs text-gray-600">Scheduled weekdays</Text>
          </View>
        </View>

        {/* Mode toggles under calendar */}
        <View className="flex-row gap-3 mt-4">
          <TouchableOpacity
            onPress={() => setEditingMode('period')}
            className={`flex-1 rounded-lg py-3 ${editingMode === 'period' ? 'bg-blue-600' : 'bg-blue-100'}`}
          >
            <Text className={`text-center font-semibold ${editingMode === 'period' ? 'text-white' : 'text-blue-700'}`}>Edit Period</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setEditingMode('schedule')}
            disabled={selectedWeekdays.size === 0}
            className={`flex-1 rounded-lg py-3 ${selectedWeekdays.size === 0 ? 'bg-gray-200' : (editingMode === 'schedule' ? 'bg-green-600' : 'bg-green-100')}`}
          >
            <Text className={`text-center font-semibold ${editingMode === 'schedule' ? 'text-white' : 'text-green-700'}`}>Edit Schedule</Text>
          </TouchableOpacity>
        </View>

      {/* Selected Summary */}
      {startDate && (
        <View className="mb-6 p-4 bg-gray-50 rounded-lg">
          <Text className="text-gray-700 font-semibold text-lg mb-2">Selected:</Text>
          <Text className="text-gray-600 text-base">Start: {new Date(startDate).toLocaleDateString()}</Text>
          {endDate && (
            <Text className="text-gray-600 text-base">End: {new Date(endDate).toLocaleDateString()}</Text>
          )}
        </View>
      )}

      {/* Verification Methods */}
      <View className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
        <Text className="text-gray-800 font-semibold text-lg mb-3">Verification Methods</Text>
        <View className="flex-row flex-wrap gap-2">
          {allMethods.map((m) => {
            const selected = verificationMethods?.includes(m);
            const locked = lockedVerificationMethods?.includes(m);
            return (
              <TouchableOpacity
                key={m}
                onPress={() => toggleMethod(m)}
                disabled={locked}
                className={`px-3 py-2 rounded-full border flex-row items-center ${
                  locked ? 'bg-blue-800 border-blue-800' : (selected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300')
                }`}
                activeOpacity={0.8}
              >
                {locked && (
                  <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
                )}
                <Text className={`${selected || locked ? 'text-white' : 'text-gray-700'} font-medium ${locked ? 'ml-1' : ''}`}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text className="text-xs text-gray-500 mt-2">Select one or more methods to verify your progress. AI-selected methods are locked.</Text>

        {/* Dynamic automation summary based on weekly schedule and selected methods */}
        {selectedWeekdays.size > 0 && (
          <View className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
            {(() => {
              const selected = new Set(verificationMethods || []);
              const hasTimeMethod = selected.has('time' as any);
              const hasManualMethod = selected.has('manual' as any);
              const hasLocationMethod = selected.has('location' as any);
              const hasPhotoMethod = selected.has('photo' as any);
              const hasScreenTimeMethod = selected.has('screentime' as any);

              const selectedDays = Array.from(selectedWeekdays).sort();
              const daysWithTimes = selectedDays.filter(d => (weeklyTimeSettings?.[d] || []).length > 0);
              const daysWithoutTimes = selectedDays.filter(d => !(weeklyTimeSettings?.[d]) || (weeklyTimeSettings?.[d] || []).length === 0);
              const hasAnyTimes = daysWithTimes.length > 0;
              const hasDayWithoutTimes = daysWithoutTimes.length > 0;

              const formatDay = (idx: number) => dayShort[idx];
              const sampleSlots: string[] = [];
              daysWithTimes.forEach(d => {
                (weeklyTimeSettings?.[d] || []).forEach(t => {
                  if (sampleSlots.length < 6) sampleSlots.push(`${formatDay(d)} ${t}`);
                });
              });

              const bullets: string[] = [];
              if (hasAnyTimes && hasTimeMethod) {
                const slotPreview = sampleSlots.length > 0 ? ` (e.g., ${sampleSlots.join(', ')}${sampleSlots.length >= 6 ? '…' : ''})` : '';
                const extras: string[] = [];
                if (hasLocationMethod) extras.push('Location');
                if (hasPhotoMethod) extras.push('Photo');
                if (hasScreenTimeMethod) extras.push('Screen Time');
                // Do not include Manual here; manual is covered for days without times below
                if (extras.length > 0) {
                  bullets.push(`At scheduled times${slotPreview}: ${extras.join(' + ')} verification will run automatically.`);
                } else {
                  bullets.push(`At scheduled times${slotPreview}: Time-based verification will run.`);
                }
              }

              if (hasDayWithoutTimes && hasManualMethod) {
                const dayList = daysWithoutTimes.map(formatDay).join(', ');
                bullets.push(`On selected days without times (${dayList}): Manual check-in is required.`);
              }

              if (bullets.length === 0) {
                // Generic fallback when no clear automation applies
                return (
                  <Text className="text-gray-600 text-xs">Configure times to enable automatic verifications on those slots.</Text>
                );
              }

              return bullets.map((line, idx) => (
                <View key={idx} className="flex-row items-start mb-1">
                  <Text className="text-gray-500 text-xs mr-1">•</Text>
                  <Text className="text-gray-700 text-xs flex-1">{line}</Text>
                </View>
              ));
            })()}
          </View>
        )}

        {/* AI Success Criteria */}
        {!!aiSuccessCriteria && (
          <View className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <Text className="text-blue-800 text-xs">{aiSuccessCriteria}</Text>
          </View>
        )}

        {/* Blocking reasons banner */}
        {blockingReasons.length > 0 && (
          <View className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            {blockingReasons.map((r, i) => (
              <Text key={i} className="text-yellow-800 text-xs">• {r}</Text>
            ))}
          </View>
        )}

        {/* Calendar */}
        <View className="mb-6">
          {/* Calendar header */}
          <View className="mb-4">
            <Text className="text-lg font-semibold text-gray-800 mb-2">Calendar</Text>
            <View className="flex-row space-x-2 mb-4">
              <TouchableOpacity
                onPress={() => setEditingMode('period')}
                className={`px-4 py-2 rounded-lg ${editingMode === 'period' ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <Text className={`font-medium ${editingMode === 'period' ? 'text-white' : 'text-gray-700'}`}>
                  Edit Period
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEditingMode('schedule')}
                className={`px-4 py-2 rounded-lg ${editingMode === 'schedule' ? 'bg-green-600' : 'bg-gray-200'}`}
              >
                <Text className={`font-medium ${editingMode === 'schedule' ? 'text-white' : 'text-gray-700'}`}>
                  Edit Schedule
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Calendar grid */}
          {(() => {
            const currentDisplayMonth = new Date();
            const year = currentDisplayMonth.getFullYear();
            const month = currentDisplayMonth.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startingDay = firstDay.getDay();
            const days: any[] = [];

            // Add empty cells for days before the first day
            for (let i = 0; i < startingDay; i++) days.push(null);

            // Add actual days
            for (let day = 1; day <= lastDay.getDate(); day++) {
              const dateStr = getLocalYMD(new Date(year, month, day));
              const inRange = !!(endDate && dateStr >= (startDate || today) && dateStr <= endDate);
              const times = getTimesForDate(dateStr);
              const isScheduled = isDateScheduled(dateStr);
              
              days.push({
                day,
                dateStr,
                isToday: dateStr === today,
                isPast: dateStr < today,
                isSelected: dateStr === startDate || (endDate && dateStr === endDate),
                isInRange: inRange,
                isScheduled,
                times: times
              });
            }

            return (
              <View>
                {/* Day headers */}
                <View className="flex-row mb-2">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => (
                    <View key={day} className="flex-1">
                      <Text className="text-center text-sm font-semibold text-gray-600">{day}</Text>
                    </View>
                  ))}
                </View>
                
                {/* Calendar grid */}
                <View className="flex-row flex-wrap">
                  {days.map((dayData: any, index: number) => (
                    <View key={index} className="w-[14.28%] p-1" style={{ aspectRatio: 1 }}>
                      {dayData ? (
                        <TouchableOpacity
                            className={`flex-1 justify-between items-center rounded relative py-1 ${
                              dayData.isPast ? 'bg-gray-100' :
                              editingMode === 'schedule' && dayData.isScheduled ? 'bg-green-200' :
                              dayData.isSelected ? 'bg-blue-600' :
                              dayData.isInRange ? 'bg-blue-100' :
                              dayData.isToday ? 'bg-blue-50' :
                              'bg-gray-50'
                            }`}
                            onPress={() => handleDateSelect(dayData.dateStr)}
                            onLongPress={() => handleDateLongPress(dayData.dateStr)}
                            delayLongPress={400}
                            disabled={dayData.isPast}
                          >
                            <Text className={`text-sm font-semibold ${
                              dayData.isPast ? 'text-gray-400' :
                              editingMode === 'schedule' && dayData.isScheduled ? 'text-green-900' :
                              dayData.isSelected ? 'text-white' :
                              dayData.isInRange ? 'text-blue-600' :
                              dayData.isToday ? 'text-blue-800' :
                              'text-gray-800'
                            }`}>{dayData.day}</Text>
                            
                            {/* Time display */}
                            {dayData.times && dayData.times.length > 0 && (
                              <Text className={`text-xs font-medium ${
                                dayData.isPast ? 'text-gray-400' :
                                editingMode === 'schedule' && dayData.isScheduled ? 'text-green-700' :
                                dayData.isSelected ? 'text-white' :
                                dayData.isInRange ? 'text-green-600' :
                                dayData.isToday ? 'text-green-700' :
                                'text-green-600'
                              }`}>
                                {dayData.times[0]}
                              </Text>
                            )}
                            
                            {dayData.isToday && (
                              <View pointerEvents="none" className="absolute inset-0 rounded border-2 border-blue-600" />
                            )}
                          </TouchableOpacity>
                      ) : (
                        <View className="flex-1" />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}
        </View>

        {/* Target Location selection (when Location method selected) */}
        {(verificationMethods || []).includes('location' as any) && (
          <View className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
            <Text className="text-gray-800 font-semibold mb-2">Target Location</Text>
            {targetLocation ? (
              <View>
                <Text className="text-gray-800 text-sm">{targetLocation.name}</Text>
                {!!targetLocation.address && (
                  <Text className="text-gray-600 text-xs mt-1">{targetLocation.address}</Text>
                )}
                {/* Mini map preview */}
                <View className="h-32 bg-gray-100 rounded-lg overflow-hidden mt-2">
                  <MapPreview location={targetLocation as any} onPress={onOpenLocationPicker || (() => {})} />
                </View>
              </View>
            ) : (
              <Text className="text-gray-500 text-xs mb-2">Not set</Text>
            )}
            <View className="flex-row space-x-3 mt-2">
              <TouchableOpacity onPress={onOpenLocationPicker} className="flex-1 bg-blue-600 rounded-lg py-2">
                <Text className="text-white text-center text-sm font-semibold">Select Location</Text>
              </TouchableOpacity>
              {!!onUseCurrentLocation && (
                <TouchableOpacity onPress={onUseCurrentLocation} className="flex-1 bg-green-600 rounded-lg py-2">
                  <Text className="text-white text-center text-sm font-semibold">Use Current</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

      </View>

      {/* Validation Error Banner */}
      {validationResult && !validationResult.isCompatible && validationResult.issues.length > 0 && (
        <View className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
          <View className="flex-row items-center mb-3">
            <Ionicons name="warning" size={20} color="#DC2626" />
            <Text className="text-red-800 font-semibold ml-2 text-base">Schedule Requirements Not Met</Text>
          </View>
          <View className="ml-1">
            {validationResult.issues.map((issue, index) => (
              <Text key={index} className="text-red-700 text-sm mb-2 leading-5">
                • {issue}
              </Text>
            ))}
          </View>
          <View className="mt-2 pt-2 border-t border-red-200">
            <Text className="text-red-600 text-xs font-medium">
              💡 Tip: Add more scheduled times or adjust your goal requirements to proceed.
            </Text>
          </View>
        </View>
      )}

      {/* Navigation Buttons */}
      <View className="flex-row space-x-3">
        <TouchableOpacity onPress={() => onNavigateToStep(0)} className="flex-1 bg-gray-200 rounded-lg py-3 flex-row items-center justify-center">
          <Ionicons name="chevron-back" size={16} color="#6B7280" />
          <Text className="text-gray-700 font-semibold ml-2">Back</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          testID="next-button"
          onPress={() => {
            if (onRequestNext) {
              onRequestNext(); // Always use validation path when available
            } else {
              onNavigateToStep(2); // Fallback only when no validation handler
            }
          }}
          className={`flex-1 rounded-lg py-3 flex-row items-center justify-center ${
            (!startDate || loading || (validationResult ? !validationResult.isCompatible : false)) 
              ? 'bg-gray-400' 
              : 'bg-blue-600'
          }`}
          disabled={!startDate || loading || (validationResult ? !validationResult.isCompatible : false)}
        >
          <Text className={`font-semibold mr-2 ${
            (!startDate || loading || (validationResult ? !validationResult.isCompatible : false)) 
              ? 'text-gray-600' 
              : 'text-white'
          }`}>
            {loading ? 'Validating...' : 
             (!startDate ? 'Select Date' :
              (validationResult && !validationResult.isCompatible ? 'Fix Issues' : 
               (onRequestNext ? 'Next' : 'Continue')))}
          </Text>
          {loading ? (
            <ActivityIndicator size="small" color="#6B7280" />
          ) : (
            <Ionicons 
              name={validationResult && !validationResult.isCompatible ? "warning" : "chevron-forward"} 
              size={16} 
              color={(!startDate || loading || (validationResult ? !validationResult.isCompatible : false)) ? '#6B7280' : 'white'} 
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <View className="flex-1 justify-end">
          <View className="bg-white mx-6 mb-10 rounded-2xl p-4 shadow-lg border border-gray-200">
            <Text className="text-center text-lg font-semibold text-gray-800 mb-3">{editingTimeIndex === -1 ? 'Add Time' : 'Edit Time'}</Text>
            <View className="flex-row items-start justify-center gap-6">
              {/* Hour Picker (00-23) */}
              <View>
                <Text className="text-center text-xs text-gray-500 mb-1">Hour</Text>
                <View className="rounded-lg border border-gray-200 overflow-hidden" style={{ width: 120 }}>
                  <Picker
                    selectedValue={editingTimeHour}
                    onValueChange={(v) => setEditingTimeHour(String(v).padStart(2, '0'))}
                    style={{ height: 150 }}
                  >
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                      <Picker.Item key={h} label={h} value={h} />
                    ))}
                  </Picker>
                </View>
              </View>
              {/* Minute Picker (00-59) */}
              <View>
                <Text className="text-center text-xs text-gray-500 mb-1">Minute</Text>
                <View className="rounded-lg border border-gray-200 overflow-hidden" style={{ width: 120 }}>
                  <Picker
                    selectedValue={editingTimeMinute}
                    onValueChange={(v) => setEditingTimeMinute(String(v).padStart(2, '0'))}
                    style={{ height: 150 }}
                  >
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                      <Picker.Item key={m} label={m} value={m} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
            <View className="flex-row space-x-3 mt-4">
              <TouchableOpacity onPress={() => setShowTimePicker(false)} className="flex-1 bg-gray-200 rounded-lg py-3">
                <Text className="text-gray-700 font-medium text-center">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => saveTime()} className="flex-1 bg-blue-600 rounded-lg py-3">
                <Text className="text-white font-medium text-center">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Edit Modal for Long Press */}
      <Modal 
        visible={showDateEditModal} 
        transparent 
        animationType="fade" 
        onRequestClose={() => {
          setShowDateEditModal(false);
          setShowDateTimeInput(false);
          setDateEditTimeInput('');
          setEditingDateTimeIndex(-1);
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-lg p-6 mx-4 max-w-sm w-full">
            <Text className="text-lg font-bold text-gray-800 mb-4">
              Edit Times for {selectedDateForEdit}
            </Text>
            
            {/* Current single time display */}
            <View className="mb-4">
              {(() => {
                const dateEvents = selectedDateForEdit ? calendarEvents.filter(event => event.date === selectedDateForEdit) : [];
                const currentTime = dateEvents.length > 0 ? dateEvents[0] : null;
                
                if (currentTime) {
                  return (
                    <View className="flex-row items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
                      <View className="flex-1">
                        <Text className="text-gray-800 font-medium text-lg">{currentTime.time}</Text>
                        <Text className="text-xs text-gray-500 capitalize">Current scheduled time</Text>
                      </View>
                      
                      {/* Action buttons for the single time */}
                      <View className="flex-row space-x-2">
                        <TouchableOpacity 
                          onPress={() => handleEditTimeForDate(0)}
                          className="bg-blue-100 rounded px-3 py-2"
                        >
                          <Text className="text-blue-600 text-sm font-medium">Edit</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          onPress={() => handleDeleteTimeForDate(0)}
                          className="bg-red-100 rounded px-3 py-2"
                        >
                          <Text className="text-red-600 text-sm font-medium">Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                } else {
                  return (
                    <View className="text-center py-6 px-4 bg-gray-50 rounded-lg border border-gray-200">
                      <Text className="text-gray-500 text-center">No scheduled time for this date</Text>
                      <Text className="text-xs text-gray-400 text-center mt-1">Tap &quot;Add Time&quot; below to schedule</Text>
                    </View>
                  );
                }
              })()}
            </View>
            
            {/* Time input section */}
            {showDateTimeInput ? (
              <View className="border-t border-gray-200 pt-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">
                  {editingDateTimeIndex >= 0 ? 'Edit Time' : 'Add New Time'}
                </Text>
                
                <View className="flex-row justify-center space-x-4 mb-4">
                  {/* Hour Picker */}
                  <View className="items-center">
                    <Text className="text-xs text-gray-500 mb-1">Hour</Text>
                    <View className="border border-gray-300 rounded-lg overflow-hidden" style={{ width: 90, height: 120 }}>
                      <Picker
                        selectedValue={dateEditTimeInput.split(':')[0] || '09'}
                        onValueChange={(hour) => {
                          const minute = dateEditTimeInput.split(':')[1] || '00';
                          setDateEditTimeInput(`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
                        }}
                        style={{ height: 120, width: 90 }}
                        itemStyle={{ fontSize: 16, height: 120 }}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <Picker.Item 
                            key={i} 
                            label={i.toString().padStart(2, '0')} 
                            value={i.toString().padStart(2, '0')}
                            style={{ fontSize: 16 }}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>
                  
                  {/* Minute Picker */}
                  <View className="items-center">
                    <Text className="text-xs text-gray-500 mb-1">Minute</Text>
                    <View className="border border-gray-300 rounded-lg overflow-hidden" style={{ width: 90, height: 120 }}>
                      <Picker
                        selectedValue={dateEditTimeInput.split(':')[1] || '00'}
                        onValueChange={(minute) => {
                          const hour = dateEditTimeInput.split(':')[0] || '09';
                          setDateEditTimeInput(`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
                        }}
                        style={{ height: 120, width: 90 }}
                        itemStyle={{ fontSize: 16, height: 120 }}
                      >
                        {Array.from({ length: 60 }, (_, i) => (
                          <Picker.Item 
                            key={i} 
                            label={i.toString().padStart(2, '0')} 
                            value={i.toString().padStart(2, '0')}
                            style={{ fontSize: 16 }}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>
                </View>
                
                <View className="flex-row space-x-3">
                  <TouchableOpacity 
                    onPress={() => {
                      setShowDateTimeInput(false);
                      setDateEditTimeInput('');
                      setEditingDateTimeIndex(-1);
                    }}
                    className="flex-1 bg-gray-200 rounded-lg py-2"
                  >
                    <Text className="text-gray-700 font-medium text-center">Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={editingDateTimeIndex >= 0 ? handleUpdateTimeForDate : handleAddTimeToDate}
                    className="flex-1 bg-blue-600 rounded-lg py-2"
                  >
                    <Text className="text-white font-medium text-center">
                      {editingDateTimeIndex >= 0 ? 'Update' : 'Add'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Main action buttons */
              <View className="flex-row space-x-3">
                <TouchableOpacity 
                  onPress={() => setShowDateEditModal(false)}
                  className="flex-1 bg-gray-200 rounded-lg py-3"
                >
                  <Text className="text-gray-700 font-medium text-center">Close</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => {
                    const dateEvents = selectedDateForEdit ? calendarEvents.filter(event => event.date === selectedDateForEdit) : [];
                    const hasExistingTime = dateEvents.length > 0;
                    
                    if (hasExistingTime) {
                      // If there's already a time, enter edit mode for that time
                      setDateEditTimeInput(dateEvents[0].time || '09:00');
                      setEditingDateTimeIndex(0);
                    } else {
                      // If no time exists, add new time
                      setDateEditTimeInput('09:00');
                      setEditingDateTimeIndex(-1);
                    }
                    setShowDateTimeInput(true);
                  }}
                  className={`flex-1 rounded-lg py-3 ${
                    selectedDateForEdit && calendarEvents.filter(event => event.date === selectedDateForEdit).length > 0 
                      ? 'bg-blue-600' 
                      : 'bg-green-600'
                  }`}
                >
                  <Text className="text-white font-medium text-center">
                    {selectedDateForEdit && calendarEvents.filter(event => event.date === selectedDateForEdit).length > 0 
                      ? 'Change Time' 
                      : 'Set Time'
                    }
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <View className="flex-1 justify-center items-center">
          <View className="bg-white mx-6 rounded-xl p-4 shadow-2xl border border-gray-300 w-80" style={{ elevation: 8 }}>
            <Text className="text-center text-lg font-semibold text-gray-800 mb-3">{editingTimeIndex === -1 ? 'Add Time' : 'Edit Time'}</Text>
            <View className="flex-row items-start justify-center gap-6">
              {/* Hour Picker (00-23) */}
              <View>
                <Text className="text-center text-sm text-gray-600 mb-1 font-medium">Hour</Text>
                <View className="rounded-lg border border-gray-300 overflow-hidden" style={{ width: 120 }}>
                  <Picker
                    selectedValue={editingTimeHour}
                    onValueChange={(v) => setEditingTimeHour(String(v).padStart(2, '0'))}
                    style={{ height: 150 }}
                  >
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                      <Picker.Item key={h} label={h} value={h} />
                    ))}
                  </Picker>
                </View>
              </View>
              {/* Minute Picker (00-59) */}
              <View>
                <Text className="text-center text-sm text-gray-600 mb-1 font-medium">Minute</Text>
                <View className="rounded-lg border border-gray-300 overflow-hidden" style={{ width: 120 }}>
                  <Picker
                    selectedValue={editingTimeMinute}
                    onValueChange={(v) => setEditingTimeMinute(String(v).padStart(2, '0'))}
                    style={{ height: 150 }}
                  >
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                      <Picker.Item key={m} label={m} value={m} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
            <View className="flex-row space-x-3 mt-4">
              <TouchableOpacity onPress={() => setShowTimePicker(false)} className="flex-1 bg-gray-200 rounded-lg py-3">
                <Text className="text-gray-700 font-medium text-center">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => saveTime()} className="flex-1 bg-blue-600 rounded-lg py-3">
                <Text className="text-white font-medium text-center">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

