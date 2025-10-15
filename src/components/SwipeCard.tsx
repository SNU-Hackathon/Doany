// Swipe Card component for proof evaluation
// Supports gesture-based swipe and button-based voting

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import {
    Dimensions,
    Image,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface Proof {
  proofId: string;
  goalId: string;
  user: {
    displayName: string;
    tier: string;
    avatarUrl: string;
  };
  description: string;
  media: {
    type: 'photo' | 'video';
    url: string;
    width: number;
    height: number;
  };
  tags: string[];
  createdAt: string;
}

interface SwipeCardProps {
  proof: Proof;
  onVoteYes: () => void;
  onVoteNo: () => void;
  onSkip?: () => void;
}

export default function SwipeCard({
  proof,
  onVoteYes,
  onVoteNo,
  onSkip,
}: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch {
      return dateString;
    }
  };

  const getTierColor = (tier: string) => {
    if (tier.includes('골드')) return '#EAB308';
    if (tier.includes('실버')) return '#9CA3AF';
    if (tier.includes('브론즈')) return '#D97706';
    return '#6B7280';
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.2;
    })
    .onEnd((event) => {
      const shouldSwipeRight = translateX.value > SWIPE_THRESHOLD;
      const shouldSwipeLeft = translateX.value < -SWIPE_THRESHOLD;

      if (shouldSwipeRight) {
        translateX.value = withTiming(SCREEN_WIDTH + 100, { duration: 300 });
        runOnJS(onVoteYes)();
      } else if (shouldSwipeLeft) {
        translateX.value = withTiming(-SCREEN_WIDTH - 100, { duration: 300 });
        runOnJS(onVoteNo)();
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-15, 0, 15]
    );

    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [1, 0.8]
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` as any },
      ] as any,
      opacity,
    };
  });

  const likeOpacityStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1]
    );
    return { opacity };
  });

  const nopeOpacityStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0]
    );
    return { opacity };
  });

  const handleYes = useCallback(() => {
    translateX.value = withTiming(SCREEN_WIDTH + 100, { duration: 300 });
    setTimeout(onVoteYes, 100);
  }, [onVoteYes, translateX]);

  const handleNo = useCallback(() => {
    translateX.value = withTiming(-SCREEN_WIDTH - 100, { duration: 300 });
    setTimeout(onVoteNo, 100);
  }, [onVoteNo, translateX]);

  return (
    <View className="flex-1 items-center justify-center px-4">
      {/* Action Buttons */}
      <View className="absolute top-16 flex-row items-center justify-center" style={{ gap: 12, zIndex: 10 }}>
        <TouchableOpacity
          onPress={handleNo}
          className="bg-white rounded-full p-4"
          activeOpacity={0.75}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
          }}
          accessibilityLabel="Reject"
          accessibilityRole="button"
          accessibilityHint="Swipe left or tap to reject this proof"
        >
          <Ionicons name="close" size={28} color="#EF4444" />
        </TouchableOpacity>

        {onSkip && (
          <TouchableOpacity
            onPress={onSkip}
            className="bg-white rounded-full p-4"
            activeOpacity={0.75}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 6,
            }}
            accessibilityLabel="Skip"
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={24} color="#6B7280" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleYes}
          className="bg-white rounded-full p-4"
          activeOpacity={0.75}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
          }}
          accessibilityLabel="Approve"
          accessibilityRole="button"
          accessibilityHint="Swipe right or tap to approve this proof"
        >
          <Ionicons name="checkmark" size={28} color="#10B981" />
        </TouchableOpacity>
      </View>

      {/* Swipeable Card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          className="bg-white rounded-3xl overflow-hidden w-full"
          style={[
            animatedStyle,
            {
              maxWidth: 380,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 10,
            },
          ]}
        >
          {/* Like/Nope Overlays */}
          <Animated.View
            className="absolute top-8 right-8 z-10 bg-green-500 rounded-2xl px-6 py-3"
            style={likeOpacityStyle}
          >
            <Text className="text-white text-2xl font-bold">승인</Text>
          </Animated.View>

          <Animated.View
            className="absolute top-8 left-8 z-10 bg-red-500 rounded-2xl px-6 py-3"
            style={nopeOpacityStyle}
          >
            <Text className="text-white text-2xl font-bold">거절</Text>
          </Animated.View>

          {/* User Info Header */}
          <View className="p-5 pb-3">
            <View className="flex-row items-center">
              <Image
                source={{ uri: proof.user.avatarUrl }}
                className="w-12 h-12 rounded-full bg-gray-200 mr-3"
                style={{
                  borderWidth: 1.5,
                  borderColor: 'rgba(0, 0, 0, 0.06)',
                }}
              />
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-base font-semibold text-gray-900 mr-2">
                    {proof.user.displayName}
                  </Text>
                  <View
                    className="px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: `${getTierColor(proof.user.tier)}15` }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{ color: getTierColor(proof.user.tier) }}
                    >
                      {proof.user.tier}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-gray-600 mt-0.5">
                  {proof.description}
                </Text>
              </View>
            </View>
          </View>

          {/* Media */}
          <Image
            source={{ uri: proof.media.url }}
            className="w-full bg-gray-100"
            style={{
              aspectRatio: proof.media.width / proof.media.height,
              maxHeight: 480,
            }}
            resizeMode="cover"
          />

          {/* Footer */}
          <View className="p-5">
            {/* Tags */}
            <View className="flex-row flex-wrap mb-3" style={{ gap: 6 }}>
              {proof.tags.map((tag, index) => (
                <Text key={index} className="text-sm font-medium text-blue-600">
                  {tag}
                </Text>
              ))}
            </View>

            {/* Date */}
            <Text className="text-xs text-gray-500">
              {formatDate(proof.createdAt)}
            </Text>

            {/* Comment Button */}
            <TouchableOpacity
              className="mt-3 flex-row items-center justify-center bg-gray-50 rounded-xl py-3"
              activeOpacity={0.75}
              accessibilityLabel="Comment"
              accessibilityRole="button"
            >
              <Ionicons name="chatbubble-outline" size={18} color="#6B7280" />
              <Text className="ml-2 text-sm font-medium text-gray-700">
                댓글 남기기
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
