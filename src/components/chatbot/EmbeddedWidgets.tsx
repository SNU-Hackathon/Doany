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
}

// Advanced Calendar Widget using SimpleDatePicker
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
  
  // Initialize with auto-parsed data if available
  const [weeklySchedule, setWeeklySchedule] = useState<{ [key: string]: string[] }>({});
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);

  // Set initial values from auto-parsed data
  useEffect(() => {
    if (goalType === 'schedule' && value && typeof value === 'object') {
      const contextData = value as any;
      if (contextData?.autoWeeklySchedule) {
        setWeeklySchedule(contextData.autoWeeklySchedule);
        console.log('[AdvancedCalendarWidget] Setting auto-parsed weekly schedule:', contextData.autoWeeklySchedule);
      }
      if (contextData?.autoWeekdays) {
        setSelectedWeekdays(contextData.autoWeekdays);
        console.log('[AdvancedCalendarWidget] Setting auto-parsed weekdays:', contextData.autoWeekdays);
      }
    }
  }, [goalType, value]);

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

  const handleWeeklyScheduleChange = (weekdays: number[], timeSettings: { [key: string]: string[] }) => {
    setSelectedWeekdays(weekdays);
    setWeeklySchedule(timeSettings);
  };

  const handleConfirm = () => {
    if (selectedRanges.length > 0) {
      const range = selectedRanges[0];
      setIsConfirmed(true);
      
      console.log('[AdvancedCalendarWidget] Confirming selection:', {
        goalType,
        range: {
          start: range.start.toISOString().split('T')[0],
          end: range.end.toISOString().split('T')[0]
        },
        weeklySchedule,
        selectedWeekdays
      });
      
      // For schedule goals, include weekly schedule data
      if (goalType === 'schedule') {
        const selectionData = {
          startDate: range.start.toISOString().split('T')[0],
          endDate: range.end.toISOString().split('T')[0],
          weeklySchedule,
          weekdays: selectedWeekdays
        };
        console.log('[AdvancedCalendarWidget] Schedule selection data:', selectionData);
        onSelect(selectionData as SlotValue);
      } else {
        // For frequency/milestone goals, just the period
        const selectionData = {
          startDate: range.start.toISOString().split('T')[0],
          endDate: range.end.toISOString().split('T')[0]
        };
        console.log('[AdvancedCalendarWidget] Period selection data:', selectionData);
        onSelect(selectionData as SlotValue);
      }
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
            onWeeklyScheduleChange={handleWeeklyScheduleChange}
            initialSelectedWeekdays={selectedWeekdays}
            initialWeeklyTimeSettings={weeklySchedule}
            onNavigateToStep={() => {}} // Not used in chatbot context
            mode={goalType === 'schedule' ? 'period+weekly' : 'period'} // Schedule gets full calendar, frequency gets period only
            variant="compact"
            // Pass auto-parsed schedule hint
            goalTitle={goalType === 'schedule' ? '자동으로 파싱된 일정이 반영되었습니다' : undefined}
          />
          
          {/* Confirm Button */}
          {selectedRanges.length > 0 && (
            <TouchableOpacity
              onPress={handleConfirm}
              className="mt-4 bg-blue-500 py-3 px-4 rounded-lg"
            >
              <Text className="text-white text-center font-medium">선택 완료</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View className="p-4 bg-blue-50 rounded-lg">
          <Text className="text-blue-700 text-center">
            📅 {selectedRanges[0]?.start.toLocaleDateString('ko-KR')} ~ {selectedRanges[0]?.end.toLocaleDateString('ko-KR')}
          </Text>
          <Text className="text-blue-600 text-xs text-center mt-1">
            기간이 선택되었습니다
          </Text>
        </View>
      )}
    </View>
  );
}

