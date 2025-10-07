import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GoalDetailScreenV2 } from '.';
import CreateGoalModal from '../components/CreateGoalModal';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { VerificationService } from '../services/verificationService';
import { Goal, RootStackParamList } from '../types';
import { Quest } from '../types/quest';

type GoalsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface GoalWithProgress extends Goal {
  successRate: number;
  recentVerifications: number;
  nextSession?: string;
  completedSessions?: number;
  totalSessions?: number;
  categoryLabel?: string;
}

interface TodayQuest extends Quest {
  goalTitle: string;
  goalCategory?: string;
  scheduledTime?: Date;
}

// 스크린샷 스타일의 간결한 Goal Card
const GoalCard = React.memo(({ 
  item, 
  onPress 
}: { 
  item: GoalWithProgress; 
  onPress: (goal: GoalWithProgress) => void;
}) => {
  const getCategoryEmoji = (category?: string) => {
    if (!category) return '🎯';
    if (category.includes('운동') || category.includes('건강')) return '💪';
    if (category.includes('공부') || category.includes('성장')) return '📚';
    return '🎯';
  };

  const getCategoryLabel = (item: GoalWithProgress) => {
    return item.categoryLabel || '운동 & 건강';
  };

  const getProgressText = (item: GoalWithProgress) => {
    const completed = item.completedSessions || 0;
    const total = item.totalSessions || 0;
    if (total === 0) return '시작 전';
    return `${completed}/${total} 완료 ✓`;
  };

  const getNextScheduleText = (item: GoalWithProgress) => {
    if (item.nextSession) return item.nextSession;
    
    // Calculate next session from weeklyWeekdays
    if (item.weeklyWeekdays && item.weeklyWeekdays.length > 0) {
      const now = new Date();
      const today = now.getDay();
      const nextDay = item.weeklyWeekdays.find(d => d > today) || item.weeklyWeekdays[0];
      const daysUntil = nextDay > today ? nextDay - today : 7 - today + nextDay;
      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + daysUntil);
      
      // Get time from schedule
      const timeStr = item.weeklySchedule?.[nextDay.toString()]?.[0] || '9:00';
      const [hours, minutes] = timeStr.split(':').map(Number);
      nextDate.setHours(hours || 9, minutes || 0);
      
      return `${nextDate.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} ${timeStr}에 수행하세요`;
    }
    
    return '진행 중';
  };

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      className="bg-white rounded-2xl p-4 mb-3 border border-gray-100"
      activeOpacity={0.7}
    >
      {/* Top: Emoji + Title */}
      <View className="flex-row items-start mb-2">
        <Text className="text-2xl mr-2">{getCategoryEmoji(item.categoryLabel)}</Text>
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-900" numberOfLines={2}>
            {item.title || 'Untitled Goal'}
          </Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="pencil" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Category Label */}
      <Text className="text-sm text-blue-600 font-medium mb-3">
        {getCategoryLabel(item)}
      </Text>

      {/* Progress Bar */}
      <View className="bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
        <View 
          className="bg-blue-600 h-2 rounded-full"
          style={{ width: `${Math.min(item.successRate || 0, 100)}%` }}
        />
      </View>

      {/* Bottom: Progress + Schedule Info */}
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-gray-900 font-semibold">
          {getProgressText(item)}
        </Text>
        <View className="flex-row items-center">
          <Ionicons name="refresh-circle" size={14} color="#9CA3AF" style={{ marginRight: 4 }} />
          <Text className="text-xs text-gray-500">{getNextScheduleText(item)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// 투데이 탭의 퀘스트 카드
const TodayQuestCard = React.memo(({ 
  quest,
  onPress 
}: { 
  quest: TodayQuest;
  onPress: () => void;
}) => {
  const getCategoryEmoji = (category?: string) => {
    if (!category) return '🎯';
    if (category.includes('운동') || category.includes('건강')) return '💪';
    if (category.includes('공부') || category.includes('성장')) return '📚';
    return '🎯';
  };

  const getTimeText = () => {
    if (quest.scheduledTime) {
      const time = new Date(quest.scheduledTime);
      const month = String(time.getMonth() + 1).padStart(2, '0');
      const day = String(time.getDate()).padStart(2, '0');
      const hours = String(time.getHours()).padStart(2, '0');
      const minutes = String(time.getMinutes()).padStart(2, '0');
      return `${month}-${day} ${hours}:${minutes}`;
    }
    return '시간 미정';
  };

  const getStatusText = () => {
    if (quest.status === 'completed') return '완료';
    return '진행';
  };

  const isCompleted = quest.status === 'completed';

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-2xl p-4 mb-3 ${isCompleted ? 'bg-green-50 border-2 border-green-400' : 'bg-white border border-gray-200'}`}
      activeOpacity={0.7}
    >
      {/* Goal Title with time */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs text-gray-600 font-medium">
          {getTimeText()} 수행하세요
        </Text>
        {isCompleted && (
          <View className="bg-green-500 rounded-full px-3 py-1">
            <Text className="text-white text-xs font-bold">✓ 완료</Text>
          </View>
        )}
        {!isCompleted && (
          <TouchableOpacity className="bg-white rounded-full px-3 py-1 border border-gray-200">
            <Text className="text-gray-700 text-xs font-medium">진행하기 →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quest Title */}
      <View className="flex-row items-center">
        <Text className="text-xl mr-2">{getCategoryEmoji(quest.goalCategory)}</Text>
        <Text className="text-base font-bold text-gray-900 flex-1" numberOfLines={2}>
          {quest.title || quest.goalTitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default function GoalsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<GoalsScreenNavigationProp>();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [todayQuests, setTodayQuests] = useState<TodayQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'goals' | 'today'>('goals');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showGoalDetail, setShowGoalDetail] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<GoalWithProgress | null>(null);
  
  const mountedRef = useRef(true);

  const categories = ['All', '공부 & 성장', '운동 & 건강', '수면'];

  // Fetch closest quest for each goal
  const fetchTodayQuests = useCallback(async () => {
    if (!user) return;

    try {
      const { QuestService } = await import('../services/questService');
      const now = new Date();
      const allQuests: TodayQuest[] = [];

      // Fetch quests for each goal and get only the closest one
      for (const goal of goals) {
        const quests = await QuestService.getQuestsForGoal(goal.id, user.id);
        
        // Find the closest future quest or today's quest
        const upcomingQuests = quests.filter(q => {
          if (!q.targetDate) return false;
          const questDate = new Date(q.targetDate);
          return questDate >= now;
        });

        // Sort by date and get the closest one
        upcomingQuests.sort((a, b) => {
          const dateA = a.targetDate ? new Date(a.targetDate).getTime() : 0;
          const dateB = b.targetDate ? new Date(b.targetDate).getTime() : 0;
          return dateA - dateB;
        });

        // Add only the closest quest
        if (upcomingQuests.length > 0) {
          const closestQuest = upcomingQuests[0];
          allQuests.push({
            ...closestQuest,
            goalTitle: goal.title,
            goalCategory: (goal as any).categoryLabel || '운동 & 건강',
            scheduledTime: closestQuest.targetDate ? new Date(closestQuest.targetDate) : undefined,
          } as TodayQuest);
        }
      }

      // Sort by scheduled time (nearest first)
      allQuests.sort((a, b) => {
        if (!a.scheduledTime || !b.scheduledTime) return 0;
        return a.scheduledTime.getTime() - b.scheduledTime.getTime();
      });

      setTodayQuests(allQuests);
    } catch (error) {
      console.error('[GoalsScreen] Error fetching today quests:', error);
    }
  }, [user, goals]);

  // Setup realtime listener for goals
  useEffect(() => {
    if (!user) return;

    console.log('[GoalsScreen] Setting up realtime listener for goals');
    
    const goalsQuery = query(
      collection(db, 'users', user.id, 'goals'),
      orderBy('createdAtClient', 'desc')
    );

    const unsubscribe = onSnapshot(goalsQuery, async (snapshot) => {
      if (!mountedRef.current) return;

      try {
        console.log('[GoalsScreen] Goals snapshot received:', snapshot.docs.length, 'documents');
        
        const goalsWithProgress = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const goal = { id: doc.id, ...doc.data() } as Goal;
            
            try {
              const { QuestService } = await import('../services/questService');
              const [successRate, recentVerifications, quests] = await Promise.all([
                VerificationService.calculateGoalSuccessRate(goal.id),
                VerificationService.getRecentGoalVerifications(goal.id, 7),
                QuestService.getQuestsForGoal(goal.id, user.id)
              ]);

              const totalSessions = quests.length;
              const completedSessions = quests.filter(q => q.status === 'completed').length;
              
              const actualSuccessRate = totalSessions > 0 
                ? Math.round((completedSessions / totalSessions) * 100)
                : 0;
              
              return {
                ...goal,
                successRate: actualSuccessRate,
                recentVerifications: recentVerifications?.length || 0,
                completedSessions,
                totalSessions,
                categoryLabel: (goal as any).category || '운동 & 건강',
              } as GoalWithProgress;
            } catch (error) {
              console.warn(`[GoalsScreen] Error loading progress for goal ${goal.id}:`, error);
              return {
                ...goal,
                successRate: 0,
                recentVerifications: 0,
                categoryLabel: '운동 & 건강',
              } as GoalWithProgress;
            }
          })
        );

        const dedupeGoals = (goals: GoalWithProgress[]) => {
          return Array.from(new Map(goals.map(g => [g.id, g])).values());
        };

        const processedGoals = dedupeGoals(goalsWithProgress).sort((a: any, b: any) => {
          const aTs = a.createdAtClient?.toMillis?.() ?? a.createdAt?.getTime?.() ?? 0;
          const bTs = b.createdAtClient?.toMillis?.() ?? b.createdAt?.getTime?.() ?? 0;
          return bTs - aTs;
        });
        
        setGoals(processedGoals);
        setLoading(false);
        setRefreshing(false);
        
        console.log(`[GoalsScreen] Realtime update: ${processedGoals.length} goals`);

      } catch (error) {
        console.error('[GoalsScreen] Error processing goals snapshot:', error);
        if (mountedRef.current) {
          Alert.alert('Error', 'Failed to process goals update. Please try again.');
        }
      }
    }, (error) => {
      console.error('[GoalsScreen] Goals listener error:', error);
      if (mountedRef.current) {
        Alert.alert('Error', 'Failed to listen to goals updates. Please try again.');
      }
    });

    return () => {
      console.log('[GoalsScreen] Cleaning up goals listener');
      unsubscribe();
    };
  }, [user]);

  // Fetch today quests when goals change or tab switches to today
  useEffect(() => {
    if (selectedTab === 'today' && goals.length > 0) {
      fetchTodayQuests();
    }
  }, [selectedTab, goals, fetchTodayQuests]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleGoalPress = useCallback((goal: GoalWithProgress) => {
    console.log('[GOAL:press]', { id: goal.id, title: goal.title });
    setSelectedGoal(goal);
    setShowGoalDetail(true);
  }, []);

  const handleQuestPress = useCallback((quest: TodayQuest) => {
    console.log('[QUEST:press]', { id: quest.id, goalId: quest.goalId });
    // Find the goal and navigate to it
    const goal = goals.find(g => g.id === quest.goalId);
    if (goal) {
      handleGoalPress(goal);
    }
  }, [goals, handleGoalPress]);

  const handleCreateGoal = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleGoalCreated = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  const goalKeyExtractor = useCallback((item: GoalWithProgress) => item.id, []);
  const questKeyExtractor = useCallback((item: TodayQuest) => item.id, []);

  const renderGoalItem = useCallback(({ item }: { item: GoalWithProgress }) => (
    <GoalCard item={item} onPress={handleGoalPress} />
  ), [handleGoalPress]);

  const renderTodayQuestItem = useCallback(({ item }: { item: TodayQuest }) => (
    <TodayQuestCard quest={item} onPress={() => handleQuestPress(item)} />
  ), [handleQuestPress]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-600">Loading...</Text>
      </View>
    );
  }

  const filteredGoals = selectedCategory === 'All' 
    ? goals 
    : goals.filter(g => g.categoryLabel === selectedCategory);

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-14 pb-4">
        {/* Title and Notification */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-gray-900">나의 목표</Text>
          <TouchableOpacity>
            <Ionicons name="notifications-outline" size={28} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {/* Search Bar and New Button */}
        <View className="flex-row items-center mb-4">
          <View className="flex-1 bg-gray-50 rounded-xl flex-row items-center px-4 py-3 mr-3">
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <Text className="flex-1 ml-2 text-gray-400 text-sm">search your goal !</Text>
            <TouchableOpacity>
              <Ionicons name="options-outline" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={handleCreateGoal}
            className="bg-blue-600 rounded-full w-12 h-12 items-center justify-center"
          >
            <Ionicons name="add" size={28} color="white" />
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View className="flex-row bg-gray-50 rounded-xl p-1">
          <TouchableOpacity
            onPress={() => setSelectedTab('goals')}
            className={`flex-1 py-3 rounded-lg ${selectedTab === 'goals' ? 'bg-white' : ''}`}
          >
            <Text className={`text-center font-bold ${selectedTab === 'goals' ? 'text-blue-600' : 'text-gray-500'}`}>
              설정 목표
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedTab('today')}
            className={`flex-1 py-3 rounded-lg ${selectedTab === 'today' ? 'bg-white' : ''}`}
          >
            <Text className={`text-center font-bold ${selectedTab === 'today' ? 'text-blue-600' : 'text-gray-500'}`}>
              투데이
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Chips - Only show for goals tab */}
      {selectedTab === 'goals' && (
        <View className="px-4 mb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                className={`mr-3 px-5 py-2 rounded-full ${
                  selectedCategory === category ? 'bg-blue-600' : 'bg-gray-100'
                }`}
                onPress={() => setSelectedCategory(category)}
              >
                <Text className={`font-bold text-sm ${
                  selectedCategory === category ? 'text-white' : 'text-gray-600'
                }`}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Count */}
      <View className="px-4 pt-2 pb-3">
        <Text className="text-sm text-gray-600">
          {selectedTab === 'goals' 
            ? `${filteredGoals.length}개의 검색 결과` 
            : `오늘의 퀘스트`}
        </Text>
      </View>

      {/* Content */}
      {selectedTab === 'goals' ? (
        <FlatList
          data={filteredGoals}
          renderItem={renderGoalItem}
          keyExtractor={goalKeyExtractor}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <Ionicons name="flag-outline" size={64} color="#D1D5DB" />
              <Text className="text-xl font-bold text-gray-400 mt-4 text-center">
                목표가 없습니다
              </Text>
              <Text className="text-gray-400 text-center mt-2 px-8">
                첫 번째 목표를 만들어보세요!
              </Text>
              <TouchableOpacity
                className="bg-blue-600 px-6 py-3 rounded-full mt-6"
                onPress={handleCreateGoal}
              >
                <Text className="text-white font-bold">목표 만들기</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={todayQuests}
          renderItem={renderTodayQuestItem}
          keyExtractor={questKeyExtractor}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
              <Text className="text-xl font-bold text-gray-400 mt-4 text-center">
                오늘 예정된 퀘스트가 없습니다
              </Text>
              <Text className="text-gray-400 text-center mt-2 px-8">
                목표를 만들고 퀘스트를 시작하세요!
              </Text>
            </View>
          }
        />
      )}

      {/* Create Goal Modal */}
      <CreateGoalModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onGoalCreated={handleGoalCreated}
      />

      {/* Goal Detail Modal */}
      <Modal
        visible={showGoalDetail}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        {selectedGoal && (
          <GoalDetailScreenV2
            route={{ params: { goalId: selectedGoal.id } } as any}
            navigation={{
              goBack: () => setShowGoalDetail(false),
              navigate: () => {},
              getState: () => ({ routeNames: [] }),
              setOptions: undefined,
              push: () => {},
              pop: () => {},
              popToTop: () => {},
              replace: () => {},
              reset: () => {},
              isFocused: () => true,
              addListener: () => ({ remove: () => {} }),
              removeListener: () => {},
              canGoBack: () => true,
              dispatch: () => {},
              setParams: () => {},
              getParent: () => undefined,
              getFocusedRouteNameFromRoute: () => undefined,
              getId: () => 'modal-goal-detail'
            } as any}
          />
        )}
      </Modal>
    </View>
  );
}
