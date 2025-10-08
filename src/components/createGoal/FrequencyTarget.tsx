import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface Period {
  startMs: number;
  endMs: number;
}

interface FrequencyTargetProps {
  perWeek: number;
  period?: Period;
  onPerWeekChange: (perWeek: number) => void;
  onPeriodChange: (period: Period) => void;
}

export const FrequencyTarget: React.FC<FrequencyTargetProps> = ({ 
  perWeek, 
  period, 
  onPerWeekChange, 
  onPeriodChange 
}) => {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 16, fontWeight: '500', color: '#374151', marginBottom: 12 }}>Target</Text>
      
      {/* Per Week Stepper */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Times per week</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity
            onPress={() => {
              if (perWeek > 1) {
                onPerWeekChange(perWeek - 1);
              }
            }}
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 20, 
              backgroundColor: '#f3f4f6', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <Text style={{ color: '#374151', fontSize: 18, fontWeight: 'bold' }}>-</Text>
          </TouchableOpacity>
          
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', minWidth: 40, textAlign: 'center' }}>
            {perWeek}
          </Text>
          
          <TouchableOpacity
            onPress={() => onPerWeekChange(perWeek + 1)}
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 20, 
              backgroundColor: '#f3f4f6', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <Text style={{ color: '#374151', fontSize: 18, fontWeight: 'bold' }}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Period Selector */}
      <View>
        <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Period</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Start Date</Text>
            <TouchableOpacity
              style={{ 
                backgroundColor: 'white', 
                borderRadius: 8, 
                borderWidth: 1, 
                borderColor: '#d1d5db',
                paddingHorizontal: 12,
                paddingVertical: 8
              }}
            >
              <Text style={{ color: '#374151' }}>
                {period?.startMs ? new Date(period.startMs).toLocaleDateString() : 'Select start date'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>End Date</Text>
            <TouchableOpacity
              style={{ 
                backgroundColor: 'white', 
                borderRadius: 8, 
                borderWidth: 1, 
                borderColor: '#d1d5db',
                paddingHorizontal: 12,
                paddingVertical: 8
              }}
            >
              <Text style={{ color: '#374151' }}>
                {period?.endMs ? new Date(period.endMs).toLocaleDateString() : 'Select end date'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};