// Calendar Widget for date/dateRange selection
export function CalendarWidget({ label, value, onSelect, mode = 'range' }: BaseWidgetProps & { mode?: 'single' | 'range' }) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<{startDate: string; endDate: string} | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Generate current month calendar
  const generateCalendarDays = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
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

  const handleDatePress = (date: Date) => {
    if (isConfirmed) return; // Don't allow changes after confirmation
    
    const dateStr = date.toISOString().split('T')[0];
    
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
          startDate: startDate.toISOString().split('T')[0],
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
      onSelect(selectedPeriod as SlotValue);
    }
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
    <View className="bg-white border border-gray-200 rounded-lg p-4 mt-2">
      <Text className="text-sm font-medium text-gray-700 mb-3">{label}</Text>
      
      {/* Calendar Header */}
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-lg font-semibold text-gray-800">
          {today.getFullYear()}년 {today.getMonth() + 1}월
        </Text>
        <Text className="text-xs text-gray-500">
          {mode === 'range' ? '시작일과 종료일을 선택' : '날짜를 선택'}
        </Text>
      </View>

      {/* Weekday headers */}
      <View className="flex-row mb-2">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
          <View key={index} className="flex-1 items-center">
            <Text className="text-xs font-medium text-gray-500">{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View className="flex-row flex-wrap">
        {calendarDays.map((dayData, index) => {
          const { date, isCurrentMonth } = dayData;
          const isPast = date < today && date.toDateString() !== today.toDateString();
          const isSelected = isDateInRange(date);
          const isStart = isDateStart(date);
          const isEnd = isDateEnd(date);
          
          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleDatePress(date)}
              disabled={isPast || !isCurrentMonth || isConfirmed}
              className={`w-[14.28%] aspect-square items-center justify-center m-0.5 rounded ${
                isPast || !isCurrentMonth
                  ? 'bg-gray-100'
                  : isSelected
                  ? isStart || isEnd
                    ? 'bg-blue-600'
                    : 'bg-blue-200'
                  : 'bg-gray-50'
              } ${isConfirmed ? 'opacity-60' : ''}`}
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

      {/* Selection Info */}
      {selectedPeriod && (
        <View className="mt-3 p-3 bg-blue-50 rounded">
          <Text className="text-sm text-blue-700">
            선택된 기간: {selectedPeriod.startDate}
            {mode === 'range' && selectedPeriod.endDate !== selectedPeriod.startDate && 
              ` ~ ${selectedPeriod.endDate}`
            }
          </Text>
        </View>
      )}

      {/* Confirm Button */}
      {selectedPeriod && !isConfirmed && (
        <TouchableOpacity
          onPress={handleConfirm}
          className="mt-3 bg-blue-500 py-3 px-4 rounded-lg"
        >
          <Text className="text-white text-center font-medium">선택 완료</Text>
        </TouchableOpacity>
      )}

      {/* Quick Options */}
      {!isConfirmed && (
        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity
            onPress={() => {
              const start = new Date();
              const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
              setStartDate(start);
              setEndDate(end);
              setSelectedPeriod({
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
              });
            }}
            className="flex-1 bg-gray-100 py-2 px-3 rounded"
          >
            <Text className="text-gray-700 text-center text-xs">1주일</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const start = new Date();
              const end = new Date(start.getTime() + 13 * 24 * 60 * 60 * 1000);
              setStartDate(start);
              setEndDate(end);
              setSelectedPeriod({
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
              });
            }}
            className="flex-1 bg-gray-100 py-2 px-3 rounded"
          >
            <Text className="text-gray-700 text-center text-xs">2주일</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const start = new Date();
              const end = new Date(start.getTime() + 29 * 24 * 60 * 60 * 1000);
              setStartDate(start);
              setEndDate(end);
              setSelectedPeriod({
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
              });
            }}
            className="flex-1 bg-gray-100 py-2 px-3 rounded"
          >
            <Text className="text-gray-700 text-center text-xs">1개월</Text>
          </TouchableOpacity>
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
  options = [], 
  defaultValue = [] 
}: BaseWidgetProps & { 
  options?: string[]; 
  defaultValue?: string[];
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
    onSelect(localSelection as SlotValue);
  };

  return (
    <View className="bg-white border border-gray-200 rounded-lg p-4 mt-2">
      <Text className="text-sm font-medium text-gray-700 mb-3">{label}</Text>
      <View className="flex-row flex-wrap">
        {options.map(option => {
          const isSelected = localSelection.includes(option);
          return (
            <TouchableOpacity
              key={option}
              onPress={() => toggleOption(option)}
              disabled={isConfirmed}
              className={`mr-2 mb-2 px-3 py-2 rounded-full border ${
                isSelected 
                  ? 'bg-blue-500 border-blue-500' 
                  : 'bg-white border-gray-300'
              } ${isConfirmed ? 'opacity-60' : ''}`}
            >
              <Text className={`text-sm ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Selection Summary */}
      {localSelection.length > 0 && (
        <View className="mt-3 p-3 bg-blue-50 rounded">
          <Text className="text-sm text-blue-700">
            선택: {localSelection.join(', ')}
          </Text>
        </View>
      )}

      {/* Confirm Button */}
      {localSelection.length > 0 && !isConfirmed && (
        <TouchableOpacity
          onPress={handleConfirm}
          className="mt-3 bg-blue-500 py-3 px-4 rounded-lg"
        >
          <Text className="text-white text-center font-medium">선택 완료</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Toggle Widget for boolean values
export function ToggleWidget({ label, value, onSelect }: BaseWidgetProps) {
  const [localValue, setLocalValue] = useState(Boolean(value));
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleToggle = () => {
    if (!isConfirmed) {
      setLocalValue(!localValue);
    }
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    onSelect(localValue);
  };

  return (
    <View className="bg-white border border-gray-200 rounded-lg p-4 mt-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-gray-700">{label}</Text>
        <TouchableOpacity
          onPress={handleToggle}
          disabled={isConfirmed}
          className={`w-12 h-6 rounded-full flex-row items-center px-1 ${
            localValue ? 'bg-blue-500' : 'bg-gray-300'
          } ${isConfirmed ? 'opacity-60' : ''}`}
        >
          <View
            className={`w-4 h-4 rounded-full bg-white transition-transform ${
              localValue ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </TouchableOpacity>
      </View>

      {/* Current Selection */}
      <View className="mt-3 p-3 bg-blue-50 rounded">
        <Text className="text-sm text-blue-700 text-center">
          선택: {localValue ? '활성화' : '비활성화'}
        </Text>
      </View>

      {/* Confirm Button */}
      {!isConfirmed && (
        <TouchableOpacity
          onPress={handleConfirm}
          className="mt-3 bg-blue-500 py-3 px-4 rounded-lg"
        >
          <Text className="text-white text-center font-medium">선택 완료</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Counter Widget for numeric values
export function CounterWidget({ 
  label, 
  value, 
  onSelect, 
  min = 1, 
  max = 10, 
  defaultValue = min 
}: BaseWidgetProps & { 
  min?: number; 
  max?: number; 
  defaultValue?: number;
}) {
  const [localValue, setLocalValue] = useState(() => {
    // Use existing value or default value
    if (value !== undefined && value !== null) {
      return Number(value);
    }
    return Number(defaultValue) || min;
  });
  const [isConfirmed, setIsConfirmed] = useState(false);

  const increment = () => {
    if (!isConfirmed && localValue < max) {
      setLocalValue(localValue + 1);
    }
  };

  const decrement = () => {
    if (!isConfirmed && localValue > min) {
      setLocalValue(localValue - 1);
    }
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    onSelect(localValue);
  };

  return (
    <View className="bg-white border border-gray-200 rounded-lg p-4 mt-2">
      <Text className="text-sm font-medium text-gray-700 mb-3">{label}</Text>
      <View className="flex-row items-center justify-center">
        <TouchableOpacity
          onPress={decrement}
          disabled={localValue <= min || isConfirmed}
          className={`w-10 h-10 rounded-full items-center justify-center ${
            localValue <= min || isConfirmed ? 'bg-gray-200' : 'bg-blue-100'
          }`}
        >
          <Text className={`text-xl font-bold ${localValue <= min || isConfirmed ? 'text-gray-400' : 'text-blue-600'}`}>
            −
          </Text>
        </TouchableOpacity>
        
        <Text className="mx-6 text-2xl font-bold text-blue-800">
          {localValue}
        </Text>
        
        <TouchableOpacity
          onPress={increment}
          disabled={localValue >= max || isConfirmed}
          className={`w-10 h-10 rounded-full items-center justify-center ${
            localValue >= max || isConfirmed ? 'bg-gray-200' : 'bg-blue-100'
          }`}
        >
          <Text className={`text-xl font-bold ${localValue >= max || isConfirmed ? 'text-gray-400' : 'text-blue-600'}`}>
            +
          </Text>
        </TouchableOpacity>
      </View>

      {/* Current Selection */}
      <View className="mt-3 p-3 bg-blue-50 rounded">
        <Text className="text-sm text-blue-700 text-center">
          선택된 값: {localValue}
        </Text>
      </View>

      {/* Confirm Button */}
      {!isConfirmed && (
        <TouchableOpacity
          onPress={handleConfirm}
          className="mt-3 bg-blue-500 py-3 px-4 rounded-lg"
        >
          <Text className="text-white text-center font-medium">선택 완료</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Time Picker Widget
export function TimePickerWidget({ label, value, onSelect }: BaseWidgetProps) {
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
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
    onSelect(formatTime(hour, minute));
  };

  return (
    <View className="bg-white border border-gray-200 rounded-lg p-4 mt-2">
      <Text className="text-sm font-medium text-gray-700 mb-3">{label}</Text>
      <View className="flex-row items-center justify-center">
        {/* Hour selector */}
        <View className="items-center">
          <TouchableOpacity
            onPress={() => handleTimeChange((hour + 1) % 24, minute)}
            disabled={isConfirmed}
            className={`w-8 h-8 rounded items-center justify-center ${
              isConfirmed ? 'bg-gray-200' : 'bg-blue-100'
            }`}
          >
            <Text className={isConfirmed ? 'text-gray-400' : 'text-blue-600'}>▲</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-blue-800 my-2">
            {hour.toString().padStart(2, '0')}
          </Text>
          <TouchableOpacity
            onPress={() => handleTimeChange(hour === 0 ? 23 : hour - 1, minute)}
            disabled={isConfirmed}
            className={`w-8 h-8 rounded items-center justify-center ${
              isConfirmed ? 'bg-gray-200' : 'bg-blue-100'
            }`}
          >
            <Text className={isConfirmed ? 'text-gray-400' : 'text-blue-600'}>▼</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-2xl font-bold text-blue-800 mx-3">:</Text>

        {/* Minute selector */}
        <View className="items-center">
          <TouchableOpacity
            onPress={() => handleTimeChange(hour, (minute + 15) % 60)}
            disabled={isConfirmed}
            className={`w-8 h-8 rounded items-center justify-center ${
              isConfirmed ? 'bg-gray-200' : 'bg-blue-100'
            }`}
          >
            <Text className={isConfirmed ? 'text-gray-400' : 'text-blue-600'}>▲</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-blue-800 my-2">
            {minute.toString().padStart(2, '0')}
          </Text>
          <TouchableOpacity
            onPress={() => handleTimeChange(hour, minute === 0 ? 45 : minute - 15)}
            disabled={isConfirmed}
            className={`w-8 h-8 rounded items-center justify-center ${
              isConfirmed ? 'bg-gray-200' : 'bg-blue-100'
            }`}
          >
            <Text className={isConfirmed ? 'text-gray-400' : 'text-blue-600'}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Current Selection */}
      <View className="mt-3 p-3 bg-blue-50 rounded">
        <Text className="text-sm text-blue-700 text-center">
          선택된 시간: {formatTime(hour, minute)}
        </Text>
      </View>

      {/* Confirm Button */}
      {!isConfirmed && (
        <TouchableOpacity
          onPress={handleConfirm}
          className="mt-3 bg-blue-500 py-3 px-4 rounded-lg"
        >
          <Text className="text-white text-center font-medium">선택 완료</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Weekdays Widget for selecting days of week
export function WeekdaysWidget({ label, value, onSelect }: BaseWidgetProps) {
  const [localSelection, setLocalSelection] = useState<number[]>(
    Array.isArray(value) ? (value as number[]) : []
  );
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
    onSelect(localSelection as SlotValue);
  };

  const getSelectedDayNames = () => {
    return localSelection
      .map(dayId => weekdays.find(day => day.id === dayId)?.full)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <View className="bg-white border border-gray-200 rounded-lg p-4 mt-2">
      <Text className="text-sm font-medium text-gray-700 mb-3">{label}</Text>
      <View className="flex-row justify-between">
        {weekdays.map(day => {
          const isSelected = localSelection.includes(day.id);
          return (
            <TouchableOpacity
              key={day.id}
              onPress={() => toggleDay(day.id)}
              disabled={isConfirmed}
              className={`w-10 h-10 rounded-full items-center justify-center border ${
                isSelected 
                  ? 'bg-blue-500 border-blue-500' 
                  : 'bg-white border-gray-300'
              } ${isConfirmed ? 'opacity-60' : ''}`}
            >
              <Text className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                {day.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selection Summary */}
      {localSelection.length > 0 && (
        <View className="mt-3 p-3 bg-blue-50 rounded">
          <Text className="text-sm text-blue-700">
            선택된 요일: {getSelectedDayNames()}
          </Text>
        </View>
      )}

      {/* Confirm Button */}
      {localSelection.length > 0 && !isConfirmed && (
        <TouchableOpacity
          onPress={handleConfirm}
          className="mt-3 bg-blue-500 py-3 px-4 rounded-lg"
        >
          <Text className="text-white text-center font-medium">선택 완료</Text>
        </TouchableOpacity>
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
