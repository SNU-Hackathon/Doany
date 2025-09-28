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
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VERIFICATION_DEFAULTS } from '../config/verification';
import { useAuth } from '../hooks/useAuth';
import { CalendarEventService } from '../services/calendarEventService';
import { db } from '../services/firebase';
import { GoalService } from '../services/goalService';
import { parsePickerExif, validateFreshness, validateGeofence, validateTimeWindow } from '../services/photo/ExifValidator';
import { QuestService } from '../services/questService';
import { VerificationService, verifyManual, verifyPhoto } from '../services/verificationService';
import { CalendarEvent, Goal, Quest, QuestStatus, RootStackParamList, Verification } from '../types';

type GoalDetailScreenRouteProp = RouteProp<RootStackParamList, 'GoalDetail'>;
type GoalDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'GoalDetail'>;

interface GoalDetailScreenProps {
  route: GoalDetailScreenRouteProp;
  navigation: GoalDetailScreenNavigationProp;
}

export default function GoalDetailScreen({ route, navigation }: GoalDetailScreenProps) {
  const { goalId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Move all hooks to the top level
  const [goal, setGoal] = useState<Goal | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [successRate, setSuccessRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [questsLoading, setQuestsLoading] = useState(false);

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
      
      // Load quests for this goal
      await loadQuestsForGoal(goalId);
      
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

  const loadQuestsForGoal = useCallback(async (goalId: string) => {
    if (!user) return;
    
    try {
      setQuestsLoading(true);
      console.log('[GoalDetail] Loading quests for goal:', goalId);
      const questsData = await QuestService.getQuestsForGoal(goalId, user.uid);
      console.log('[DETAIL.LOAD]', {
        goalId: goalId,
        totalLoaded: questsData.length,
        sortCriteria: 'weekNumber/scheduledDate',
        firstThree: questsData.slice(0, 3).map(q => ({
          title: q.title,
          weekNumber: q.weekNumber,
          scheduledDate: q.scheduledDate,
          type: q.type
        }))
      });
      setQuests(questsData);
      
      // If no quests exist, generate them
      if (questsData.length === 0 && goal) {
        console.log('[GoalDetail] No quests found, generating quests for goal:', goalId);
        await generateQuestsForGoal();
      }
      
    } catch (error) {
      console.error('[GoalDetail] Error loading quests:', error);
      console.error('[GoalDetail] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        goalId,
        userId: user?.uid
      });
      
      // Don't show error message, just continue with empty quests
      // The QuestService now returns empty array instead of throwing
      console.log('[GoalDetail] Continuing with empty quests due to error');
    } finally {
      setQuestsLoading(false);
    }
  }, [user, goal]);

  const generateQuestsForGoal = useCallback(async () => {
    if (!user || !goal) return;
    
    try {
      setQuestsLoading(true);
      console.log('[GoalDetail] Generating quests for goal:', goal.id);
      console.log('[GoalDetail] Goal data for generation:', {
        id: goal.id,
        title: goal.title,
        type: goal.category,
        duration: goal.duration,
        frequency: goal.frequency
      });
      
      // Generate quests using the goal data
      const generatedQuests = await QuestService.generateAndSaveQuestsForGoal(
        goal.id,
        goal,
        user.uid
      );
      
      setQuests(generatedQuests);
      console.log('[GoalDetail] Generated', generatedQuests.length, 'quests');
      
    } catch (error) {
      console.error('[GoalDetail] Error generating quests:', error);
      console.error('[GoalDetail] Generation error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        goalId: goal?.id,
        userId: user?.uid
      });
      
      // Show user-friendly error message
      Alert.alert('오류', '퀘스트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setQuestsLoading(false);
    }
  }, [user, goal]);

  const handleQuestPress = useCallback((quest: Quest) => {
    // Navigate to QuestDetailScreen
    // For now, we'll show an alert since we need to set up navigation
    Alert.alert(
      '퀀스트 상세',
      `퀀스트: ${quest.title}\n상태: ${quest.status}`,
      [{ text: '확인' }]
    );
  }, []);

  const handleQuestStatusChange = useCallback(async (questId: string, status: QuestStatus) => {
    if (!user) return;
    
    try {
      await QuestService.updateQuestStatus(questId, status, user.uid);
      
      // Update local state
      setQuests(prevQuests => 
        prevQuests.map(quest => 
          quest.id === questId ? { ...quest, status } : quest
        )
      );
      
      console.log('[GoalDetail] Updated quest status:', questId, 'to', status);
      
    } catch (error) {
      console.error('[GoalDetail] Error updating quest status:', error);
      Alert.alert('오류', '퀀스트 상태 업데이트에 실패했습니다');
    }
  }, [user]);

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

  // Set up header with delete button (only if navigation.setOptions exists)
  useLayoutEffect(() => {
    if (goal && navigation.setOptions) {
      try {
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
      } catch (error) {
        console.log('[GoalDetailScreen] setOptions not available in modal context');
      }
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

  // Check if we're in a modal context (no navigation.setOptions)
  const isModalContext = !navigation.setOptions;

  // Prepare data for FlatList sections
  const listData = [
    { type: 'header', id: 'header' },
    { type: 'goalInfo', id: 'goalInfo' },
    { type: 'progress', id: 'progress' },
    { type: 'verification', id: 'verification' },
    { type: 'quests', id: 'quests' },
    { type: 'delete', id: 'delete' }
  ];

  const renderItem = ({ item }: { item: { type: string; id: string } }) => {
    switch (item.type) {
      case 'header':
        return null; // Header is handled separately
      
      case 'goalInfo':
        return (
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
          </View>
        );
      
      case 'progress':
        return (
          <View className="px-4">
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
          </View>
        );
      
      case 'verification':
        return (
          <View className="px-4">
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
          </View>
        );
      
      case 'quests':
        return (
          <View className="px-4">
            <Text className="text-xl font-bold text-gray-800 mb-4">
              퀀스트 목록
            </Text>
            
            {questsLoading ? (
              <View className="items-center py-8">
                <Ionicons name="hourglass-outline" size={48} color="#6B7280" />
                <Text className="text-gray-600 mt-2 text-center">
                  퀀스트를 생성하는 중...
                </Text>
              </View>
            ) : (
              <FlatList
                data={quests}
                keyExtractor={(item) => item.id}
                renderItem={({ item: quest }) => (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 12,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 2,
                      elevation: 1,
                    }}
                    onPress={() => handleQuestPress(quest)}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 }} numberOfLines={2}>
                          {quest.title}
                        </Text>
                        {quest.description && (
                          <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }} numberOfLines={2}>
                            {quest.description}
                          </Text>
                        )}
                      </View>
                      
                      <View style={{ alignItems: 'center' }}>
                        <Ionicons
                          name={quest.status === 'completed' ? 'checkmark-circle' : quest.status === 'failed' ? 'close-circle' : quest.status === 'pending' ? 'time' : 'help-circle'}
                          size={24}
                          color={quest.status === 'completed' ? '#10B981' : quest.status === 'failed' ? '#EF4444' : quest.status === 'pending' ? '#F59E0B' : '#6B7280'}
                        />
                        <Text style={{ fontSize: 12, fontWeight: '500', marginTop: 4, color: quest.status === 'completed' ? '#10B981' : quest.status === 'failed' ? '#EF4444' : quest.status === 'pending' ? '#F59E0B' : '#6B7280' }}>
                          {quest.status === 'completed' ? '완료' : quest.status === 'failed' ? '실패' : quest.status === 'pending' ? '대기' : '알 수 없음'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                      {quest.scheduledDate && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 }}>
                          <Ionicons name="calendar" size={16} color="#6B7280" />
                          <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 4 }}>
                            {new Date(quest.scheduledDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                          </Text>
                        </View>
                      )}
                      
                      {quest.weekNumber && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 }}>
                          <Ionicons name="repeat" size={16} color="#6B7280" />
                          <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 4 }}>주차 {quest.weekNumber}</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                      {quest.status === 'pending' && (
                        <>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8, backgroundColor: '#ECFDF5' }}
                            onPress={() => handleQuestStatusChange(quest.id, 'completed')}
                          >
                            <Ionicons name="checkmark" size={16} color="#10B981" />
                            <Text style={{ fontSize: 12, fontWeight: '500', marginLeft: 4, color: '#10B981' }}>완료</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8, backgroundColor: '#F9FAFB' }}
                            onPress={() => handleQuestStatusChange(quest.id, 'skipped')}
                          >
                            <Ionicons name="remove" size={16} color="#6B7280" />
                            <Text style={{ fontSize: 12, fontWeight: '500', marginLeft: 4, color: '#6B7280' }}>건너뛰기</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      
                      {quest.status === 'completed' && (
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8, backgroundColor: '#FFFBEB' }}
                          onPress={() => handleQuestStatusChange(quest.id, 'pending')}
                        >
                          <Ionicons name="arrow-undo" size={16} color="#F59E0B" />
                          <Text style={{ fontSize: 12, fontWeight: '500', marginLeft: 4, color: '#F59E0B' }}>되돌리기</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                    <Ionicons name="list" size={48} color="#D1D5DB" />
                    <Text style={{ fontSize: 16, fontWeight: '500', color: '#6B7280', marginTop: 12 }}>퀀스트가 없습니다</Text>
                    <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>
                      목표가 생성되면 자동으로 퀀스트가 생성됩니다
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        );
      
      case 'delete':
        return (
          <View className="px-4">
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
        );
      
      default:
        return null;
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Custom Header for Modal Context */}
      {isModalContext && (
        <View 
          className="bg-white border-b border-gray-200 px-4 flex-row items-center justify-between"
          style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="flex-row items-center"
            style={{ minHeight: 44, minWidth: 44 }} // 터치 영역 확보
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
            <Text className="text-gray-700 font-medium ml-2">Back</Text>
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-900">Goal Details</Text>
          <TouchableOpacity
            onPress={handleDeleteGoal}
            className="p-1"
            style={{ minHeight: 44, minWidth: 44 }} // 터치 영역 확보
          >
            <Ionicons name="trash-outline" size={24} color="#DC2626" />
          </TouchableOpacity>
        </View>
      )}
      
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 90 }} // Add bottom padding for tab bar
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}