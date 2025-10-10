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
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { GoalDetailScreenV2 } from '.';
import { GoalCategory, GoalListItem } from '../api/types';
import { LoadingState } from '../components';
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
      case '운동 & 건강': return '#10B981'; // Green
      case '공부 & 성장': return '#3B82F6'; // Blue
      case '수면': return '#8B5CF6'; // Purple
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
              {item.tags?.map(tag => `#${tag}`).join(' ') || ''}
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

  // API hooks
  const { 
    data: goalsData, 
    isLoading: loading, 
    error, 
    refetch 
  } = useMyGoals({ 
    page: 1, 
    pageSize: 100 
  });

  // Extract user ID as primitive to avoid infinite loop
  const userId = user?.id || '';

  // Transform and filter goals
  const filteredGoals: GoalListItem[] = React.useMemo(() => {
    if (!goalsData?.items) return [];

    let filtered = goalsData.items;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(goal => 
        goal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        goal.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        goal.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
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

  // Category options
  const categories: (GoalCategory | 'All')[] = ['All', '운동 & 건강', '공부 & 성장', '수면'];

  // Render item
  const renderItem = useCallback(({ item }: { item: GoalListItem }) => (
    <GoalCard item={item} onPress={handleGoalPress} />
  ), [handleGoalPress]);

  // Key extractor
  const keyExtractor = useCallback((item: GoalListItem) => item.goalId, []);

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
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>나의 목표</Text>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={22} color="#1F2937" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="search your goal !"
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity style={styles.filterButton}>
              <Ionicons name="options-outline" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleCreateGoal}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

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
            data={categories}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  selectedCategory === item && styles.selectedCategoryChip
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
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 5,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  filterButton: {
    padding: 4,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 20,
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
  },
  categoriesList: {
    paddingRight: 20,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
  },
  selectedCategoryChip: {
    backgroundColor: '#E5E7EB',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  selectedCategoryChipText: {
    color: '#1F2937',
    fontWeight: '600',
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