// Quest Map 상단 탭 바 (퀘스트 맵 ↔ 상세보기)

import React from 'react';
import { Pressable, Text, View } from 'react-native';

export type ViewMode = 'map' | 'split';

interface QuestTopBarProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export function QuestTopBar({ mode, onModeChange }: QuestTopBarProps) {
  return (
    <View className="flex-row bg-white border-b border-gray-200 px-4">
      {/* 퀘스트 탭 */}
      <Pressable
        onPress={() => onModeChange('map')}
        className="flex-1 py-3 items-center"
        style={{
          borderBottomWidth: mode === 'map' ? 2 : 0,
          borderBottomColor: '#27AE60',
        }}
      >
        <Text
          className={`text-base font-semibold ${
            mode === 'map' ? 'text-[#27AE60]' : 'text-gray-500'
          }`}
        >
          퀘스트
        </Text>
      </Pressable>

      {/* 상세보기 탭 */}
      <Pressable
        onPress={() => onModeChange('split')}
        className="flex-1 py-3 items-center"
        style={{
          borderBottomWidth: mode === 'split' ? 2 : 0,
          borderBottomColor: '#27AE60',
        }}
      >
        <Text
          className={`text-base font-semibold ${
            mode === 'split' ? 'text-[#27AE60]' : 'text-gray-500'
          }`}
        >
          상세보기
        </Text>
      </Pressable>
    </View>
  );
}

