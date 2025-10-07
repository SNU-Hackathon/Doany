// Goal Detail Screen V2 - Separated Calendar and Detail tabs
// Tab 1 (퀘스트): Calendar only with quest schedules
// Tab 2 (상세보기): Quest list only

import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { ShareToFeedDialog } from '../components/feed';
import { useAuth } from '../hooks/useAuth';
import { GoalService } from '../services/goalService';
import { QuestService } from '../services/questService';
import { VerificationService } from '../services/verificationService';
import { Goal, Quest, RootStackParamList } from '../types';

type GoalDetailScreenRouteProp = RouteProp<RootStackParamList, 'GoalDetail'>;
type GoalDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'GoalDetail'>;

interface GoalDetailScreenProps {
  route: GoalDetailScreenRouteProp;
  navigation: GoalDetailScreenNavigationProp;
}

type TabType = 'calendar' | 'detail';

interface GridDay {
  date: Date;
  iso: string;
  inMonth: boolean;
  key: string;
}

// Helper to build a stable 6-week (42-day) calendar grid
function buildMonthGrid(year: number, month0: number): GridDay[] {
  const firstDay = new Date(year, month0, 1);
  const lastDay = new Date(year, month0 + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0=Sunday

  const grid: GridDay[] = [];

  // Previous month filler
  const prevMonthLastDay = new Date(year, month0, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const d = new Date(year, month0 - 1, day);
    const iso = d.toISOString().split('T')[0];
    grid.push({ date: d, iso, inMonth: false, key: `prev-${iso}` });
  }

  // Current month
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month0, day);
    const iso = d.toISOString().split('T')[0];
    grid.push({ date: d, iso, inMonth: true, key: iso });
  }

  // Next month filler to complete 42 cells (6 weeks)
  const remaining = 42 - grid.length;
  for (let day = 1; day <= remaining; day++) {
    const d = new Date(year, month0 + 1, day);
    const iso = d.toISOString().split('T')[0];
    grid.push({ date: d, iso, inMonth: false, key: `next-${iso}` });
  }

  return grid;
}

interface CalendarTabProps {
  selectedMonth: Date;
  quests: Quest[];
  onMonthChange: (direction: 'prev' | 'next') => void;
}

