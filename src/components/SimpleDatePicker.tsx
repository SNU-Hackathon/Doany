// Simple Date Picker Component - Fallback without external dependencies

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
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
  onConfirm: (selection: DateSelection) => void;
  onCancel: () => void;
  initialStartDate?: string;
  initialEndDate?: string;
}

export default function SimpleDatePicker({
  onConfirm,
  onCancel,
  initialStartDate,
  initialEndDate
}: SimpleDatePickerProps) {
  const today = new Date().toISOString().split('T')[0];
  
  const mode = 'duration'; // Only use duration mode
  const [startDate, setStartDate] = useState(initialStartDate || today);
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [durationType, setDurationType] = useState<'days' | 'weeks' | 'months'>('weeks');
  const [durationValue, setDurationValue] = useState('2');
  
  // Calendar navigation state
  const [currentMonth, setCurrentMonth] = useState(new Date(startDate || today));
  
  // Weekday-based goal state
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>('10:00');
  // Removed dateRange state as it's not needed for duration mode

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
        isWeekdayGoal: endDate && dateStr >= startDate && dateStr <= endDate && selectedWeekdays.includes(new Date(dateStr).getDay())
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

  const handleConfirm = () => {
    if (!startDate) {
      Alert.alert('Invalid Date', 'Please select a start date');
      return;
    }

    const selection: DateSelection = {
      mode: 'duration',
      startDate,
      endDate,
      durationType,
      durationValue: parseInt(durationValue) || 1
    };

    console.log('[SimpleDatePicker] Confirming selection:', selection);
    onConfirm(selection);
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
    <View className="bg-white rounded-lg border border-gray-200 p-4 m-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Ionicons name="calendar" size={20} color="#3B82F6" />
          <Text className="text-lg font-bold text-gray-800 ml-2">
            Select Date & Duration
          </Text>
        </View>
        <TouchableOpacity onPress={onCancel}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Duration Mode Only */}

      {/* Duration Controls */}
      <View className="mb-4 p-3 bg-blue-50 rounded-lg">
          <Text className="text-blue-800 font-semibold mb-2">Duration</Text>
          <View className="flex-row items-center space-x-2">
            <TextInput
              className="bg-white border border-blue-300 rounded-lg px-3 py-2 text-center w-16"
              value={durationValue}
              onChangeText={handleDurationChange}
              keyboardType="number-pad"
              placeholder="1"
              maxLength={3}
            />
            <View className="flex-row space-x-1">
              {(['days', 'weeks', 'months'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  className={`px-3 py-2 rounded-lg ${
                    durationType === type ? 'bg-blue-600' : 'bg-white border border-blue-300'
                  }`}
                  onPress={() => handleDurationTypeChange(type)}
                >
                  <Text className={`text-sm font-semibold ${
                    durationType === type ? 'text-white' : 'text-blue-600'
                  }`}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {endDate && (
            <Text className="text-blue-700 text-sm mt-2">
              Will end on: {new Date(endDate).toLocaleDateString()}
            </Text>
          )}
        </View>

        {/* Weekday-based Goal Selection */}
        <View className="mb-4 p-3 bg-green-50 rounded-lg">
          <Text className="text-gray-700 font-semibold mb-2">Weekly Schedule (Optional)</Text>
          <Text className="text-gray-600 text-sm mb-3">Select days and time for recurring goals</Text>
          
          {/* Weekday Selection */}
          <View className="flex-row justify-between mb-3">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
              <TouchableOpacity
                key={day}
                onPress={() => {
                  const newWeekdays = selectedWeekdays.includes(index)
                    ? selectedWeekdays.filter(d => d !== index)
                    : [...selectedWeekdays, index];
                  setSelectedWeekdays(newWeekdays);
                }}
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  selectedWeekdays.includes(index) ? 'bg-green-600' : 'bg-white border border-gray-300'
                }`}
              >
                <Text className={`text-sm font-semibold ${
                  selectedWeekdays.includes(index) ? 'text-white' : 'text-gray-600'
                }`}>
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Time Selection */}
          <View className="flex-row items-center space-x-2">
            <Text className="text-gray-600 text-sm">Time:</Text>
            <TextInput
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 flex-1"
              value={selectedTime}
              onChangeText={setSelectedTime}
              placeholder="10:00"
            />
          </View>
        </View>

      {/* Simple Calendar */}
      <View className="mb-4">
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
              Alert.alert(
                'Select Year',
                'Choose a year:',
                years.map(year => ({
                  text: year.toString(),
                  onPress: () => goToYear(year)
                }))
              );
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

      {/* Manual Date Input as Backup */}
      <View className="mb-4 p-3 bg-gray-50 rounded-lg">
        <Text className="text-gray-700 font-semibold mb-2">Or enter dates manually:</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text className="text-gray-600 text-sm mb-1">Start Date</Text>
            <TextInput
              className="bg-white border border-gray-300 rounded-lg px-3 py-2"
              placeholder="YYYY-MM-DD"
              value={startDate}
              onChangeText={(text) => {
                if (/^\d{0,4}-?\d{0,2}-?\d{0,2}$/.test(text)) {
                  setStartDate(text);
                }
              }}
              style={{ height: 48, lineHeight: 48, paddingVertical: 10 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text className="text-gray-600 text-sm mb-1">End Date</Text>
            <Text className="text-gray-500 text-xs">Auto-calculated</Text>
            <TextInput
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
              placeholder="YYYY-MM-DD"
              value={endDate}
              editable={false}
              selectTextOnFocus={false}
              style={{ height: 48, lineHeight: 48, paddingVertical: 10 }}
            />
          </View>
        </View>
      </View>

      {/* Selected Summary with validation */}
      {startDate && (
        <View className="mb-4 p-3 bg-gray-50 rounded-lg">
          <Text className="text-gray-700 font-semibold mb-1">Selected:</Text>
          <Text className="text-gray-600 text-sm">
            Start: {new Date(startDate).toLocaleDateString()}
          </Text>
          {endDate && (
            <Text className="text-gray-600 text-sm">
              End: {new Date(endDate).toLocaleDateString()}
            </Text>
          )}
          {startDate && endDate && endDate < startDate && (
            <Text className="text-red-600 text-xs mt-1">End date must be after start date.</Text>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View className="flex-row space-x-3">
        <TouchableOpacity
          className="flex-1 bg-gray-200 rounded-lg py-3"
          onPress={onCancel}
        >
          <Text className="text-gray-700 font-semibold text-center">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-blue-600 rounded-lg py-3"
          onPress={handleConfirm}
          disabled={!startDate}
        >
          <Text className="text-white font-semibold text-center">Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
