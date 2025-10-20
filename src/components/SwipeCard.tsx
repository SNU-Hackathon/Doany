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
  onUndo?: () => void;
  canUndo?: boolean;
}

export default function SwipeCard({
  proof,
  onVoteYes,
  onVoteNo,
  onUndo,
  canUndo = false,
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
        { rotate: `${rotate}deg` } as any,
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

  const handleNo = useCallback(() => {
    translateX.value = withTiming(-SCREEN_WIDTH - 100, { duration: 300 });
    setTimeout(onVoteNo, 100);
  }, [onVoteNo, translateX]);

  const handleYes = useCallback(() => {
    translateX.value = withTiming(SCREEN_WIDTH + 100, { duration: 300 });
    setTimeout(onVoteYes, 100);
  }, [onVoteYes, translateX]);

  return (
    <View style={{ flex: 1, paddingTop: 16 }}>
      {/* 버튼 바: 카드 바깥, wrapper 기준 절대 배치 */}
      <View
        style={{
          position: 'absolute',
          top: 8,            // 헤더 바로 아래 떠 있게
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          zIndex: 30,
          pointerEvents: 'box-none',
        }}
      >
        {/* X */}
        <TouchableOpacity
          onPress={handleNo}
          style={{
            width: 52, height: 40, borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.95)',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
          }}
          activeOpacity={0.75}
          accessibilityLabel="Reject"
        >
          <Ionicons name="close" size={28} color="#EF4444" />
        </TouchableOpacity>

        {/* Undo */}
        {onUndo && (
          <TouchableOpacity
            onPress={onUndo}
            style={{
              width: 52, height: 40, borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.95)',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
              opacity: canUndo ? 1 : 0.3,
            }}
            activeOpacity={0.75}
            accessibilityLabel="Undo"
            disabled={!canUndo}
          >
            <Ionicons name="arrow-undo" size={24} color="#6B7280" />
          </TouchableOpacity>
        )}

        {/* Check */}
        <TouchableOpacity
          onPress={handleYes}
          style={{
            width: 52, height: 40, borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.95)',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
          }}
          activeOpacity={0.75}
          accessibilityLabel="Approve"
        >
          <Ionicons name="checkmark" size={28} color="#10B981" />
        </TouchableOpacity>
      </View>

      {/* Swipeable Card: 버튼과는 분리해서 제스처 적용 */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            animatedStyle,
            {
              marginHorizontal: 16,
              marginTop: 40,     // 버튼 아래로 살짝 내리기
              marginBottom: 120, // 하단 탭바 간격
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              overflow: 'hidden', // 둥근 모서리 유지
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
            style={[
              likeOpacityStyle,
              {
                position: 'absolute',
                top: 100,
                right: 32,
                zIndex: 10,
                backgroundColor: '#10B981',
                borderRadius: 16,
                paddingHorizontal: 24,
                paddingVertical: 12,
              },
            ]}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700' }}>승인</Text>
          </Animated.View>

          <Animated.View
            style={[
              nopeOpacityStyle,
              {
                position: 'absolute',
                top: 100,
                left: 32,
                zIndex: 10,
                backgroundColor: '#EF4444',
                borderRadius: 16,
                paddingHorizontal: 24,
                paddingVertical: 12,
              },
            ]}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700' }}>거절</Text>
          </Animated.View>

          {/* User Info Header */}
          <View style={{ padding: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Image
                source={{ uri: proof.user.avatarUrl }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#F3F4F6',
                  marginRight: 12,
                  borderWidth: 1.5,
                  borderColor: 'rgba(0, 0, 0, 0.06)',
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                  {proof.user.displayName}
                </Text>
                <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>
                  {proof.description}
                </Text>
              </View>
            </View>

            {/* Gold Button */}
            <TouchableOpacity
              style={{
                backgroundColor: '#FCD34D',
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 16,
                shadowColor: '#F59E0B',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 3,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400E' }}>
                골드
              </Text>
            </TouchableOpacity>
          </View>

          {/* Media Image */}
          <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#F3F4F6' }}>
            <Image
              source={{ uri: proof.media.url }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </View>

          {/* Footer */}
          <View style={{ padding: 20, paddingTop: 16 }}>
            {/* Tags and Date Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 }}>
                {proof.tags.map((tag, index) => (
                  <Text key={index} style={{ fontSize: 13, color: '#6366F1', fontWeight: '600' }}>
                    {`#${tag}${index < proof.tags.length - 1 ? ' ' : ''}`}
                  </Text>
                ))}
              </View>
              <Text style={{ fontSize: 13, color: '#9CA3AF', fontWeight: '500', marginLeft: 12 }}>
                {formatDate(proof.createdAt)}
              </Text>
            </View>

            {/* Comment Button */}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 2,
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-outline" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}