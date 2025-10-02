// 개별 퀘스트 노드 (Duolingo 스타일 원형 아이콘)

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import type { Quest } from '../../types/quest';

interface QuestNodeProps {
  quest: Quest;
  isToday: boolean;
  isSelected: boolean;
  isLocked: boolean;
  isCompleted: boolean;
  onPress: () => void;
  offsetX?: number; // 지그재그 배치용
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const QuestNode = React.memo(
  ({
    quest,
    isToday,
    isSelected,
    isLocked,
    isCompleted,
    onPress,
    offsetX = 0,
  }: QuestNodeProps) => {
    const nodeStyle = useAnimatedStyle(() => {
      const transforms: any[] = [
        { scale: withSpring(isSelected ? 1.14 : 1) }, // 64/56 = 1.14
      ];
      
      if (offsetX !== 0) {
        transforms.push({ translateX: offsetX });
      }
      
      return {
        transform: transforms,
      };
    });

    const getNodeColor = () => {
      if (isLocked) return '#D9D9D9';
      if (isCompleted) return '#2D9CDB';
      if (isToday) return '#27AE60';
      return '#F2F2F2';
    };

    const getIconName = () => {
      if (isLocked) return 'lock-closed';
      if (isCompleted) return 'checkmark-circle';
      return 'star';
    };

    const getIconColor = () => {
      if (isLocked) return '#999';
      if (isCompleted) return '#FFF';
      if (isToday) return '#FFF';
      return '#CCC';
    };

    return (
      <View className="items-center mb-4">
        {/* NEXT 배지 (별 표시) */}
        {isToday && (
          <View className="absolute -top-2 left-1/2 -ml-6 bg-[#FCD34D] px-2 py-0.5 rounded-full z-10">
            <Text className="text-gray-900 text-xs font-bold">NEXT ⭐</Text>
          </View>
        )}

        {/* 노드 */}
        <AnimatedPressable
          onPress={onPress}
          disabled={isLocked}
          style={[
            nodeStyle,
            {
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: getNodeColor(),
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: isSelected ? '#27AE60' : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isSelected ? 0.35 : 0.1,
              shadowRadius: isSelected ? 8 : 2,
              elevation: isSelected ? 8 : 2,
            },
          ]}
        >
          <Ionicons name={getIconName()} size={28} color={getIconColor()} />
        </AnimatedPressable>

        {/* 하단 날짜/제목 (다음 퀘스트만) */}
        {isToday && (
          <Text className="text-xs text-gray-900 font-semibold mt-1 text-center">
            다음 퀘스트
          </Text>
        )}
      </View>
    );
  }
);

QuestNode.displayName = 'QuestNode';

