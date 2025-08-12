// Simple Date Picker Component - Schedule Step with Calendar

import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { convertDurationToRange } from '../features/goals/aiDraft';

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
}

export default function SimpleDatePicker({
  startDate: initialStartDate,
  endDate: initialEndDate,
  onStartDateChange,
  onEndDateChange,
  onNavigateToStep,
  onWeeklyScheduleChange
}: SimpleDatePickerProps) {
  const today = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(initialStartDate || today);
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [durationType, setDurationType] = useState<'days' | 'weeks' | 'months'>('weeks');
  const [durationValue, setDurationValue] = useState('2');

  // Calendar navigation state
  const [currentMonth, setCurrentMonth] = useState(new Date(startDate || today));

  // Weekly Schedule state (always visible)
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(new Set());
  const [weeklyTimeSettings, setWeeklyTimeSettings] = useState<{ [key: string]: string[] }>({});
  const [isEditingWeeklySchedule, setIsEditingWeeklySchedule] = useState(true);

  // Time picker modal state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingDayIndex, setEditingDayIndex] = useState<number>(-1);
  const [editingTimeIndex, setEditingTimeIndex] = useState<number>(-1);
  const [editingTimeHour, setEditingTimeHour] = useState('10');
  const [editingTimeMinute, setEditingTimeMinute] = useState('00');

  // Change-detection to avoid loops
  const prevWeeklyDataRef = useRef<string>('');

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
    notifyParent(selectedWeekdays, weeklyTimeSettings);
  }, [selectedWeekdays, weeklyTimeSettings, notifyParent]);

  // Calendar navigation functions
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() - 1);
      return newMonth;
    });
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + 1);
      return newMonth;
    });
  };

  const goToYear = (year: number) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setFullYear(year);
      return newMonth;
    });
  };

  // Generate calendar days for current month
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();

    const days: any[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        day,
        dateStr,
        isToday: dateStr === today,
        isPast: dateStr < today,
        isSelected: dateStr === startDate || (endDate && dateStr === endDate),
        isInRange: endDate && dateStr > startDate && dateStr < endDate,
        isWeekdayGoal: endDate && dateStr >= startDate && dateStr <= endDate && selectedWeekdays.has(new Date(dateStr).getDay())
      });
    }

    return days;
  };

  const handleDateSelect = (dateStr: string) => {
    if (dateStr < today) return; // Don't allow past dates

    setStartDate(dateStr);
    onStartDateChange(dateStr);

    // Always calculate end date based on duration
    const value = parseInt(durationValue) || 1;
    const range = convertDurationToRange(dateStr, durationType, value);
    setEndDate(range.endDate);
    onEndDateChange(range.endDate);
  };

  const handleDurationChange = (value: string) => {
    setDurationValue(value);
    if (startDate && value) {
      const numValue = parseInt(value) || 1;
      const range = convertDurationToRange(startDate, durationType, numValue);
      setEndDate(range.endDate);
      onEndDateChange(range.endDate);
    }
  };

  const handleDurationTypeChange = (type: 'days' | 'weeks' | 'months') => {
    setDurationType(type);
    if (startDate && durationValue) {
      const numValue = parseInt(durationValue) || 1;
      const range = convertDurationToRange(startDate, type, numValue);
      setEndDate(range.endDate);
      onEndDateChange(range.endDate);
    }
  };

  // Weekly Schedule functions (always visible)
  const toggleWeekday = useCallback((dayIndex: number) => {
    setSelectedWeekdays(prev => {
      const next = new Set(prev);
      if (next.has(dayIndex)) {
        next.delete(dayIndex);
        setWeeklyTimeSettings(prevTimes => {
          const copy = { ...prevTimes } as any;
          delete copy[dayIndex];
          return copy;
        });
      } else {
        next.add(dayIndex);
        // Do not auto-add default time; user will add manually
      }
      return next;
    });
  }, []);

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
    setEditingDayIndex(dayIndex);
    setEditingTimeIndex(timeIdx);
    setEditingTimeHour(h.padStart(2, '0'));
    setEditingTimeMinute(m.padStart(2, '0'));
    setShowTimePicker(true);
  }, [weeklyTimeSettings]);

  const removeTime = useCallback((dayIndex: number, timeIdx: number) => {
    setWeeklyTimeSettings(prev => {
      const list = prev[dayIndex] ? [...prev[dayIndex]] : [];
      list.splice(timeIdx, 1);
      const next = { ...prev } as any;
      if (list.length > 0) {
        next[dayIndex] = list;
      } else {
        delete next[dayIndex];
        setSelectedWeekdays(prevDays => {
          const copy = new Set(prevDays);
          copy.delete(dayIndex);
          return copy;
        });
      }
      return next;
    });
  }, []);

  const saveTime = useCallback(() => {
    const time = `${editingTimeHour.padStart(2, '0')}:${editingTimeMinute.padStart(2, '0')}`;
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      Alert.alert('Invalid Time', 'Please choose a valid time');
      return;
    }
    setWeeklyTimeSettings(prev => {
      const current = prev[editingDayIndex] ? [...prev[editingDayIndex]] : [];
      if (editingTimeIndex === -1) {
        if (!current.includes(time)) current.push(time);
      } else {
        current[editingTimeIndex] = time;
      }
      current.sort();
      return { ...prev, [editingDayIndex]: current } as any;
    });
    setShowTimePicker(false);
    setEditingDayIndex(-1);
    setEditingTimeIndex(-1);
  }, [editingDayIndex, editingTimeIndex, editingTimeHour, editingTimeMinute]);

  const clearWeeklySchedule = useCallback(() => {
    setSelectedWeekdays(new Set());
    setWeeklyTimeSettings({});
  }, []);

  const calendarDays = generateCalendarDays();

  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View className="bg-white rounded-lg p-4 mx-0 my-4">
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
            {Array.from(selectedWeekdays).sort().map((dayIdx) => (
              <View key={dayIdx} className="mb-3 p-3 bg-gray-50 rounded-lg">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-gray-800 font-medium">{dayShort[dayIdx]}</Text>
                  <TouchableOpacity onPress={() => openAddTimeModal(dayIdx)} className="px-3 py-1 bg-blue-100 rounded">
                    <Text className="text-blue-700 text-xs font-semibold">Add time</Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {(weeklyTimeSettings[dayIdx] || []).map((t, i) => (
                    <View key={`${t}-${i}`} className="flex-row items-center bg-green-100 px-3 py-1 rounded-full">
                      <TouchableOpacity onPress={() => openEditTimeModal(dayIdx, i)}>
                        <Text className="text-green-800 font-medium mr-1">{t}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeTime(dayIdx, i)}>
                        <Ionicons name="close" size={14} color="#047857" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {(weeklyTimeSettings[dayIdx]?.length || 0) === 0 && (
                    <Text className="text-gray-500 text-xs">No times added</Text>
                  )}
                </View>
              </View>
            ))}

            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity onPress={clearWeeklySchedule} className="flex-1 bg-gray-500 px-4 py-3 rounded-lg">
                <Text className="text-white font-medium text-center">Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Display mode - summarized
          <View>
            {selectedWeekdays.size > 0 ? (
              <View className="gap-2">
                {Array.from(selectedWeekdays).sort().map((dayIdx) => (
                  <View key={dayIdx} className="flex-row items-start">
                    <Text className="w-12 text-gray-800 font-medium">{dayShort[dayIdx]}</Text>
                    <View className="flex-1 flex-row flex-wrap gap-2">
                      {(weeklyTimeSettings[dayIdx] || []).map((t, i) => (
                        <View key={`${t}-${i}`} className="bg-green-100 px-3 py-1 rounded-full">
                          <Text className="text-green-800 font-medium">{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="bg-gray-50 rounded-lg p-4">
                <Text className="text-gray-600 text-center">No weekly schedule set</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Calendar */}
      <View className="mb-6">
        {/* Month/Year Navigation */}
          <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity onPress={goToPreviousMonth} className="p-2">
            <Ionicons name="chevron-back" size={24} color="#3B82F6" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              const currentYear = currentMonth.getFullYear();
              const nextYear = currentYear + 1;
              goToYear(nextYear);
            }}
            className="px-4 py-2"
          >
            <Text className="text-center text-lg font-bold text-gray-800">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goToNextMonth} className="p-2">
            <Ionicons name="chevron-forward" size={24} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {/* Day headers */}
        <View className="flex-row mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <View key={day} className="flex-1">
              <Text className="text-center text-sm font-semibold text-gray-600">{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
          <View className="flex-row flex-wrap">
          {calendarDays.map((dayData, index) => (
            <View key={index} className="w-[14.28%] p-1" style={{ aspectRatio: 1 }}>
              {dayData ? (
                <TouchableOpacity
                  className={`flex-1 justify-center items-center rounded relative ${
                    dayData.isPast ? 'bg-gray-100' :
                    dayData.isSelected ? 'bg-blue-600' :
                    dayData.isInRange ? 'bg-blue-100' :
                    dayData.isToday ? 'bg-blue-50 border border-blue-300' :
                    'bg-gray-50'
                  }`}
                  onPress={() => handleDateSelect(dayData.dateStr)}
                  disabled={dayData.isPast}
                >
                  <Text className={`text-sm font-semibold ${
                    dayData.isPast ? 'text-gray-400' :
                    dayData.isSelected ? 'text-white' :
                    dayData.isInRange ? 'text-blue-600' :
                    dayData.isToday ? 'text-blue-600' :
                    'text-gray-800'
                  }`}>{dayData.day}</Text>
                  {/* Weekday goal indicator */}
                  {dayData.isWeekdayGoal && (
                    <View className="absolute -bottom-1 w-2 h-2 bg-green-500 rounded-full" />
                  )}
                </TouchableOpacity>
              ) : (
                <View className="flex-1" />
              )}
            </View>
          ))}
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

      {/* Navigation Buttons */}
      <View className="flex-row space-x-3">
        <TouchableOpacity onPress={() => onNavigateToStep(0)} className="flex-1 bg-gray-200 rounded-lg py-3 flex-row items-center justify-center">
          <Ionicons name="chevron-back" size={16} color="#6B7280" />
          <Text className="text-gray-700 font-semibold ml-2">Back</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => onNavigateToStep(2)} className="flex-1 bg-blue-600 rounded-lg py-3 flex-row items-center justify-center" disabled={!startDate}>
          <Text className="text-white font-semibold mr-2">Next</Text>
          <Ionicons name="chevron-forward" size={16} color="white" />
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
              <TouchableOpacity onPress={saveTime} className="flex-1 bg-blue-600 rounded-lg py-3">
                <Text className="text-white font-medium text-center">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

