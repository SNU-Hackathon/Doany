import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Verification } from '../types';

type WeeklyTimeSettings = { [key: string]: string[] } | { [key: number]: string[] };

interface GoalScheduleCalendarProps {
  startDateISO?: string | null;
  endDateISO?: string | null;
  weeklyWeekdays?: number[];
  weeklyTimeSettings?: WeeklyTimeSettings;
  includeDates?: string[];
  excludeDates?: string[];
  verifications?: Verification[];
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function computeScheduleCounts(
  startISO?: string | null,
  endISO?: string | null,
  weeklyDays: number[] = [],
  weeklyTimes: WeeklyTimeSettings = {},
  include: string[] = [],
  exclude: string[] = []
) {
  if (!startISO || !endISO) return { required: 0, perDateRequired: new Map<string, number>() };
  const perDateRequired = new Map<string, number>();

  const normalizeTimes = (weekday: number): string[] => {
    const key = String(weekday);
    // @ts-ignore - support string/number index
    return (weeklyTimes[weekday] || weeklyTimes[key] || []) as string[];
  };

  const start = new Date(startISO);
  const end = new Date(endISO);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = toDateStr(d);
    const weekday = d.getDay();
    const baseIncluded = weeklyDays.includes(weekday);
    const isScheduled = (baseIncluded && !exclude.includes(ds)) || include.includes(ds);
    if (!isScheduled) continue;
    const times = normalizeTimes(weekday);
    const count = times && times.length > 0 ? times.length : 1;
    perDateRequired.set(ds, count);
  }

  const required = Array.from(perDateRequired.values()).reduce((a, b) => a + b, 0);
  return { required, perDateRequired };
}

export default function GoalScheduleCalendar({
  startDateISO,
  endDateISO,
  weeklyWeekdays = [],
  weeklyTimeSettings = {},
  includeDates = [],
  excludeDates = [],
  verifications = []
}: GoalScheduleCalendarProps) {
  const getLocalYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const today = getLocalYMD(new Date());

  const { perDateRequired, required } = useMemo(() =>
    computeScheduleCounts(startDateISO, endDateISO, weeklyWeekdays, weeklyTimeSettings, includeDates, excludeDates),
    [startDateISO, endDateISO, weeklyWeekdays, weeklyTimeSettings, includeDates, excludeDates]
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
      days.push({
        day: d,
        dateStr: ds,
        inRange,
        requiredForDay,
        success: vf?.success || 0,
        fail: vf?.fail || 0,
        isToday
      });
    }
    return days;
  };

  // Achievement rate
  const achievementPct = required > 0 ? Math.round((successCount / required) * 100) : 0;

  // Fixed header month tracking and measurements (match Schedule's UI)
  const calendarScrollRef = useRef<ScrollView | null>(null);
  const monthsLayoutRef = useRef<Array<{ y: number; h: number }>>([]);
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
          onScroll={(e) => updateHeaderForScroll(e.nativeEvent.contentOffset.y)}
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
                onLayout={(e) => onMonthLayout(idx, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
              >
                <View className="flex-row flex-wrap">
                  {days.map((d: any, index: number) => (
                    <View key={index} className="w-[14.28%] p-1" style={{ aspectRatio: 1 }}>
                      {d ? (
                        <View className={`flex-1 rounded items-center justify-center relative ${
                          !d.inRange ? 'bg-gray-50' : d.requiredForDay > 0 ? 'bg-green-50' : 'bg-white'
                        }`}>
                          <Text className={`text-sm font-semibold ${!d.inRange ? 'text-gray-400' : (d.isToday ? 'text-blue-800' : 'text-gray-800')}`}>{d.day}</Text>
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
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}


