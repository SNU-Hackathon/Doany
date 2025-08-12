// Simple Date Picker Component - Schedule Step with Calendar

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { convertDurationToRange } from '../features/goals/aiDraft';
import { AIGoal } from '../types';

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
  autoExpandWeeklySchedule?: boolean;
  aiGoal?: AIGoal;
  onWeeklyScheduleChange?: (weekdays: Set<number>, timeSettings: { [key: string]: string }) => void;
}

export default function SimpleDatePicker({
  startDate: initialStartDate,
  endDate: initialEndDate,
  onStartDateChange,
  onEndDateChange,
  onNavigateToStep,
  autoExpandWeeklySchedule = false,
  aiGoal,
  onWeeklyScheduleChange
}: SimpleDatePickerProps) {
  const today = new Date().toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(initialStartDate || today);
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [durationType, setDurationType] = useState<'days' | 'weeks' | 'months'>('weeks');
  const [durationValue, setDurationValue] = useState('2');
  
  // Calendar navigation state
  const [currentMonth, setCurrentMonth] = useState(new Date(startDate || today));
  
  // Weekday-based goal state for Weekly Schedule
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(new Set());
  const [selectedTime, setSelectedTime] = useState<string>('10:00');
  
  // Accordion state for Weekly Schedule - auto-expand if AI suggests it
  const [showWeeklySchedule, setShowWeeklySchedule] = useState(autoExpandWeeklySchedule);
  const [weeklyTimeSettings, setWeeklyTimeSettings] = useState<{ [key: string]: string }>({});
  const [isEditingWeeklySchedule, setIsEditingWeeklySchedule] = useState(false);

  // Use ref to track previous weekly schedule data
  const prevWeeklyDataRef = useRef<string>('');

  // Initialize weekly schedule from AI data if available
  useEffect(() => {
    if (autoExpandWeeklySchedule && aiGoal?.weeklySchedule) {
      const weekdays = new Set<number>();
      const timeSettings: { [key: string]: string } = {};
      
      // Convert day names to indices and set times
      Object.entries(aiGoal.weeklySchedule).forEach(([day, time]) => {
        const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
          .indexOf(day.toLowerCase());
        if (dayIndex !== -1) {
          weekdays.add(dayIndex);
          timeSettings[dayIndex] = time;
        }
      });
      
      // Set initial values without triggering callback
      setSelectedWeekdays(weekdays);
      setWeeklyTimeSettings(timeSettings);
      setShowWeeklySchedule(true); // Auto-open when AI suggests it
      
      // Update ref to prevent unnecessary callback
      prevWeeklyDataRef.current = JSON.stringify({ 
        weekdays: Array.from(weekdays), 
        timeSettings 
      });
    }
  }, [autoExpandWeeklySchedule, aiGoal?.weeklySchedule]);

  // Auto-open weekly schedule if AI detects time-related information
  useEffect(() => {
    if (aiGoal?.title) {
      const title = aiGoal.title.toLowerCase();
      const hasTimeInfo = /\d{1,2}:\d{2}|am|pm|morning|evening|night|hour|o'clock/.test(title);
      const hasDayInfo = /monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|weekly/.test(title);
      
      if (hasTimeInfo || hasDayInfo) {
        setShowWeeklySchedule(true);
        
        // Auto-populate with detected information
        if (aiGoal.weeklySchedule) {
          const weekdays = new Set<number>();
          const timeSettings: { [key: string]: string } = {};
          
          Object.entries(aiGoal.weeklySchedule).forEach(([day, time]) => {
            const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
              .indexOf(day.toLowerCase());
            if (dayIndex !== -1) {
              weekdays.add(dayIndex);
              timeSettings[dayIndex] = time;
            }
          });
          
          setSelectedWeekdays(weekdays);
          setWeeklyTimeSettings(timeSettings);
        }
      }
    }
  }, [aiGoal?.title, aiGoal?.weeklySchedule]);

  // Notify parent component when weekly schedule changes
  useEffect(() => {
    if (onWeeklyScheduleChange) {
      const currentData = JSON.stringify({ 
        weekdays: Array.from(selectedWeekdays), 
        timeSettings: weeklyTimeSettings 
      });
      
      // Only notify if data actually changed
      if (currentData !== prevWeeklyDataRef.current) {
        prevWeeklyDataRef.current = currentData;
        onWeeklyScheduleChange(selectedWeekdays, weeklyTimeSettings);
      }
    }
  }, [selectedWeekdays, weeklyTimeSettings, onWeeklyScheduleChange]);

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
    
    const days = [];
    
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
    // Always calculate end date based on duration
    const value = parseInt(durationValue) || 1;
    const range = convertDurationToRange(dateStr, durationType, value);
    setEndDate(range.endDate);
  };

  const handleDurationChange = (value: string) => {
    setDurationValue(value);
    if (startDate && value) {
      const numValue = parseInt(value) || 1;
      const range = convertDurationToRange(startDate, durationType, numValue);
      setEndDate(range.endDate);
    }
  };

  const handleDurationTypeChange = (type: 'days' | 'weeks' | 'months') => {
    setDurationType(type);
    if (startDate && durationValue) {
      const numValue = parseInt(durationValue) || 1;
      const range = convertDurationToRange(startDate, type, numValue);
      setEndDate(range.endDate);
    }
  };

  const calendarDays = generateCalendarDays();

  return (
    <View className="bg-white rounded-lg p-4 m-4">
      {/* Header - Just title text, no box wrapper */}
      <View className="mb-6">
        <Text className="text-2xl font-bold text-gray-800 text-center">
          Schedule
        </Text>
        <Text className="text-gray-600 text-center mt-2">
          Set your goal duration and schedule
        </Text>
      </View>

      {/* Duration Controls - Larger size */}
      <View className="mb-6 p-4 bg-blue-50 rounded-lg">
          <Text className="text-blue-800 font-semibold text-lg mb-3">Duration</Text>
          <View className="flex-row items-center space-x-3">
            <TextInput
              className="bg-white border border-blue-300 rounded-lg px-4 py-3 text-center w-20 text-lg"
              value={durationValue}
              onChangeText={handleDurationChange}
              keyboardType="number-pad"
              placeholder="1"
              maxLength={3}
            />
            <View className="flex-row space-x-2">
              {(['days', 'weeks', 'months'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  className={`px-4 py-3 rounded-lg ${
                    durationType === type ? 'bg-blue-600' : 'bg-white border border-blue-300'
                  }`}
                  onPress={() => handleDurationTypeChange(type)}
                >
                  <Text className={`text-base font-semibold ${
                    durationType === type ? 'text-white' : 'text-blue-600'
                  }`}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {endDate && (
            <Text className="text-blue-700 text-base mt-3">
              Will end on: {new Date(endDate).toLocaleDateString()}
            </Text>
          )}
        </View>

        {/* Weekly Schedule Section */}
        <View className="mt-6 bg-white rounded-lg p-4 border border-gray-200">
          <TouchableOpacity
            onPress={() => setShowWeeklySchedule(!showWeeklySchedule)}
            className="flex-row items-center justify-between mb-3"
          >
            <View className="flex-row items-center">
              <Ionicons name="calendar" size={20} color="#059669" />
              <Text className="text-lg font-semibold text-gray-800 ml-2">Weekly Schedule</Text>
              {selectedWeekdays.size > 0 && (
                <View className="bg-green-100 px-2 py-1 rounded-full ml-2">
                  <Text className="text-green-800 text-xs font-medium">
                    {selectedWeekdays.size} days
                  </Text>
                </View>
              )}
            </View>
            <Ionicons
              name={showWeeklySchedule ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#6B7280"
            />
          </TouchableOpacity>

          {showWeeklySchedule && (
            <View>
              {!isEditingWeeklySchedule ? (
                // Display mode - show selected weekdays and times
                <View>
                  {selectedWeekdays.size > 0 ? (
                    <View>
                      <Text className="text-sm text-gray-600 mb-3">Scheduled days and times:</Text>
                      <View className="flex-row flex-wrap gap-2 mb-4">
                        {Array.from(selectedWeekdays).sort().map(dayIndex => {
                          const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex];
                          const time = weeklyTimeSettings[dayIndex] || '10:00';
                          return (
                            <View key={dayIndex} className="bg-green-100 px-3 py-2 rounded-full flex-row items-center">
                              <Text className="text-green-800 font-medium mr-2">{dayName}</Text>
                              <Text className="text-green-600">{time}</Text>
                            </View>
                          );
                        })}
                      </View>
                      <TouchableOpacity
                        onPress={() => setIsEditingWeeklySchedule(true)}
                        className="bg-blue-500 px-4 py-2 rounded-lg self-start"
                      >
                        <Text className="text-white font-medium">Edit Schedule</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View className="bg-gray-50 rounded-lg p-4 mb-3">
                      <Text className="text-gray-600 text-center">Please select days and set times</Text>
                    </View>
                  )}
                </View>
              ) : (
                // Edit mode - allow setting times for each weekday
                <View>
                  <Text className="text-sm text-gray-600 mb-3">Select weekdays and set specific times:</Text>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                    <View key={index} className="flex-row items-center justify-between mb-3 p-3 bg-gray-50 rounded-lg">
                      <View className="flex-row items-center">
                        <TouchableOpacity
                          onPress={() => {
                            const newWeekdays = new Set(selectedWeekdays);
                            if (newWeekdays.has(index)) {
                              newWeekdays.delete(index);
                              const newTimeSettings = { ...weeklyTimeSettings };
                              delete newTimeSettings[index];
                              setWeeklyTimeSettings(newTimeSettings);
                            } else {
                              newWeekdays.add(index);
                              setWeeklyTimeSettings(prev => ({ ...prev, [index]: '10:00' }));
                            }
                            setSelectedWeekdays(newWeekdays);
                          }}
                          className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${
                            selectedWeekdays.has(index) ? 'bg-green-500 border-green-500' : 'border-gray-300'
                          }`}
                        >
                          {selectedWeekdays.has(index) && (
                            <Ionicons name="checkmark" size={16} color="white" />
                          )}
                        </TouchableOpacity>
                        <Text className="text-gray-800 font-medium w-12">{day}</Text>
                      </View>
                      {selectedWeekdays.has(index) && (
                        <TouchableOpacity
                          onPress={() => {
                            // Show time picker for this day
                            const currentTime = weeklyTimeSettings[index] || '10:00';
                            // For now, we'll use a simple time input
                            // In a real app, you'd want a proper time picker
                            const newTime = prompt(`Set time for ${day} (HH:MM):`, currentTime);
                            if (newTime) {
                              // Validate time format
                              const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
                              if (timeRegex.test(newTime)) {
                                setWeeklyTimeSettings(prev => ({ ...prev, [index]: newTime }));
                              } else {
                                // Show error message
                                alert('Please enter time in HH:MM format (e.g., 09:30, 14:00)');
                              }
                            }
                          }}
                          className="bg-blue-100 px-3 py-2 rounded-lg"
                        >
                          <Text className="text-blue-800 font-medium">
                            {weeklyTimeSettings[index] || '10:00'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  <View className="flex-row gap-3 mt-4">
                    <TouchableOpacity
                      onPress={() => setIsEditingWeeklySchedule(false)}
                      className="flex-1 bg-green-500 px-4 py-3 rounded-lg"
                    >
                      <Text className="text-white font-medium text-center">Confirm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setIsEditingWeeklySchedule(false);
                        setSelectedWeekdays(new Set());
                        setWeeklyTimeSettings({});
                      }}
                      className="flex-1 bg-gray-500 px-4 py-3 rounded-lg"
                    >
                      <Text className="text-white font-medium text-center">Clear All</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

      {/* Calendar with Duration-based Display */}
      <View className="mb-6">
        {/* Month/Year Navigation */}
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity
            onPress={goToPreviousMonth}
            className="p-2"
          >
            <Ionicons name="chevron-back" size={24} color="#3B82F6" />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => {
              const currentYear = currentMonth.getFullYear();
              const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
              // Simple year selection - you can enhance this with a proper picker
              const nextYear = currentYear + 1;
              goToYear(nextYear);
            }}
            className="px-4 py-2"
          >
            <Text className="text-center text-lg font-bold text-gray-800">
              {currentMonth.toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
              })}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={goToNextMonth}
            className="p-2"
          >
            <Ionicons name="chevron-forward" size={24} color="#3B82F6" />
          </TouchableOpacity>
        </View>
        
        {/* Day headers */}
        <View className="flex-row mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <View key={day} className="flex-1">
              <Text className="text-center text-sm font-semibold text-gray-600">
                {day}
              </Text>
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
                  }`}>
                    {dayData.day}
                  </Text>
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

      {/* Selected Summary with validation */}
      {startDate && (
        <View className="mb-6 p-4 bg-gray-50 rounded-lg">
          <Text className="text-gray-700 font-semibold text-lg mb-2">Selected:</Text>
          <Text className="text-gray-600 text-base">
            Start: {new Date(startDate).toLocaleDateString()}
          </Text>
          {endDate && (
            <Text className="text-gray-600 text-base">
              End: {new Date(endDate).toLocaleDateString()}
            </Text>
          )}
          {startDate && endDate && endDate < startDate && (
            <Text className="text-red-600 text-sm mt-2">End date must be after start date.</Text>
          )}
        </View>
      )}

      {/* Navigation Buttons */}
      <View className="flex-row space-x-3">
        <TouchableOpacity
          onPress={() => onNavigateToStep && onNavigateToStep(0)}
          className="flex-1 bg-gray-200 rounded-lg py-3 flex-row items-center justify-center"
        >
          <Ionicons name="chevron-back" size={16} color="#6B7280" />
          <Text className="text-gray-700 font-semibold ml-2">Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => onNavigateToStep && onNavigateToStep(2)}
          className="flex-1 bg-blue-600 rounded-lg py-3 flex-row items-center justify-center"
          disabled={!startDate}
        >
          <Text className="text-white font-semibold mr-2">Next</Text>
          <Ionicons name="chevron-forward" size={16} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
