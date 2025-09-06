import React from 'react';
import { Alert, Button, Text, View } from 'react-native';

// Mock test scenario for schedule.timeWindows undefined issue
export default function TestSimple() {
  const testScheduleTimeWindows = () => {
    // Simulate the issue: schedule.timeWindows with undefined values
    const mockSchedule = {
      countRule: { operator: '>=', count: 3, unit: 'per_week' },
      weekdayConstraints: [1, 3, 5], // Mon, Wed, Fri
      timeRules: [
        {
          days: [1, 3, 5],
          range: ['07:00', '07:00'],
          label: '07:00',
          source: 'user_text'
        }
      ],
      timeWindows: [
        {
          label: '07:00',
          range: ['07:00', '07:00'],
          source: 'user_text'
        },
        {
          label: undefined, // This could cause the issue
          range: ['09:00', '09:00'],
          source: 'inferred'
        }
      ],
      weekBoundary: 'startWeekday',
      enforcePartialWeeks: false,
      requiresDisambiguation: true,
      followUpQuestion: 'How many times per week and which time windows do you prefer?'
    };

    console.log('[TestSimple] Mock schedule with potential undefined:', JSON.stringify(mockSchedule, null, 2));
    
    // Check for undefined values in timeWindows
    const hasUndefined = mockSchedule.timeWindows?.some(w => 
      w.label === undefined || w.range === undefined || w.source === undefined
    );
    
    Alert.alert(
      'Test Result',
      `Schedule has undefined values: ${hasUndefined}\n\nCheck console for full schedule object.`
    );
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 20, textAlign: 'center' }}>
        Test Schedule.timeWindows Undefined Issue
      </Text>
      
      <Text style={{ fontSize: 14, marginBottom: 20, textAlign: 'center', color: '#666' }}>
        This test simulates the schedule object that might be causing the Firestore WriteBatch.set() error.
      </Text>
      
      <Button 
        title="Test Schedule Structure" 
        onPress={testScheduleTimeWindows}
      />
      
      <View style={{ marginTop: 30 }}>
        <Text style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
          Expected behavior: Check console for schedule object structure and look for undefined values in timeWindows array.
        </Text>
      </View>
    </View>
  );
}
