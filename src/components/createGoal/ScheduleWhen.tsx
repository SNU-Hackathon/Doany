import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

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
  // Legacy component - no longer used
  return null;
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
