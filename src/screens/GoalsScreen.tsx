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
import CreateGoalModal from '../components/CreateGoalModal';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { GoalService } from '../services/goalService';
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
    name?: string;
    role?: string;
    required?: boolean;
    id?: string;
    inviteEmail?: string;
    status?: "pending" | "accepted" | "declined";
  };
}

// Goal Card Component matching the design
const GoalCard = React.memo(({ 
  item, 
  onPress,
  onDelete 
}: { 
  item: GoalWithProgress; 
  onPress: (goal: GoalWithProgress) => void;
  onDelete: (goal: GoalWithProgress) => void;
}) => {
  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'schedule':
        return 'bg-blue-500';
      case 'frequency':
        return 'bg-green-500';
      case 'partner':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeFromGoal = (goal: GoalWithProgress) => {
    // First check if type is explicitly set
    const goalWithType = goal as any;
    if (goalWithType.type) {
      console.log('[GoalsScreen] Goal has explicit type:', goalWithType.type);
      return goalWithType.type.charAt(0).toUpperCase() + goalWithType.type.slice(1); // Capitalize first letter
    }
    
    // Fallback to inference - use any to access extended properties
    const goalData = goal as any;
    if (goalData.partner?.required || goalData.partner?.id || goalData.partner?.inviteEmail) return 'Partner';
    // Check for schedule indicators
    if (goal.schedule || goal.weeklySchedule || goal.weeklyWeekdays || goalData.calendarEvents) return 'Schedule';
    // Default to frequency for other cases
    return 'Frequency';
  };

  // Helper functions to extract real data from goal
  const getDateRangeInfo = (goal: GoalWithProgress) => {
    let startDate, endDate;
    
    // Try multiple ways to get dates with better error handling
    if (goal.duration?.startDate) {
      startDate = goal.duration.startDate;
    } else if (goal.startDate) {
      startDate = goal.startDate instanceof Date ? goal.startDate.toISOString().split('T')[0] : goal.startDate;
    }
    
    if (goal.duration?.endDate) {
      endDate = goal.duration.endDate;
    } else if (goal.endDate) {
      endDate = goal.endDate instanceof Date ? goal.endDate.toISOString().split('T')[0] : goal.endDate;
    }
    
    console.log('[GoalsScreen] Date parsing for goal', goal.id, ':', { startDate, endDate });
    
    // Fallback to current date if no dates available
    if (!startDate && !endDate) {
      const today = new Date();
      const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
      return `${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${twoWeeksLater.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    
    if (startDate && endDate) {
      try {
        // Handle different date formats
        let start, end;
        
        if (typeof startDate === 'string') {
          start = new Date(startDate);
        } else if (startDate && typeof startDate === 'object' && startDate.seconds) {
          // Firebase Timestamp format
          start = new Date(startDate.seconds * 1000);
        } else {
          start = new Date(startDate);
        }
        
        if (typeof endDate === 'string') {
          end = new Date(endDate);
        } else if (endDate && typeof endDate === 'object' && endDate.seconds) {
          // Firebase Timestamp format
          end = new Date(endDate.seconds * 1000);
        } else {
          end = new Date(endDate);
        }
        
        // Check if dates are valid
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          console.warn('[GoalsScreen] Invalid dates after parsing:', { start, end });
          return 'Date parsing error';
        }
        
        const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${startStr} - ${endStr}`;
      } catch (error) {
        console.warn('[GoalsScreen] Date parsing error:', error);
        return 'Date error';
      }
    }
    return 'No end date';
  };

  const getCurrentWeekInfo = (goal: GoalWithProgress) => {
    let startDate, endDate;
    
    // Try multiple ways to get dates
    if (goal.duration?.startDate) {
      startDate = goal.duration.startDate;
    } else if (goal.startDate) {
      startDate = goal.startDate instanceof Date ? goal.startDate.toISOString().split('T')[0] : goal.startDate;
    }
    
    if (goal.duration?.endDate) {
      endDate = goal.duration.endDate;
    } else if (goal.endDate) {
      endDate = goal.endDate instanceof Date ? goal.endDate.toISOString().split('T')[0] : goal.endDate;
    }
    
    if (!startDate) return 'Week 1 of 1';
    
    try {
      const start = new Date(startDate);
      const now = new Date();
      
      // Check if start date is valid
      if (isNaN(start.getTime())) {
        return 'Week 1 of 1';
      }
      
      const diffTime = now.getTime() - start.getTime();
      const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;
      
      // Calculate total weeks
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          const totalTime = end.getTime() - start.getTime();
          const totalWeeks = Math.ceil(totalTime / (1000 * 60 * 60 * 24 * 7));
          return `Week ${Math.max(1, diffWeeks)} of ${Math.max(1, totalWeeks)}`;
        }
      }
      
      return `Week ${Math.max(1, diffWeeks)}`;
    } catch (error) {
      console.warn('Week calculation error:', error);
      return 'Week 1 of 1';
    }
  };

  const getVerificationMethodsText = (goal: GoalWithProgress) => {
    const methods = goal.verificationMethods || [];
    if (methods.length === 0) return 'No verification';
    
    // Format verification methods
    const formattedMethods = methods.map(method => {
      switch (method) {
        case 'manual': return 'Manual';
        case 'location': return 'Location';
        case 'photo': return 'Photo';
        case 'time': return 'Time';
        case 'screentime': return 'ScreenTime';
        default: return method;
      }
    });
    
    return formattedMethods.join(' + ');
  };

  const getNextSessionInfo = (goal: GoalWithProgress, type: string) => {
    if (type === 'Schedule') {
      // For schedule goals, get next scheduled time
      const now = new Date();
      const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      if (goal.weeklyWeekdays && goal.weeklyWeekdays.length > 0) {
        const nextWeekday = goal.weeklyWeekdays.find(day => day > today) || goal.weeklyWeekdays[0];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // Get time from weekly schedule if available
        const dayKey = nextWeekday.toString();
        const times = goal.weeklySchedule?.[dayKey];
        const timeStr = times && times.length > 0 ? times[0] : '9:00 AM';
        
        return `Next: ${dayNames[nextWeekday]} ${timeStr}`;
      }
      return 'Next: Not scheduled';
    }
    
    if (type === 'Frequency') {
      const targetCount = goal.frequency?.count || 3;
      const currentCount = goal.completedSessions || 0;
      return `This Week: ${currentCount}/${targetCount} completed`;
    }
    
    if (type === 'Partner' && goal.partner) {
      const partnerName = goal.partner.name || 'Partner';
      const partnerRole = goal.partner.role || 'Collaborator';
      return `Partner: ${partnerName} (${partnerRole}) | Next: Sun, 2:00 PM`;
    }
    
    return 'No schedule info available';
  };

  const type = getTypeFromGoal(item);

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      className="bg-white rounded-xl p-4 mb-3 shadow-sm"
      style={{ 
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1
      }}
      activeOpacity={0.7}
    >
      {/* Type Badge */}
      <View className="flex-row items-center justify-between mb-3">
        <View className={`${getTypeColor(type)} rounded-full px-3 py-1`}>
          <Text className="text-white text-xs font-medium">{type}</Text>
        </View>
        <TouchableOpacity onPress={() => onDelete(item)}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Goal Title */}
      <Text className="text-lg font-semibold text-gray-900 mb-2" numberOfLines={2}>
        {item.title || 'Untitled Goal'}
      </Text>

      {/* Goal Details */}
      <Text className="text-sm text-gray-600 mb-3">
        {getNextSessionInfo(item, type) || 'No schedule info'}
      </Text>

      {/* Progress Bar */}
      <View className="mb-3">
        <View className="bg-gray-200 rounded-full h-2">
          <View 
            className="bg-yellow-400 h-2 rounded-full"
            style={{ width: `${item.successRate || 0}%` }}
          />
        </View>
      </View>

      {/* Bottom Info */}
      <View className="space-y-1">
        {type === 'Schedule' && (
          <>
            <Text className="text-xs text-gray-600">
              {item.completedSessions || 0}/{item.totalSessions || 0} sessions completed
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-600">
                📅 {getDateRangeInfo(item)}
              </Text>
              <Text className="text-xs text-gray-600">
                🕐 {getVerificationMethodsText(item)}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-600">
                📊 {getCurrentWeekInfo(item)}
              </Text>
              <Text className="text-xs text-gray-600">
                🏆 Target: {Math.round(item.successRate || 80)}%
              </Text>
            </View>
          </>
        )}
        
        {type === 'Frequency' && (
          <>
            <Text className="text-xs text-gray-600">
              🔥 {item.recentVerifications || 0}-week streak
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-600">
                📅 {getDateRangeInfo(item)}
              </Text>
              <Text className="text-xs text-gray-600">
                🕐 {getVerificationMethodsText(item)}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-600">
                📊 {getCurrentWeekInfo(item)}
              </Text>
              <Text className="text-xs text-gray-600">
                🏆 Target: {Math.round(item.successRate || 80)}%
              </Text>
            </View>
          </>
        )}

        {type === 'Partner' && (
          <>
            <Text className="text-xs text-gray-600">
              {item.completedSessions || 0}/{item.totalSessions || 0} milestones completed
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-600">
                📅 {getDateRangeInfo(item)}
              </Text>
              <Text className="text-xs text-gray-600">
                👥 Partner Verified
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-600">
                📊 {getCurrentWeekInfo(item)}
              </Text>
              <Text className="text-xs text-gray-600">
                🏆 Target: {Math.round(item.successRate || 80)}%
              </Text>
            </View>
            {item.requiredDocs && item.requiredDocs.length > 0 && (
              <Text className="text-xs text-gray-600">
                📄 Required: {item.requiredDocs.join(', ')}
              </Text>
            )}
            {item.optionalDocs && item.optionalDocs.length > 0 && (
              <Text className="text-xs text-gray-600">
                ⭐ Optional: {item.optionalDocs.join(', ')}
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<GoalWithProgress | null>(null);
  const [deletingGoal, setDeletingGoal] = useState(false);
  
  const mountedRef = useRef(true);

  const categories = ['All', 'Health & Fitness', 'Study & Growth'];
  const types = ['All', 'Schedule', 'Frequency', 'Partner'];

  // Setup realtime listener for goals
  useEffect(() => {
    if (!user) return;

    console.log('[GoalsScreen] Setting up realtime listener for goals');
    
    console.log('[GoalsScreen] Setting up goals listener for user:', user.id);
    console.log('[GoalsScreen] Goals collection path:', `users/${user.id}/goals`);
    
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
            console.log('[GoalsScreen] Raw goal data for', doc.id, ':', {
              title: goal.title,
              type: (goal as any).type,
              successRate: (goal as any).successRate,
              verificationMethods: goal.verificationMethods,
              duration: goal.duration,
              weeklyWeekdays: goal.weeklyWeekdays,
              weeklySchedule: goal.weeklySchedule
            });
            console.log('[GoalsScreen] FULL raw data:', goal);
            try {
              const [successRate, recentVerifications] = await Promise.all([
                VerificationService.calculateGoalSuccessRate(goal.id),
                VerificationService.getRecentGoalVerifications(goal.id, 7)
              ]);

              // Calculate basic progress metrics
              const startDate = goal.duration?.startDate || goal.startDate;
              const endDate = goal.duration?.endDate || goal.endDate;
              let totalSessions = 0;
              let completedSessions = 0;

              if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                
                if (goal.weeklyWeekdays && goal.weeklyWeekdays.length > 0) {
                  // Schedule type: count sessions based on weekdays
                  const weeksCount = Math.ceil(totalDays / 7);
                  totalSessions = weeksCount * goal.weeklyWeekdays.length;
                } else if (goal.frequency) {
                  // Frequency type: count based on frequency
                  const weeksCount = Math.ceil(totalDays / 7);
                  totalSessions = weeksCount * (goal.frequency.count || 1);
                }
                
                // Mock completed sessions (in real app, this would come from verification data)
                completedSessions = Math.floor(totalSessions * (successRate || 0) / 100);
              }

              // Generate a realistic success rate for new goals (between 0-30% initially)
              const mockSuccessRate = successRate || Math.floor(Math.random() * 31);
              
              const processedGoal = {
                ...goal,
                successRate: goal.successRate || mockSuccessRate, // Use actual successRate first, fallback to mock
                recentVerifications: recentVerifications?.length || Math.floor(Math.random() * 3),
                completedSessions,
                totalSessions,
                // Keep partner data if it exists
                partner: (goal as any).partner || undefined
              } as GoalWithProgress;
              
              console.log('[GoalsScreen] Processed goal:', {
                id: goal.id,
                title: goal.title,
                type: (goal as any).type,
                duration: goal.duration,
                weeklyWeekdays: goal.weeklyWeekdays,
                verificationMethods: goal.verificationMethods,
                successRate: processedGoal.successRate,
                originalSuccessRate: (goal as any).successRate,
                mockSuccessRate: mockSuccessRate
              });
              
              return processedGoal;
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

  const handleDeleteGoal = useCallback((goal: GoalWithProgress) => {
    console.log('[GoalsScreen] handleDeleteGoal called with goal:', {
      id: goal.id,
      title: goal.title,
      userId: goal.userId
    });
    setGoalToDelete(goal);
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteGoal = useCallback(async () => {
    if (!goalToDelete || !user) {
      console.error('[GoalsScreen] confirmDeleteGoal: Missing required data', { goalToDelete: !!goalToDelete, user: !!user });
      return;
    }
    
    console.log('[GoalsScreen] Starting goal deletion:', {
      goalId: goalToDelete.id,
      userId: user.id,
      goalTitle: goalToDelete.title
    });
    
    try {
      setDeletingGoal(true);
      
      // Delete from the user's goals subcollection
      console.log('[GoalsScreen] Calling GoalService.deleteGoal...');
      await GoalService.deleteGoal(goalToDelete.id, user.id);
      console.log('[GoalsScreen] GoalService.deleteGoal completed successfully');
      
      // Close modal
      setShowDeleteModal(false);
      setGoalToDelete(null);
      
      console.log(`[GoalsScreen] Goal ${goalToDelete.id} deleted successfully`);
      Alert.alert('Success', 'Goal deleted successfully');
    } catch (error) {
      console.error('[GoalsScreen] Error deleting goal:', error);
      console.error('[GoalsScreen] Error details:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      });
      Alert.alert('Error', `Failed to delete goal: ${error?.message || 'Unknown error'}`);
    } finally {
      setDeletingGoal(false);
    }
  }, [goalToDelete, user]);

  const cancelDeleteGoal = useCallback(() => {
    setShowDeleteModal(false);
    setGoalToDelete(null);
  }, []);

  const keyExtractor = useCallback((item: GoalWithProgress) => item.id, []);

  const renderGoalItem = useCallback(({ item }: { item: GoalWithProgress }) => (
    <GoalCard item={item} onPress={handleGoalPress} onDelete={handleDeleteGoal} />
  ), [handleGoalPress, handleDeleteGoal]);

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
      {/* Navy Header */}
      <View className="bg-navy px-4 pt-12 pb-4">
        {/* My Goals Title and Notification */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-xl font-bold">My Goals</Text>
          <TouchableOpacity>
            <Ionicons name="notifications-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Search Bar and New Button */}
        <View className="flex-row items-center justify-between">
          <View className="flex-1 bg-white rounded-lg flex-row items-center px-3 py-2 mr-3">
            <Ionicons name="search" size={20} color="#6B7280" />
            <Text className="flex-1 ml-2 text-gray-500">search your goal</Text>
            <TouchableOpacity>
              <Ionicons name="options" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={handleCreateGoal}
            className="bg-sunny rounded-lg px-4 py-2"
          >
            <Text className="text-gray-900 font-semibold">+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category and Type Chips */}
      <View className="bg-white px-4 pt-4 pb-4">
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
      <View className="px-4 pt-3 pb-1">
        <Text className="text-base font-medium text-gray-700">Found {goals.length} Goals</Text>
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

      {/* Delete Goal Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={cancelDeleteGoal}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-4">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <View className="items-center mb-4">
              <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="trash-outline" size={32} color="#DC2626" />
              </View>
              <Text className="text-xl font-bold text-gray-900 mb-2">Delete Goal</Text>
              <Text className="text-gray-600 text-center">
                Are you sure you want to delete "{goalToDelete?.title || 'this goal'}"? This action cannot be undone.
              </Text>
            </View>
            
            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={cancelDeleteGoal}
                disabled={deletingGoal}
                className="flex-1 bg-gray-200 rounded-lg py-3"
              >
                <Text className="text-gray-700 font-semibold text-center">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={confirmDeleteGoal}
                disabled={deletingGoal}
                className="flex-1 bg-red-600 rounded-lg py-3"
              >
                {deletingGoal ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-semibold text-center">Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
