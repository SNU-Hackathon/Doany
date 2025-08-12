// Home screen displaying user goals and progress with realtime updates

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CreateGoalModal } from '../components';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { VerificationService } from '../services/verificationService';
import { Goal, RootStackParamList } from '../types';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface GoalWithProgress extends Goal {
  successRate: number;
  recentVerifications: number;
}

// Memoized goal item component for performance
const GoalItem = React.memo(({ 
  item, 
  onPress 
}: { 
  item: GoalWithProgress; 
  onPress: (goal: GoalWithProgress) => void;
}) => {
  const getProgressColor = (rate: number) => {
    if (rate >= 80) return '#10B981'; // green-500
    if (rate >= 60) return '#EAB308'; // yellow-500
    if (rate >= 40) return '#F97316'; // orange-500
    return '#EF4444'; // red-500
  };

  const getVerificationTypeIcon = (type: string) => {
    switch (type) {
      case 'location':
        return 'location';
      case 'time':
        return 'time';
      case 'screentime':
        return 'phone-portrait';
      case 'manual':
        return 'checkmark-circle';
      default:
        return 'help-circle';
    }
  };

  const formatFrequency = (frequency: { count: number; unit: string }) => {
    return `${frequency.count}x ${frequency.unit.replace('per_', '')}`;
  };

  const primaryVerificationMethod = item.verificationMethods?.[0] || item.verificationType || 'manual';

  return (
    <TouchableOpacity
      style={{
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB'
      }}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1F2937' }} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
            Category: {item.category}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: getProgressColor(item.successRate),
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
              {Math.round(item.successRate)}%
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons
            name={getVerificationTypeIcon(primaryVerificationMethod) as any}
            size={16}
            color="#6B7280"
          />
          <Text style={{ fontSize: 14, color: '#6B7280', marginLeft: 8 }}>
            {formatFrequency(item.frequency)}
          </Text>
        </View>
        
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
            {item.recentVerifications} recent
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Refs for cleanup
  const mountedRef = useRef(true);

  // Setup realtime listener for goals
  useEffect(() => {
    if (!user) return;

    console.log('[HomeScreen] Setting up realtime listener for goals');
    
    const goalsQuery = query(
      collection(db, 'users', user.id, 'goals'),
      // Prefer server timestamp if present; client fallback handled after snapshot
      orderBy('createdAtClient', 'desc')
    );

    const unsubscribe = onSnapshot(goalsQuery, async (snapshot) => {
      if (!mountedRef.current) return;

      try {
        console.log('[HomeScreen] Goals snapshot received:', snapshot.docs.length, 'documents');
        
        // Process goals with progress data
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
                successRate: successRate || 0,
                recentVerifications: recentVerifications?.length || 0
              } as GoalWithProgress;
            } catch (error) {
              console.warn(`[HomeScreen] Error loading progress for goal ${goal.id}:`, error);
              return {
                ...goal,
                successRate: 0,
                recentVerifications: 0
              } as GoalWithProgress;
            }
          })
        );

        // Dedupe goals by ID to prevent duplicate key warnings
        const dedupeGoals = (goals: GoalWithProgress[]) => {
          return Array.from(new Map(goals.map(g => [g.id, g])).values());
        };

        // Client-side sort using client timestamp fallback
        const processedGoals = dedupeGoals(goalsWithProgress).sort((a: any, b: any) => {
          const aTs = a.createdAtClient?.toMillis?.() ?? a.createdAt?.getTime?.() ?? 0;
          const bTs = b.createdAtClient?.toMillis?.() ?? b.createdAt?.getTime?.() ?? 0;
          return bTs - aTs;
        });
        console.log('[GOAL:list:ids]', processedGoals.map(d => d.id).slice(0, 10));
        setGoals(processedGoals);
        setLoading(false);
        setRefreshing(false);
        
        console.log(`[HomeScreen] Realtime update: ${processedGoals.length} goals`);

      } catch (error) {
        console.error('[HomeScreen] Error processing goals snapshot:', error);
        if (mountedRef.current) {
          Alert.alert('Error', 'Failed to process goals update. Please try again.');
        }
      }
    }, (error) => {
      console.error('[HomeScreen] Goals listener error:', error);
      if (mountedRef.current) {
        Alert.alert('Error', 'Failed to listen to goals updates. Please try again.');
      }
    });

    // Cleanup function
    return () => {
      console.log('[HomeScreen] Cleaning up goals listener');
      unsubscribe();
    };
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // The realtime listener will handle the actual data update
    // This is just for UI feedback
  }, []);

  const handleGoalPress = useCallback((goal: GoalWithProgress) => {
    console.log('[GOAL:press]', { 
      id: goal.id, 
      title: goal.title,
      userId: goal.userId,
      timestamp: new Date().toISOString()
    });
    
    navigation.navigate('GoalDetail', { goalId: goal.id });
  }, [navigation]);

  const handleCreateGoal = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleGoalCreated = useCallback(() => {
    setShowCreateModal(false);
    // The realtime listener will automatically update the list
  }, []);

  // Memoized key extractor for FlatList performance
  const keyExtractor = useCallback((item: GoalWithProgress) => item.id, []);

  // Memoized render item function
  const renderGoalItem = useCallback(({ item }: { item: GoalWithProgress }) => (
    <GoalItem item={item} onPress={handleGoalPress} />
  ), [handleGoalPress]);

  // Memoized empty component
  const renderEmptyComponent = useMemo(() => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
      <Ionicons name="flag-outline" size={64} color="#D1D5DB" />
      <Text style={{ fontSize: 20, fontWeight: '600', color: '#6B7280', marginTop: 16, textAlign: 'center' }}>
        No Goals Yet
      </Text>
      <Text style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 8, paddingHorizontal: 32 }}>
        Start your journey by creating your first goal!
      </Text>
      <TouchableOpacity
        style={{ backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 24 }}
        onPress={handleCreateGoal}
      >
        <Text style={{ color: 'white', fontWeight: '600' }}>Create Goal</Text>
      </TouchableOpacity>
    </View>
  ), [handleCreateGoal]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 16, color: '#6B7280' }}>Loading your goals...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: 'white', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1F2937' }}>
            My Goals
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
            onPress={handleCreateGoal}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Goals List */}
      <FlatList
        data={goals}
        renderItem={renderGoalItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyComponent}
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