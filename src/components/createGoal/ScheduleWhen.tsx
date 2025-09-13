import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

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

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 16, fontWeight: '500', color: '#374151', marginBottom: 12 }}>When</Text>
      
      {times.map((slot, index) => (
        <View key={index} style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          marginBottom: 12,
          padding: 12,
          backgroundColor: 'white',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#d1d5db'
        }}>
          {/* Day of Week Selector */}
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Day</Text>
            <View style={{ 
              backgroundColor: '#f9fafb', 
              borderRadius: 6, 
              paddingHorizontal: 8, 
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: '#d1d5db'
            }}>
              <Text style={{ color: '#374151', fontSize: 14 }}>
                {DAYS_OF_WEEK[slot.dow || 0]}
              </Text>
            </View>
          </View>
          
          {/* Time Input */}
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Time</Text>
            <View style={{ 
              backgroundColor: '#f9fafb', 
              borderRadius: 6, 
              paddingHorizontal: 8, 
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: '#d1d5db'
            }}>
              <Text style={{ color: '#374151', fontSize: 14 }}>
                {slot.time || '07:00'}
              </Text>
            </View>
          </View>
          
          {/* Remove Button */}
          <TouchableOpacity
            onPress={() => removeTimeSlot(index)}
            style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 16, 
              backgroundColor: '#fee2e2', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <Ionicons name="close" size={16} color="#dc2626" />
          </TouchableOpacity>
        </View>
      ))}
      
      {/* Add Button */}
      <TouchableOpacity
        onPress={addTimeSlot}
        style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          padding: 12, 
          backgroundColor: '#f0f9ff', 
          borderRadius: 8, 
          borderWidth: 1, 
          borderColor: '#bae6fd',
          borderStyle: 'dashed'
        }}
      >
        <Ionicons name="add" size={20} color="#2563eb" />
        <Text style={{ color: '#2563eb', fontSize: 14, fontWeight: '500', marginLeft: 8 }}>
          Add time slot
        </Text>
      </TouchableOpacity>
    </View>
  );
};
