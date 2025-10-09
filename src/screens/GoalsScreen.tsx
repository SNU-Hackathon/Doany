import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { GoalDetailScreenV2 } from '.';
import { BaseScreen, LoadingState } from '../components';
import CreateGoalModal from '../components/CreateGoalModal';
import { useAuth } from '../hooks/useAuth';
import { useMyGoals } from '../hooks/useGoals';
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
          <Text className="text-base font-bold text-gray-900 leading-tight" numberOfLines={1}>
            {item.title}
          </Text>
          <Text className="text-xs text-gray-500 mt-0.5">{getCategoryLabel(item)}</Text>
        </View>
      </View>

      {/* Middle: Progress */}
      <View className="mb-2">
        <Text className="text-sm text-gray-600">{getProgressText(item)}</Text>
      </View>

      {/* Bottom: Next Schedule */}
      <View className="flex-row items-center">
        <Ionicons name="time-outline" size={14} color="#9CA3AF" />
        <Text className="text-xs text-gray-500 ml-1">{getNextScheduleText(item)}</Text>
      </View>
    </TouchableOpacity>
  );
});

const GoalsScreen = () => {
  const navigation = useNavigation<GoalsScreenNavigationProp>();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  // REST API data fetching
  const { 
    data: goalsData, 
    isLoading: goalsLoading, 
    error: goalsError,
    refetch 
  } = useMyGoals({ 
    page: 1, 
    pageSize: 100 
  });

  const [selectedGoal, setSelectedGoal] = useState<GoalWithProgress | null>(null);
  const [showGoalDetail, setShowGoalDetail] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Transform API goals to GoalWithProgress format
  const goals: GoalWithProgress[] = React.useMemo(() => {
    if (!goalsData?.items) return [];

    return goalsData.items.map((apiGoal): GoalWithProgress => ({
      // Map API fields to local Goal type
      id: apiGoal.goalId,
      userId: user?.id || '',
      title: apiGoal.title,
      description: apiGoal.description || '',
      category: apiGoal.tags?.[0] || '기타',
      verificationMethods: [],
      frequency: { count: 1, unit: 'per_day' },
      duration: { type: 'days', value: 30 },
      createdAt: new Date(),
      updatedAt: new Date(),
      
      // Progress fields (mock for now)
      successRate: 0,
      recentVerifications: 0,
      completedSessions: 0,
      totalSessions: 0,
      categoryLabel: apiGoal.tags?.[0] || '기타',
    } as GoalWithProgress));
  }, [goalsData, user]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleGoalPress = useCallback((goal: GoalWithProgress) => {
    setSelectedGoal(goal);
    setShowGoalDetail(true);
  }, []);

  const handleGoalDetailClose = useCallback(() => {
    setShowGoalDetail(false);
    setSelectedGoal(null);
    refetch(); // Refresh goals after closing detail
  }, [refetch]);

  const handleCreateGoal = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleCreateGoalClose = useCallback(() => {
    setShowCreateModal(false);
    refetch(); // Refresh goals after creating
  }, [refetch]);

  // Show loading state
  if (authLoading || goalsLoading) {
    return (
      <BaseScreen
        title="목표"
        rightAction={{
          icon: 'add',
          onPress: handleCreateGoal,
        }}
      >
        <LoadingState />
      </BaseScreen>
    );
  }

  // Show error state
  if (goalsError) {
    return (
      <BaseScreen
        title="목표"
        rightAction={{
          icon: 'add',
          onPress: handleCreateGoal,
        }}
      >
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-red-600 text-center mb-4">
            목표를 불러오는 중 오류가 발생했습니다
          </Text>
          <TouchableOpacity
            className="bg-blue-600 px-6 py-3 rounded-lg"
            onPress={() => refetch()}
          >
            <Text className="text-white font-semibold">다시 시도</Text>
          </TouchableOpacity>
        </View>
      </BaseScreen>
    );
  }

  // Show not authenticated state
  if (!isAuthenticated) {
    return (
      <BaseScreen
        title="목표"
        rightAction={{
          icon: 'add',
          onPress: handleCreateGoal,
        }}
      >
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-gray-600 text-center mb-4">
            로그인이 필요합니다
          </Text>
          <TouchableOpacity
            className="bg-blue-600 px-6 py-3 rounded-lg"
            onPress={() => {
              // TODO: Navigate to auth screen
              Alert.alert('알림', '로그인 화면으로 이동합니다');
            }}
          >
            <Text className="text-white font-semibold">로그인</Text>
          </TouchableOpacity>
        </View>
      </BaseScreen>
    );
  }

  return (
    <BaseScreen
      title="목표"
      rightAction={{
        icon: 'add',
        onPress: handleCreateGoal,
      }}
      contentPadding={false}
    >
      {/* Goals List */}
      <FlatList
        data={goals}
        renderItem={({ item }) => (
          <GoalCard item={item} onPress={handleGoalPress} />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text className="text-gray-400 text-center mb-4">
              아직 목표가 없습니다
            </Text>
            <TouchableOpacity
              className="bg-blue-600 px-6 py-3 rounded-lg"
              onPress={handleCreateGoal}
            >
              <Text className="text-white font-semibold">첫 목표 만들기</Text>
            </TouchableOpacity>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />

      {/* Goal Detail Modal */}
      {selectedGoal && (
        <Modal
          visible={showGoalDetail}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleGoalDetailClose}
        >
          <GoalDetailScreenV2
            goalId={selectedGoal.id}
            onClose={handleGoalDetailClose}
          />
        </Modal>
      )}

      {/* Create Goal Modal */}
      <CreateGoalModal
        visible={showCreateModal}
        onClose={handleCreateGoalClose}
      />
    </BaseScreen>
  );
};

export default GoalsScreen;
