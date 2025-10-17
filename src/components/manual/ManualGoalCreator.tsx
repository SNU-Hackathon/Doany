// Manual Goal Creator - Create goals with multiple quest types manually

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { createGoal } from '../../services/goalService';

interface ManualGoalCreatorProps {
  onGoalCreated: () => void;
  onClose: () => void;
}

type QuestType = 'schedule' | 'frequency' | 'milestone';

interface QuestBase {
  id: string;
  type: QuestType;
  title: string;
  description: string;
}

interface ScheduleQuest extends QuestBase {
  type: 'schedule';
  date: string;
  time: string;
  verificationMethod: 'camera' | 'location' | 'manual';
}

interface FrequencyQuest extends QuestBase {
  type: 'frequency';
  unit: number;
  verificationMethod: 'camera' | 'location' | 'manual';
}

interface MilestoneQuest extends QuestBase {
  type: 'milestone';
  targetValue: number;
  verificationMethod: 'camera' | 'location' | 'manual';
}

type Quest = ScheduleQuest | FrequencyQuest | MilestoneQuest;

export default function ManualGoalCreator({ onGoalCreated, onClose }: ManualGoalCreatorProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'basic' | 'quests'>('basic');
  
  // Basic goal info
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  // Quests
  const [quests, setQuests] = useState<Quest[]>([]);
  const [showAddQuestModal, setShowAddQuestModal] = useState(false);
  const [selectedQuestType, setSelectedQuestType] = useState<QuestType | null>(null);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  
  // Quest form state
  const [questTitle, setQuestTitle] = useState('');
  const [questDescription, setQuestDescription] = useState('');
  const [questDate, setQuestDate] = useState('');
  const [questTime, setQuestTime] = useState('09:00');
  const [questUnit, setQuestUnit] = useState('1');
  const [questTargetValue, setQuestTargetValue] = useState('100');
  const [questVerification, setQuestVerification] = useState<'camera' | 'location' | 'manual'>('camera');
  
  const [isSaving, setIsSaving] = useState(false);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleStartAddQuest = (type: QuestType) => {
    setSelectedQuestType(type);
    setShowAddQuestModal(true);
    resetQuestForm();
  };

  const resetQuestForm = () => {
    setQuestTitle('');
    setQuestDescription('');
    setQuestDate('');
    setQuestTime('09:00');
    setQuestUnit('1');
    setQuestTargetValue('100');
    setQuestVerification('camera');
    setEditingQuest(null);
  };

  const handleSaveQuest = () => {
    if (!selectedQuestType || !questTitle.trim()) return;

    const newQuest: Quest = {
      id: editingQuest?.id || `quest-${Date.now()}-${Math.random()}`,
      type: selectedQuestType,
      title: questTitle,
      description: questDescription,
      ...(selectedQuestType === 'schedule' && {
        date: questDate,
        time: questTime,
        verificationMethod: questVerification,
      }),
      ...(selectedQuestType === 'frequency' && {
        unit: parseInt(questUnit),
        verificationMethod: questVerification,
      }),
      ...(selectedQuestType === 'milestone' && {
        targetValue: parseInt(questTargetValue),
        verificationMethod: questVerification,
      }),
    } as Quest;

    if (editingQuest) {
      setQuests(quests.map(q => q.id === editingQuest.id ? newQuest : q));
    } else {
      setQuests([...quests, newQuest]);
    }

    setShowAddQuestModal(false);
    resetQuestForm();
  };

  const handleEditQuest = (quest: Quest) => {
    setEditingQuest(quest);
    setSelectedQuestType(quest.type);
    setQuestTitle(quest.title);
    setQuestDescription(quest.description);
    
    if (quest.type === 'schedule') {
      setQuestDate(quest.date);
      setQuestTime(quest.time);
      setQuestVerification(quest.verificationMethod);
    } else if (quest.type === 'frequency') {
      setQuestUnit(String(quest.unit));
      setQuestVerification(quest.verificationMethod);
    } else if (quest.type === 'milestone') {
      setQuestTargetValue(String(quest.targetValue));
      setQuestVerification(quest.verificationMethod);
    }
    
    setShowAddQuestModal(true);
  };

  const handleDeleteQuest = (questId: string) => {
    setQuests(quests.filter(q => q.id !== questId));
  };

  const handleSaveGoal = async () => {
    if (!goalTitle.trim() || !startDate || !endDate || quests.length === 0) {
      alert('목표 제목, 기간, 최소 1개의 퀘스트가 필요합니다.');
      return;
    }

    setIsSaving(true);
    try {
      // Group quests by type for API
      const scheduleQuests = quests.filter(q => q.type === 'schedule') as ScheduleQuest[];
      const frequencyQuests = quests.filter(q => q.type === 'frequency') as FrequencyQuest[];
      const milestoneQuests = quests.filter(q => q.type === 'milestone') as MilestoneQuest[];

      // For now, create the primary goal based on the first quest type
      const primaryType = quests[0].type;
      
      const goalData: any = {
        goalType: primaryType,
        title: goalTitle,
        description: goalDescription || goalTitle,
        tags: tags.length > 0 ? tags : ['수동 생성'],
        startAt: `${startDate}T00:00`,
        endAt: `${endDate}T23:59`,
        userId: user?.userId || '1',
      };

      if (primaryType === 'schedule' && scheduleQuests.length > 0) {
        goalData.quests = scheduleQuests.map(q => ({
          date: `${q.date}T${q.time}`,
          description: q.description || q.title,
          verificationMethod: q.verificationMethod,
        }));
      } else if (primaryType === 'frequency' && frequencyQuests.length > 0) {
        goalData.period = 'week';
        goalData.numbers = frequencyQuests.length;
        goalData.quests = frequencyQuests.map((q, idx) => ({
          unit: q.unit,
          description: q.description || q.title,
          verificationMethod: q.verificationMethod,
        }));
      } else if (primaryType === 'milestone' && milestoneQuests.length > 0) {
        goalData.scheduleMethod = 'milestone';
        goalData.quests = milestoneQuests.map(q => ({
          title: q.title,
          targetValue: q.targetValue,
          description: q.description || q.title,
          verificationMethod: q.verificationMethod,
        }));
        goalData.totalSteps = milestoneQuests.length;
        goalData.currentStepIndex = 0;
        goalData.overallTarget = milestoneQuests[milestoneQuests.length - 1]?.targetValue || 100;
        goalData.config = {
          rewardPerStep: Math.floor(goalData.overallTarget / milestoneQuests.length),
          maxFails: Math.max(1, Math.floor(milestoneQuests.length / 2)),
        };
      }

      await createGoal(goalData);
      onGoalCreated();
    } catch (error) {
      console.error('[ManualGoalCreator] Failed to create goal:', error);
      alert('목표 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const getQuestTypeLabel = (type: QuestType) => {
    switch (type) {
      case 'schedule': return '스케줄형';
      case 'frequency': return '빈도형';
      case 'milestone': return '마일스톤형';
    }
  };

  const getQuestTypeColor = (type: QuestType) => {
    switch (type) {
      case 'schedule': return '#3B82F6';
      case 'frequency': return '#10B981';
      case 'milestone': return '#8B5CF6';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView 
        className="flex-1" 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center justify-between">
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800">
            {step === 'basic' ? '기본 정보' : '퀘스트 추가'}
          </Text>
          <TouchableOpacity onPress={step === 'basic' ? () => setStep('quests') : handleSaveGoal} disabled={isSaving}>
            <Text className="text-blue-500 font-medium">
              {step === 'basic' ? '다음' : isSaving ? '저장중...' : '완료'}
            </Text>
          </TouchableOpacity>
        </View>

        {step === 'basic' ? (
          <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
            {/* Goal Title */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">목표 제목 *</Text>
              <TextInput
                value={goalTitle}
                onChangeText={setGoalTitle}
                placeholder="예: 한 달 안에 5kg 감량하기"
                className="border border-gray-300 rounded-lg px-4 py-3 bg-white"
              />
            </View>

            {/* Goal Description */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">목표 설명</Text>
              <TextInput
                value={goalDescription}
                onChangeText={setGoalDescription}
                placeholder="목표에 대한 자세한 설명"
                className="border border-gray-300 rounded-lg px-4 py-3 bg-white"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Date Range */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">기간 *</Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2025-01-01"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-3 bg-white"
                />
                <Text className="py-3">~</Text>
                <TextInput
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="2025-01-31"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-3 bg-white"
                />
              </View>
            </View>

            {/* Tags */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">태그</Text>
              <View className="flex-row gap-2 mb-2">
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder="태그 입력"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-3 bg-white"
                  onSubmitEditing={handleAddTag}
                />
                <TouchableOpacity onPress={handleAddTag} className="bg-blue-500 rounded-lg px-4 justify-center">
                  <Text className="text-white font-medium">추가</Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {tags.map(tag => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => handleRemoveTag(tag)}
                    className="bg-blue-100 rounded-full px-3 py-1 flex-row items-center"
                  >
                    <Text className="text-blue-700 text-sm mr-1">{tag}</Text>
                    <Ionicons name="close-circle" size={16} color="#1E40AF" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        ) : (
          <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
            {/* Quest Type Selection */}
            <View className="mb-4">
              <Text className="text-base font-semibold text-gray-800 mb-3">퀘스트 유형 선택</Text>
              <View className="gap-3">
                <TouchableOpacity
                  onPress={() => handleStartAddQuest('schedule')}
                  className="bg-white border-2 border-blue-200 rounded-lg p-4"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="calendar" size={24} color="#3B82F6" />
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-semibold text-gray-800">스케줄형</Text>
                      <Text className="text-sm text-gray-600">특정 날짜와 시간에 실행</Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color="#3B82F6" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleStartAddQuest('frequency')}
                  className="bg-white border-2 border-green-200 rounded-lg p-4"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="repeat" size={24} color="#10B981" />
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-semibold text-gray-800">빈도형</Text>
                      <Text className="text-sm text-gray-600">주당 횟수로 관리</Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color="#10B981" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleStartAddQuest('milestone')}
                  className="bg-white border-2 border-purple-200 rounded-lg p-4"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="flag" size={24} color="#8B5CF6" />
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-semibold text-gray-800">마일스톤형</Text>
                      <Text className="text-sm text-gray-600">단계별 목표 달성</Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color="#8B5CF6" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quest List */}
            {quests.length > 0 && (
              <View className="mb-4">
                <Text className="text-base font-semibold text-gray-800 mb-3">
                  추가된 퀘스트 ({quests.length})
                </Text>
                {quests.map((quest, index) => (
                  <View
                    key={quest.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 mb-3"
                  >
                    <View className="flex-row items-start justify-between mb-2">
                      <View className="flex-1">
                        <View className="flex-row items-center mb-1">
                          <View
                            className="rounded-full px-2 py-0.5"
                            style={{ backgroundColor: getQuestTypeColor(quest.type) + '20' }}
                          >
                            <Text className="text-xs font-medium" style={{ color: getQuestTypeColor(quest.type) }}>
                              {getQuestTypeLabel(quest.type)}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-base font-semibold text-gray-800">{quest.title}</Text>
                        {quest.description && (
                          <Text className="text-sm text-gray-600 mt-1">{quest.description}</Text>
                        )}
                      </View>
                      <View className="flex-row gap-2">
                        <TouchableOpacity onPress={() => handleEditQuest(quest)}>
                          <Ionicons name="pencil" size={20} color="#6B7280" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteQuest(quest.id)}>
                          <Ionicons name="trash" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {quests.length === 0 && (
              <View className="items-center py-8">
                <Ionicons name="list-outline" size={48} color="#D1D5DB" />
                <Text className="text-gray-400 mt-2">아직 추가된 퀘스트가 없습니다</Text>
                <Text className="text-gray-400 text-sm">위에서 유형을 선택하여 추가하세요</Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Add/Edit Quest Modal */}
        {showAddQuestModal && selectedQuestType && (
          <View className="absolute inset-0 bg-black/50">
            <View className="flex-1 justify-end">
              <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-lg font-semibold text-gray-800">
                    {editingQuest ? '퀘스트 수정' : `${getQuestTypeLabel(selectedQuestType)} 퀘스트 추가`}
                  </Text>
                  <TouchableOpacity onPress={() => setShowAddQuestModal(false)}>
                    <Ionicons name="close" size={24} color="#374151" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View className="mb-3">
                    <Text className="text-sm font-medium text-gray-700 mb-2">제목 *</Text>
                    <TextInput
                      value={questTitle}
                      onChangeText={setQuestTitle}
                      placeholder="퀘스트 제목"
                      className="border border-gray-300 rounded-lg px-4 py-3 bg-white"
                    />
                  </View>

                  <View className="mb-3">
                    <Text className="text-sm font-medium text-gray-700 mb-2">설명</Text>
                    <TextInput
                      value={questDescription}
                      onChangeText={setQuestDescription}
                      placeholder="퀘스트 설명"
                      className="border border-gray-300 rounded-lg px-4 py-3 bg-white"
                      multiline
                      numberOfLines={2}
                      textAlignVertical="top"
                    />
                  </View>

                  {selectedQuestType === 'schedule' && (
                    <>
                      <View className="mb-3">
                        <Text className="text-sm font-medium text-gray-700 mb-2">날짜 *</Text>
                        <TextInput
                          value={questDate}
                          onChangeText={setQuestDate}
                          placeholder="2025-01-15"
                          className="border border-gray-300 rounded-lg px-4 py-3 bg-white"
                        />
                      </View>
                      <View className="mb-3">
                        <Text className="text-sm font-medium text-gray-700 mb-2">시간 *</Text>
                        <TextInput
                          value={questTime}
                          onChangeText={setQuestTime}
                          placeholder="09:00"
                          className="border border-gray-300 rounded-lg px-4 py-3 bg-white"
                        />
                      </View>
                    </>
                  )}

                  {selectedQuestType === 'frequency' && (
                    <View className="mb-3">
                      <Text className="text-sm font-medium text-gray-700 mb-2">회차 *</Text>
                      <TextInput
                        value={questUnit}
                        onChangeText={setQuestUnit}
                        placeholder="1"
                        keyboardType="number-pad"
                        className="border border-gray-300 rounded-lg px-4 py-3 bg-white"
                      />
                    </View>
                  )}

                  {selectedQuestType === 'milestone' && (
                    <View className="mb-3">
                      <Text className="text-sm font-medium text-gray-700 mb-2">목표 값 *</Text>
                      <TextInput
                        value={questTargetValue}
                        onChangeText={setQuestTargetValue}
                        placeholder="100"
                        keyboardType="number-pad"
                        className="border border-gray-300 rounded-lg px-4 py-3 bg-white"
                      />
                    </View>
                  )}

                  <View className="mb-4">
                    <Text className="text-sm font-medium text-gray-700 mb-2">검증 방법 *</Text>
                    <View className="flex-row gap-2">
                      {(['camera', 'location', 'manual'] as const).map(method => (
                        <TouchableOpacity
                          key={method}
                          onPress={() => setQuestVerification(method)}
                          className={`flex-1 border-2 rounded-lg p-3 ${
                            questVerification === method ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                          }`}
                        >
                          <Text className={`text-center text-sm font-medium ${
                            questVerification === method ? 'text-blue-700' : 'text-gray-700'
                          }`}>
                            {method === 'camera' ? '사진' : method === 'location' ? '위치' : '수동'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleSaveQuest}
                    className="bg-blue-500 rounded-lg py-4"
                    disabled={!questTitle.trim()}
                  >
                    <Text className="text-white text-center font-semibold text-base">
                      {editingQuest ? '수정 완료' : '추가하기'}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

