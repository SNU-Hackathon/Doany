import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { GoalDetailScreenV2 } from '.';
import { GoalCategory, GoalListItem } from '../api/types';
import { LoadingState } from '../components';
import AppHeader from '../components/AppHeader';
import CreateGoalModal from '../components/CreateGoalModal';
import { useAuth } from '../hooks/useAuth';
import { useMyGoals } from '../hooks/useGoals';
import categoriesData from '../mocks/goals.categories.json';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Goal Card Component - Matches screenshot design exactly
const GoalCard = React.memo(({ 
  item, 
  onPress 
}: { 
  item: GoalListItem; 
  onPress: (goal: GoalListItem) => void;
}) => {
  const getCategoryColor = (category?: GoalCategory) => {
    switch (category) {
      case 'health fitness': return '#4F46E5'; // Indigo
      case 'study': return '#3B82F6'; // Blue
      case 'sleep': return '#8B5CF6'; // Purple
      default: return '#6B7280'; // Gray
    }
  };

  const getProgressPercentage = () => {
    if (item.progressCurrent && item.progressTotal) {
      return (item.progressCurrent / item.progressTotal) * 100;
    }
    return 56; // Mock data for screenshot match
  };

  const getProgressText = () => {
    if (item.progressCurrent && item.progressTotal) {
      return `${item.progressCurrent}/${item.progressTotal} 완료 ✓`;
    }
    return '9/16 완료 ✓';
  };

  const formatDateRange = () => {
    if (item.startAt && item.endAt) {
      try {
        const start = new Date(Number(item.startAt));
        const end = new Date(Number(item.endAt));
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return '날짜 미정';
        }
        
        return `${start.getMonth() + 1}월 ${start.getDate()}일-${end.getMonth() + 1}월 ${end.getDate()}일`;
      } catch (error) {
        console.error('Date formatting error:', error);
        return '날짜 미정';
      }
    }
    return '10월 3일-10월 30일';
  };

  return (
    <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.9}>
      <View style={styles.goalCard}>
        {/* Header with Icon, Title and Edit Button */}
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Ionicons name="disc-outline" size={28} color="#9CA3AF" />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.goalTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.categoryText}>
              {item.category || '운동 & 건강'}
            </Text>
            <Text style={styles.tagsText}>
              {item.tag ? item.tag.split('&').map(tag => `#${tag.trim()}`).join(' ') : '#헬스 #운동 #루틴'}
            </Text>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Ionicons name="pencil" size={18} color="#BFBFBF" />
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${getProgressPercentage()}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{getProgressText()}</Text>
        </View>

        {/* Status and Date Row */}
        <View style={styles.statusRow}>
          <View style={styles.statusContainer}>
            <Ionicons name="reload-circle" size={16} color="#10B981" style={{ marginRight: 4 }} />
            <Text style={styles.statusText}>진행중</Text>
          </View>
          <Text style={styles.dateText}>{formatDateRange()}</Text>
        </View>

        {/* Quest Button */}
        <TouchableOpacity 
          style={styles.questButton}
          onPress={() => onPress(item)}
        >
          <Text style={styles.questButtonText}>퀘스트 {'>'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

export default function GoalsScreen() {
  const navigation = useNavigation<GoalsScreenNavigationProp>();
  const { user } = useAuth();
  
  // State
  const [selectedGoal, setSelectedGoal] = useState<GoalListItem | null>(null);
  const [showGoalDetail, setShowGoalDetail] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [creationMethod, setCreationMethod] = useState<'ai' | 'manual' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<GoalCategory | 'All'>('All');
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  // Extract user ID as primitive to avoid infinite loop
  const userId = user?.userId || '1';

  // API hooks
  const { 
    data: goalsData, 
    isLoading: loading, 
    error, 
    refetch 
  } = useMyGoals(userId, {
    page: 1,
    pageSize: 20, // 최대 20
    state: 'onTrack', // 기본값
    ...(selectedCategory !== 'All' && { category: selectedCategory }), // category가 'All'이 아닐 때만 포함
    sort: 'updatedAt_desc', // 기본값
    visibility: 'public' // 기본값
  });

  // Transform and filter goals
  const filteredGoals: GoalListItem[] = React.useMemo(() => {
    if (!goalsData?.items) return [];

    let filtered = goalsData.items;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(goal => 
        goal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        goal.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        goal.tag?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(goal => goal.category === selectedCategory);
    }

    return filtered;
  }, [goalsData, searchQuery, selectedCategory]);

  // Event handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleGoalPress = useCallback((goal: GoalListItem) => {
    setSelectedGoal(goal);
    setShowGoalDetail(true);
  }, []);

  const handleGoalDetailClose = useCallback(() => {
    setShowGoalDetail(false);
    setSelectedGoal(null);
  }, []);

  const handleCreateGoal = useCallback(() => {
    setShowMethodSelector(true);
  }, []);

  const handleMethodSelect = useCallback((method: 'ai' | 'manual') => {
    setCreationMethod(method);
    setShowMethodSelector(false);
    setShowCreateModal(true);
  }, []);

  const handleCreateGoalClose = useCallback(() => {
    setShowCreateModal(false);
    setCreationMethod(null);
  }, []);

  const handleGoalCreated = useCallback(() => {
    setShowCreateModal(false);
    setCreationMethod(null);
    refetch();
  }, [refetch]);

  // Category options - from JSON
  const allCategories: (GoalCategory | 'All')[] = categoriesData.categories as (GoalCategory | 'All')[];
  const displayedCategories = categoriesExpanded ? allCategories : allCategories.slice(0, 8);
  const hasMoreCategories = allCategories.length > 8;

  // Render item
  const renderItem = useCallback(({ item }: { item: GoalListItem }) => (
    <GoalCard item={item} onPress={handleGoalPress} />
  ), [handleGoalPress]);

  // Key extractor
  const keyExtractor = useCallback((item: GoalListItem) => String(item.goalId), []);

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Unified Header */}
      <AppHeader
        title="나의 목표"
        showNotification
        onNotificationPress={() => console.log('Notifications')}
        showSearch
        searchPlaceholder="search your goals !"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        showSearchOptions
        onSearchOptionsPress={() => console.log('Search options')}
        showActionButton
        actionButtonIcon="add"
        onActionButtonPress={handleCreateGoal}
        actionButtonColor="#4F46E5"
      />

      {/* Tabs and Filters Container */}
      <View style={styles.filtersContainer}>
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tab, styles.activeTab]}>
            <Text style={[styles.tabText, styles.activeTabText]}>설정 목표</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab}>
            <Text style={styles.tabText}>투데이</Text>
          </TouchableOpacity>
        </View>

        {/* Category Filters */}
        <View style={styles.categoriesContainer}>
          <FlatList
            data={displayedCategories}
            horizontal={!categoriesExpanded}
            numColumns={categoriesExpanded ? 4 : undefined}
            key={categoriesExpanded ? 'expanded' : 'collapsed'}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.categoriesList,
              categoriesExpanded && styles.categoriesListExpanded
            ]}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  selectedCategory === item && styles.selectedCategoryChip,
                  categoriesExpanded && styles.categoryChipExpanded
                ]}
                onPress={() => setSelectedCategory(item)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === item && styles.selectedCategoryChipText
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
          {hasMoreCategories && (
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setCategoriesExpanded(!categoriesExpanded)}
            >
              <Ionicons 
                name={categoriesExpanded ? 'chevron-up' : 'chevron-down'} 
                size={16} 
                color="#6B7280" 
              />
              <Text style={styles.expandButtonText}>
                {categoriesExpanded ? '접기' : '더보기'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.resultsText}>
          {filteredGoals.length}건의 검색 결과
        </Text>
        
        <FlatList
          data={filteredGoals}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.goalsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      </View>

      {/* Modals */}
      <Modal
        visible={showGoalDetail}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setShowGoalDetail(false);
          setSelectedGoal(null);
        }}
      >
        {selectedGoal && (
          <GoalDetailScreenV2
            route={{ params: { goalId: selectedGoal.goalId } } as any}
            navigation={navigation as any}
            onClose={() => {
              setShowGoalDetail(false);
              setSelectedGoal(null);
            }}
          />
        )}
      </Modal>

      {/* Method Selection Modal */}
      <Modal
        visible={showMethodSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMethodSelector(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 32, width: SCREEN_WIDTH * 0.85, maxWidth: 400 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#1F2937', marginBottom: 12, textAlign: 'center' }}>
              목표 생성 방식 선택
            </Text>
            <Text style={{ fontSize: 15, color: '#6B7280', marginBottom: 32, textAlign: 'center', lineHeight: 22 }}>
              AI와 대화하며 생성하거나{'\n'}직접 수동으로 만들 수 있습니다
            </Text>

            {/* AI Method */}
            <TouchableOpacity
              onPress={() => handleMethodSelect('ai')}
              activeOpacity={0.7}
              style={{
                backgroundColor: '#4F46E5',
                borderRadius: 16,
                padding: 20,
                marginBottom: 16,
                shadowColor: '#4F46E5',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="sparkles" size={28} color="#FFF" />
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#FFF', marginLeft: 12 }}>
                  AI와 대화하기
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: '#E0E7FF', lineHeight: 20 }}>
                AI가 질문하면서 맞춤형 목표를 생성해드려요
              </Text>
            </TouchableOpacity>

            {/* Manual Method */}
            <TouchableOpacity
              onPress={() => handleMethodSelect('manual')}
              activeOpacity={0.7}
              style={{
                backgroundColor: '#FFF',
                borderRadius: 16,
                padding: 20,
                borderWidth: 2,
                borderColor: '#E5E7EB',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="create-outline" size={28} color="#4F46E5" />
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#1F2937', marginLeft: 12 }}>
                  직접 만들기
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
                원하는 대로 세부사항을 직접 설정할 수 있어요
              </Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              onPress={() => setShowMethodSelector(false)}
              style={{ marginTop: 20, padding: 12 }}
            >
              <Text style={{ textAlign: 'center', color: '#6B7280', fontSize: 16, fontWeight: '600' }}>
                취소
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CreateGoalModal
        visible={showCreateModal}
        onClose={handleCreateGoalClose}
        onGoalCreated={handleGoalCreated}
        creationMethod={creationMethod}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 60,
    marginRight: 25,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  categoriesContainer: {
    marginBottom: 4,
    marginLeft: 10,
  },
  categoriesList: {
    paddingRight: 20,
  },
  categoriesListExpanded: {
    paddingRight: 0,
    paddingBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
    marginBottom: 6,
  },
  categoryChipExpanded: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
  },
  selectedCategoryChip: {
    backgroundColor: '#E5E7EB',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  selectedCategoryChipText: {
    color: '#1F2937',
    fontWeight: '600',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 20,
    marginBottom: 6,
  },
  expandButtonText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    marginLeft: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  resultsText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginVertical: 12,
  },
  goalsList: {
    paddingBottom: 20,
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 20,
  },
  editButton: {
    padding: 4,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 2,
  },
  tagsText: {
    fontSize: 12,
    color: '#BFBFBF',
    lineHeight: 16,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E8E8E8',
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#BFBFBF',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: '#BFBFBF',
    fontWeight: '400',
    minWidth: 70,
    textAlign: 'right',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 12,
    color: '#BFBFBF',
  },
  questButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  questButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});