// Goal Detail Screen V2 - Duolingo Style with Map/Split View

import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Dimensions, Text as RNText, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuestDetailList } from '../components/quests/QuestDetailList';
import { QuestMapView } from '../components/quests/QuestMapView';
import { QuestTopBar, ViewMode } from '../components/quests/QuestTopBar';
import { useAuth } from '../hooks/useAuth';
import { QuestService } from '../services/questService';
import { Goal, Quest, RootStackParamList } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GoalDetailScreenRouteProp = RouteProp<RootStackParamList, 'GoalDetail'>;
type GoalDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'GoalDetail'>;

interface GoalDetailScreenProps {
  route: GoalDetailScreenRouteProp;
  navigation: GoalDetailScreenNavigationProp;
}

export default function GoalDetailScreenV2({ route, navigation }: GoalDetailScreenProps) {
  const { goalId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // State
  const [goal, setGoal] = useState<Goal | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [mode, setMode] = useState<ViewMode>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Animation
  const progress = useSharedValue(0); // 0 = map, 1 = split

  // Load data
  const loadData = useCallback(async () => {
    if (!user || !user.id) return;

    try {
      setLoading(true);
      
      // Load quests
      const questsData = await QuestService.getQuestsForGoal(goalId, user.id);
      setQuests(questsData);

      // Auto-select next quest (미완료 중 가장 가까운 미래)
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      const sortedQuests = [...questsData].sort((a, b) => {
        const dateA = new Date(a.targetDate || a.scheduledDate || '').getTime();
        const dateB = new Date(b.targetDate || b.scheduledDate || '').getTime();
        return dateA - dateB;
      });
      
      const nextQuest = sortedQuests.find(q => {
        const qDate = new Date(q.targetDate || q.scheduledDate || '');
        qDate.setHours(0, 0, 0, 0);
        return qDate.getTime() >= now.getTime() && q.status !== 'completed';
      });

      if (nextQuest) {
        setSelectedId(nextQuest.id);
      }
    } catch (error) {
      console.error('[GoalDetailV2] Load error:', error);
      Alert.alert('오류', '데이터를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  }, [goalId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Mode transition
  const toSplit = useCallback(() => {
    setMode('split');
    progress.value = withTiming(1, { duration: 300 });
  }, [progress]);

  const toMap = useCallback(() => {
    setMode('map');
    progress.value = withTiming(0, { duration: 300 });
  }, [progress]);

  const handleModeChange = useCallback(
    (newMode: ViewMode) => {
      if (newMode === 'split') {
        toSplit();
      } else {
        toMap();
      }
    },
    [toSplit, toMap]
  );

  // Gesture handler
  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      const isSwipeRight = event.translationX > 50;
      const isSwipeLeft = event.translationX < -50;

      if (mode === 'map' && isSwipeLeft) {
        toSplit();
      } else if (mode === 'split' && isSwipeRight) {
        toMap();
      }
    });

  // Quest actions
  const handleComplete = useCallback(
    async (id: string) => {
      if (!user || !user.id) return;
      
      try {
        await QuestService.updateQuestStatus(id, 'completed', user.id);
        setQuests((prev) =>
          prev.map((q) => (q.id === id ? { ...q, status: 'completed' } : q))
        );
      } catch (error) {
        console.error('[GoalDetailV2] Complete error:', error);
        Alert.alert('오류', '퀘스트를 완료할 수 없습니다');
      }
    },
    [user]
  );

  const handleSkip = useCallback(
    async (id: string) => {
      if (!user || !user.id) return;
      
      try {
        await QuestService.updateQuestStatus(id, 'skipped', user.id);
        setQuests((prev) =>
          prev.map((q) => (q.id === id ? { ...q, status: 'skipped' } : q))
        );
      } catch (error) {
        console.error('[GoalDetailV2] Skip error:', error);
        Alert.alert('오류', '퀘스트를 건너뛸 수 없습니다');
      }
    },
    [user]
  );

  const handleUndo = useCallback(
    async (id: string) => {
      if (!user || !user.id) return;
      
      try {
        await QuestService.updateQuestStatus(id, 'pending', user.id);
        setQuests((prev) =>
          prev.map((q) => (q.id === id ? { ...q, status: 'pending' } : q))
        );
      } catch (error) {
        console.error('[GoalDetailV2] Undo error:', error);
        Alert.alert('오류', '되돌릴 수 없습니다');
      }
    },
    [user]
  );

  // Animated styles (아이콘 20%, 카드 80%)
  const mapContainerStyle = useAnimatedStyle(() => ({
    width:
      mode === 'map'
        ? '100%'
        : progress.value * 0.2 * SCREEN_WIDTH + (1 - progress.value) * SCREEN_WIDTH, // ✅ 36% → 20%
  }));

  const detailContainerStyle = useAnimatedStyle(() => ({
    width: '80%', // ✅ 64% → 80%
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    opacity: progress.value,
    transform: [
      {
        translateX: (1 - progress.value) * SCREEN_WIDTH,
      },
    ],
  }));

  // Header (Modal 컨텍스트에서는 setOptions가 없을 수 있음)
  useLayoutEffect(() => {
    if (navigation.setOptions) {
      navigation.setOptions({
        headerTitle: goal?.title || '퀘스트',
        headerLeft: () => (
          <Ionicons
            name="arrow-back"
            size={24}
            color="#000"
            style={{ marginLeft: 16 }}
            onPress={() => navigation.goBack()}
          />
        ),
      });
    }
  }, [navigation, goal]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Ionicons name="hourglass-outline" size={48} color="#6B7280" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Custom Header (Modal에서만 표시) */}
      {!navigation.setOptions && (
        <View 
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
          }}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#000"
            onPress={() => navigation.goBack()}
          />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <RNText style={{ fontSize: 18, fontWeight: '600' }}>
              {goal?.title || '퀘스트'}
            </RNText>
          </View>
        </View>
      )}
      
      {/* Top Bar */}
      <QuestTopBar mode={mode} onModeChange={handleModeChange} />

      {/* Main Content with Gesture */}
      <GestureDetector gesture={panGesture}>
        <View className="flex-1 relative">
          {/* Map View */}
          <Animated.View style={[{ flex: 1 }, mapContainerStyle]}>
            <QuestMapView
              data={quests}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRequestDetail={toSplit}
              isCompactMode={mode === 'split'}
            />
          </Animated.View>

          {/* Detail Panel (Split mode only) */}
          {mode === 'split' && (
            <Animated.View style={[detailContainerStyle, { backgroundColor: '#FAFAFA' }]}>
              <QuestDetailList
                data={quests}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onComplete={handleComplete}
                onSkip={handleSkip}
                onUndo={handleUndo}
              />
            </Animated.View>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

