import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import CreateGoalModal from '../components/CreateGoalModal';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { VerificationService } from '../services/verificationService';
import { Goal, RootStackParamList } from '../types';

type GoalsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface GoalWithProgress extends Goal {
  successRate: number;
  recentVerifications: number;
  nextSession?: string;
  completedSessions?: number;
  totalSessions?: number;
  weekInfo?: string;
  timeLocation?: string;
  successCriteria?: string;
  monthInfo?: string;
  requiredDocs?: string[];
  optionalDocs?: string[];
  partner?: {
    name: string;
    role: string;
  };
}

// Goal Card Component matching the design
const GoalCard = React.memo(({ 
  item, 
  onPress 
}: { 
  item: GoalWithProgress; 
  onPress: (goal: GoalWithProgress) => void;
}) => {
  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'schedule':
        return 'bg-blue-600';
      case 'frequency':
        return 'bg-green-600';
      case 'partner':
        return 'bg-purple-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getTypeFromGoal = (goal: GoalWithProgress) => {
    if (goal.schedule || goal.weeklySchedule) return 'Schedule';
    if (goal.frequency) return 'Frequency';
    if (goal.partner) return 'Partner';
    return 'Schedule'; // default
  };

  const type = getTypeFromGoal(item);

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      className="bg-white rounded-2xl p-4 mb-3 border border-gray-200"
      activeOpacity={0.7}
    >
      {/* Type Badge */}
      <View className="flex-row items-center justify-between mb-3">
        <View className={`${getTypeColor(type)} rounded-full px-3 py-1`}>
          <Text className="text-white text-xs font-medium">{type}</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Goal Title */}
      <Text className="text-lg font-semibold text-gray-900 mb-2" numberOfLines={2}>
        {item.title}
      </Text>

      {/* Goal Details */}
      {type === 'Schedule' && (
        <Text className="text-sm text-gray-600 mb-3">
          Next: {item.nextSession || 'Wed 7:00 AM'}
        </Text>
      )}
      {type === 'Frequency' && (
        <Text className="text-sm text-gray-600 mb-3">
          This Week: {item.completedSessions || 2}/{item.totalSessions || 3} completed
        </Text>
      )}
      {type === 'Partner' && item.partner && (
        <Text className="text-sm text-gray-600 mb-3">
          Partner: {item.partner.name} ({item.partner.role}) | Next: Sun, 2:00 PM
        </Text>
      )}

      {/* Progress Bar */}
      <View className="mb-3">
        <View className="bg-gray-200 rounded-full h-2">
          <View 
            className="bg-sunny h-2 rounded-full"
            style={{ width: `${item.successRate || 0}%` }}
          />
        </View>
      </View>

      {/* Bottom Info */}
      <View className="space-y-1">
        {type === 'Schedule' && (
          <>
            <Text className="text-xs text-gray-600">
              {item.completedSessions || 5}/{item.totalSessions || 12} sessions completed
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-600">
                📅 {item.weekInfo || 'Sep 1 - Sep 28'}
              </Text>
              <Text className="text-xs text-gray-600">
                🕐 {item.timeLocation || 'Time + Location'}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-600">
                📊 {item.weekInfo || 'Week 2 of 4'}
              </Text>
              <Text className="text-xs text-gray-600">
                🏆 {item.successCriteria || 'Success Criteria: 85%'}
              </Text>
            </View>
          </>
        )}
        
        {type === 'Frequency' && (
          <>
            <Text className="text-xs text-gray-600">
              🔥 {item.recentVerifications || 3}-week streak
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-600">
                📅 {item.monthInfo || 'Oct 25 - Sep 21'}
              </Text>
              <Text className="text-xs text-gray-600">
                🕐 {item.timeLocation || 'manual + Location'}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-600">
                📊 {item.weekInfo || 'Week 3 of 4'}
              </Text>
              <Text className="text-xs text-gray-600">
                🏆 {item.successCriteria || 'Success Criteria: 100%'}
              </Text>
            </View>
          </>
        )}

        {type === 'Partner' && (
          <>
            <Text className="text-xs text-gray-600">
              {item.completedSessions || 2}/{item.totalSessions || 8} milestones completed
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-600">
                📅 {item.monthInfo || 'Sep 2025 - Aug 202'}
              </Text>
              <Text className="text-xs text-gray-600">
                👥 Partner Verified
              </Text>
            </View>
            <Text className="text-xs text-gray-600">
              📊 {item.weekInfo || 'Month 2 of 12'}
            </Text>
            {item.requiredDocs && (
              <Text className="text-xs text-gray-600">
                📄 Required: {item.requiredDocs.join(', ') || 'Personal Statement, TOEFL, Recs'}
              </Text>
            )}
            {item.optionalDocs && (
              <Text className="text-xs text-gray-600">
                ⭐ Optional: {item.optionalDocs.join(', ') || 'Scholarship Essay'}
              </Text>
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default function GoalsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<GoalsScreenNavigationProp>();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  
  const mountedRef = useRef(true);

  const categories = ['All', 'Health & Fitness', 'Study & Growth'];
  const types = ['All', 'Schedule', 'Frequency', 'Partner'];

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
              const [successRate, recentVerifications] = await Promise.all([
                VerificationService.calculateGoalSuccessRate(goal.id),
                VerificationService.getRecentGoalVerifications(goal.id, 7)
              ]);

              return {
                ...goal,
                successRate: successRate || Math.floor(Math.random() * 100), // Mock data
                recentVerifications: recentVerifications?.length || Math.floor(Math.random() * 5),
                // Add mock data for display
                nextSession: 'Wed 7:00 AM',
                completedSessions: Math.floor(Math.random() * 10) + 1,
                totalSessions: Math.floor(Math.random() * 5) + 10,
                weekInfo: 'Week 2 of 4',
                timeLocation: 'Time + Location',
                successCriteria: 'Success Criteria: 85%',
                monthInfo: 'Sep 2025 - Aug 202',
                requiredDocs: ['Personal Statement', 'TOEFL', 'Recs'],
                optionalDocs: ['Scholarship Essay'],
                partner: {
                  name: 'Emily',
                  role: 'Study Abroad Advisor'
                }
              } as GoalWithProgress;
            } catch (error) {
              console.warn(`[GoalsScreen] Error loading progress for goal ${goal.id}:`, error);
              return {
                ...goal,
                successRate: 0,
                recentVerifications: 0
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

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleGoalPress = useCallback((goal: GoalWithProgress) => {
    console.log('[GOAL:press]', { id: goal.id, title: goal.title });
    navigation.navigate('GoalDetail', { goalId: goal.id });
  }, [navigation]);

  const handleCreateGoal = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleGoalCreated = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  const keyExtractor = useCallback((item: GoalWithProgress) => item.id, []);

  const renderGoalItem = useCallback(({ item }: { item: GoalWithProgress }) => (
    <GoalCard item={item} onPress={handleGoalPress} />
  ), [handleGoalPress]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text className="mt-4 text-gray-600">Loading your goals...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-12 pb-4">
        <View className="flex-row items-center justify-between mb-4">
          {/* Search Bar */}
          <View className="flex-1 bg-gray-100 rounded-lg flex-row items-center px-3 py-2 mr-3">
            <Ionicons name="search" size={20} color="#6B7280" />
            <Text className="flex-1 ml-2 text-gray-500">search your goal</Text>
            <TouchableOpacity>
              <Ionicons name="options" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity>
            <Ionicons name="notifications-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* My Goals Title and New Button */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-gray-900">My Goals</Text>
          <TouchableOpacity
            onPress={handleCreateGoal}
            className="bg-sunny rounded-lg px-4 py-2"
          >
            <Text className="text-gray-900 font-semibold">+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Category Chips */}
        <View className="mb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                className={`mr-3 px-4 py-2 rounded-full ${
                  selectedCategory === category ? 'bg-sunny' : 'bg-gray-200'
                }`}
                onPress={() => setSelectedCategory(category)}
              >
                <Text className={`font-medium ${
                  selectedCategory === category ? 'text-gray-900' : 'text-gray-600'
                }`}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Type Chips */}
        <View className="mb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {types.map((type) => (
              <TouchableOpacity
                key={type}
                className={`mr-3 px-4 py-2 rounded-full ${
                  selectedType === type ? 'bg-sunny' : 'bg-gray-200'
                }`}
                onPress={() => setSelectedType(type)}
              >
                <Text className={`font-medium ${
                  selectedType === type ? 'text-gray-900' : 'text-gray-600'
                }`}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Goals Count */}
      <View className="px-4 py-2">
        <Text className="text-lg font-semibold text-gray-900">Found {goals.length} Goals</Text>
      </View>

      {/* Goals List */}
      <FlatList
        data={goals}
        renderItem={renderGoalItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-12">
            <Ionicons name="flag-outline" size={64} color="#D1D5DB" />
            <Text className="text-xl font-semibold text-gray-500 mt-4 text-center">
              No Goals Yet
            </Text>
            <Text className="text-gray-400 text-center mt-2 px-8">
              Start your journey by creating your first goal!
            </Text>
            <TouchableOpacity
              className="bg-navy px-6 py-3 rounded-lg mt-6"
              onPress={handleCreateGoal}
            >
              <Text className="text-white font-semibold">Create Goal</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Create Goal Modal */}
      <CreateGoalModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onGoalCreated={handleGoalCreated}
      />
    </View>
  );
}
