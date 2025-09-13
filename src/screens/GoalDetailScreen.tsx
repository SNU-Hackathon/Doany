// Goal detail screen showing verification history and progress

import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { getAuth } from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import GoalScheduleCalendar from '../components/GoalScheduleCalendar';
import { VERIFICATION_DEFAULTS } from '../config/verification';
import { useAuth } from '../hooks/useAuth';
import { CalendarEventService } from '../services/calendarEventService';
import { db } from '../services/firebase';
import { GoalService } from '../services/goalService';
import { parsePickerExif, validateFreshness, validateGeofence, validateTimeWindow } from '../services/photo/ExifValidator';
import { VerificationService, verifyManual, verifyPhoto } from '../services/verificationService';
import { CalendarEvent, Goal, RootStackParamList, Verification } from '../types';

type GoalDetailScreenRouteProp = RouteProp<RootStackParamList, 'GoalDetail'>;
type GoalDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'GoalDetail'>;

interface GoalDetailScreenProps {
  route: GoalDetailScreenRouteProp;
  navigation: GoalDetailScreenNavigationProp;
}

export default function GoalDetailScreen({ route, navigation }: GoalDetailScreenProps) {
  const { goalId } = route.params;
  const { user } = useAuth();
  
  // Move all hooks to the top level
  const [goal, setGoal] = useState<Goal | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [successRate, setSuccessRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const loadGoalData = useCallback(async () => {
    if (!goalId) return;
    
    try {
      setError(null);
      
      const [goalData, verificationsData, rate] = await Promise.all([
        GoalService.getGoal(goalId),
        VerificationService.getGoalVerifications(goalId),
        VerificationService.calculateGoalSuccessRate(goalId)
      ]);

      console.log('[GOAL:fetch:result]', { 
        goalExists: !!goalData, 
        verificationsCount: verificationsData?.length || 0,
        successRate: rate 
      });

      if (!goalData) {
        console.error('[GOAL:not-found]', { goalId, timestamp: new Date().toISOString() });
        setError('Goal not found');
        setGoal(null);
        return;
      }

      // Load calendar events for the goal
      let calendarEventsData: CalendarEvent[] = [];
      try {
        if (goalData.duration?.startDate && goalData.duration?.endDate) {
          calendarEventsData = await CalendarEventService.getCalendarEvents(
            goalId,
            goalData.duration.startDate,
            goalData.duration.endDate
          );
        }
      } catch (error) {
        console.warn('[GOAL:calendar-events] Failed to load calendar events:', error);
        // Continue without calendar events
      }

      setGoal(goalData);
      setVerifications(verificationsData);
      setSuccessRate(rate);
      setCalendarEvents(calendarEventsData);
      console.log('[GOAL:fetch:success]', { 
        goalId, 
        title: goalData.title,
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      console.error('[GOAL:fetch:error]', { goalId, error, timestamp: new Date().toISOString() });
      setError('Failed to load goal details');
      
      // Check if it's a permission error
      if (error instanceof Error && error.message.includes('permission')) {
        setError('Permission denied. Please check your account access.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [goalId]);

  useEffect(() => {
    loadGoalData();
  }, [goalId, loadGoalData]);

  const handleDeleteGoal = useCallback(async () => {
    if (!goal) return;

    Alert.alert(
      'Delete Goal',
      'Delete this goal? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[GoalDelete] Starting deletion for goal:', goalId);
              
              const auth = getAuth();
              const currentUser = auth.currentUser;
              
              if (!currentUser) {
                console.error('[GoalDelete] No authenticated user');
                Alert.alert('Error', 'You must be signed in to delete goals.');
                return;
              }

              // Delete the goal document
              const goalRef = doc(db, 'users', currentUser.uid, 'goals', goalId);
              await deleteDoc(goalRef);
              
              console.log('[GoalDelete] Goal deleted successfully');
              
              // Show success message and navigate back
              Alert.alert(
                'Goal Deleted',
                'The goal has been deleted successfully.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack()
                  }
                ]
              );
            } catch (error) {
              console.error('[GoalDelete] Error deleting goal:', error);
              Alert.alert(
                'Delete Failed',
                'Failed to delete the goal. Please try again.'
              );
            }
          }
        }
      ]
    );
  }, [goal, goalId, navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGoalData();
  }, [loadGoalData]);

  // Set up header with delete button
  useLayoutEffect(() => {
    if (goal) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            onPress={handleDeleteGoal}
            style={{ marginRight: 16 }}
          >
            <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ),
      });
    }
  }, [goal, navigation, handleDeleteGoal]);

  const handleManualVerification = async () => {
    if (!goal) return;

    Alert.alert(
      'Manual Verification',
      'Did you complete this goal task?',
      [
        {
          text: 'No',
          style: 'cancel',
          onPress: async () => {
            try {
              await verifyManual(goal as any, false);
              await loadGoalData();
              Alert.alert('Recorded', 'Failure recorded. Keep trying!');
            } catch (error) {
              Alert.alert('Error', 'Failed to record verification');
            }
          }
        },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              await verifyManual(goal as any, true);
              await loadGoalData();
              Alert.alert('Great!', 'Success recorded! Keep up the good work!');
            } catch (error) {
              Alert.alert('Error', 'Failed to record verification');
            }
          }
        }
      ]
    );
  };

  const handlePhotoVerification = async () => {
    if (!goal) return;

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission', 'Camera permission is required to take a verification photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
        exif: true,
        base64: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const resp = await fetch(asset.uri);
      const blob = await resp.blob();

      // Extract EXIF and perform validation
      const exif = parsePickerExif(asset.exif || undefined);
      
      // Get time window from goal (if available)
      const now = Date.now();
      const windowStart = now - (30 * 60 * 1000); // 30 min ago default
      const windowEnd = now + (30 * 60 * 1000);   // 30 min from now default
      
      // Get target location from goal
      const targetLocation = goal.targetLocation ? 
        { lat: goal.targetLocation.lat, lng: goal.targetLocation.lng } : 
        undefined;
      
      // Validate EXIF data
      const timeValid = validateTimeWindow(exif.timestampMs, windowStart, windowEnd, VERIFICATION_DEFAULTS.timeToleranceMinutes);
      const locValid = targetLocation ? validateGeofence(exif.location, targetLocation, VERIFICATION_DEFAULTS.geofenceRadiusMeters) : true;
      const freshValid = validateFreshness(exif.timestampMs, VERIFICATION_DEFAULTS.photoFreshnessMaxMinutes);
      
      console.log(`[PhotoVerification] timeValid=${timeValid} locValid=${locValid} freshValid=${freshValid} ts=${exif.timestampMs}`);
      
      // Create enriched photo signals
      const photoSignals = {
        present: true,
        exif: { 
          timestampMs: exif.timestampMs, 
          location: exif.location, 
          deviceModel: exif.deviceModel 
        },
        validationResult: { 
          timeValid, 
          locationValid: locValid, 
          freshnessValid: freshValid 
        }
      };

      // Upload photo and get URL, then update signals
      await verifyPhoto(goal as any, blob, photoSignals);

      await loadGoalData();
      Alert.alert('Uploaded', 'Photo verification uploaded successfully.');
    } catch (error) {
      console.error('[PhotoVerification] error', error);
      Alert.alert('Error', 'Failed to upload photo verification.');
    }
  };

  const getVerificationIcon = (status: string) => {
    return status === 'success' ? 'checkmark-circle' : 'close-circle';
  };

  const getVerificationColor = (status: string) => {
    return status === 'success' ? 'text-green-600' : 'text-red-600';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 60) return 'bg-yellow-500';
    if (rate >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-gray-600">Loading goal details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-red-600 text-lg mb-4">{error}</Text>
        <Text className="text-gray-600 text-center mb-6">
          {error === 'Goal not found' 
            ? 'The goal you are looking for could not be found. It may have been deleted or you may not have permission to view it.'
            : 'There was an error loading the goal details. Please try again.'
          }
        </Text>
        <TouchableOpacity
          className="bg-blue-500 px-6 py-3 rounded-lg"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!goal) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-gray-600">Goal not found</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ paddingBottom: 90 }} // Add bottom padding for tab bar
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="px-4 pt-4">
        {/* Goal Info Card */}
        <View className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <Text className="text-2xl font-bold text-gray-800 mb-2">
            {goal.title}
          </Text>
          <Text className="text-gray-600 mb-4">
            {goal.description}
          </Text>

          {/* Goal Details */}
          <View className="space-y-3">
            <View className="flex-row items-center">
              <Ionicons name="repeat" size={20} color="#6B7280" />
              <Text className="text-gray-700 ml-3">
                {typeof goal.frequency === 'object' 
                  ? `${goal.frequency.count}x ${goal.frequency.unit.replace('per_', '')}` 
                  : `${goal.frequency}x ${goal.timeFrame}`}
              </Text>
            </View>
            
            <View className="flex-row items-center">
              <Ionicons name="folder" size={20} color="#6B7280" />
              <Text className="text-gray-700 ml-3">
                {goal.category}
              </Text>
            </View>

            <View className="flex-row items-center">
              <Ionicons name="calendar" size={20} color="#6B7280" />
              <Text className="text-gray-700 ml-3">
                {goal.startDate?.toLocaleDateString() || 'No start date'} - {goal.endDate?.toLocaleDateString() || 'No end date'}
              </Text>
            </View>

            {goal.targetLocation && (
              <View className="flex-row items-center">
                <Ionicons name="location" size={20} color="#6B7280" />
                <Text className="text-gray-700 ml-3">
                  {goal.targetLocation.name}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Progress Card */}
        <View className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <Text className="text-xl font-bold text-gray-800 mb-4">
            Progress Overview
          </Text>
          
          {/* Success Rate */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-gray-700 font-semibold">Success Rate</Text>
              <Text className="text-xl font-bold text-gray-800">
                {successRate.toFixed(0)}%
              </Text>
            </View>
            <View className="bg-gray-200 rounded-full h-3">
              <View 
                className={`h-3 rounded-full ${getProgressColor(successRate)}`}
                style={{ width: `${successRate}%` }}
              />
            </View>
          </View>

          {/* Stats */}
          <View className="flex-row justify-around border-t border-gray-200 pt-4">
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">
                {verifications.filter(v => v.status === 'success').length}
              </Text>
              <Text className="text-gray-600 text-sm">Successes</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-red-600">
                {verifications.filter(v => v.status === 'fail').length}
              </Text>
              <Text className="text-gray-600 text-sm">Failures</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-blue-600">
                {verifications.length}
              </Text>
              <Text className="text-gray-600 text-sm">Total</Text>
            </View>
          </View>
        </View>

        {/* Manual Verification Button (for manual goals) */}
        {goal.verificationType === 'manual' && (
          <TouchableOpacity
            className="bg-blue-600 rounded-lg p-4 mb-6 flex-row items-center justify-center"
            onPress={handleManualVerification}
          >
            <Ionicons name="checkmark-circle" size={24} color="white" />
            <Text className="text-white font-bold text-lg ml-2">
              Record Progress
            </Text>
          </TouchableOpacity>
        )}

        {/* Photo Verification Button (if photo method selected) */}
        {goal.verificationMethods?.includes('photo' as any) && (
          <TouchableOpacity
            className="bg-purple-600 rounded-lg p-4 mb-6 flex-row items-center justify-center"
            onPress={handlePhotoVerification}
          >
            <Ionicons name="camera" size={24} color="white" />
            <Text className="text-white font-bold text-lg ml-2">
              Take Verification Photo
            </Text>
          </TouchableOpacity>
        )}

        {/* Schedule & Progress Calendar */}
        <View className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <Text className="text-xl font-bold text-gray-800 mb-4">Schedule & Progress</Text>
          <GoalScheduleCalendar
            startDateISO={goal.duration?.startDate || goal.startDate?.toISOString()}
            endDateISO={goal.duration?.endDate || goal.endDate?.toISOString()}
            weeklyWeekdays={goal.weeklyWeekdays || []}
            weeklyTimeSettings={goal.weeklySchedule || {}}
            includeDates={goal.includeDates || []}
            excludeDates={goal.excludeDates || []}
            verifications={verifications}
            enforcePartialWeeks={goal.schedule?.enforcePartialWeeks || false}
            calendarEvents={calendarEvents}
            goalId={goalId}
          />
        </View>

        {/* Verification History */}
        <View className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <Text className="text-xl font-bold text-gray-800 mb-4">
            Verification History
          </Text>

          {verifications.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="document-outline" size={48} color="#6B7280" />
              <Text className="text-gray-600 mt-2 text-center">
                No verifications yet
              </Text>
            </View>
          ) : (
            verifications.map((verification) => (
              <View 
                key={verification.id}
                className="flex-row items-center justify-between py-3 border-b border-gray-100 last:border-b-0"
              >
                <View className="flex-row items-center flex-1">
                  <Ionicons 
                    name={getVerificationIcon(verification.status)}
                    size={24}
                    color={verification.status === 'success' ? '#10B981' : '#EF4444'}
                  />
                  <View className="ml-3 flex-1">
                    <Text className={`font-semibold ${getVerificationColor(verification.status)}`}>
                      {verification.status === 'success' ? 'Success' : 'Failed'}
                    </Text>
                    <Text className="text-gray-600 text-sm">
                      {formatDate(verification.timestamp)}
                    </Text>
                    {verification.location && (
                      <Text className="text-gray-500 text-xs mt-1">
                        📍 {verification.location.name}
                      </Text>
                    )}
                  </View>
                </View>
                
                {verification.screenshotUrl && (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('Screenshot', 'Screenshot viewing will be implemented soon!');
                    }}
                  >
                    <Ionicons name="image" size={20} color="#3B82F6" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* Delete Goal Button */}
        <View className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <TouchableOpacity
            className="bg-red-600 rounded-lg p-4 flex-row items-center justify-center"
            onPress={handleDeleteGoal}
          >
            <Ionicons name="trash-outline" size={24} color="white" />
            <Text className="text-white font-bold text-lg ml-2">
              Delete Goal
            </Text>
          </TouchableOpacity>
          <Text className="text-gray-500 text-sm text-center mt-2">
            This action cannot be undone
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}