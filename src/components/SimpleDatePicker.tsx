/**
 * Simple Date Picker Component - Schedule Step with Calendar
 * 
 * 경계/정합성 규칙:
 * 1. 기간이 7일 미만이면 검증 스킵 (불완전 주만 존재)
 * 2. 중복 이벤트 카운트 정책: 동일 날짜·시간 다중 등록은 개수만큼 집계 (기본)
 * 3. 타임존: Asia/Seoul 고정, 날짜 문자열은 YYYY-MM-DD
 * 
 * QA: SimpleDatePicker
 * Manual Test Steps:
 * 1. Set range to include at least 3 full weeks
 * 2. Select Mon/Wed/Fri and set 09:00 as weekly time → all Mon/Wed/Fri cells show "09:00"
 * 3. Long-press a specific Wed, set 07:30 → that cell shows "07:30", others remain 09:00
 * 4. Click that Wed → all events removed for that date → no time label
 * 5. Click it again → manual no-time event appears
 * 6. Change weekly time to 10:30 → all non-override scheduled days switch to 10:30; the overridden date keeps its state if still scheduled
 * 7. Toggle a date off via click; verify weekly sync doesn't re-add time for that exact date unless you re-enable it
 * 8. Verify at most one time label per date everywhere
 * 
 * DEBUGGING: setState during render warning
 * Stack trace captured:
 * ERROR  Warning: Cannot update a component (`CreateGoalModalContent`) while rendering a different component (`SimpleDatePicker`). To locate the bad setState() call inside `SimpleDatePicker`, follow the stack trace as described in https://react.dev/link/setstate-in-render
 * 
 *  90 |
 *  91 | export default function SimpleDatePicker({
 * > 92 |   startDate: initialStartDate,
 *     |                              ^
 *  93 |   endDate: initialEndDate,
 *  94 |   onStartDateChange,
 *  95 |   onEndDateChange,
 * 
 * HYPOTHESIS STATUS:
 * ✅ Hypothesis #1: Applied microtask deferral for parent callbacks
 * ✅ Hypothesis #2: Local fallback already implemented - effectiveEvents unified read source
 * ✅ Hypothesis #3: Weekly→calendar materialization already implemented - syncWeeklyScheduleToCalendar function
 * ✅ Hypothesis #4: Fixed bad back-propagation - removed Weekly mutation from include/exclude changes
 * ✅ Hypothesis #5: Long-press already works without guards - one-time-per-date normalization implemented
 * ✅ Hypothesis #6: Implemented navigation button handlers using existing refs/layout
 * ✅ Hypothesis #7: Replaced duplicate calendar in Verification with clean bullet summary
 * ✅ One-time-per-cell normalization: override > weekly > none (already implemented)
 */
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { getLocalYMD } from '../utils/dateUtils';
import MapPreview from './MapPreview'; // Localized logger helpers
const log = (...args: any[]) => console.log('[SimpleDatePicker]', ...args);
const warn = (...args: any[]) => console.warn('[SimpleDatePicker]', ...args);
const err = (...args: any[]) => console.error('[SimpleDatePicker]', ...args);// microtask deferral to avoid parent updates during render
const defer = (fn: () => void) => queueMicrotask(fn);export interface DateSelection {
  mode: 'duration';
  startDate: string;
  endDate: string;
  durationType: 'days' | 'weeks' | 'months';
  durationValue: number;
}interface SimpleDatePickerProps {
  startDate: string | null;
  endDate: string | null;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onNavigateToStep: (stepIndex: number) => void;
  verificationMethods?: VerificationType[];
  onVerificationMethodsChange?: (methods: VerificationType[]) => void;
  lockedVerificationMethods?: VerificationType[];
  goalTitle?: string;
  goalRawText?: string;
  aiSuccessCriteria?: string;
  blockingReasons?: string[];
  onRequestNext?: () => void;
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
  // Weekly schedule callbacks
  onWeeklyScheduleChange?: (weekdays: number[], timeSettings: { [key: string]: string[] }) => void;
  onIncludeExcludeChange?: (includeDates: string[], excludeDates: string[]) => void;
  // Include/exclude dates
  includeDates?: string[];
  excludeDates?: string[];
  // Initial values
  initialSelectedWeekdays?: number[];
  initialWeeklyTimeSettings?: { [key: string]: string[] };
  // Frequency Goal props
  isFrequencyGoal?: boolean;
  perWeek?: number;
  onPerWeekChange?: (perWeek: number) => void;
}

