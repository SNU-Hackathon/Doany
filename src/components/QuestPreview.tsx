import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { QuestService } from '../services/questService';
import { Quest } from '../types/quest';

interface QuestPreviewProps {
  goalData: any;
  userId: string;
}

export default function QuestPreview({ goalData, userId }: QuestPreviewProps) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.log('[QuestPreview] ===== COMPONENT RENDER =====');
  console.log('[QuestPreview] Component rendered with:', {
    hasGoalData: !!goalData,
    hasUserId: !!userId,
    goalDataKeys: goalData ? Object.keys(goalData) : [],
    goalType: goalData?.type,
    duration: goalData?.duration,
    frequency: goalData?.frequency,
    weeklyWeekdays: goalData?.weeklyWeekdays,
    weeklySchedule: goalData?.weeklySchedule,
    verificationMethods: goalData?.verificationMethods,
    targetLocation: goalData?.targetLocation,
    loading,
    error,
    questsCount: quests.length,
    questsPreview: quests.slice(0, 2).map(q => ({
      id: q.id,
      title: q.title,
      type: q.type,
      scheduledDate: q.scheduledDate,
      weekNumber: q.weekNumber
    }))
  });
  
  // goalData 상세 분석
  if (goalData) {
    console.log('[QuestPreview] GoalData 상세 분석:', {
      title: goalData.title,
      type: goalData.type,
      duration: goalData.duration,
      frequency: goalData.frequency,
      weeklyWeekdays: goalData.weeklyWeekdays,
      weeklySchedule: goalData.weeklySchedule,
      verificationMethods: goalData.verificationMethods,
      targetLocation: goalData.targetLocation
    });
    
    // 예상 퀘스트 개수 계산
    if (goalData.type === 'frequency' && goalData.duration && goalData.frequency) {
      const startDate = new Date(goalData.duration.startDate);
      const endDate = new Date(goalData.duration.endDate);
      const totalWeeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const targetPerWeek = goalData.frequency.count || 3;
      const expectedQuests = totalWeeks * targetPerWeek;
      
      console.log('[QuestPreview] 예상 퀘스트 개수:', {
        totalWeeks,
        targetPerWeek,
        expectedQuests,
        actualQuests: quests.length
      });
    }
  } else {
    console.log('[QuestPreview] ❌ goalData가 없습니다!');
  }

  console.log('[QuestPreview] Component mounted/updated at:', new Date().toISOString());

  useEffect(() => {
    console.log('[QuestPreview] useEffect triggered at:', new Date().toISOString());
    console.log('[QuestPreview] useEffect dependencies:', {
      goalDataExists: !!goalData,
      userIdExists: !!userId,
      goalDataTitle: goalData?.title,
      goalDataType: goalData?.type
    });
    
    if (!goalData || !userId) {
      console.log('[QuestPreview] Missing goalData or userId, skipping quest generation');
      console.log('[QuestPreview] goalData:', goalData);
      console.log('[QuestPreview] userId:', userId);
      return;
    }

    console.log('[QuestPreview] Starting quest generation process...');
    
    // Always generate fallback quests first for immediate display
    console.log('[QuestPreview] Generating fallback quests...');
    const fallbackQuests = generateFallbackQuests();
    console.log('[QuestPreview] Generated', fallbackQuests.length, 'fallback quests');
    setQuests(fallbackQuests);
    
    // Then try to generate AI quests
    console.log('[QuestPreview] Starting AI quest generation...');
    generateQuests();
  }, [goalData, userId]);

  const generateQuests = async () => {
    console.log('[QuestPreview] ===== AI QUEST GENERATION START =====');
    console.log('[QuestPreview] Starting AI quest generation at:', new Date().toISOString());
    console.log('[QuestPreview] Goal data for AI generation:', {
      title: goalData?.title,
      type: goalData?.type,
      duration: goalData?.duration,
      frequency: goalData?.frequency,
      weeklyWeekdays: goalData?.weeklyWeekdays,
      verificationMethods: goalData?.verificationMethods
    });
    setLoading(true);
    setError(null);

    try {
      console.log('[QuestPreview] Calling QuestService.generateQuestsForPreview...');
      console.log('[QuestPreview] Parameters:', {
        goalData: goalData,
        userId: userId
      });
      
      // Generate quests using AI (preview only, no saving)
      const generatedQuests = await QuestService.generateQuestsForPreview(
        goalData,
        userId
      );
      
      console.log('[QuestPreview] ===== AI QUEST GENERATION SUCCESS =====');
      console.log('[QuestPreview] QuestService returned:', generatedQuests?.length, 'quests');
      console.log('[QuestPreview] Generated quests:', generatedQuests);

      console.log('[QuestPreview] AI generated quests:', generatedQuests.length);
      
      // Compare with fallback quests
      console.log('[QuestPreview] Quest comparison:', {
        fallbackCount: quests.length,
        aiCount: generatedQuests.length,
        fallbackTypes: quests.map(q => q.type),
        aiTypes: generatedQuests.map(q => q.type),
        fallbackSchedules: quests.map(q => q.scheduledDate || q.weekNumber),
        aiSchedules: generatedQuests.map(q => q.scheduledDate || q.weekNumber),
        fallbackTitles: quests.slice(0, 3).map(q => q.title),
        aiTitles: generatedQuests.slice(0, 3).map(q => q.title)
      });
      
      // Validate AI quest structure
      if (generatedQuests.length > 0) {
        console.log('[QuestPreview] AI quest validation:', {
          firstQuest: {
            id: generatedQuests[0].id,
            title: generatedQuests[0].title,
            type: generatedQuests[0].type,
            weekNumber: generatedQuests[0].weekNumber,
            scheduledDate: generatedQuests[0].scheduledDate,
            verificationRules: generatedQuests[0].verificationRules?.length || 0
          },
          allTypes: [...new Set(generatedQuests.map(q => q.type))],
          weekNumbers: [...new Set(generatedQuests.map(q => q.weekNumber).filter(w => w !== undefined))],
          scheduledDates: [...new Set(generatedQuests.map(q => q.scheduledDate).filter(d => d !== undefined))]
        });
      }
      
      // Only update if we got valid quests
      if (generatedQuests && generatedQuests.length > 0) {
        setQuests(generatedQuests);
        console.log('[QuestPreview] Updated with AI quests');
      } else {
        console.log('[QuestPreview] AI returned empty quests, keeping fallback');
      }

    } catch (err) {
      console.error('[QuestPreview] ===== AI QUEST GENERATION ERROR =====');
      console.error('[QuestPreview] Error generating AI quests:', err);
      console.error('[QuestPreview] Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        goalData: {
          title: goalData?.title,
          type: goalData?.type,
          duration: goalData?.duration,
          frequency: goalData?.frequency
        },
        userId: userId
      });
      
      // Check if it's a specific error type
      if (err instanceof Error) {
        if (err.message.includes('AI_QUEST_GENERATION_ERROR')) {
          console.error('[QuestPreview] AI quest generation failed, keeping fallback quests');
        } else if (err.message.includes('QUEST_GENERATION_ERROR')) {
          console.error('[QuestPreview] Quest service error, keeping fallback quests');
        } else {
          console.error('[QuestPreview] Unknown error type:', err.message);
        }
      }
      
      setError(err instanceof Error ? err.message : 'AI 퀘스트 생성 중 오류가 발생했습니다');
      
      // Keep existing fallback quests, don't replace them
      console.log('[QuestPreview] Keeping existing fallback quests');
    } finally {
      console.log('[QuestPreview] ===== AI QUEST GENERATION END =====');
      setLoading(false);
    }
  };

  const generateFallbackQuests = (): Quest[] => {
    console.log('[QuestPreview] ===== FALLBACK QUEST GENERATION START =====');
    console.log('[QuestPreview] Generating fallback quests for goal type:', goalData?.type);
    console.log('[QuestPreview] Goal data for fallback:', {
      title: goalData?.title,
      type: goalData?.type,
      duration: goalData?.duration,
      frequency: goalData?.frequency,
      weeklyWeekdays: goalData?.weeklyWeekdays
    });
    
    const fallbackQuests: Quest[] = [];
    
    if (goalData?.type === 'schedule') {
      console.log('[QuestPreview] Using schedule quest generation');
      // Schedule 타입: 특정 일정에 맞는 퀘스트 생성
      fallbackQuests.push(...generateScheduleQuests());
    } else if (goalData?.type === 'frequency') {
      console.log('[QuestPreview] Using frequency quest generation');
      // Frequency 타입: 주기와 빈도에 맞는 퀘스트 생성
      fallbackQuests.push(...generateFrequencyQuests());
    } else {
      console.log('[QuestPreview] Using default quest generation (type:', goalData?.type, ')');
      // 기본 타입: 일반적인 퀘스트 생성
      fallbackQuests.push(...generateDefaultQuests());
    }
    
    console.log('[QuestPreview] ===== FALLBACK QUEST GENERATION END =====');
    console.log('[QuestPreview] Generated', fallbackQuests.length, 'fallback quests');
    console.log('[QuestPreview] Fallback quest titles:', fallbackQuests.map(q => q.title));
    return fallbackQuests;
  };

  const generateScheduleQuests = (): Quest[] => {
    const quests: Quest[] = [];
    
    // 목표 기간 계산
    const startDate = goalData?.duration?.startDate ? new Date(goalData.duration.startDate) : new Date();
    const endDate = goalData?.duration?.endDate ? new Date(goalData.duration.endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    // 요일별 스케줄 확인 (실제 formData 구조 사용)
    const weekdays = goalData?.weeklyWeekdays || [1, 3, 5]; // 월, 수, 금 기본값
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    
    console.log('[QuestPreview] Schedule quest generation:', {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      weekdays,
      totalDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    });
    
    let questIndex = 1;
    let currentDate = new Date(startDate);
    
    // 기간 동안 모든 스케줄된 날짜에 대해 퀘스트 생성
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      
      if (weekdays.includes(dayOfWeek)) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayName = dayNames[dayOfWeek];
        
        quests.push({
          id: `schedule_quest_${questIndex}`,
          goalId: 'preview',
          title: `${goalData?.title || '목표'} - ${dayName}요일`,
          description: `${dayName}요일에 ${goalData?.title || '목표'}를 수행합니다`,
          type: 'schedule',
          status: 'pending',
          scheduledDate: dateStr,
          verificationRules: generateVerificationRules(),
          createdAt: new Date().toISOString()
        });
        questIndex++;
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log('[QuestPreview] Generated', quests.length, 'schedule quests');
    return quests;
  };

  const generateFrequencyQuests = (): Quest[] => {
    console.log('[QuestPreview] ===== FREQUENCY QUEST GENERATION START =====');
    const quests: Quest[] = [];
    
    // 주기 설정 확인 (실제 formData 구조 사용)
    const frequency = goalData?.frequency || { count: 3, unit: 'per_week' };
    const targetPerWeek = frequency.count || 3;
    
    console.log('[QuestPreview] Frequency settings:', {
      frequency: frequency,
      targetPerWeek: targetPerWeek,
      goalDataFrequency: goalData?.frequency
    });
    
    // 목표 기간 계산
    const startDate = goalData?.duration?.startDate ? new Date(goalData.duration.startDate) : new Date();
    const endDate = goalData?.duration?.endDate ? new Date(goalData.duration.endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    // 총 주차 수 계산 (정확한 계산)
    const totalWeeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    console.log('[QuestPreview] Duration calculation:', {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      totalWeeks: totalWeeks
    });
    
    console.log('[QuestPreview] Frequency quest generation:', {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      targetPerWeek,
      totalWeeks,
      totalQuests: totalWeeks * targetPerWeek
    });
    
    let questIndex = 1;
    
    console.log('[QuestPreview] Starting quest generation loop...');
    // 각 주차별로 목표 빈도만큼 퀘스트 생성
    for (let week = 1; week <= totalWeeks; week++) {
      console.log(`[QuestPreview] Generating quests for week ${week}...`);
      for (let i = 1; i <= targetPerWeek; i++) {
        const questTitle = `${goalData?.title || '목표'} - ${week}주차 ${i}회차`;
        console.log(`[QuestPreview] Creating quest: ${questTitle}`);
        
        quests.push({
          id: `frequency_quest_${questIndex}`,
          goalId: 'preview',
          title: questTitle,
          description: `${week}주차 ${i}번째 ${goalData?.title || '목표'} 세션을 수행합니다`,
          type: 'frequency',
          status: 'pending',
          weekNumber: week,
          verificationRules: generateVerificationRules(),
          createdAt: new Date().toISOString()
        });
        questIndex++;
      }
    }
    
    console.log('[QuestPreview] ===== FREQUENCY QUEST GENERATION END =====');
    console.log('[QuestPreview] Generated', quests.length, 'frequency quests');
    console.log('[QuestPreview] Quest titles:', quests.map(q => q.title));
    return quests;
  };

  const generateDefaultQuests = (): Quest[] => {
    const quests: Quest[] = [];
    const questCount = 4;
    
    const questTitles = [
      `${goalData?.title || '목표'} 시작하기`,
      `${goalData?.title || '목표'} 진행하기`,
      `${goalData?.title || '목표'} 완성하기`,
      `${goalData?.title || '목표'} 마무리하기`
    ];
    
    const questDescriptions = [
      '목표 달성을 위한 첫 번째 단계를 시작합니다',
      '목표 달성을 위한 중간 단계를 진행합니다',
      '목표 달성을 위한 핵심 단계를 완성합니다',
      '목표 달성을 위한 마지막 단계를 마무리합니다'
    ];
    
    for (let i = 1; i <= questCount; i++) {
      quests.push({
        id: `default_quest_${i}`,
        goalId: 'preview',
        title: questTitles[i - 1],
        description: questDescriptions[i - 1],
        type: goalData?.type || 'frequency',
        status: 'pending',
        weekNumber: i,
        verificationRules: generateVerificationRules(),
        createdAt: new Date().toISOString()
      });
    }
    
    return quests;
  };

  const generateVerificationRules = () => {
    const rules = [];
    
    // 사용자가 선택한 인증 방법들 추가 (실제 formData 구조 사용)
    const verificationMethods = goalData?.verificationMethods || ['manual'];
    
    console.log('[QuestPreview] Generating verification rules for methods:', verificationMethods);
    
    verificationMethods.forEach(method => {
      rules.push({
        type: method,
        required: method === 'manual' ? true : false,
        config: getVerificationConfig(method)
      });
    });
    
    // 기본적으로 manual 인증은 항상 포함
    if (!verificationMethods.includes('manual')) {
      rules.push({
        type: 'manual',
        required: true,
        config: {}
      });
    }
    
    return rules;
  };

  const getVerificationConfig = (method: string) => {
    switch (method) {
      case 'location':
        return goalData?.targetLocation ? {
          location: {
            name: goalData.targetLocation.name,
            coordinates: goalData.targetLocation.coordinates,
            radius: 100
          }
        } : {};
      case 'photo':
        return { exifValidation: true };
      case 'time':
        return {
          time: {
            window: {
              start: '09:00',
              end: '18:00'
            },
            tolerance: 15
          }
        };
      default:
        return {};
    }
  };

  const getScheduleDisplay = (quest: Quest): string => {
    if (quest.type === 'schedule' && quest.scheduledDate) {
      // Schedule 타입: 특정 날짜 표시
      const date = new Date(quest.scheduledDate);
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = dayNames[date.getDay()];
      const month = date.getMonth() + 1;
      const day = date.getDate();
      
      return `${month}/${day} (${dayName})`;
    } else if (quest.type === 'frequency' && quest.weekNumber) {
      // Frequency 타입: 주차와 회차 표시
      const title = quest.title || '';
      const weekMatch = title.match(/(\d+)주차 (\d+)회차/);
      if (weekMatch) {
        const week = weekMatch[1];
        const session = weekMatch[2];
        return `${week}주차 ${session}회차`;
      }
      return `${quest.weekNumber}주차`;
    } else if (quest.weekNumber) {
      // 일반적인 주차 표시
      return `${quest.weekNumber}주차`;
    } else {
      return '일정 미정';
    }
  };

  const getTimeDisplay = (quest: Quest): string => {
    if (quest.type === 'schedule' && quest.scheduledDate) {
      const date = new Date(quest.scheduledDate);
      const dayOfWeek = date.getDay();
      
      // 해당 요일의 시간 설정 확인 (실제 formData 구조 사용)
      const weeklySchedule = goalData?.weeklySchedule as any;
      if (weeklySchedule && weeklySchedule[dayOfWeek]) {
        const times = weeklySchedule[dayOfWeek];
        if (Array.isArray(times) && times.length > 0) {
          return times.join(', ');
        }
      }
    }
    return '시간 미정';
  };

  const getVerificationMethodName = (type: string): string => {
    switch (type) {
      case 'location': return '위치';
      case 'photo': return '사진';
      case 'time': return '시간';
      case 'manual': return '수동';
      case 'partner': return '파트너';
      case 'screentime': return '화면시간';
      default: return type;
    }
  };

  const getVerificationIcon = (type: string) => {
    switch (type) {
      case 'location': return 'location-outline';
      case 'photo': return 'camera-outline';
      case 'time': return 'time-outline';
      case 'manual': return 'hand-right-outline';
      case 'partner': return 'people-outline';
      case 'screentime': return 'phone-portrait-outline';
      default: return 'checkmark-circle-outline';
    }
  };

  console.log('[QuestPreview] Rendering state:', { loading, error, questsCount: quests.length });

  if (loading) {
    console.log('[QuestPreview] Rendering loading state');
    return (
      <View style={styles.container}>
        <Text style={styles.title}>퀘스트 미리보기</Text>
        <View style={styles.loadingContainer}>
          <Ionicons name="sparkles" size={24} color="#059669" />
          <Text style={styles.loadingText}>AI가 퀘스트를 생성하는 중...</Text>
        </View>
        <Text style={styles.footer}>
          * 현재 폴백 퀘스트를 표시 중입니다
        </Text>
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
      
      {/* Quest list with detailed information */}
      {quests.map((quest, index) => (
        <View key={quest.id || index} style={styles.questItem}>
          <View style={styles.questHeader}>
            <Text style={styles.questTitle}>{quest.title}</Text>
            <View style={styles.questBadge}>
              <Text style={styles.questBadgeText}>{quest.type}</Text>
            </View>
          </View>
          
          {quest.description && (
            <Text style={styles.questDescription}>{quest.description}</Text>
          )}
          
          <View style={styles.questMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>
                {getScheduleDisplay(quest)}
              </Text>
            </View>
            
            {quest.type === 'schedule' && goalData?.weeklySchedule && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color="#6B7280" />
                <Text style={styles.metaText}>
                  {getTimeDisplay(quest)}
                </Text>
              </View>
            )}
            
            <View style={styles.metaItem}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>
                {quest.verificationRules?.length || 0}개 인증 방법
              </Text>
            </View>
          </View>
          
          {quest.verificationRules && quest.verificationRules.length > 0 && (
            <View style={styles.verificationRules}>
              {quest.verificationRules.map((rule, ruleIndex) => (
                <View key={ruleIndex} style={styles.verificationRule}>
                  <Ionicons 
                    name={getVerificationIcon(rule.type)} 
                    size={12} 
                    color="#10B981" 
                  />
                  <Text style={styles.verificationRuleText}>{getVerificationMethodName(rule.type)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
      
      <Text style={styles.footer}>
        {loading ? '* AI가 퀘스트를 생성하는 중...' : 
         error ? '* AI 생성 실패, 폴백 퀘스트 표시 중' :
         '* AI가 목표에 맞게 생성한 퀘스트 미리보기'}
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
  questItem: {
    backgroundColor: 'white',
    padding: 16,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    marginBottom: 8,
  },
  questTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  questBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  questBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2563eb',
    textTransform: 'capitalize',
  },
  questDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 12,
    lineHeight: 20,
  },
  questMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  verificationRules: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  verificationRule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  verificationRuleText: {
    fontSize: 11,
    color: '#059669',
    marginLeft: 3,
    textTransform: 'capitalize',
  },
});
