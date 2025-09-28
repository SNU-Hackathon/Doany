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
      frequencyDetails: goalData?.frequency ? {
        count: goalData.frequency.count,
        unit: goalData.frequency.unit,
        type: typeof goalData.frequency,
        keys: Object.keys(goalData.frequency)
      } : null,
      weeklyWeekdays: goalData?.weeklyWeekdays,
      weeklySchedule: goalData?.weeklySchedule,
      verificationMethods: goalData?.verificationMethods,
      targetLocation: goalData?.targetLocation,
      loading,
      error,
      questsCount: quests.length,
      questsPreview: quests.slice(0, 5).map(q => ({ // Show more quests for debugging
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
    
    // Generate AI quests only - no fallback heuristics
    console.log('[QuestPreview] Starting AI quest generation (no fallbacks)...');
    setQuests([]); // Start with empty state
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
      
      // Use AI quests only - no fallback comparison
      if (generatedQuests && generatedQuests.length > 0) {
        // Limit to 100 quests maximum
        const limitedQuests = generatedQuests.slice(0, 100);
        
        console.log('[QuestPreview] AI quest generation successful:', {
          totalGenerated: generatedQuests.length,
          afterLimit: limitedQuests.length,
          questTitles: limitedQuests.map(q => q.title)
        });
        
        setQuests(limitedQuests);
        console.log('[QuestPreview] Updated with AI quests');
      } else {
        console.log('[QuestPreview] AI returned empty quests - showing empty state');
        setQuests([]);
        setError('AI가 퀘스트를 생성하지 못했습니다. 목표를 다시 작성해보세요.');
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
      
      // AI generation failed - show error to user instead of fallback
      console.log('[QuestPreview] AI quest generation failed - no fallbacks available');
      setQuests([]);
      setError('AI 퀘스트 생성에 실패했습니다. 목표를 다시 작성해보세요.');
    } finally {
      console.log('[QuestPreview] ===== AI QUEST GENERATION END =====');
      setLoading(false);
    }
  };

  // Fallback quest generation removed - AI-only approach

  // Schedule quest generation removed - AI-only approach

  // All fallback quest generation functions removed - AI-only approach

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
  console.log('[REVIEW.PROPS]', {
    totalCount: quests.length,
    firstThree: quests.slice(0, 3).map(q => ({
      title: q.title,
      weekNumber: q.weekNumber,
      scheduledDate: q.scheduledDate,
      type: q.type
    }))
  });

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
          * AI가 퀘스트를 생성하는 중...
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
        * AI가 목표에 맞게 생성한 퀘스트 미리보기 (최대 100개)
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
