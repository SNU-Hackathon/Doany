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

// Liquid Glass Goal Card Component
const GoalCard = React.memo(({ 
  item, 
  onPress 
}: { 
  item: GoalListItem; 
  onPress: (goal: GoalListItem) => void;
}) => {
  const getCategoryColor = (category?: GoalCategory) => {
    switch (category) {
      case 'health fitness': return '#10B981'; // Green
      case 'study': return '#3B82F6'; // Blue
      case 'sleep': return '#8B5CF6'; // Purple
      default: return '#6B7280'; // Gray
    }
  };

  const getProgressPercentage = () => {
    if (item.progressCurrent && item.progressTotal) {
      return (item.progressCurrent / item.progressTotal) * 100;
    }
    return 0;
  };

  const getProgressText = () => {
    if (item.progressCurrent && item.progressTotal) {
      return `${item.progressCurrent}/${item.progressTotal} 완료 ✓`;
    }
    return '시작 전';
  };

  const formatDateRange = () => {
    if (item.startAt && item.endAt) {
      try {
        const start = new Date(Number(item.startAt));
        const end = new Date(Number(item.endAt));
        
        // 유효한 날짜인지 확인
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return '날짜 미정';
        }
        
        return `${start.getMonth() + 1}월 ${start.getDate()}일-${end.getMonth() + 1}월 ${end.getDate()}일`;
      } catch (error) {
        console.error('Date formatting error:', error);
        return '날짜 미정';
      }
    }
    return '날짜 미정';
  };

  return (
    <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.8}>
      <View style={styles.goalCard}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Ionicons name="disc-outline" size={24} color="#6B7280" />
          </View>
          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <Text style={styles.goalTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {item.isEditable && (
                <TouchableOpacity style={styles.editButton}>
                  <Ionicons name="pencil" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.categoryText, { color: getCategoryColor(item.category) }]}>
              {item.category || '기타'}
            </Text>
            <Text style={styles.tagsText}>
              {item.tag ? item.tag.split('&').map(tag => `#${tag.trim()}`).join(' ') : ''}
            </Text>
          </View>
        </View>

        {/* Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${getProgressPercentage()}%`,
                    backgroundColor: getCategoryColor(item.category)
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>{getProgressText()}</Text>
          </View>
          
          <View style={styles.statusRow}>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.statusText}>진행중</Text>
            </View>
            <Text style={styles.dateText}>{formatDateRange()}</Text>
          </View>
        </View>

        {/* Quest Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity 
            style={[styles.questButton, { backgroundColor: getCategoryColor(item.category) }]}
            onPress={() => onPress(item)}
          >
            <Text style={styles.questButtonText}>퀘스트 {'>'}</Text>
          </TouchableOpacity>
        </View>
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
    setShowCreateModal(true);
  }, []);

  const handleCreateGoalClose = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const handleGoalCreated = useCallback(() => {
    setShowCreateModal(false);
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

      <CreateGoalModal
        visible={showCreateModal}
        onClose={handleCreateGoalClose}
        onGoalCreated={handleGoalCreated}
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
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  goalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    lineHeight: 24,
  },
  editButton: {
    padding: 4,
    marginLeft: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  tagsText: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 16,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actionSection: {
    alignItems: 'flex-end',
  },
  questButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  questButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});