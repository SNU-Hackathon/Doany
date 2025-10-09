// Calendar screen for viewing goal progress and scheduling

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Text,
  View
} from 'react-native';
import { BaseScreen, LoadingState } from '../components';
import { useAuth } from '../hooks/useAuth';
import { GoalService } from '../compat/goalService';
import { VerificationService } from '../compat/verificationService';
import { Goal, Verification } from '../types';

interface GoalProgress {
  goal: Goal;
  todayVerifications: Verification[];
  weeklyProgress: number;
}

export default function CalendarScreen() {
  const { user } = useAuth();
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadCalendarData();
  }, [user]);

  const loadCalendarData = async () => {
    if (!user) return;

    try {
      const goals = await GoalService.getActiveGoals(user.id);
      const progressData = await Promise.all(
        goals.map(async (goal: any) => {
          const todayVerifications = await VerificationService.getRecentGoalVerifications(goal.id, 1);
          const weeklyProgress = await VerificationService.calculateGoalSuccessRate(goal.id, 7);
          
          return {
            goal,
            todayVerifications,
            weeklyProgress,
          };
        })
      );

      setGoalProgress(progressData);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      Alert.alert('Error', 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getTodayStatus = (verifications: Verification[]) => {
    if (verifications.length === 0) return 'pending';
    return verifications[0].status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'fail': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return 'checkmark-circle';
      case 'fail': return 'close-circle';
      default: return 'time-outline';
    }
  };

  if (loading) {
    return <LoadingState message="Loading calendar..." fullScreen />;
  }

  return (
    <BaseScreen
      title="캘린더"
      backgroundColor="#F9FAFB"
      contentPadding={false}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        {/* Date Header */}
        <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1F2937', textAlign: 'center' }}>
            {formatDate(selectedDate)}
          </Text>
          <Text style={{ color: '#6B7280', textAlign: 'center', marginTop: 8 }}>
            Track your daily progress
          </Text>
        </View>

        {/* Today's Goals Progress */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 16 }}>
            Today's Goals
          </Text>

          {goalProgress.length === 0 ? (
            <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 32, alignItems: 'center' }}>
              <Ionicons name="calendar-outline" size={64} color="#6B7280" />
              <Text style={{ fontSize: 20, fontWeight: '600', color: '#1F2937', marginTop: 16, textAlign: 'center' }}>
                No Active Goals
              </Text>
              <Text style={{ color: '#6B7280', marginTop: 8, textAlign: 'center' }}>
                Create some goals to track your progress here!
              </Text>
            </View>
          ) : (
            goalProgress.map((progress) => {
              const todayStatus = getTodayStatus(progress.todayVerifications);
              
              return (
                <View
                  key={progress.goal.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 1
                  }}
                >
                  {/* Goal Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1F2937' }}>
                        {progress.goal.title}
                      </Text>
                      <Text style={{ color: '#6B7280', fontSize: 14 }}>
                        {typeof progress.goal.frequency === 'object' 
                          ? `${progress.goal.frequency.count}x ${progress.goal.frequency.unit.replace('per_', '')}` 
                          : `${progress.goal.frequency}x ${progress.goal.timeFrame}`}
                      </Text>
                    </View>
                    
                    {/* Status Indicator */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        marginRight: 8,
                        backgroundColor: todayStatus === 'success' ? '#10B981' : 
                                        todayStatus === 'fail' ? '#EF4444' : '#6B7280'
                      }} />
                      <Ionicons 
                        name={getStatusIcon(todayStatus)} 
                        size={24} 
                        color={
                          todayStatus === 'success' ? '#10B981' : 
                          todayStatus === 'fail' ? '#EF4444' : '#6B7280'
                        }
                      />
                    </View>
                  </View>

                  {/* Progress Info */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, color: '#6B7280' }}>
                      Weekly Progress: {progress.weeklyProgress.toFixed(0)}%
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
                      {todayStatus === 'success' ? 'Completed' : 
                       todayStatus === 'fail' ? 'Missed' : 'Pending'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Quick Stats */}
        <View className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-4">
            Quick Stats
          </Text>
          
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-2xl font-bold text-blue-600">
                {goalProgress.length}
              </Text>
              <Text className="text-gray-600 text-sm">Active Goals</Text>
            </View>
            
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">
                {goalProgress.filter(p => getTodayStatus(p.todayVerifications) === 'success').length}
              </Text>
              <Text className="text-gray-600 text-sm">Completed Today</Text>
            </View>
            
            <View className="items-center">
              <Text className="text-2xl font-bold text-orange-600">
                {goalProgress.filter(p => getTodayStatus(p.todayVerifications) === 'pending').length}
              </Text>
              <Text className="text-gray-600 text-sm">Pending</Text>
            </View>
          </View>
        </View>

        {/* Coming Soon Features */}
        <View className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-3">
            Coming Soon
          </Text>
          <View className="space-y-2">
            <Text className="text-gray-600">📅 Monthly calendar view</Text>
            <Text className="text-gray-600">📊 Progress streaks and trends</Text>
            <Text className="text-gray-600">⏰ Goal reminders and scheduling</Text>
            <Text className="text-gray-600">📈 Advanced analytics</Text>
          </View>
        </View>
      </View>
    </BaseScreen>
  );
}
