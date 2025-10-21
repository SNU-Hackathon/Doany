import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { createGoal } from '../api/goals';
import { CreateGoalRequest } from '../api/types';
import { useAuth } from '../hooks/useAuth';
import goalTemplatesData from '../mocks/goal.templates.json';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QuestTemplate {
  type: 'schedule' | 'frequency' | 'milestone';
  title: string;
  description: string;
  verificationMethods: string[];
  schedule?: {
    weekdays?: number[];
    time?: string;
    timeWindow?: [string, string];
  };
  frequency?: {
    count: number;
    unit: string;
  };
  milestones?: Array<{
    label: string;
    targetValue: number;
  }>;
  constraints?: any;
}

interface GoalTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  icon: string;
  color: string;
  difficulty: string;
  estimatedDuration: string;
  participants: number;
  successRate: number;
  quests: QuestTemplate[];
}

interface GoalLibraryScreenProps {
  onClose: () => void;
  onSelectTemplate: (template: GoalTemplate) => void;
}

// Template Card Component
const TemplateCard = ({ 
  template, 
  onPress 
}: { 
  template: GoalTemplate; 
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <View style={styles.templateCard}>
        {/* Icon and Basic Info */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${template.color}20` }]}>
            <Ionicons name={template.icon as any} size={32} color={template.color} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.templateTitle} numberOfLines={1}>
              {template.title}
            </Text>
            <Text style={styles.categoryText}>{template.category}</Text>
            <View style={styles.tagsContainer}>
              {template.tags.slice(0, 3).map((tag, index) => (
                <Text key={index} style={styles.tagText}>#{tag}</Text>
              ))}
            </View>
          </View>
        </View>

        {/* Description */}
        <Text style={styles.description} numberOfLines={2}>
          {template.description}
        </Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={14} color="#6B7280" />
            <Text style={styles.statText}>{template.participants.toLocaleString()}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="trophy-outline" size={14} color="#6B7280" />
            <Text style={styles.statText}>{template.successRate}%</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={styles.statText}>{template.estimatedDuration}</Text>
          </View>
          <View style={[styles.difficultyBadge, getDifficultyStyle(template.difficulty)]}>
            <Text style={[styles.difficultyText, getDifficultyTextStyle(template.difficulty)]}>
              {template.difficulty}
            </Text>
          </View>
        </View>

        {/* Quest Count */}
        <View style={styles.questInfo}>
          <Ionicons name="list-outline" size={16} color="#4F46E5" />
          <Text style={styles.questCount}>퀘스트 {template.quests.length}개</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Helper function for difficulty badge style
const getDifficultyStyle = (difficulty: string) => {
  switch (difficulty) {
    case '쉬움':
      return { backgroundColor: '#D1FAE5' };
    case '보통':
      return { backgroundColor: '#FEF3C7' };
    case '어려움':
      return { backgroundColor: '#FEE2E2' };
    default:
      return { backgroundColor: '#F3F4F6' };
  }
};

const getDifficultyTextStyle = (difficulty: string) => {
  switch (difficulty) {
    case '쉬움':
      return { color: '#059669' };
    case '보통':
      return { color: '#D97706' };
    case '어려움':
      return { color: '#DC2626' };
    default:
      return { color: '#6B7280' };
  }
};

export default function GoalLibraryScreen({ onClose, onSelectTemplate }: GoalLibraryScreenProps) {
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<GoalTemplate | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [isCreating, setIsCreating] = useState(false);

  const templates: GoalTemplate[] = goalTemplatesData.templates as GoalTemplate[];

  // Categories
  const categories = ['전체', 'lifestyle', 'health fitness', 'study', 'hobby'];

  // Filter templates by category
  const filteredTemplates = selectedCategory === '전체' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  const handleTemplatePress = (template: GoalTemplate) => {
    setSelectedTemplate(template);
    setShowDetailModal(true);
  };

  const handleUseTemplate = async () => {
    if (!selectedTemplate || !user) return;

    setIsCreating(true);
    try {
      // 날짜 설정 (현재 날짜부터 템플릿의 예상 기간만큼)
      const startDate = new Date();
      const endDate = new Date(startDate);
      
      // 예상 기간을 파싱하여 종료일 계산
      const durationMatch = selectedTemplate.estimatedDuration.match(/(\d+)(주|개월)/);
      if (durationMatch) {
        const value = parseInt(durationMatch[1]);
        const unit = durationMatch[2];
        if (unit === '주') {
          endDate.setDate(endDate.getDate() + value * 7);
        } else if (unit === '개월') {
          endDate.setMonth(endDate.getMonth() + value);
        }
      } else {
        // 기본값: 4주
        endDate.setDate(endDate.getDate() + 28);
      }

      // ISO 형식으로 변환
      const startAtStr = startDate.toISOString();
      const endAtStr = endDate.toISOString();

      // 템플릿의 첫 번째 퀘스트 타입을 기준으로 목표 타입 결정
      const primaryQuestType = selectedTemplate.quests[0]?.type || 'schedule';

      // 목표 생성 요청 데이터 구성
      let requestBody: CreateGoalRequest;

      if (primaryQuestType === 'schedule') {
        // Schedule 타입 목표 생성
        const scheduleQuests = selectedTemplate.quests
          .filter(q => q.type === 'schedule')
          .flatMap(quest => {
            const dates: string[] = [];
            const currentDate = new Date(startDate);
            
            // 시작일부터 종료일까지 해당 요일에 퀘스트 생성
            while (currentDate <= endDate) {
              const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay(); // 일요일을 7로 변환
              
              if (quest.schedule?.weekdays?.includes(dayOfWeek)) {
                dates.push(currentDate.toISOString().split('T')[0]);
              }
              currentDate.setDate(currentDate.getDate() + 1);
            }

            // 각 날짜에 대한 퀘스트 생성
            return dates.map(date => ({
              date,
              time: quest.schedule?.time || quest.schedule?.timeWindow?.[0] || '09:00',
              description: quest.description,
              verificationMethod: (quest.verificationMethods[0] || 'manual') as 'camera' | 'location' | 'manual'
            }));
          });

        requestBody = {
          goalType: 'schedule',
          title: selectedTemplate.title,
          description: selectedTemplate.description,
          tags: selectedTemplate.tags,
          startAt: startAtStr,
          endAt: endAtStr,
          quests: scheduleQuests.slice(0, 30) // 최대 30개로 제한
        };
      } else if (primaryQuestType === 'frequency') {
        // Frequency 타입 목표 생성
        const frequencyQuest = selectedTemplate.quests.find(q => q.type === 'frequency');
        
        requestBody = {
          goalType: 'frequency',
          title: selectedTemplate.title,
          description: selectedTemplate.description,
          tags: selectedTemplate.tags,
          startAt: startAtStr,
          endAt: endAtStr,
          period: 'week',
          numbers: frequencyQuest?.frequency?.count || 3,
          quests: [{
            unit: 1,
            description: frequencyQuest?.description || selectedTemplate.description,
            verificationMethod: (frequencyQuest?.verificationMethods[0] || 'manual') as 'camera' | 'location' | 'manual'
          }]
        };
      } else {
        // Milestone 타입 목표 생성
        const milestoneQuest = selectedTemplate.quests.find(q => q.type === 'milestone');
        const milestones = milestoneQuest?.milestones || [];
        
        requestBody = {
          goalType: 'milestone',
          scheduleMethod: 'milestone',
          title: selectedTemplate.title,
          description: selectedTemplate.description,
          tags: selectedTemplate.tags,
          startAt: startAtStr,
          endAt: endAtStr,
          quests: milestones.map(m => ({
            title: m.label,
            targetValue: m.targetValue,
            description: m.label,
            verificationMethod: (milestoneQuest?.verificationMethods[0] || 'manual') as 'camera' | 'location' | 'manual'
          })),
          totalSteps: milestones.length,
          currentStepIndex: 0,
          overallTarget: milestones[milestones.length - 1]?.targetValue || 100,
          config: {
            rewardPerStep: 10,
            maxFails: 2
          }
        };
      }

      // API 호출
      const response = await createGoal(
        {
          userId: user.userId,
          visibility: 'public',
          goalType: primaryQuestType as 'schedule' | 'frequency' | 'milestone'
        },
        requestBody
      );

      console.log('Goal created successfully:', response);
      
      // 성공 알림
      Alert.alert(
        '목표 생성 완료',
        `"${selectedTemplate.title}" 목표가 성공적으로 생성되었습니다!`,
        [
          {
            text: '확인',
            onPress: () => {
              setShowDetailModal(false);
              onSelectTemplate(selectedTemplate);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Failed to create goal from template:', error);
      Alert.alert(
        '목표 생성 실패',
        '목표를 생성하는 중 오류가 발생했습니다. 다시 시도해주세요.',
        [{ text: '확인' }]
      );
    } finally {
      setIsCreating(false);
    }
  };

  const renderQuestType = (quest: QuestTemplate) => {
    switch (quest.type) {
      case 'schedule':
        return (
          <View style={styles.questTypeTag}>
            <Ionicons name="calendar-outline" size={12} color="#8B5CF6" />
            <Text style={[styles.questTypeText, { color: '#8B5CF6' }]}>스케줄형</Text>
          </View>
        );
      case 'frequency':
        return (
          <View style={styles.questTypeTag}>
            <Ionicons name="repeat-outline" size={12} color="#3B82F6" />
            <Text style={[styles.questTypeText, { color: '#3B82F6' }]}>빈도형</Text>
          </View>
        );
      case 'milestone':
        return (
          <View style={styles.questTypeTag}>
            <Ionicons name="flag-outline" size={12} color="#F59E0B" />
            <Text style={[styles.questTypeText, { color: '#F59E0B' }]}>마일스톤형</Text>
          </View>
        );
    }
  };

  const renderQuestDetail = (quest: QuestTemplate) => {
    if (quest.type === 'schedule' && quest.schedule) {
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const weekdayText = quest.schedule.weekdays?.map(d => days[d - 1]).join(', ') || '매일';
      const timeText = quest.schedule.time || 
        (quest.schedule.timeWindow ? `${quest.schedule.timeWindow[0]} - ${quest.schedule.timeWindow[1]}` : '');
      return <Text style={styles.questDetailText}>{weekdayText} {timeText}</Text>;
    } else if (quest.type === 'frequency' && quest.frequency) {
      const unitText = quest.frequency.unit === 'per_week' ? '주' : 
                       quest.frequency.unit === 'per_day' ? '일' : '월';
      return <Text style={styles.questDetailText}>{unitText}당 {quest.frequency.count}회</Text>;
    } else if (quest.type === 'milestone' && quest.milestones) {
      return <Text style={styles.questDetailText}>{quest.milestones.length}단계</Text>;
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Custom Header with Back Button */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>목표 라이브러리</Text>
        </View>
      </View>

      {/* Category Filter */}
      <View style={styles.categoryContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.selectedCategoryChip
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === category && styles.selectedCategoryChipText
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Templates List */}
      <View style={styles.content}>
        <Text style={styles.resultsText}>
          {filteredTemplates.length}개의 템플릿
        </Text>
        
        <FlatList
          data={filteredTemplates}
          renderItem={({ item }) => (
            <TemplateCard 
              template={item} 
              onPress={() => handleTemplatePress(item)} 
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.templatesList}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTemplate && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={[styles.modalIconContainer, { backgroundColor: `${selectedTemplate.color}20` }]}>
                    <Ionicons name={selectedTemplate.icon as any} size={40} color={selectedTemplate.color} />
                  </View>
                  <Text style={styles.modalTitle}>{selectedTemplate.title}</Text>
                  <Text style={styles.modalDescription}>{selectedTemplate.description}</Text>
                  
                  {/* Stats */}
                  <View style={styles.modalStats}>
                    <View style={styles.modalStatItem}>
                      <Text style={styles.modalStatValue}>{selectedTemplate.participants.toLocaleString()}</Text>
                      <Text style={styles.modalStatLabel}>참여자</Text>
                    </View>
                    <View style={styles.modalStatItem}>
                      <Text style={styles.modalStatValue}>{selectedTemplate.successRate}%</Text>
                      <Text style={styles.modalStatLabel}>성공률</Text>
                    </View>
                    <View style={styles.modalStatItem}>
                      <Text style={styles.modalStatValue}>{selectedTemplate.estimatedDuration}</Text>
                      <Text style={styles.modalStatLabel}>예상 기간</Text>
                    </View>
                  </View>
                </View>

                {/* Quests List */}
                <ScrollView style={styles.questsContainer} showsVerticalScrollIndicator={false}>
                  <Text style={styles.questsTitle}>포함된 퀘스트</Text>
                  {selectedTemplate.quests.map((quest, index) => (
                    <View key={index} style={styles.questItem}>
                      <View style={styles.questItemHeader}>
                        <Text style={styles.questItemTitle}>{quest.title}</Text>
                        {renderQuestType(quest)}
                      </View>
                      <Text style={styles.questItemDescription}>{quest.description}</Text>
                      {renderQuestDetail(quest)}
                      
                      {/* Verification Methods */}
                      <View style={styles.verificationMethods}>
                        {quest.verificationMethods.map((method, idx) => (
                          <View key={idx} style={styles.methodBadge}>
                            <Text style={styles.methodBadgeText}>{method}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={[styles.useButton, isCreating && styles.useButtonDisabled]}
                    onPress={handleUseTemplate}
                    disabled={isCreating}
                  >
                    <Text style={styles.useButtonText}>
                      {isCreating ? '생성 중...' : '이 템플릿 사용하기'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => setShowDetailModal(false)}
                    disabled={isCreating}
                  >
                    <Text style={styles.cancelButtonText}>취소</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    marginTop: 50,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  categoryContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 12,
  },
  categoryList: {
    paddingHorizontal: 20,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  selectedCategoryChip: {
    backgroundColor: '#4F46E5',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  selectedCategoryChipText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  resultsText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginVertical: 12,
  },
  templatesList: {
    paddingBottom: 20,
  },
  templateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  templateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginRight: 8,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  questInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questCount: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
    marginLeft: 6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_WIDTH * 1.8,
    paddingBottom: 20,
  },
  modalHeader: {
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  modalStatLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  questsContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  questsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 12,
  },
  questItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  questItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  questTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  questTypeText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  questItemDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  questDetailText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  verificationMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  methodBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
    marginTop: 4,
  },
  methodBadgeText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '500',
  },
  modalActions: {
    padding: 24,
    paddingTop: 12,
  },
  useButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  useButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0.1,
  },
  useButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});

