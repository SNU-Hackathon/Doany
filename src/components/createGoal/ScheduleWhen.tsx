import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface TimeSlot {
  dow?: number;
  time?: string;
  atMs?: number;
}

interface ScheduleWhenProps {
  times: TimeSlot[];
  onChange: (times: TimeSlot[]) => void;
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ScheduleWhen: React.FC<ScheduleWhenProps> = ({ times, onChange }) => {
  const [showDayModal, setShowDayModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'dow' | 'time' | null>(null);

  console.log('[ScheduleWhen] Rendering with times:', times);

  const addTimeSlot = () => {
    const newTimes = [...times, { dow: 1, time: '07:00' }];
    onChange(newTimes);
  };

  const removeTimeSlot = (index: number) => {
    const newTimes = times.filter((_, i) => i !== index);
    onChange(newTimes);
  };

  const updateTimeSlot = (index: number, field: keyof TimeSlot, value: any) => {
    const newTimes = times.map((slot, i) => 
      i === index ? { ...slot, [field]: value } : slot
    );
    onChange(newTimes);
  };

  const openDaySelector = (index: number) => {
    setEditingIndex(index);
    setEditingField('dow');
    setShowDayModal(true);
  };

  const openTimeSelector = (index: number) => {
    setEditingIndex(index);
    setEditingField('time');
    setShowTimeModal(true);
  };

  const selectDay = (dayIndex: number) => {
    if (editingIndex !== null) {
      updateTimeSlot(editingIndex, 'dow', dayIndex);
    }
    setShowDayModal(false);
    setEditingIndex(null);
    setEditingField(null);
  };

  const selectTime = (time: string) => {
    if (editingIndex !== null) {
      updateTimeSlot(editingIndex, 'time', time);
    }
    setShowTimeModal(false);
    setEditingIndex(null);
    setEditingField(null);
  };

  // If no times are provided, show a default empty slot
  const displayTimes = times && times.length > 0 ? times : [{ dow: 1, time: '07:00' }];

  return (
    <View className="mb-5">
      <Text className="text-base font-medium text-gray-700 mb-3">When</Text>
      
      {displayTimes.map((slot, index) => (
        <View key={index} className="flex-row items-center mb-3 p-3 bg-white rounded-lg border border-gray-300">
          {/* Day of Week Selector */}
          <View className="flex-1 mr-3">
            <Text className="text-xs text-gray-500 mb-1">Day</Text>
            <TouchableOpacity
              onPress={() => openDaySelector(index)}
              className="bg-gray-50 rounded-md px-2 py-1.5 border border-gray-300 active:bg-gray-100"
              style={{ minHeight: 32 }}
            >
              <Text className="text-gray-700 text-sm">
                {DAYS_OF_WEEK[slot.dow || 0]} ▼
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Time Input */}
          <View className="flex-1 mr-3">
            <Text className="text-xs text-gray-500 mb-1">Time</Text>
            <TouchableOpacity
              onPress={() => openTimeSelector(index)}
              className="bg-gray-50 rounded-md px-2 py-1.5 border border-gray-300 active:bg-gray-100"
              style={{ minHeight: 32 }}
            >
              <Text className="text-gray-700 text-sm">
                {slot.time || '07:00'} ▼
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Remove Button */}
          <TouchableOpacity
            onPress={() => removeTimeSlot(index)}
            className="w-8 h-8 rounded-full bg-red-100 items-center justify-center"
          >
            <Ionicons name="close" size={16} color="#dc2626" />
          </TouchableOpacity>
        </View>
      ))}
      
      {/* Add Button */}
      <TouchableOpacity
        onPress={addTimeSlot}
        className="flex-row items-center p-3 bg-blue-50 rounded-lg border border-blue-200 border-dashed"
      >
        <Ionicons name="add" size={20} color="#2563eb" />
        <Text className="text-blue-600 text-sm font-medium ml-2">
          Add time slot
        </Text>
      </TouchableOpacity>

      {/* Day Selection Modal */}
      <Modal
        visible={showDayModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDayModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="text-lg font-semibold text-gray-800 mb-4 text-center">Select Day</Text>
            <View className="space-y-2">
              {DAYS_OF_WEEK.map((day, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => selectDay(index)}
                  className="py-4 px-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <Text className="text-gray-700 text-base text-center">{day}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setShowDayModal(false)}
              className="mt-4 py-3 bg-gray-200 rounded-lg"
            >
              <Text className="text-gray-700 text-base text-center font-medium">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Selection Modal */}
      <Modal
        visible={showTimeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimeModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="text-lg font-semibold text-gray-800 mb-4 text-center">Select Time</Text>
            <TimeInputSelector
              currentTime={times[editingIndex || 0]?.time || '07:00'}
              onTimeSelect={selectTime}
              onCancel={() => setShowTimeModal(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Time Input Selector Component
const TimeInputSelector: React.FC<{
  currentTime: string;
  onTimeSelect: (time: string) => void;
  onCancel: () => void;
}> = ({ currentTime, onTimeSelect, onCancel }) => {
  const [time, setTime] = useState(currentTime);

  const handleConfirm = () => {
    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (timeRegex.test(time)) {
      onTimeSelect(time);
    } else {
      // If invalid, use current time
      onTimeSelect(currentTime);
    }
  };

  return (
    <View>
      <TextInput
        value={time}
        onChangeText={setTime}
        placeholder="HH:MM"
        className="border border-gray-300 rounded-lg px-4 py-3 text-center text-lg mb-4"
        keyboardType="numeric"
        maxLength={5}
      />
      <View className="flex-row space-x-3">
        <TouchableOpacity
          onPress={onCancel}
          className="flex-1 py-3 bg-gray-200 rounded-lg"
        >
          <Text className="text-gray-700 text-base text-center font-medium">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleConfirm}
          className="flex-1 py-3 bg-blue-500 rounded-lg"
        >
          <Text className="text-white text-base text-center font-medium">Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