function CalendarTab({ selectedMonth, quests, onMonthChange }: CalendarTabProps) {
  const gridDays = useMemo(() => {
    return buildMonthGrid(selectedMonth.getFullYear(), selectedMonth.getMonth());
  }, [selectedMonth]);

  const questMap = useMemo(() => {
    const map = new Map<string, Quest>();
    quests.forEach(q => {
      if (q.targetDate) {
        const iso = q.targetDate.split('T')[0];
        map.set(iso, q);
      }
    });
    return map;
  }, [quests]);

  const isToday = (iso: string) => {
    const today = new Date().toISOString().split('T')[0];
    return iso === today;
  };

  const renderDayCell = ({ item }: { item: GridDay }) => {
    const quest = questMap.get(item.iso);
    const today = isToday(item.iso);
    const isCompleted = quest?.status === 'completed';
    const dayNumber = item.date.getDate();

    return (
      <View style={{ 
        width: `${100/7}%`, 
        aspectRatio: 1, 
        padding: 2,
        opacity: item.inMonth ? 1 : 0.3
      }}>
        <View style={{ 
          flex: 1, 
          alignItems: 'center', 
          justifyContent: 'flex-start',
          paddingTop: 6
        }}>
          {/* Day number */}
          <Text style={{ 
            fontSize: 13, 
            fontWeight: today ? '700' : '500',
            color: today ? '#3B82F6' : '#374151',
            marginBottom: 6
          }}>
            {dayNumber}
          </Text>

          {/* Quest indicator */}
          {quest && item.inMonth && (
            <View style={{ alignItems: 'center' }}>
              {today && !isCompleted && (
                <View style={{ 
                  backgroundColor: '#FBBF24', 
                  borderRadius: 8, 
                  paddingHorizontal: 6, 
                  paddingVertical: 2,
                  marginBottom: 2
                }}>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: '#000' }}>
                    Today !
                  </Text>
                </View>
              )}
              {isCompleted && (
                <View style={{ 
                  backgroundColor: '#10B981', 
                  borderRadius: 12, 
                  width: 24, 
                  height: 24, 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Ionicons name="checkmark" size={16} color="white" />
                </View>
              )}
              {!isCompleted && !today && (
                <View style={{ 
                  backgroundColor: '#E5E7EB', 
                  borderRadius: 12, 
                  width: 24, 
                  height: 24, 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Ionicons name="lock-closed" size={12} color="#9CA3AF" />
                </View>
              )}
            </View>
          )}

          {/* Level up badge on 29th */}
          {dayNumber === 29 && item.inMonth && (
            <View style={{ 
              backgroundColor: '#FEF3C7', 
              borderRadius: 4, 
              paddingHorizontal: 4, 
              paddingVertical: 2,
              marginTop: 2
            }}>
              <Text style={{ fontSize: 7, fontWeight: '700', color: '#92400E' }}>Level up</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  const monthYear = `${selectedMonth.getFullYear()}년 ${selectedMonth.getMonth() + 1}월`;

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Month selector */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        paddingVertical: 20,
        paddingHorizontal: 16
      }}>
        <TouchableOpacity onPress={() => onMonthChange('prev')} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18, color: '#6B7280' }}>◀</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginHorizontal: 24 }}>
          {monthYear}
        </Text>
        <TouchableOpacity onPress={() => onMonthChange('next')} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18, color: '#6B7280' }}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Week days header */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 }}>
        {weekDays.map((day, index) => (
          <View key={index} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280' }}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={{ paddingHorizontal: 16 }}>
        <FlatList
          data={gridDays}
          numColumns={7}
          scrollEnabled={false}
          keyExtractor={(item) => item.key}
          renderItem={renderDayCell}
          columnWrapperStyle={{ flexDirection: 'row' }}
        />
      </View>
    </View>
  );
}

interface DetailTabProps {
  quests: Quest[];
  goal: Goal | null;
  refreshing: boolean;
  onRefresh: () => void;
  onUpload: (quest: Quest) => void;
  onComplete: (quest: Quest) => void;
  onSkip: (quest: Quest) => void;
}

function DetailTab({ quests, goal, refreshing, onRefresh, onUpload, onComplete, onSkip }: DetailTabProps) {
  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const renderQuestCard = ({ item }: { item: Quest }) => {
    const date = item.targetDate ? new Date(item.targetDate) : null;
    const today = date && isToday(date);
    const isCompleted = item.status === 'completed';

    return (
      <View style={{
        backgroundColor: today ? '#F0FDF4' : '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        marginHorizontal: 16,
        borderWidth: today ? 2 : 1,
        borderColor: today ? '#10B981' : '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1
      }}>
        {/* Header with Today badge and Upload button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          {today && (
            <View style={{ backgroundColor: '#3B82F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>Today !</Text>
            </View>
          )}
          {!today && <View />}
          {today && !isCompleted && (
            <TouchableOpacity 
              onPress={() => onUpload(item)}
              style={{ 
                backgroundColor: '#10B981', 
                borderRadius: 12, 
                paddingHorizontal: 14, 
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Ionicons name="camera" size={14} color="white" />
              <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>업로드</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quest info */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
          <View style={{ marginRight: 12, marginTop: 2 }}>
            <Ionicons 
              name={isCompleted ? "checkmark-circle" : "refresh-circle-outline"} 
              size={28} 
              color={isCompleted ? "#10B981" : "#F97316"} 
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 6 }}>
              {item.title || goal?.title}
            </Text>
            {date && (
              <Text style={{ fontSize: 13, color: '#6B7280' }}>
                {date.getFullYear()}-{String(date.getMonth() + 1).padStart(2, '0')}-{String(date.getDate()).padStart(2, '0')} 7:00에 수행하세요
              </Text>
            )}
          </View>
        </View>

        {/* Action buttons */}
        {today && !isCompleted && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              onPress={() => onComplete(item)}
              style={{
                flex: 1,
                backgroundColor: 'white',
                borderWidth: 1.5,
                borderColor: '#10B981',
                borderRadius: 10,
                paddingVertical: 11,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 14 }}>✓ 완료</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => onSkip(item)}
              style={{
                flex: 1,
                backgroundColor: 'white',
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 10,
                paddingVertical: 11,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 14 }}>→ 건너뛰기</Text>
            </TouchableOpacity>
          </View>
        )}
        {isCompleted && (
          <View style={{ 
            backgroundColor: '#D1FAE5', 
            borderRadius: 8, 
            paddingVertical: 10,
            alignItems: 'center'
          }}>
            <Text style={{ color: '#065F46', fontWeight: '700', fontSize: 14 }}>✓ 완료됨</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <FlatList
      data={quests}
      keyExtractor={(item) => item.id}
      renderItem={renderQuestCard}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingVertical: 16, paddingBottom: 100 }}
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingVertical: 48 }}>
          <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
          <Text style={{ color: '#9CA3AF', marginTop: 16, fontSize: 14 }}>퀘스트가 없습니다</Text>
        </View>
      }
    />
  );
}