export default function SimpleDatePicker({
  startDate: initialStartDate,
  endDate: initialEndDate,
  onStartDateChange,
  onEndDateChange,
  onNavigateToStep,
  verificationMethods = [],
  onVerificationMethodsChange,
  lockedVerificationMethods = [],
  goalTitle,
  goalRawText,
  aiSuccessCriteria,
  blockingReasons = [],
  onRequestNext,
  targetLocation, 
  onOpenLocationPicker, 
  onUseCurrentLocation,
  userId,
  goalId,
  goalSpec,
  loading = false,
  validationResult,
  calendarEvents = [],
  onCalendarEventsChange,
  onWeeklyScheduleChange,
  onIncludeExcludeChange,
  includeDates = [],
  excludeDates = [],
  initialSelectedWeekdays = [],
  initialWeeklyTimeSettings = {},
  isFrequencyGoal = false,
  perWeek = 3,
  onPerWeekChange
}: SimpleDatePickerProps) {
  // Parent notifications must happen post-commit.
  
  const today = getLocalYMD(new Date());
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];  const [startDate, setStartDate] = useState(initialStartDate || today);
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [durationType, setDurationType] = useState<'days' | 'weeks' | 'months'>('weeks');
  const [durationValue, setDurationValue] = useState('2');  // Calendar navigation state
  const [currentMonth, setCurrentMonth] = useState(new Date(startDate || today));  // Weekly Schedule state removed - using calendar events only
  const [editingMode, setEditingMode] = useState<'period' | 'schedule'>('period');
  // Calendar state  // Ensure an initial endDate exists so that the current period is active
  useEffect(() => {
    if (!endDate && startDate) {
      const numValue = parseInt(durationValue) || 1;
      const range = convertDurationToRange(startDate, durationType, numValue);
      setEndDate(range.endDate);
    }
  }, [endDate, startDate, durationType, durationValue]);  // Time picker modal state
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
  const [editingDateTimeIndex, setEditingDateTimeIndex] = useState(-1);  // Local fallback when parent does not provide onCalendarEventsChange
  const [localCalendarEvents, setLocalCalendarEvents] = useState<CalendarEvent[]>([]);  const applyEventsChange = (next: CalendarEvent[]) => {
    if (onCalendarEventsChange) {
      onCalendarEventsChange(next);
    } else {
      setLocalCalendarEvents(next);
    }
  };  const effectiveEvents: CalendarEvent[] = useMemo(() => {
    const events = (calendarEvents && calendarEvents.length > 0)
      ? calendarEvents
      : localCalendarEvents;
    return events;
  }, [calendarEvents, localCalendarEvents]);

  // Weekly schedule removed - using calendar events only  // OPTIONAL: prefer effect-based parent notification (safer)
  useEffect(() => {
    if (!startDate) return;
    onStartDateChange && onStartDateChange(startDate);
  }, [startDate]);
  useEffect(() => {
    if (!endDate) return;
    onEndDateChange && onEndDateChange(endDate);
  }, [endDate]);

  // 모드 전환 시 스크롤 이동
  useEffect(() => {
    if (editingMode === 'schedule' && startDate) {
      // 스케줄 모드: 시작월로 이동
      const startMonth = new Date(startDate);
      scrollToTargetMonth(startMonth);
    } else if (editingMode === 'period') {
      // 기간 편집 모드: 현재 월로 이동
      const currentMonth = new Date();
      scrollToTargetMonth(currentMonth);
    }
  }, [editingMode, startDate]);  // Weekly schedule initialization removed  // Removed 'weekly overrides calendar excludes' effect to allow per-day overrides to persist  // Include/exclude logic removed - using calendar events only  // Calendar navigation functions (moved after monthsInView declaration)  // Generate calendar days for current month
  // generateCalendarDays function removed - using calendar events only  // Precompute winning time per date: override > weekly
  const dateTimeMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const e of effectiveEvents) {
      const curr = map.get(e.date);
      if (e.source === 'single') {
        map.set(e.date, e.time ?? null);
      } else if (e.source === 'pattern') {
        if (!curr) map.set(e.date, e.time ?? null);
      }
    }
    return map;
  }, [effectiveEvents]);  // Set/Map 캐시 for O(1) lookups
  // Set/Map caching removed - using calendar events only  // Generate calendar days for a given month (memoized)
  const generateCalendarDaysFor = useCallback((monthDate: Date) => {
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
      
      // 기간 내에 있는 일정만 표시 (editingMode가 'schedule'일 때)
      const isWithinPeriod = editingMode === 'schedule' ? inRange : true;
      const dayEvents = effectiveEvents.filter(e => e.date === dateStr);
      const isScheduled = dayEvents.length > 0 && isWithinPeriod;
      const timeToShow = dayEvents.length > 0 ? dayEvents[0].time : null;
      
      if (dayEvents.length > 0) {
        console.log('[SimpleDatePicker] Day events found:', { dateStr, dayEvents: dayEvents.map(e => ({ time: e.time, source: e.source })), timeToShow });
      }
      
      
      
      days.push({
        day: d,
        dateStr,
        isToday: dateStr === today,
        isPast: dateStr < today,
        isSelected: dateStr === startDate || (endDate && dateStr === endDate),
        isInRange: endDate && dateStr > startDate && dateStr < endDate,
        isScheduled,
        isWithinRange: inRange,
        timeToShow
      });
    }
    return days;
  }, [startDate, endDate, today, effectiveEvents, editingMode]);  // monthsInView: editingMode에 따라 뷰 범위 전환
  const todayDate = useMemo(() => new Date(), []);
  const clampToMonthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

  // 달력 뷰 범위: editingMode에 따라 결정
  const monthsInView = useMemo(() => {
    if (editingMode === 'schedule' && startDate && endDate) {
      // 스케줄 모드: 선택된 기간만 표시
      const start = new Date(startDate);
      const end = new Date(endDate);
      const list: Date[] = [];
      
      const current = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
      
      while (current <= endMonth) {
        list.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
      }
      
      return list;
    } else {
      // 기간 편집 모드: 현재 날짜 기준 미래 12개월 표시
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const list: Date[] = [];
      
      for (let i = 0; i < 12; i++) {
        list.push(new Date(start.getFullYear(), start.getMonth() + i, 1));
      }
      
    return list;
    }
  }, [editingMode, startDate, endDate]);

  // 월별 캘린더 데이터 미리 계산 (훅 규칙 위반 방지)
  const monthKeyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  
  const daysByMonth = useMemo(() => {
    const entries = monthsInView.map((m) => {
      const key = monthKeyOf(m);
      return [key, generateCalendarDaysFor(m)] as const;
    });
    return new Map(entries);
  }, [monthsInView, generateCalendarDaysFor]);

  // Calendar navigation functions
  const scrollToMonth = useCallback((d: Date) => {
    const idx = monthsInView.findIndex(m => m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth());
    if (idx < 0) return;
    const ly = monthsLayoutRef.current?.[idx];
    if (!ly) return;
    calendarScrollRef.current?.scrollTo({ y: ly.y, animated: true });
    setHeaderMonth?.(monthsInView[idx]);
  }, [monthsInView]);  const goToPreviousMonth = () => {
    const base = headerMonth ?? new Date();
    const prevMonth = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    // monthsInView 범위 내에서만 이동
    if (monthsInView.some(m => m.getFullYear() === prevMonth.getFullYear() && m.getMonth() === prevMonth.getMonth())) {
      scrollToMonth(prevMonth);
    }
  };
  const goToNextMonth = () => {
    const base = headerMonth ?? new Date();
    const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    // monthsInView 범위 내에서만 이동
    if (monthsInView.some(m => m.getFullYear() === nextMonth.getFullYear() && m.getMonth() === nextMonth.getMonth())) {
      scrollToMonth(nextMonth);
    }
  };
  const goToToday = () => scrollToMonth(new Date());
  const goToStart = () => {
    const d = (editingMode === 'schedule' && startDate) ? new Date(startDate) : todayDate;
    scrollToMonth(d);
  };
  const goToYear = (_year: number) => {};  // Fixed header month tracking and measurements
  const calendarScrollRef = useRef<ScrollView | null>(null);
  const monthsLayoutRef = useRef<{ y: number; h: number }[]>([]);
  const VIEWPORT_HEIGHT = 420;
  const [headerMonth, setHeaderMonth] = useState<Date | null>(null);  useEffect(() => {
    monthsLayoutRef.current = [];
    // Initialize header with first month
    if (monthsInView.length > 0) setHeaderMonth(monthsInView[0]);
  }, [monthsInView]);  // Smart scroll: go to startDate month if set, otherwise current month
  useEffect(() => {
    if (calendarScrollRef.current && monthsInView.length > 0) {
      // Determine target month: startDate if set, otherwise current date
      const targetDate = startDate ? new Date(startDate) : new Date();
      const targetMonthIndex = monthsInView.findIndex(month => 
        month.getMonth() === targetDate.getMonth() && 
        month.getFullYear() === targetDate.getFullYear()
      );
      
      if (targetMonthIndex !== -1) {
        // Use requestAnimationFrame to avoid setState during render
        const scrollToTarget = () => {
          requestAnimationFrame(() => {
            if (calendarScrollRef.current) {
              const layouts = monthsLayoutRef.current;
              if (layouts && layouts[targetMonthIndex]) {
                // Use actual layout position
                calendarScrollRef.current.scrollTo({
                  y: layouts[targetMonthIndex].y,
                  animated: false
                });
                setHeaderMonth?.(monthsInView[targetMonthIndex]);
              } else {
                // Fallback to approximate calculation
                const monthHeight = 280; // Approximate height of one month
                const scrollY = targetMonthIndex * monthHeight;
                calendarScrollRef.current.scrollTo({
                  y: scrollY,
                  animated: false
                });
                setHeaderMonth?.(monthsInView[targetMonthIndex]);
              }
            }
          });
        };
        
        // Try immediately, then single retry after short delay to avoid double jumps
        scrollToTarget();
        const timeoutId = setTimeout(scrollToTarget, 100);
        
        // Cleanup timeout on unmount
        return () => clearTimeout(timeoutId);
      }
    }
  }, [monthsInView, startDate]);  const onMonthLayout = (index: number, y: number, h: number) => {
    const arr = monthsLayoutRef.current.slice();
    arr[index] = { y, h };
    monthsLayoutRef.current = arr;
    // Height is fixed; no need to set from layout
  };  // Throttle by rAF + binary search by y to pick month near viewport center
  const ticking = useRef(false);
  const updateHeaderForScroll = (scrollY: number) => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
    const layouts = monthsLayoutRef.current;
      if (layouts && layouts.length) {
        const center = scrollY + VIEWPORT_HEIGHT / 2;
        let lo = 0, hi = layouts.length - 1, ans = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const y = layouts[mid]?.y ?? 0;
          if (y <= center) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
        }
        const m = monthsInView[ans];
    if (m && (!headerMonth || headerMonth.getMonth() !== m.getMonth() || headerMonth.getFullYear() !== m.getFullYear())) {
      setHeaderMonth(m);
        }
      }
      ticking.current = false;
    });
  };  // Function to scroll to a specific month
  const scrollToTargetMonth = (targetDate: Date) => {
    if (!calendarScrollRef.current || monthsInView.length === 0) return;
    
    const targetMonthIndex = monthsInView.findIndex(month => 
      month.getMonth() === targetDate.getMonth() && 
      month.getFullYear() === targetDate.getFullYear()
    );
    
    if (targetMonthIndex !== -1) {
      const layouts = monthsLayoutRef.current;
      if (layouts && layouts[targetMonthIndex]) {
        // Use actual layout position for precise scrolling
        calendarScrollRef.current.scrollTo({
          y: layouts[targetMonthIndex].y,
          animated: true
        });
      } else {
        // Fallback to approximate calculation
        const monthHeight = 280; // Approximate height of one month
        const scrollY = targetMonthIndex * monthHeight;
        calendarScrollRef.current.scrollTo({
          y: scrollY,
          animated: true
        });
      }
    }
  };

  // Removed snapping block (we only update header dynamically)

  const handleDateSelect = async (dateStr: string) => {
    log('handleDateSelect entry:', { dateStr, editingMode, today });
    if (dateStr < today) return; // Don't allow past dates

    // Check if date is within the selected period (only for schedule mode)
    if (editingMode === 'schedule' && !isDateInPeriod(dateStr)) {
      if (__DEV__) console.log('[SimpleDatePicker] Cannot schedule outside period:', dateStr);
      return; // Don't allow scheduling outside the period
    }

    if (editingMode === 'schedule') {
      // 🔄 SCHEDULE MODE: Toggle calendar events for this date
      console.log(`[Calendar] Toggling schedule for date: ${dateStr}`);
      
      const currentlyScheduled = effectiveEvents.some(e => e.date === dateStr);
      const dayName = dayShort[new Date(dateStr).getDay()];

      console.log(`[Calendar] Date ${dateStr} (${dayName}): currentlyScheduled=${currentlyScheduled}`);

      if (currentlyScheduled) {
        // Currently scheduled; remove all events for this date
         const eventsToRemove = effectiveEvents.filter(event => event.date === dateStr);
         const updatedEvents = effectiveEvents.filter(event => event.date !== dateStr);
          
          // 🔄 DATABASE PERSISTENCE: Delete from database if userId and goalId are available
          if (userId && goalId && eventsToRemove.length > 0) {
            try {
              const toDeleteIds = eventsToRemove.map(e => e.id).filter(Boolean) as string[];
              if (toDeleteIds.length > 0) {
                await CalendarEventService.deleteCalendarEvents(goalId, toDeleteIds);
                log('handleDateSelect: deleted events from database', { dateStr, deletedCount: toDeleteIds.length });
              }
            } catch (error) {
              console.error('[Calendar] Error deleting events from database:', error);
              err('handleDateSelect: database delete failed', error);
              // Continue with local update even if database delete fails
            }
          }
          
          applyEventsChange(updatedEvents);
        console.log(`[Calendar] Removed all events for ${dayName} ${dateStr}`);
      } else {
        // Not currently scheduled; add a single event without time
        const newEvent: CalendarEvent = {
          goalId: goalId ?? '',
          date: dateStr,
          time: '', // No specific time
          source: 'single',
        };
        
        const updatedEvents = [...effectiveEvents, newEvent];
        
        // 🔄 DATABASE PERSISTENCE: Create in database if userId and goalId are available
        if (userId && goalId) {
          try {
            await CalendarEventService.createCalendarEvents(goalId, [newEvent]);
            log('handleDateSelect: created event in database', { dateStr });
          } catch (error) {
            console.error('[Calendar] Error creating event in database:', error);
            err('handleDateSelect: database create failed', error);
            // Continue with local update even if database create fails
          }
        }
        
        applyEventsChange(updatedEvents);
        console.log(`[Calendar] Added event for ${dayName} ${dateStr}`);
      }
    } else {
      // 🔄 PERIOD MODE: Set start date
    setStartDate(dateStr);

    const value = parseInt(durationValue) || 1;
    const range = convertDurationToRange(dateStr, durationType, value);
    setEndDate(range.endDate);

      // 기간 변경으로 인해 밖으로 밀려난 일정들 삭제
      const newStartDate = dateStr;
      const newEndDate = range.endDate;
      const eventsOutsidePeriod = effectiveEvents.filter(event => {
        // 유효한 이벤트만 필터링
        if (!event.id || !event.date || !event.time) return false;
        
        // 기간 체크
        return event.date < newStartDate || event.date > newEndDate;
      });

      if (eventsOutsidePeriod.length > 0) {
        console.log(`[SimpleDatePicker] 시작일 변경으로 인해 ${eventsOutsidePeriod.length}개의 일정이 삭제됩니다.`);
        console.log('[SimpleDatePicker] 삭제될 일정들:', eventsOutsidePeriod.map(e => `${e.date} ${e.time}`).join(', '));

        // 기간 내 이벤트만 유지
        const eventsWithinPeriod = effectiveEvents.filter(event => {
          if (!event.id || !event.date || !event.time) return false;
          return event.date >= newStartDate && event.date <= newEndDate;
        });
        
        console.log(`[SimpleDatePicker] 기간 내 남은 일정: ${eventsWithinPeriod.length}개`);
        applyEventsChange(eventsWithinPeriod);

        // 데이터베이스에서도 삭제
        if (userId && goalId) {
          try {
            const eventIds = eventsOutsidePeriod.map(event => event.id).filter(Boolean) as string[];
            if (eventIds.length > 0) {
              console.log(`[SimpleDatePicker] 데이터베이스에서 ${eventIds.length}개의 일정 삭제 시도...`);
              await CalendarEventService.deleteCalendarEvents(goalId, eventIds);
              console.log('[SimpleDatePicker] 데이터베이스에서 일정 삭제 완료');
            }
          } catch (error) {
            console.error('[SimpleDatePicker] 데이터베이스에서 일정 삭제 실패:', error);
          }
        }
      }

      // 즉시 부모 컴포넌트에 변경사항 알림
      onStartDateChange(dateStr);
      onEndDateChange(range.endDate);
    }

    log('handleDateSelect exit:', { 
      action: 'date_select', 
      date: dateStr, 
      editingMode, 
       calendarEventsCount: effectiveEvents.length,
       eventsForDate: effectiveEvents.filter(e => e.date === dateStr).map(e => ({ source: e.source, time: e.time }))
    });
  };

  const handleDurationChange = async (value: string) => {
    setDurationValue(value);
    if (startDate && value) {
      const numValue = parseInt(value) || 1;
      const range = convertDurationToRange(startDate, durationType, numValue);
      setEndDate(range.endDate);

      // 기간 변경으로 인해 밖으로 밀려난 일정들 삭제
      const newEndDate = range.endDate;
      const eventsOutsidePeriod = effectiveEvents.filter(event => {
        // 유효한 이벤트만 필터링
        if (!event.id || !event.date || !event.time) return false;

        // 기간 체크
        return event.date < startDate || event.date > newEndDate;
      });

      if (eventsOutsidePeriod.length > 0) {
        console.log(`[SimpleDatePicker] 기간 변경으로 인해 ${eventsOutsidePeriod.length}개의 일정이 삭제됩니다.`);
        console.log('[SimpleDatePicker] 삭제될 일정들:', eventsOutsidePeriod.map(e => `${e.date} ${e.time}`).join(', '));

        // 기간 내 이벤트만 유지
        const eventsWithinPeriod = effectiveEvents.filter(event => {
          if (!event.id || !event.date || !event.time) return false;
          return event.date >= startDate && event.date <= newEndDate;
        });
        
        console.log(`[SimpleDatePicker] 기간 내 남은 일정: ${eventsWithinPeriod.length}개`);
        applyEventsChange(eventsWithinPeriod);

        // 데이터베이스에서도 삭제
        if (userId && goalId) {
          try {
            const eventIds = eventsOutsidePeriod.map(event => event.id).filter(Boolean) as string[];
            if (eventIds.length > 0) {
              console.log(`[SimpleDatePicker] 데이터베이스에서 ${eventIds.length}개의 일정 삭제 시도...`);
              await CalendarEventService.deleteCalendarEvents(goalId, eventIds);
              console.log('[SimpleDatePicker] 데이터베이스에서 일정 삭제 완료');
            }
          } catch (error) {
            console.error('[SimpleDatePicker] 데이터베이스에서 일정 삭제 실패:', error);
          }
        }
      }
      
      // 즉시 부모 컴포넌트에 변경사항 알림
      onEndDateChange(range.endDate);
    }
  };

  const handleDurationTypeChange = async (type: 'days' | 'weeks' | 'months') => {
    setDurationType(type);
    if (startDate && durationValue) {
      const numValue = parseInt(durationValue) || 1;
      const range = convertDurationToRange(startDate, type, numValue);
      setEndDate(range.endDate);

      // 기간 변경으로 인해 밖으로 밀려난 일정들 삭제
      const newEndDate = range.endDate;
      const eventsOutsidePeriod = effectiveEvents.filter(event => {
        // 유효한 이벤트만 필터링
        if (!event.id || !event.date || !event.time) return false;

        // 기간 체크
        return event.date < startDate || event.date > newEndDate;
      });

      if (eventsOutsidePeriod.length > 0) {
        console.log(`[SimpleDatePicker] 기간 타입 변경으로 인해 ${eventsOutsidePeriod.length}개의 일정이 삭제됩니다.`);
        console.log('[SimpleDatePicker] 삭제될 일정들:', eventsOutsidePeriod.map(e => `${e.date} ${e.time}`).join(', '));

        // 기간 내 이벤트만 유지
        const eventsWithinPeriod = effectiveEvents.filter(event => {
          if (!event.id || !event.date || !event.time) return false;
          return event.date >= startDate && event.date <= newEndDate;
        });
        
        console.log(`[SimpleDatePicker] 기간 내 남은 일정: ${eventsWithinPeriod.length}개`);
        applyEventsChange(eventsWithinPeriod);

        // 데이터베이스에서도 삭제
        if (userId && goalId) {
          try {
            const eventIds = eventsOutsidePeriod.map(event => event.id).filter(Boolean) as string[];
            if (eventIds.length > 0) {
              console.log(`[SimpleDatePicker] 데이터베이스에서 ${eventIds.length}개의 일정 삭제 시도...`);
              await CalendarEventService.deleteCalendarEvents(goalId, eventIds);
              console.log('[SimpleDatePicker] 데이터베이스에서 일정 삭제 완료');
            }
    } catch (error) {
            console.error('[SimpleDatePicker] 데이터베이스에서 일정 삭제 실패:', error);
          }
        }
      }

      // 즉시 부모 컴포넌트에 변경사항 알림
      onEndDateChange(range.endDate);
    }
  };

  // Weekly Schedule functions removed - using calendar events only

  // Helper functions for calendar
  const getTimesForDate = useCallback((dateStr: string): string[] => {
    // Get all calendar events for this specific date
    const dateEvents = effectiveEvents.filter(e => e.date === dateStr && e.time);
    return dateEvents.map(e => e.time).filter(Boolean) as string[];
  }, [effectiveEvents]);

  const isDateScheduled = useCallback((dateStr: string): boolean => {
    return effectiveEvents.some(e => e.date === dateStr);
  }, [effectiveEvents]);

  // Helper function to check if date is within the selected period
  const isDateInPeriod = useCallback((dateStr: string): boolean => {
    if (!startDate || !endDate) return false;
    return dateStr >= startDate && dateStr <= endDate;
  }, [startDate, endDate]);

  // Weekly Schedule functions removed - using calendar events only

  // Long press handler for date editing
  const handleDateLongPress = useCallback((dateStr: string) => {
    log('handleDateLongPress entry:', { dateStr, editingMode });
    if (__DEV__) console.log('[SimpleDatePicker] Long press detected for date:', dateStr);
    
    if (!dateStr) return;

    // Check if date is within the selected period
    if (!isDateInPeriod(dateStr)) {
      if (__DEV__) console.log('[SimpleDatePicker] Cannot add schedule outside period:', dateStr);
      return; // Don't allow scheduling outside the period
    }
    
    try {
      // Get current time for this date
      const dateEvents = effectiveEvents.filter(event => event.date === dateStr);
      const currentTime = dateEvents.length > 0 ? (dateEvents[0].time || '09:00') : '09:00';
      
      setSelectedDateForEdit(dateStr);
      setDateEditTimeInput(currentTime);
      setShowDateEditModal(true);
      
      // Add haptic feedback (skip for now)
      // TODO: Add haptic feedback when ready
    } catch (error) {
      console.error('[SimpleDatePicker] Error in handleDateLongPress:', error);
    }
  }, [effectiveEvents, isDateInPeriod]);

  // Helper function to actually add/replace time for a date
  const handleAddTimeToDate = useCallback(async () => {
    if (!selectedDateForEdit || !dateEditTimeInput.trim()) return;
    
    console.log('[SimpleDatePicker] handleAddTimeToDate called:', { 
      selectedDateForEdit, 
      dateEditTimeInput, 
      currentEventsCount: effectiveEvents.length 
    });
    
    // 🔄 ONE TIME PER DATE: Remove any existing events for this date (regardless of source)
      const otherDateEvents = effectiveEvents.filter(e => e.date !== selectedDateForEdit);
      const newEvent: CalendarEvent = {
        id: `override-${selectedDateForEdit}-${dateEditTimeInput}-${Date.now()}`,
        date: selectedDateForEdit,
        time: dateEditTimeInput,
        goalId: goalId || 'temp-goal-id',
      source: 'single',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    const next = [...otherDateEvents, newEvent];
    
    console.log('[SimpleDatePicker] New events array:', next.map(e => ({ date: e.date, time: e.time })));
    
    // 1) Optimistic UI update
        applyEventsChange(next);
    
    // 2) Background sync
    if (userId && goalId) {
      (async () => {
        try {
          // 기존 이벤트 삭제
          const existingEvents = effectiveEvents.filter(e => e.date === selectedDateForEdit);
          if (existingEvents.length > 0) {
            const eventIds = existingEvents.map(e => e.id).filter(Boolean) as string[];
            if (eventIds.length > 0) {
              console.log('[SimpleDatePicker] Deleting existing events:', eventIds);
              await CalendarEventService.deleteCalendarEvents(goalId, eventIds);
            }
          }
          
          // 새 이벤트 생성
          console.log('[SimpleDatePicker] Creating new event:', { date: selectedDateForEdit, time: dateEditTimeInput });
          await CalendarEventService.createCalendarEvents(goalId, [{
          date: selectedDateForEdit,
            time: dateEditTimeInput,
          goalId: goalId,
            source: 'single'
          }]);
          
          console.log('[SimpleDatePicker] Event created successfully');
        } catch (e) {
          console.error('[SimpleDatePicker] Background sync failed:', e);
        }
      })();
    }
    
    // Reset input and close modal
    setShowDateTimeInput(false);
    setShowDateEditModal(false);
    setSelectedDateForEdit('');
    setDateEditTimeInput('');
    
    console.log('[SimpleDatePicker] Modal closed and state reset');
  }, [selectedDateForEdit, dateEditTimeInput, effectiveEvents, applyEventsChange, userId, goalId]);

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
    }    // 2) Photo verification  
    if (mandatory.includes('photo') || (methods.includes('photo' as any) && constraints.photo?.required)) {
      lines.push('During the scheduled times, upload a photo as proof to be counted.');
    }    // 3) Screentime verification
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

  console.log('[SimpleDatePicker] Rendering with props:', {
    startDate: initialStartDate,
    endDate: initialEndDate,
    goalTitle,
    goalRawText
  });

  return (
    <>
      {/* DEBUG: NativeWind className 적용 여부 확인용 빨간 바 */}
      <View style={{ height: 16, backgroundColor: '#ef4444', marginBottom: 8 }} />
      {/* DEBUG: className 테스트 */}
      <View className="h-4 bg-blue-500 mb-2" />
      {/* DEBUG: 더 명확한 테스트 */}
      <Text style={{ color: 'red', fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
        SimpleDatePicker RENDERED - className test below:
      </Text>
      <Text className="text-green-500 text-lg font-bold">
        This should be GREEN if NativeWind works
      </Text>
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
        <Text className="text-2xl font-bold text-gray-800 text-center">
          {isFrequencyGoal ? 'Frequency Goal' : 'Schedule'}
        </Text>
        <Text className="text-gray-600 text-center mt-2">
          {isFrequencyGoal ? 'Set your goal duration and frequency' : 'Set your goal duration and schedule'}
        </Text>
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
                <Text
                  className={`text-base font-semibold ${durationType === type ? 'text-white' : 'text-blue-600'}`}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {endDate && (
          <Text className="text-blue-700 text-base mt-3">Will end on: {new Date(endDate).toLocaleDateString()}</Text>
        )}
      </View>

      {/* Weekly Schedule UI removed - using calendar events only */}
      
      {/* Calendar */}
      <View className="mb-3" style={{ height: VIEWPORT_HEIGHT * 0.7 }}>
        {/* Fixed month/year header and single day-of-week row */}
              <View className="mb-2">
          <View className="flex-row items-center justify-between mb-2">
                <TouchableOpacity
              onPress={() => scrollToTargetMonth(startDate ? new Date(startDate) : new Date())}
              className="px-3 py-1 bg-blue-100 rounded-full"
            >
              <Text className="text-blue-700 text-xs font-semibold">
                {startDate ? 'Start Date' : 'Today'}
              </Text>
                    </TouchableOpacity>
            
            <Text className="text-center text-lg font-bold text-gray-800">
              {(headerMonth || monthsInView[0] || new Date()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </Text>
            
            <TouchableOpacity 
              onPress={() => scrollToTargetMonth(new Date())}
              className="px-3 py-1 bg-gray-100 rounded-full"
              activeOpacity={0.9}
            >
              <Text className="text-gray-700 text-xs font-semibold">Today</Text>
              </TouchableOpacity>
            </View>
          
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
          scrollEventThrottle={48}
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
          decelerationRate="normal"
          scrollEnabled={true}
          nestedScrollEnabled={true}
          removeClippedSubviews={true}
          keyboardShouldPersistTaps="handled"
        >
        {monthsInView.map((m, idx) => {
          const monthKey = monthKeyOf(m);
          const days = daysByMonth.get(monthKey) || [];
          return (
            <View
              key={monthKey}
              onLayout={(e: any) => onMonthLayout(idx, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
              className="mb-4"
            >
              <View className="flex-row flex-wrap">
                {days.map((dayData: any, index: number) => (
                  <View key={index} className="w-[14.28%] p-1" style={{ aspectRatio: 1 }}>
                    {dayData ? (
                      <TouchableOpacity
                        className={`flex-1 justify-center items-center rounded relative ${dayData.isPast || (!isFrequencyGoal && editingMode === 'schedule' && !isDateInPeriod(dayData.dateStr)) ? 'bg-gray-200' : dayData.isSelected ? 'bg-blue-600' : !isFrequencyGoal && editingMode === 'schedule' && dayData.isScheduled ? 'bg-green-200' : dayData.isInRange ? 'bg-blue-100' : dayData.isToday ? 'bg-blue-50' : 'bg-gray-50'}`}
                        onPress={() => handleDateSelect(dayData.dateStr)}
                        onLongPress={() => {
                          if (!dayData.isPast && dayData.dateStr) {
                            // Open time edit modal for this date
                            handleDateLongPress(dayData.dateStr);
                          }
                        }}
                        delayLongPress={500}
                        disabled={dayData.isPast || (!isFrequencyGoal && editingMode === 'schedule' && !isDateInPeriod(dayData.dateStr))}
                      >
                        <Text
                          className={`text-sm font-semibold ${dayData.isPast ? 'text-gray-400' : dayData.isSelected ? 'text-white' : !isFrequencyGoal && editingMode === 'schedule' && dayData.isScheduled ? 'text-green-900' : dayData.isInRange ? 'text-blue-600' : dayData.isToday ? 'text-blue-800' : 'text-gray-800'}`}
                        >
                          {dayData.day}
                        </Text>
                        
                        {/* Display single time from calendar events - only if within period */}
                        {!isFrequencyGoal && dayData.timeToShow && (
                          <View className="mt-1 px-1">
                                <Text className="text-xs text-green-600 text-center leading-3 font-medium">
                              {dayData.timeToShow}
                                </Text>
                          </View>
                        )}
                        
                        
                        {!isFrequencyGoal && editingMode !== 'schedule' && dayData.isScheduled && (
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
          <View className="flex-row justify-center space-x-6 mt-2">
          <View className="flex-row items-center">
            <View className="w-3 h-3 bg-blue-600 rounded mr-2" />
            <Text className="text-xs text-gray-600">Selected range</Text>
          </View>
          {!isFrequencyGoal && (
            <View className="flex-row items-center">
              <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              <Text className="text-xs text-gray-600">Scheduled weekdays</Text>
            </View>
          )}
        </View>

        {/* Mode toggles under calendar */}
        <View className="flex-row gap-3 mt-2">
          <TouchableOpacity
            onPress={() => setEditingMode('period')}
            className={`flex-1 rounded-lg py-3 ${editingMode === 'period' ? 'bg-blue-600' : 'bg-blue-100'}`}
            activeOpacity={0.9}
          >
            <Text
              className={`text-center font-semibold ${editingMode === 'period' ? 'text-white' : 'text-blue-700'}`}
            >
              Edit Period
            </Text>
          </TouchableOpacity>
          {!isFrequencyGoal && (
            <TouchableOpacity
              onPress={() => setEditingMode('schedule')}
              className={`flex-1 rounded-lg py-3 ${editingMode === 'schedule' ? 'bg-green-600' : 'bg-green-100'}`}
              activeOpacity={0.9}
            >
              <Text
                className={`text-center font-semibold ${editingMode === 'schedule' ? 'text-white' : 'text-green-700'}`}
              >
                Edit Schedule
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Frequency Goal - 주당 횟수 설정 */}
        {isFrequencyGoal && (
          <View className="mb-3 p-4 bg-blue-50 rounded-lg">
            <Text className="text-blue-800 font-semibold text-base mb-3">주당 목표 횟수</Text>
            <View className="flex-row items-center justify-center space-x-4">
              <TouchableOpacity
                onPress={() => onPerWeekChange?.(Math.max(1, (perWeek || 3) - 1))}
                className="w-10 h-10 bg-blue-200 rounded-full items-center justify-center"
                activeOpacity={0.7}
              >
                <Text className="text-blue-700 text-xl font-bold">-</Text>
              </TouchableOpacity>
              <Text className="text-2xl font-bold text-blue-800 min-w-[60px] text-center">
                {perWeek || 3}회
              </Text>
              <TouchableOpacity
                onPress={() => onPerWeekChange?.((perWeek || 3) + 1)}
                className="w-10 h-10 bg-blue-200 rounded-full items-center justify-center"
                activeOpacity={0.7}
              >
                <Text className="text-blue-700 text-xl font-bold">+</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-blue-600 text-sm text-center mt-2">
              주당 {perWeek || 3}회 목표를 달성하세요
            </Text>
          </View>
        )}


      {/* Selected Summary */}
      {startDate && (
        <View className="mb-3 p-3 bg-gray-50 rounded-lg">
          <Text className="text-gray-700 font-semibold text-base mb-1">Selected:</Text>
          <Text className="text-gray-600 text-sm">Start: {new Date(startDate).toLocaleDateString()}</Text>
          {endDate && (
            <Text className="text-gray-600 text-sm">End: {new Date(endDate).toLocaleDateString()}</Text>
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
                className={`px-3 py-2 rounded-full border flex-row items-center ${locked ? 'bg-blue-800 border-blue-800' : (selected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300')}`}
                activeOpacity={0.8}
              >
                {locked && (
                  <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
                )}
                <Text
                  className={`${selected || locked ? 'text-white' : 'text-gray-700'} font-medium ${locked ? 'ml-1' : ''}`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text className="text-xs text-gray-500 mt-2">Select one or more methods to verify your progress. AI-selected methods are locked.</Text>

        {/* Verification Summary */}
        {(() => {
          const note = generateVerificationNote();
          return note && (
            <View className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
              {note.split('\n').map((line, i) => (
                <View key={i} className="flex-row items-start mb-1">
                  <Text className="text-gray-500 text-xs mr-1">•</Text>
                  <Text className="text-gray-700 text-xs flex-1">{line}</Text>
                </View>
              ))}
            </View>
          );
        })()}
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
            console.log('[SimpleDatePicker] Next button pressed, onRequestNext:', !!onRequestNext, 'loading:', loading, 'validationResult:', validationResult);
            if (onRequestNext) {
              console.log('[SimpleDatePicker] Calling onRequestNext');
              onRequestNext(); // Always use validation path when available
            } else {
              console.log('[SimpleDatePicker] Calling onNavigateToStep(2)');
              onNavigateToStep(2); // Fallback only when no validation handler
            }
          }}
          className={`flex-1 rounded-lg py-3 flex-row items-center justify-center ${(loading || (validationResult ? !validationResult.isCompatible : false)) ? 'bg-gray-400' : 'bg-blue-600'}`}
          disabled={loading || (validationResult ? !validationResult.isCompatible : false)}
        >
          <Text
            className={`font-semibold mr-2 ${(loading || (validationResult ? !validationResult.isCompatible : false)) ? 'text-gray-600' : 'text-white'}`}
          >
            {loading ? 'Validating...' : 
             (validationResult && !validationResult.isCompatible ? 'Fix Issues' : 
              (onRequestNext ? 'Next' : 'Continue'))}
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

      {/* Date Edit Modal for Long Press */}
      <Modal 
        visible={showDateEditModal} 
        transparent 
        animationType="fade" 
        onRequestClose={() => {
          setShowDateEditModal(false);
          setDateEditTimeInput('');
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-lg p-6 mx-4 max-w-sm w-full">
            <Text className="text-lg font-bold text-gray-800 mb-4 text-center">
              {selectedDateForEdit ? `Set Time for ${selectedDateForEdit}` : 'Set Time'}
            </Text>
            
            {/* Current time display */}
            <View className="mb-4">
              {(() => {
                const dateEvents = selectedDateForEdit ? effectiveEvents.filter(event => event.date === selectedDateForEdit) : [];
                const currentTime = dateEvents.length > 0 ? dateEvents[0] : null;
                
                if (currentTime) {
                  return (
                    <View className="py-3 px-4 bg-blue-50 rounded-lg border border-blue-200">
                      <Text className="text-blue-800 font-medium text-center">Current: {currentTime.time}</Text>
                    </View>
                  );
                } else {
                  return (
                    <View className="py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
                      <Text className="text-gray-500 text-center">No time set</Text>
                    </View>
                  );
                }
              })()}
            </View>
            
            {/* Time picker */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-3 text-center">Select Time</Text>
                
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
                </View>
                
            {/* Action buttons */}
                <View className="flex-row space-x-3">
                  <TouchableOpacity 
                    onPress={() => {
                  setShowDateEditModal(false);
                      setDateEditTimeInput('');
                    }}
                className="flex-1 bg-gray-200 rounded-lg py-3"
                  >
                    <Text className="text-gray-700 font-medium text-center">Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => {
                  if (selectedDateForEdit && dateEditTimeInput) {
                    handleAddTimeToDate();
                  }
                }}
                className="flex-1 bg-blue-600 rounded-lg py-3"
              >
                <Text className="text-white font-medium text-center">Set Time</Text>
                </TouchableOpacity>
              </View>
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
              <TouchableOpacity onPress={() => setShowTimePicker(false)} className="flex-1 bg-blue-600 rounded-lg py-3">
                <Text className="text-white font-medium text-center">Save</Text>
                    </TouchableOpacity>
              </View>
          </View>
        </View>
      </Modal>
      </View>
    </>
  );
}
