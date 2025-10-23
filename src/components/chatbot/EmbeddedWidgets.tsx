// Embedded widgets for chatbot messages

import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SlotValue } from '../../types/chatbot';
import { DateRange } from '../../utils/dateRanges';
import SimpleDatePicker from '../SimpleDatePicker';
import VerificationSelector, { VerificationMethod } from './VerificationSelector';

interface BaseWidgetProps {
  label: string;
  value?: SlotValue;
  onSelect: (value: SlotValue) => void;
  onConfirm?: (value: SlotValue) => void;
}

// Advanced Calendar Widget using SimpleDatePicker
// NOTE: For period slot, only shows date range selection
// Weekdays and time are now separate widgets/slots
export function AdvancedCalendarWidget({ 
  label, 
  value, 
  onSelect, 
  goalType = 'frequency',
  mode = 'range' 
}: BaseWidgetProps & { 
  goalType?: 'schedule' | 'frequency' | 'milestone';
  mode?: 'single' | 'range';
}) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [selectedRanges, setSelectedRanges] = useState<DateRange[]>([]);
  const [weeklyTarget, setWeeklyTarget] = useState(3);

  // Auto-set default range for better UX
  useEffect(() => {
    if (selectedRanges.length === 0 && !isConfirmed) {
      // Set default 2-week range starting from today
      const today = new Date();
      const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      setSelectedRanges([{
        start: today,
        end: twoWeeksLater
      }]);
      
      console.log('[AdvancedCalendarWidget] Set default 2-week range');
    }
  }, [selectedRanges.length, isConfirmed]);

  const handleRangesChange = (ranges: DateRange[]) => {
    setSelectedRanges(ranges);
  };

  const handleConfirm = () => {
    if (selectedRanges.length > 0) {
      const range = selectedRanges[0];
      setIsConfirmed(true);
      
      // Always return just the period data
      // Weekdays and time are now handled by separate widgets/slots
      const selectionData = {
        startDate: range.start.toISOString().split('T')[0],
        endDate: range.end.toISOString().split('T')[0]
      };
      
      console.log('[AdvancedCalendarWidget] Period selection data:', selectionData);
      onSelect(selectionData as SlotValue);
    }
  };

  return (
    <View className="bg-white border border-gray-200 rounded-lg p-4 mt-2">
      <Text className="text-sm font-medium text-gray-700 mb-3">{label}</Text>
      
      {!isConfirmed ? (
        <>
          <SimpleDatePicker
            goalType={goalType === 'milestone' ? 'frequency' : goalType}
            weeklyTarget={weeklyTarget}
            onWeeklyTargetChange={setWeeklyTarget}
            ranges={selectedRanges}
            onRangesChange={handleRangesChange}
            onNavigateToStep={() => {}} // Not used in chatbot context
            mode="period" // Always use period-only mode in chatbot
            variant="compact"
          />
          
          {/* Confirm Button */}
          {selectedRanges.length > 0 && (
            <TouchableOpacity
              onPress={handleConfirm}
              className="mt-4 bg-blue-500 py-3 px-4 rounded-lg"
            >
              <Text className="text-white text-center font-medium">네</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View className="p-4 bg-green-50 rounded-lg border border-green-200">
          <Text className="text-green-700 text-center font-medium">
            📅 {selectedRanges[0]?.start.toLocaleDateString('ko-KR')} ~ {selectedRanges[0]?.end.toLocaleDateString('ko-KR')}
          </Text>
        </View>
      )}
    </View>
  );
}

// Calendar Widget for date/dateRange selection
export function CalendarWidget({ label, value, onSelect, onConfirm, mode = 'range', isActive = true }: BaseWidgetProps & { mode?: 'single' | 'range'; isActive?: boolean }) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<{startDate: string; endDate: string} | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Generate calendar for current displayed month
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeek = firstDay.getDay();
    
    const days = [];
    
    // Previous month's dates
    for (let i = startWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }
    
    // Current month's dates
    for (let date = 1; date <= lastDay.getDate(); date++) {
      days.push({ date: new Date(year, month, date), isCurrentMonth: true });
    }
    
    // Next month's dates to fill the grid
    const remainingSlots = 42 - days.length;
    for (let date = 1; date <= remainingSlots; date++) {
      days.push({ date: new Date(year, month + 1, date), isCurrentMonth: false });
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const today = new Date();
  
  // Month navigation
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Format date to YYYY-MM-DD using local timezone
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDatePress = (date: Date) => {
    if (isConfirmed) return; // Don't allow changes after confirmation
    
    const dateStr = formatLocalDate(date);
    
    if (mode === 'single') {
      setStartDate(date);
      setSelectedPeriod({ startDate: dateStr, endDate: dateStr });
      return;
    }

    if (!startDate) {
      setStartDate(date);
      setEndDate(null);
      setSelectedPeriod(null);
    } else if (!endDate) {
      if (date >= startDate) {
        setEndDate(date);
        setSelectedPeriod({
          startDate: formatLocalDate(startDate),
          endDate: dateStr
        });
      } else {
        // Reset if selecting earlier date
        setStartDate(date);
        setEndDate(null);
        setSelectedPeriod(null);
      }
    } else {
      // Reset selection
      setStartDate(date);
      setEndDate(null);
      setSelectedPeriod(null);
    }
  };

  const handleConfirm = () => {
    if (selectedPeriod) {
      setIsConfirmed(true);
      // Call onConfirm if provided, otherwise fall back to onSelect
      if (onConfirm) {
        onConfirm(selectedPeriod as SlotValue);
      } else {
        onSelect(selectedPeriod as SlotValue);
      }
    }
  };
  
  const handleEdit = () => {
    setIsConfirmed(false);
  };

  const isDateInRange = (date: Date) => {
    if (!startDate) return false;
    if (mode === 'single') return date.toDateString() === startDate.toDateString();
    if (!endDate) return date.toDateString() === startDate.toDateString();
    return date >= startDate && date <= endDate;
  };

  const isDateStart = (date: Date) => startDate && date.toDateString() === startDate.toDateString();
  const isDateEnd = (date: Date) => endDate && date.toDateString() === endDate.toDateString();

  return (
    <View className={`bg-white rounded-lg p-4 mt-2 ${isActive && !isConfirmed ? 'border-4 border-blue-500' : 'border border-gray-200'}`}>
      <Text className="text-sm font-medium text-gray-700 mb-3">{label}</Text>
      
      {!isConfirmed ? (
        <>
          {/* Calendar Header with navigation */}
          <View className="flex-row justify-between items-center mb-2">
            <TouchableOpacity onPress={goToPreviousMonth} className="p-2">
              <Text className="text-blue-600 text-lg font-bold">◀</Text>
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-gray-800">
              {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
            </Text>
            <TouchableOpacity onPress={goToNextMonth} className="p-2">
              <Text className="text-blue-600 text-lg font-bold">▶</Text>
            </TouchableOpacity>
          </View>
          
          <Text className="text-xs text-gray-500 text-center mb-2">
            {mode === 'range' ? '시작일과 종료일을 선택' : '날짜를 선택'}
          </Text>

          {/* Weekday headers */}
          <View className="flex-row mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <View key={`weekday-header-${day}`} className="flex-1 items-center">
                <Text className="text-xs font-medium text-gray-500">{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid - 7 columns (Sun-Sat) */}
          <View className="flex-row flex-wrap">
            {calendarDays.map((dayData) => {
              const { date, isCurrentMonth } = dayData;
              const isPast = date < today && date.toDateString() !== today.toDateString();
              const isSelected = isDateInRange(date);
              const isStart = isDateStart(date);
              const isEnd = isDateEnd(date);
              
              // Globally unique key using full ISO date
              const dateKey = `cal-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getTime()}`;
              
              return (
                <TouchableOpacity
                  key={dateKey}
                  onPress={() => handleDatePress(date)}
                  disabled={isPast || !isCurrentMonth}
                  style={{ width: '14.28%' }}
                  className={`aspect-square items-center justify-center rounded ${
                    isPast || !isCurrentMonth
                      ? 'bg-gray-100'
                      : isSelected
                      ? isStart || isEnd
                        ? 'bg-blue-600'
                        : 'bg-blue-200'
                      : 'bg-gray-50'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      isPast || !isCurrentMonth
                        ? 'text-gray-400'
                        : isSelected
                        ? isStart || isEnd
                          ? 'text-white font-bold'
                          : 'text-blue-800'
                        : 'text-gray-700'
                    }`}
                  >
                    {date.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selection Info - Compact spacing */}
          {selectedPeriod && (
            <View className="mt-2 p-2 bg-blue-50 rounded">
              <Text className="text-xs text-blue-700 text-center">
                {selectedPeriod.startDate}
                {mode === 'range' && selectedPeriod.endDate !== selectedPeriod.startDate && 
                  ` ~ ${selectedPeriod.endDate}`
                }
              </Text>
            </View>
          )}

          {/* Confirm Button */}
          {selectedPeriod && (
            <TouchableOpacity
              onPress={handleConfirm}
              className="mt-2 bg-blue-500 py-2.5 px-4 rounded-lg"
            >
              <Text className="text-white text-center font-medium text-sm">네</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View className="p-4 bg-green-50 rounded-lg border border-green-200">
          <Text className="text-green-700 text-center font-medium">
            📅 {selectedPeriod?.startDate}
            {mode === 'range' && selectedPeriod?.endDate !== selectedPeriod?.startDate && 
              ` ~ ${selectedPeriod?.endDate}`
            }
          </Text>
        </View>
      )}
    </View>
  );
}

// Chips Widget for multi-selection
export function ChipsWidget({ 
  label, 
  value, 
  onSelect,
  onConfirm,
  options = [], 
  defaultValue = [],
  isActive = true
}: BaseWidgetProps & { 
  options?: string[]; 
  defaultValue?: string[];
  isActive?: boolean;
}) {
  const [localSelection, setLocalSelection] = useState<string[]>(() => {
    // Use existing value or default value
    if (Array.isArray(value) && (value as string[]).length > 0) {
      return value as string[];
    }
    return Array.isArray(defaultValue) ? defaultValue : [];
  });
  const [isConfirmed, setIsConfirmed] = useState(false);

  const toggleOption = (option: string) => {
    if (isConfirmed) return;
    
    const newSelection = localSelection.includes(option)
      ? localSelection.filter(v => v !== option)
      : [...localSelection, option];
    setLocalSelection(newSelection);
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    if (onConfirm) {
      onConfirm(localSelection as SlotValue);
    } else {
      onSelect(localSelection as SlotValue);
    }
  };

  return (
    <View className={`bg-white rounded-lg p-4 mt-2 ${isActive && !isConfirmed ? 'border-4 border-blue-500' : 'border border-gray-200'}`}>
      <Text className="text-sm font-medium text-gray-700 mb-3">{label}</Text>
      {!isConfirmed ? (
        <>
          <View className="flex-row flex-wrap">
            {options.map((option, optIndex) => {
              const isSelected = localSelection.includes(option);
              return (
                <TouchableOpacity
                  key={`chip-${label}-${option}-${optIndex}`}
                  onPress={() => toggleOption(option)}
                  className={`mr-2 mb-2 px-4 py-2.5 rounded-full border-2 ${
                    isSelected 
                      ? 'bg-blue-500 border-blue-500' 
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <Text className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Confirm Button */}
          {localSelection.length > 0 && (
            <TouchableOpacity
              onPress={handleConfirm}
              className="mt-3 bg-blue-500 py-3 px-4 rounded-lg"
            >
              <Text className="text-white text-center font-medium">네</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View className="p-3 bg-green-50 rounded-lg border border-green-200">
          <Text className="text-green-700 text-center font-medium">
            ✓ {localSelection.join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
}

// Toggle Widget for boolean values
export function ToggleWidget({ label, value, onSelect, onConfirm, isActive = true }: BaseWidgetProps & { isActive?: boolean }) {
  const [localValue, setLocalValue] = useState(Boolean(value));
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleToggle = () => {
    if (!isConfirmed) {
      setLocalValue(!localValue);
    }
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    if (onConfirm) {
      onConfirm(localValue);
    } else {
      onSelect(localValue);
    }
  };

  return (
    <View className={`bg-white rounded-lg p-4 mt-2 ${isActive && !isConfirmed ? 'border-4 border-blue-500' : 'border border-gray-200'}`}>
      {!isConfirmed ? (
        <>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-gray-700">{label}</Text>
            <TouchableOpacity
              onPress={handleToggle}
              className={`w-12 h-6 rounded-full flex-row items-center px-1 ${
                localValue ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <View
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  localValue ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            onPress={handleConfirm}
            className="mt-4 bg-blue-500 py-3 px-4 rounded-lg"
          >
            <Text className="text-white text-center font-medium">네</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View className="p-3 bg-green-50 rounded-lg border border-green-200">
          <Text className="text-green-700 text-center font-medium">
            {localValue ? '✓ 활성화' : '○ 비활성화'}
          </Text>
        </View>
      )}
    </View>
  );
}

// Counter Widget for numeric values with direct input
export function CounterWidget({ 
  label, 
  value, 
  onSelect,
  onConfirm,
  min = 1, 
  max = 10, 
  defaultValue = min,
  isActive = true
}: BaseWidgetProps & { 
  min?: number; 
  max?: number; 
  defaultValue?: number;
  isActive?: boolean;
}) {
  const [localValue, setLocalValue] = useState(() => {
    // Use existing value or default value
    if (value !== undefined && value !== null) {
      return Number(value);
    }
    return Number(defaultValue) || min;
  });
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [inputValue, setInputValue] = useState(String(localValue));

  const increment = () => {
    if (!isConfirmed && localValue < max) {
      const newValue = localValue + 1;
      setLocalValue(newValue);
      setInputValue(String(newValue));
    }
  };

  const decrement = () => {
    if (!isConfirmed && localValue > min) {
      const newValue = localValue - 1;
      setLocalValue(newValue);
      setInputValue(String(newValue));
    }
  };

  const handleInputChange = (text: string) => {
    setInputValue(text);
    const numValue = parseInt(text, 10);
    if (!isNaN(numValue) && numValue >= min && numValue <= max) {
      setLocalValue(numValue);
    }
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    if (onConfirm) {
      onConfirm(localValue);
    } else {
      onSelect(localValue);
    }
  };

  return (
    <View className={`bg-white rounded-lg p-4 mt-2 ${isActive && !isConfirmed ? 'border-4 border-blue-500' : 'border border-gray-200'}`}>
      <Text className="text-sm font-medium text-gray-700 mb-3">{label}</Text>
      {!isConfirmed ? (
        <>
          <View className="flex-row items-center justify-center">
            <TouchableOpacity
              onPress={decrement}
              disabled={localValue <= min}
              className={`w-10 h-10 rounded-full items-center justify-center ${
                localValue <= min ? 'bg-gray-200' : 'bg-blue-100'
              }`}
            >
              <Text className={`text-xl font-bold ${localValue <= min ? 'text-gray-400' : 'text-blue-600'}`}>
                −
              </Text>
            </TouchableOpacity>
            
            {/* Direct input field */}
            <TextInput
              value={inputValue}
              onChangeText={handleInputChange}
              keyboardType="number-pad"
              className="mx-4 text-2xl font-bold text-blue-800 text-center border-b-2 border-blue-300 w-16"
              maxLength={3}
            />
            
            <TouchableOpacity
              onPress={increment}
              disabled={localValue >= max}
              className={`w-10 h-10 rounded-full items-center justify-center ${
                localValue >= max ? 'bg-gray-200' : 'bg-blue-100'
              }`}
            >
              <Text className={`text-xl font-bold ${localValue >= max ? 'text-gray-400' : 'text-blue-600'}`}>
                +
              </Text>
            </TouchableOpacity>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            onPress={handleConfirm}
            className="mt-4 bg-blue-500 py-3 px-4 rounded-lg"
          >
            <Text className="text-white text-center font-medium">네</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View className="p-3 bg-green-50 rounded-lg border border-green-200">
          <Text className="text-green-700 text-center font-medium">
            {label.includes('달성률') ? `📊 ${localValue}%` : `🎯 주 ${localValue}회`}
          </Text>
        </View>
      )}
    </View>
  );
}

// Time Picker Widget with pre-population support
export function TimePickerWidget({ label, value, onSelect, onConfirm, defaultValue, isActive = true }: BaseWidgetProps & { defaultValue?: string; isActive?: boolean }) {
  // Parse default value if provided (HH:MM format)
  const parseTime = (timeStr?: string) => {
    if (timeStr && typeof timeStr === 'string') {
      const parts = timeStr.split(':');
      if (parts.length === 2) {
        return {
          hour: parseInt(parts[0], 10) || 9,
          minute: parseInt(parts[1], 10) || 0
        };
      }
    }
    return { hour: 9, minute: 0 };
  };

  const initialTime = parseTime(defaultValue);
  const [hour, setHour] = useState(initialTime.hour);
  const [minute, setMinute] = useState(initialTime.minute);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const formatTime = (h: number, m: number) => {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const handleTimeChange = (newHour: number, newMinute: number) => {
    if (!isConfirmed) {
      setHour(newHour);
      setMinute(newMinute);
    }
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    const timeValue = formatTime(hour, minute);
    if (onConfirm) {
      onConfirm(timeValue);
    } else {
      onSelect(timeValue);
    }
  };

  return (
    <View className={`bg-white rounded-lg p-4 mt-2 ${isActive && !isConfirmed ? 'border-4 border-blue-500' : 'border border-gray-200'}`}>
      <Text className="text-sm font-medium text-gray-700 mb-3">{label}</Text>
      {!isConfirmed ? (
        <>
          <View className="flex-row items-center justify-center">
            {/* Hour selector */}
            <View className="items-center">
              <TouchableOpacity
                onPress={() => handleTimeChange((hour + 1) % 24, minute)}
                className="w-8 h-8 rounded items-center justify-center bg-blue-100"
              >
                <Text className="text-blue-600">▲</Text>
              </TouchableOpacity>
              <Text className="text-2xl font-bold text-blue-800 my-2">
                {hour.toString().padStart(2, '0')}
              </Text>
              <TouchableOpacity
                onPress={() => handleTimeChange(hour === 0 ? 23 : hour - 1, minute)}
                className="w-8 h-8 rounded items-center justify-center bg-blue-100"
              >
                <Text className="text-blue-600">▼</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-2xl font-bold text-blue-800 mx-3">:</Text>

            {/* Minute selector */}
            <View className="items-center">
              <TouchableOpacity
                onPress={() => handleTimeChange(hour, (minute + 15) % 60)}
                className="w-8 h-8 rounded items-center justify-center bg-blue-100"
              >
                <Text className="text-blue-600">▲</Text>
              </TouchableOpacity>
              <Text className="text-2xl font-bold text-blue-800 my-2">
                {minute.toString().padStart(2, '0')}
              </Text>
              <TouchableOpacity
                onPress={() => handleTimeChange(hour, minute === 0 ? 45 : minute - 15)}
                className="w-8 h-8 rounded items-center justify-center bg-blue-100"
              >
                <Text className="text-blue-600">▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            onPress={handleConfirm}
            className="mt-4 bg-blue-500 py-3 px-4 rounded-lg"
          >
            <Text className="text-white text-center font-medium">네</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View className="p-3 bg-green-50 rounded-lg border border-green-200">
          <Text className="text-green-700 text-center font-medium">
            🕐 {formatTime(hour, minute)}
          </Text>
        </View>
      )}
    </View>
  );
}

// Weekdays Widget for selecting days of week with pre-population
export function WeekdaysWidget({ label, value, onSelect, onConfirm, defaultValue, isActive = true }: BaseWidgetProps & { defaultValue?: number[]; isActive?: boolean }) {
  const [localSelection, setLocalSelection] = useState<number[]>(() => {
    // Use defaultValue if provided, otherwise use value, otherwise empty
    if (Array.isArray(defaultValue) && defaultValue.length > 0) {
      return defaultValue;
    }
    if (Array.isArray(value) && (value as number[]).length > 0) {
      return value as number[];
    }
    return [];
  });
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  const weekdays = [
    { id: 1, name: '월', full: '월요일' },
    { id: 2, name: '화', full: '화요일' },
    { id: 3, name: '수', full: '수요일' },
    { id: 4, name: '목', full: '목요일' },
    { id: 5, name: '금', full: '금요일' },
    { id: 6, name: '토', full: '토요일' },
    { id: 0, name: '일', full: '일요일' }
  ];

  const toggleDay = (dayId: number) => {
    if (isConfirmed) return;
    
    const newSelection = localSelection.includes(dayId)
      ? localSelection.filter(d => d !== dayId)
      : [...localSelection, dayId];
    setLocalSelection(newSelection);
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    if (onConfirm) {
      onConfirm(localSelection as SlotValue);
    } else {
      onSelect(localSelection as SlotValue);
    }
  };

  const getSelectedDayNames = () => {
    return localSelection
      .map(dayId => weekdays.find(day => day.id === dayId)?.full)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <View className={`bg-white rounded-lg p-4 mt-2 ${isActive && !isConfirmed ? 'border-4 border-blue-500' : 'border border-gray-200'}`}>
      <Text className="text-sm font-medium text-gray-700 mb-3">{label}</Text>
      {!isConfirmed ? (
        <>
          <View className="flex-row justify-between">
            {weekdays.map(day => {
              const isSelected = localSelection.includes(day.id);
              return (
                <TouchableOpacity
                  key={day.id}
                  onPress={() => toggleDay(day.id)}
                  className={`w-10 h-10 rounded-full items-center justify-center border-2 ${
                    isSelected 
                      ? 'bg-blue-500 border-blue-500' 
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <Text className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                    {day.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Confirm Button */}
          {localSelection.length > 0 && (
            <TouchableOpacity
              onPress={handleConfirm}
              className="mt-4 bg-blue-500 py-3 px-4 rounded-lg"
            >
              <Text className="text-white text-center font-medium">네</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View className="p-3 bg-green-50 rounded-lg border border-green-200">
          <Text className="text-green-700 text-center font-medium">
            📆 {getSelectedDayNames()}
          </Text>
        </View>
      )}
    </View>
  );
}

// Text Input Widget
export function TextInputWidget({ label, value, onSelect }: BaseWidgetProps) {
  const [text, setText] = useState(String(value || ''));

  const handleSubmit = () => {
    onSelect(text);
  };

  return (
    <View className="bg-white border border-gray-200 rounded-lg p-4 mt-2">
      <Text className="text-sm font-medium text-gray-700 mb-3">{label}</Text>
      <View className="flex-row">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="목표를 입력해주세요"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 mr-2"
        />
        <TouchableOpacity
          onPress={handleSubmit}
          className="bg-blue-500 px-4 py-2 rounded-lg"
        >
          <Text className="text-white font-medium">확인</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Enhanced Verification Widget
export function VerificationWidget({ 
  goalType, 
  value, 
  onSelect 
}: { 
  goalType: 'schedule' | 'frequency' | 'milestone';
  value?: SlotValue;
  onSelect: (value: SlotValue) => void;
}) {
  const selectedMethods = Array.isArray(value) ? value as VerificationMethod[] : [];

  const handleMethodsChange = (methods: VerificationMethod[]) => {
    onSelect(methods as SlotValue);
  };

  return (
    <VerificationSelector
      goalType={goalType}
      selectedMethods={selectedMethods}
      onMethodsChange={handleMethodsChange}
      showDescription={true}
    />
  );
}
