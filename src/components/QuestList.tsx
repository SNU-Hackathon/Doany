// Quest List Component
// Displays a list of quests for a goal

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Quest, QuestStatus } from '../types/quest';

interface QuestListProps {
  quests: Quest[];
  onQuestPress: (quest: Quest) => void;
  onQuestStatusChange: (questId: string, status: QuestStatus) => void;
}

export default function QuestList({ quests, onQuestPress, onQuestStatusChange }: QuestListProps) {
  
  const getStatusColor = (status: QuestStatus): string => {
    switch (status) {
      case 'completed': return '#10B981'; // green
      case 'failed': return '#EF4444'; // red
      case 'pending': return '#F59E0B'; // yellow
      case 'skipped': return '#6B7280'; // gray
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: QuestStatus): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'completed': return 'checkmark-circle';
      case 'failed': return 'close-circle';
      case 'pending': return 'time';
      case 'skipped': return 'remove-circle';
      default: return 'help-circle';
    }
  };

  const getStatusText = (status: QuestStatus): string => {
    switch (status) {
      case 'completed': return '완료';
      case 'failed': return '실패';
      case 'pending': return '대기';
      case 'skipped': return '건너뜀';
      default: return '알 수 없음';
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
        weekday: 'short'
      });
    } catch {
      return '';
    }
  };

  const renderQuest = ({ item: quest }: { item: Quest }) => (
    <TouchableOpacity
      style={styles.questItem}
      onPress={() => onQuestPress(quest)}
    >
      <View style={styles.questHeader}>
        <View style={styles.questTitleContainer}>
          <Text style={styles.questTitle} numberOfLines={2}>
            {quest.title}
          </Text>
          {quest.description && (
            <Text style={styles.questDescription} numberOfLines={2}>
              {quest.description}
            </Text>
          )}
        </View>
        
        <View style={styles.questStatus}>
          <Ionicons
            name={getStatusIcon(quest.status)}
            size={24}
            color={getStatusColor(quest.status)}
          />
          <Text style={[styles.statusText, { color: getStatusColor(quest.status) }]}>
            {getStatusText(quest.status)}
          </Text>
        </View>
      </View>

      <View style={styles.questMeta}>
        {quest.scheduledDate && (
          <View style={styles.metaItem}>
            <Ionicons name="calendar" size={16} color="#6B7280" />
            <Text style={styles.metaText}>{formatDate(quest.scheduledDate)}</Text>
          </View>
        )}
        
        {quest.weekNumber && (
          <View style={styles.metaItem}>
            <Ionicons name="repeat" size={16} color="#6B7280" />
            <Text style={styles.metaText}>주차 {quest.weekNumber}</Text>
          </View>
        )}
        
        {quest.metadata?.sequence && (
          <View style={styles.metaItem}>
            <Ionicons name="list" size={16} color="#6B7280" />
            <Text style={styles.metaText}>단계 {quest.metadata.sequence}</Text>
          </View>
        )}
      </View>

      <View style={styles.questActions}>
        {quest.status === 'pending' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => onQuestStatusChange(quest.id, 'completed')}
            >
              <Ionicons name="checkmark" size={16} color="#10B981" />
              <Text style={[styles.actionButtonText, { color: '#10B981' }]}>완료</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.skipButton]}
              onPress={() => onQuestStatusChange(quest.id, 'skipped')}
            >
              <Ionicons name="remove" size={16} color="#6B7280" />
              <Text style={[styles.actionButtonText, { color: '#6B7280' }]}>건너뛰기</Text>
            </TouchableOpacity>
          </>
        )}
        
        {quest.status === 'completed' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.revertButton]}
            onPress={() => onQuestStatusChange(quest.id, 'pending')}
          >
            <Ionicons name="arrow-undo" size={16} color="#F59E0B" />
            <Text style={[styles.actionButtonText, { color: '#F59E0B' }]}>되돌리기</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const getQuestStats = () => {
    const total = quests.length;
    const completed = quests.filter(q => q.status === 'completed').length;
    const pending = quests.filter(q => q.status === 'pending').length;
    const failed = quests.filter(q => q.status === 'failed').length;
    
    return { total, completed, pending, failed };
  };

  const stats = getQuestStats();

  return (
    <View style={styles.container}>
      {/* Quest Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>퀀스트 진행상황</Text>
          <Text style={styles.statsSubtitle}>
            {stats.completed}/{stats.total} 완료 ({Math.round((stats.completed / stats.total) * 100)}%)
          </Text>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.completed}</Text>
            <Text style={styles.statLabel}>완료</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.pending}</Text>
            <Text style={styles.statLabel}>대기</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.failed}</Text>
            <Text style={styles.statLabel}>실패</Text>
          </View>
        </View>
      </View>

      {/* Quest List */}
      <FlatList
        data={quests}
        keyExtractor={(item) => item.id}
        renderItem={renderQuest}
        style={styles.questList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="list" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>퀀스트가 없습니다</Text>
            <Text style={styles.emptySubtext}>
              목표가 생성되면 자동으로 퀀스트가 생성됩니다
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  
  // Stats styles
  statsContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  statsHeader: {
    marginBottom: 16,
  },
  
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  
  statsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  
  statItem: {
    alignItems: 'center',
  },
  
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  
  // Quest list styles
  questList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  
  questItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  questHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  
  questTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  
  questTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  
  questDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  
  questStatus: {
    alignItems: 'center',
  },
  
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  
  questMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  
  questActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  
  completeButton: {
    backgroundColor: '#ECFDF5',
  },
  
  skipButton: {
    backgroundColor: '#F9FAFB',
  },
  
  revertButton: {
    backgroundColor: '#FFFBEB',
  },
  
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  
  // Empty state styles
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 12,
  },
  
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
});
