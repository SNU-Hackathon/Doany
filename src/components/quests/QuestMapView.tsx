// Duolingo 스타일 퀘스트 맵 뷰 (아이콘 경로)

import React, { useEffect, useRef } from 'react';
import { FlatList, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Quest } from '../../types/quest';
import { QuestNode } from './QuestNode';

interface QuestMapViewProps {
  data: Quest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRequestDetail: () => void;
  isCompactMode?: boolean; // Split 모드에서 축소
}

export const QuestMapView = React.memo(
  ({ data, selectedId, onSelect, onRequestDetail, isCompactMode = false }: QuestMapViewProps) => {
    const listRef = useRef<FlatList>(null);
    const scaleValue = useSharedValue(isCompactMode ? 0.6 : 1);

    useEffect(() => {
      scaleValue.value = withTiming(isCompactMode ? 0.6 : 1, { duration: 300 });
    }, [isCompactMode, scaleValue]);

    const containerStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scaleValue.value }],
    }));

    // 현재 날짜
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // 정렬된 데이터 (가까운 미래가 위로)
    const sortedData = React.useMemo(() => {
      return [...data].sort((a, b) => {
        const dateA = new Date(a.targetDate || a.scheduledDate || '').getTime();
        const dateB = new Date(b.targetDate || b.scheduledDate || '').getTime();
        return dateA - dateB; // ✅ 오름차순 = 가까운 미래가 위
      });
    }, [data]);

    // 다음 퀘스트 찾기 (미완료 중 가장 가까운 미래)
    const nextQuestId = React.useMemo(() => {
      const upcomingQuests = sortedData.filter(q => {
        const questDate = new Date(q.targetDate || q.scheduledDate || '');
        questDate.setHours(0, 0, 0, 0);
        return questDate.getTime() >= now.getTime() && q.status !== 'completed';
      });
      return upcomingQuests[0]?.id || null;
    }, [sortedData, now]);

    // 퀘스트 상태 판별
    const getQuestStatus = (quest: Quest) => {
      const questDate = new Date(quest.targetDate || quest.scheduledDate || '');
      questDate.setHours(0, 0, 0, 0);
      
      const isCompleted = quest.status === 'completed';
      const isNextQuest = quest.id === nextQuestId; // ✅ 다음 퀘스트만 별 표시
      const isLocked = !isCompleted && !isNextQuest && questDate.getTime() >= now.getTime(); // ✅ 다음 퀘스트 외에는 잠금
      
      return { isNextQuest, isCompleted, isLocked };
    };

    // NEXT 퀘스트로 자동 스크롤 (Goal Detail 진입 시)
    React.useEffect(() => {
      if (!isCompactMode && sortedData.length > 0 && nextQuestId) {
        const nextIndex = sortedData.findIndex(q => q.id === nextQuestId);
        if (nextIndex !== -1) {
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index: nextIndex,
              animated: true,
              viewPosition: 0.2, // 화면 상단 20% 위치
            });
          }, 300);
        }
      }
    }, [sortedData, nextQuestId, isCompactMode]);

    const renderNode = ({ item, index }: { item: Quest; index: number }) => {
      const { isNextQuest, isCompleted, isLocked } = getQuestStatus(item);
      
      // 지그재그 오프셋 (짝수/홀수 행에 따라)
      const offsetX = index % 2 === 0 ? -20 : 20;

      return (
        <QuestNode
          quest={item}
          isToday={isNextQuest}
          isSelected={selectedId === item.id}
          isLocked={isLocked}
          isCompleted={isCompleted}
          onPress={() => {
            if (!isLocked) {
              onSelect(item.id);
              if (!isCompactMode) {
                onRequestDetail();
              }
            }
          }}
          offsetX={isCompactMode ? 0 : offsetX}
        />
      );
    };

    if (data.length === 0) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-gray-500 text-center">아직 생성된 퀘스트가 없습니다</Text>
        </View>
      );
    }

    return (
      <Animated.View style={[{ flex: 1 }, containerStyle]}>
        <FlatList
          ref={listRef}
          data={sortedData}
          keyExtractor={(item) => item.id}
          renderItem={renderNode}
          contentContainerStyle={{
            paddingVertical: 24,
            paddingHorizontal: isCompactMode ? 8 : 16,
          }}
          showsVerticalScrollIndicator={!isCompactMode}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.5,
              });
            }, 100);
          }}
        />
      </Animated.View>
    );
  }
);

QuestMapView.displayName = 'QuestMapView';

