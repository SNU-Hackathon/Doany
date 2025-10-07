// Swipe screen for verifying other users' quests
// Users can swipe left (fail) or right (success) to verify others' achievements

import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    PanResponder,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';

interface QuestVerification {
  id: string;
  userId: string;
  userName: string;
  goalTitle: string;
  questTitle: string;
  photoUrl?: string;
  location?: string;
  timestamp: Date;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

export default function SwipeScreen() {
  const { user } = useAuth();
  const [quests, setQuests] = useState<QuestVerification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Fetch other users' quests for verification
  const fetchQuests = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // TODO: Query actual quest verifications from Firestore
      // For now, return empty array
      const questsQuery = query(
        collection(db, 'questVerifications'),
        where('userId', '!=', user.uid),
        where('status', '==', 'pending'),
        limit(10)
      );

      const snapshot = await getDocs(questsQuery);
      const fetchedQuests: QuestVerification[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as QuestVerification));

      setQuests(fetchedQuests);
    } catch (error) {
      console.error('[SWIPE:fetch:error]', error);
      setQuests([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    console.log(`[SWIPE:${direction}]`, quests[currentIndex]?.id);
    
    // TODO: Save verification result to Firestore
    
    // Move to next quest
    if (currentIndex < quests.length - 1) {
      setCurrentIndex(prev => prev + 1);
      translateX.value = 0;
      translateY.value = 0;
    } else {
      // Reload quests when all done
      fetchQuests();
      setCurrentIndex(0);
      translateX.value = 0;
      translateY.value = 0;
    }
  }, [currentIndex, quests, fetchQuests, translateX, translateY]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      translateX.value = gestureState.dx;
      translateY.value = gestureState.dy;
    },
    onPanResponderRelease: (_, gestureState) => {
      if (Math.abs(gestureState.dx) > SWIPE_THRESHOLD) {
        const direction = gestureState.dx > 0 ? 'right' : 'left';
        translateX.value = withSpring(gestureState.dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH);
        setTimeout(() => handleSwipe(direction), 200);
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    },
  });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = translateX.value / 20;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` as any },
      ] as any,
    };
  });

  const currentQuest = quests[currentIndex];

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-600">로딩 중...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-14 pb-4">
        <Text className="text-2xl font-bold text-gray-900">스와이프</Text>
      </View>

      {/* Content */}
      {!currentQuest ? (
        // Empty state
        <View className="flex-1 justify-center items-center px-8">
          <View className="bg-gray-50 rounded-3xl p-8 items-center" style={{ 
            width: '90%',
            maxWidth: 400,
            aspectRatio: 0.7,
            borderWidth: 2,
            borderColor: '#E5E7EB',
            borderStyle: 'dashed'
          }}>
            <View className="flex-1 justify-center items-center">
              <Ionicons name="hand-right-outline" size={80} color="#D1D5DB" style={{ marginBottom: 20 }} />
              <Text className="text-xl font-bold text-gray-400 text-center mb-2">
                좌우로 넘겨 인증해주세요!
              </Text>
              <Text className="text-sm text-gray-400 text-center">
                다른 유저가 생성한 퀘스트가 없습니다
              </Text>
            </View>
          </View>

          {/* Instructions */}
          <View className="mt-8 flex-row justify-around w-full px-4">
            <View className="items-center">
              <View className="bg-red-100 rounded-full w-16 h-16 items-center justify-center mb-2">
                <Ionicons name="close" size={32} color="#EF4444" />
              </View>
              <Text className="text-sm text-gray-600 font-medium">#리넥 #불돌</Text>
            </View>
            <View className="items-center">
              <View className="bg-green-100 rounded-full w-16 h-16 items-center justify-center mb-2">
                <Ionicons name="checkmark" size={32} color="#10B981" />
              </View>
              <Text className="text-sm text-gray-600 font-medium">#운동</Text>
            </View>
          </View>
        </View>
      ) : (
        // Quest card
        <View className="flex-1 justify-center items-center">
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              cardStyle,
              {
                width: '85%',
                aspectRatio: 0.7,
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
              }
            ]}
          >
            {/* User Info */}
            <View className="flex-row items-center mb-4">
              <View className="bg-gray-200 rounded-full w-12 h-12 items-center justify-center mr-3">
                <Ionicons name="person" size={24} color="#6B7280" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-gray-900">User ID</Text>
                <Text className="text-sm text-gray-500">Lv.6</Text>
              </View>
            </View>

            {/* Goal Title */}
            <View className="flex-row items-center mb-3">
              <Ionicons name="flag" size={20} color="#3B82F6" />
              <Text className="ml-2 font-bold text-gray-900">{currentQuest.goalTitle}</Text>
            </View>

            {/* Photo */}
            {currentQuest.photoUrl ? (
              <View className="bg-gray-100 rounded-2xl mb-4 overflow-hidden" style={{ height: 300 }}>
                <Image
                  source={{ uri: currentQuest.photoUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View className="bg-gray-50 rounded-2xl mb-4 items-center justify-center border-2 border-dashed border-gray-200" style={{ height: 300 }}>
                <Ionicons name="image-outline" size={48} color="#D1D5DB" />
                <Text className="mt-2 text-gray-400">No photo</Text>
              </View>
            )}

            {/* Details */}
            <View className="space-y-2">
              <View className="flex-row items-center">
                <Ionicons name="location-outline" size={16} color="#6B7280" />
                <Text className="ml-2 text-sm text-gray-600">
                  {currentQuest.location || '위치 정보 없음'}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={16} color="#6B7280" />
                <Text className="ml-2 text-sm text-gray-600">
                  {currentQuest.timestamp.toLocaleDateString('ko-KR')} {currentQuest.timestamp.toLocaleTimeString('ko-KR')}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Action Buttons */}
          <View className="flex-row justify-around w-full px-8 mt-8">
            <TouchableOpacity
              onPress={() => handleSwipe('left')}
              className="bg-red-100 rounded-full w-16 h-16 items-center justify-center"
            >
              <Ionicons name="close" size={32} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSwipe('right')}
              className="bg-green-100 rounded-full w-16 h-16 items-center justify-center"
            >
              <Ionicons name="checkmark" size={32} color="#10B981" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
