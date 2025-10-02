// 퀘스트 상세 카드 리스트 (기존 GoalDetailScreen에서 추출)

import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import type { Quest } from '../../types/quest';

interface QuestDetailListProps {
  data: Quest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onComplete: (id: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
  onUndo: (id: string) => Promise<void>;
}

export const QuestDetailList = React.memo(
  ({ data, selectedId, onSelect, onComplete, onSkip, onUndo }: QuestDetailListProps) => {
    const listRef = useRef<FlatList>(null);

    // 정렬된 데이터 (가까운 미래가 위로)
    const sortedData = React.useMemo(() => {
      return [...data].sort((a, b) => {
        const dateA = new Date(a.targetDate || a.scheduledDate || '').getTime();
        const dateB = new Date(b.targetDate || b.scheduledDate || '').getTime();
        return dateA - dateB; // ✅ 오름차순 = 가까운 미래가 위
      });
    }, [data]);

    // 선택된 항목으로 스크롤
    React.useEffect(() => {
      if (selectedId) {
        const index = sortedData.findIndex((q) => q.id === selectedId);
        if (index !== -1) {
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index,
              animated: true,
              viewPosition: 0.3,
            });
          }, 100);
        }
      }
    }, [selectedId, sortedData]);

    const renderQuestCard = ({ item: quest }: { item: Quest }) => {
      const isSelected = selectedId === quest.id;

      return (
        <TouchableOpacity
          onPress={() => onSelect(quest.id)}
          style={{
            backgroundColor: isSelected ? '#F0FDF4' : '#FFFFFF',
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderWidth: isSelected ? 2 : 1,
            borderColor: isSelected ? '#27AE60' : '#E5E7EB',
            shadowColor: isSelected ? '#27AE60' : '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isSelected ? 0.15 : 0.05,
            shadowRadius: isSelected ? 4 : 2,
            elevation: isSelected ? 4 : 1,
          }}
        >
          {/* 헤더: 제목 + 상태 */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: 4,
                }}
                numberOfLines={2}
              >
                {quest.title}
              </Text>
              {quest.description && (
                <Text
                  style={{
                    fontSize: 14,
                    color: '#6B7280',
                    lineHeight: 20,
                  }}
                  numberOfLines={2}
                >
                  {quest.description}
                </Text>
              )}
            </View>

            <View style={{ alignItems: 'center' }}>
              <Ionicons
                name={
                  quest.status === 'completed'
                    ? 'checkmark-circle'
                    : quest.status === 'failed'
                    ? 'close-circle'
                    : quest.status === 'pending'
                    ? 'time'
                    : 'help-circle'
                }
                size={24}
                color={
                  quest.status === 'completed'
                    ? '#10B981'
                    : quest.status === 'failed'
                    ? '#EF4444'
                    : quest.status === 'pending'
                    ? '#F59E0B'
                    : '#6B7280'
                }
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  marginTop: 4,
                  color:
                    quest.status === 'completed'
                      ? '#10B981'
                      : quest.status === 'failed'
                      ? '#EF4444'
                      : quest.status === 'pending'
                      ? '#F59E0B'
                      : '#6B7280',
                }}
              >
                {quest.status === 'completed'
                  ? '완료'
                  : quest.status === 'failed'
                  ? '실패'
                  : quest.status === 'pending'
                  ? '대기'
                  : '알 수 없음'}
              </Text>
            </View>
          </View>

          {/* 메타 정보: 날짜, 주차 */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            {quest.scheduledDate && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginRight: 16,
                  marginBottom: 4,
                }}
              >
                <Ionicons name="calendar" size={16} color="#6B7280" />
                <Text
                  style={{
                    fontSize: 12,
                    color: '#6B7280',
                    marginLeft: 4,
                  }}
                >
                  {new Date(quest.scheduledDate).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </Text>
              </View>
            )}

            {quest.weekNumber && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginRight: 16,
                  marginBottom: 4,
                }}
              >
                <Ionicons name="repeat" size={16} color="#6B7280" />
                <Text
                  style={{
                    fontSize: 12,
                    color: '#6B7280',
                    marginLeft: 4,
                  }}
                >
                  주차 {quest.weekNumber}
                </Text>
              </View>
            )}
          </View>

          {/* 액션 버튼 */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
            }}
          >
            {quest.status === 'pending' && (
              <>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6,
                    marginLeft: 8,
                    backgroundColor: '#ECFDF5',
                  }}
                  onPress={() => onComplete(quest.id)}
                >
                  <Ionicons name="checkmark" size={16} color="#10B981" />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '500',
                      marginLeft: 4,
                      color: '#10B981',
                    }}
                  >
                    완료
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6,
                    marginLeft: 8,
                    backgroundColor: '#F9FAFB',
                  }}
                  onPress={() => onSkip(quest.id)}
                >
                  <Ionicons name="remove" size={16} color="#6B7280" />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '500',
                      marginLeft: 4,
                      color: '#6B7280',
                    }}
                  >
                    건너뛰기
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {quest.status === 'completed' && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  marginLeft: 8,
                  backgroundColor: '#FFFBEB',
                }}
                onPress={() => onUndo(quest.id)}
              >
                <Ionicons name="arrow-undo" size={16} color="#F59E0B" />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    marginLeft: 4,
                    color: '#F59E0B',
                  }}
                >
                  되돌리기
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      );
    };

    if (data.length === 0) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 48,
          }}
        >
          <Ionicons name="list" size={48} color="#D1D5DB" />
          <Text
            style={{
              fontSize: 16,
              fontWeight: '500',
              color: '#6B7280',
              marginTop: 12,
            }}
          >
            퀀스트가 없습니다
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        ref={listRef}
        data={sortedData}
        keyExtractor={(item) => item.id}
        renderItem={renderQuestCard}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
        showsVerticalScrollIndicator={true}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
              viewPosition: 0.3,
            });
          }, 100);
        }}
      />
    );
  }
);

QuestDetailList.displayName = 'QuestDetailList';

