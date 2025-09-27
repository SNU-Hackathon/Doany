import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Quest } from '../types/quest';

interface QuestPreviewProps {
  goalData: any;
  userId: string;
}

export default function QuestPreview({ goalData, userId }: QuestPreviewProps) {
  const [quests, setQuests] = useState<Quest[]>([
    // Hardcoded test quests for debugging
    {
      id: 'test_quest_1',
      goalId: 'test_goal',
      title: '테스트 퀘스트 1',
      type: 'frequency',
      status: 'pending',
      weekNumber: 1,
      verificationRules: [{ type: 'manual', required: true, config: {} }],
      createdAt: new Date().toISOString()
    },
    {
      id: 'test_quest_2', 
      goalId: 'test_goal',
      title: '테스트 퀘스트 2',
      type: 'frequency',
      status: 'pending',
      weekNumber: 2,
      verificationRules: [{ type: 'manual', required: true, config: {} }],
      createdAt: new Date().toISOString()
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.log('[QuestPreview] Component rendered with:', {
    hasGoalData: !!goalData,
    hasUserId: !!userId,
    goalDataKeys: goalData ? Object.keys(goalData) : [],
    loading,
    error,
    questsCount: quests.length
  });

  useEffect(() => {
    console.log('[QuestPreview] useEffect triggered');
    // Skip quest generation for now, just use hardcoded quests
  }, [goalData, userId]);

  console.log('[QuestPreview] Rendering state:', { loading, error, questsCount: quests.length });

  if (loading) {
    console.log('[QuestPreview] Rendering loading state');
    return (
      <View style={styles.container}>
        <Text style={styles.title}>퀘스트 미리보기</Text>
        <View style={styles.loadingContainer}>
          <Ionicons name="hourglass-outline" size={24} color="#6B7280" />
          <Text style={styles.loadingText}>퀘스트를 생성하는 중...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    console.log('[QuestPreview] Rendering error state:', error);
    return (
      <View style={styles.container}>
        <Text style={styles.title}>퀘스트 미리보기</Text>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={24} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  if (quests.length === 0) {
    console.log('[QuestPreview] Rendering empty state');
    return (
      <View style={styles.container}>
        <Text style={styles.title}>퀘스트 미리보기</Text>
        <View style={styles.emptyContainer}>
          <Ionicons name="list" size={24} color="#6B7280" />
          <Text style={styles.emptyText}>퀘스트 미리보기를 사용할 수 없습니다</Text>
        </View>
      </View>
    );
  }

  console.log('[QuestPreview] Rendering quests:', quests.length);
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>퀘스트 미리보기</Text>
      <Text style={styles.subtitle}>
        생성된 퀘스트: {quests.length}개
      </Text>
      
      {/* Simple quest list for debugging */}
      {quests.map((quest, index) => (
        <View key={quest.id || index} style={{
          backgroundColor: 'white',
          padding: 12,
          marginVertical: 4,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#e5e7eb'
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{quest.title}</Text>
          <Text style={{ fontSize: 14, color: '#6B7280' }}>
            Type: {quest.type} | Status: {quest.status}
          </Text>
          {quest.weekNumber && (
            <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
              Week {quest.weekNumber}
            </Text>
          )}
        </View>
      ))}
      
      <Text style={styles.footer}>
        * 디버그 모드: 하드코딩된 테스트 퀘스트
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  footer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#ef4444',
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
  },
});