export default function GoalDetailScreenV2({ route, navigation }: GoalDetailScreenProps) {
  const { goalId } = route.params;
  const { user } = useAuth();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('calendar');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Feed share dialog state
  const [shareDialogVisible, setShareDialogVisible] = useState(false);
  const [currentQuest, setCurrentQuest] = useState<Quest | null>(null);
  const [lastPhotoUri, setLastPhotoUri] = useState<string>('');

  const loadGoalData = useCallback(async () => {
    if (!goalId || !user) return;

    try {
      const [goalData, questsData] = await Promise.all([
        GoalService.getGoal(goalId),
        QuestService.getQuestsForGoal(goalId, user.id)
      ]);

      setGoal(goalData);
      
      // Sort quests by date
      const sortedQuests = questsData.sort((a, b) => {
        const dateA = a.targetDate ? new Date(a.targetDate).getTime() : 0;
        const dateB = b.targetDate ? new Date(b.targetDate).getTime() : 0;
        return dateA - dateB;
      });
      
      setQuests(sortedQuests);
    } catch (error) {
      console.error('[GoalDetailV2] Error loading data:', error);
      Alert.alert('오류', '데이터를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [goalId, user]);

  useEffect(() => {
    loadGoalData();
  }, [loadGoalData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadGoalData();
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setSelectedMonth(newMonth);
  };

  // Upload photo handler
  const handleUpload = async (quest: Quest) => {
    if (!user || !goal) return;

    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '사진을 업로드하려면 카메라 권한이 필요합니다.');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const photoUri = result.assets[0].uri;
        setLastPhotoUri(photoUri);

        // Convert URI to Blob for upload
        const response = await fetch(photoUri);
        const blob = await response.blob();

        // Create verification
        await VerificationService.createVerification(
          goal.id,
          user.id,
          'success',
          undefined,
          blob
        );

        // Update quest status
        await QuestService.updateQuestStatus(quest.id, 'completed', user.id);

        // Show share dialog
        setCurrentQuest(quest);
        setShareDialogVisible(true);

        Alert.alert('성공', '퀘스트가 완료되었습니다!');
        loadGoalData();
      }
    } catch (error) {
      console.error('[Upload] Error:', error);
      Alert.alert('오류', '사진 업로드에 실패했습니다.');
    }
  };

  // Complete quest handler
  const handleComplete = async (quest: Quest) => {
    if (!user || !goal) return;

    Alert.alert(
      '퀘스트 완료',
      '이 퀘스트를 완료하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '완료',
          onPress: async () => {
            try {
              // Create manual verification
              await VerificationService.createVerification(
                goal.id,
                user.id,
                'success'
              );

              // Update quest status
              await QuestService.updateQuestStatus(quest.id, 'completed', user.id);

              // Show share dialog
              setCurrentQuest(quest);
              setShareDialogVisible(true);

              Alert.alert('성공', '퀘스트가 완료되었습니다!');
              loadGoalData();
            } catch (error) {
              console.error('[Complete] Error:', error);
              Alert.alert('오류', '퀘스트 완료 처리에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  // Skip quest handler
  const handleSkip = async (quest: Quest) => {
    Alert.alert(
      '퀘스트 건너뛰기',
      '이 퀘스트를 건너뛰시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '건너뛰기',
          onPress: async () => {
            try {
              if (!user) return;
              // Update quest status to skipped
              await QuestService.updateQuestStatus(quest.id, 'skipped', user.id);
              Alert.alert('알림', '퀘스트를 건너뛰었습니다.');
              loadGoalData();
            } catch (error) {
              console.error('[Skip] Error:', error);
              Alert.alert('오류', '퀘스트 건너뛰기에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Header */}
      <View style={{ 
        paddingHorizontal: 16, 
        paddingTop: 56, 
        paddingBottom: 16, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6'
      }}>
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>퀘스트</Text>
        <TouchableOpacity>
          <Ionicons name="notifications-outline" size={28} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, backgroundColor: 'white' }}>
        <TouchableOpacity
          style={{ 
            flex: 1, 
            paddingVertical: 14, 
            borderBottomWidth: 2, 
            borderBottomColor: activeTab === 'calendar' ? '#3B82F6' : 'transparent' 
          }}
          onPress={() => setActiveTab('calendar')}
        >
          <Text style={{ 
            textAlign: 'center', 
            fontSize: 15,
            fontWeight: '700', 
            color: activeTab === 'calendar' ? '#3B82F6' : '#9CA3AF' 
          }}>
            퀘스트
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ 
            flex: 1, 
            paddingVertical: 14, 
            borderBottomWidth: 2, 
            borderBottomColor: activeTab === 'detail' ? '#3B82F6' : 'transparent' 
          }}
          onPress={() => setActiveTab('detail')}
        >
          <Text style={{ 
            textAlign: 'center', 
            fontSize: 15,
            fontWeight: '700', 
            color: activeTab === 'detail' ? '#3B82F6' : '#9CA3AF' 
          }}>
            상세보기
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab content */}
      {activeTab === 'calendar' ? (
        <CalendarTab 
          selectedMonth={selectedMonth}
          quests={quests}
          onMonthChange={changeMonth}
        />
      ) : (
        <DetailTab 
          quests={quests}
          goal={goal}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onUpload={handleUpload}
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      )}

      {/* Share to Feed Dialog */}
      {currentQuest && (
        <ShareToFeedDialog
          visible={shareDialogVisible}
          onClose={() => {
            setShareDialogVisible(false);
            setCurrentQuest(null);
            setLastPhotoUri('');
          }}
          onSuccess={() => {
            loadGoalData();
          }}
          questTitle={currentQuest.title || goal?.title || '퀘스트'}
          goalId={goalId}
          questId={currentQuest.id}
          userId={user?.id || ''}
          userName={user?.displayName}
          photoUrls={lastPhotoUri ? [lastPhotoUri] : []}
          hasLocation={false}
          hasTime={true}
        />
      )}
    </View>
  );
}
