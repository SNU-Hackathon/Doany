// Main chatbot interface for goal creation with embedded controls

import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { formatGoalTypeConfirmation, generateNextQuestionWithAI, useChatbotState } from '../../features/createGoal/chatbotState';
import { useAuth } from '../../hooks/useAuth';
import { AIService } from '../../services/ai';
import { GoalService } from '../../services/goalService';
import { CreateGoalForm } from '../../types';
import { EmbeddedWidget, SlotValue } from '../../types/chatbot';
import {
  AdvancedCalendarWidget,
  ChipsWidget,
  CounterWidget,
  TimePickerWidget,
  ToggleWidget,
  WeekdaysWidget
} from './EmbeddedWidgets';

interface ChatbotCreateGoalProps {
  onGoalCreated: (goalData: any) => void;
  onClose: () => void;
}

export default function ChatbotCreateGoal({ onGoalCreated, onClose }: ChatbotCreateGoalProps) {
  const { state, actions } = useChatbotState();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<'goalType' | 'verification' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAllQuests, setShowAllQuests] = useState(false);
  const [lastQuestionTime, setLastQuestionTime] = useState<number>(0);
  const nextQuestionTimer = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [state.messages]);

  // Initial welcome message
  useEffect(() => {
    if (state.messages.length === 0) {
      actions.addMessage('안녕하세요! 새로운 목표를 만들어보겠습니다. 어떤 목표를 달성하고 싶으신가요?', 'assistant');
    }
  }, []);

  // Auto-generate next question when pendingSlots change
  useEffect(() => {
    const runEffect = async () => {
      console.log('[ChatbotCreateGoal] useEffect triggered:', {
        awaitingConfirmation,
        isComplete: state.isComplete,
        pendingSlotsLength: state.pendingSlots.length,
        pendingSlots: state.pendingSlots,
        currentGoalType: state.currentGoalType,
        collectedSlotsKeys: Object.keys(state.collectedSlots),
        collectedSlots: state.collectedSlots,
        lastQuestionTime,
        timeSinceLastQuestion: Date.now() - lastQuestionTime
      });

      // 🔥 핵심: useEffect 시작 시 항상 이전 타이머를 취소
      clearTimeout(nextQuestionTimer.current!);

      // Don't auto-generate if we're waiting for confirmation or if complete
      if (awaitingConfirmation) {
        console.log('[ChatbotCreateGoal] Skipping: awaiting confirmation');
        return;
      }
      if (state.isComplete) {
        console.log('[ChatbotCreateGoal] Skipping: goal is complete');
        return;
      }

      // 모든 슬롯이 채워졌으면 퀘스트 생성
      if (state.pendingSlots.length === 0) {
        if (state.currentGoalType && !state.isComplete) {
          // 퀘스트 생성 예약
          nextQuestionTimer.current = setTimeout(() => {
            generateAndShowQuests();
          }, 300);
        }
        return;
      }

      // 🚫 자동 질문 생성 비활성화 - 사용자가 답변할 때까지 기다림
      // AI가 컨텍스트를 기반으로 적절한 질문을 생성하도록 함
      console.log('[ChatbotCreateGoal] Skipping auto-question generation - waiting for user response');
    };

    runEffect();
  }, [
    state.pendingSlots,
    state.currentGoalType,
    awaitingConfirmation,
    state.isComplete,
    lastQuestionTime  // 의존성에 추가 - 스로틀 재평가 위해
  ]);

  // 안전한 질문 생성 함수 (AI 기반)
  const generateNextQuestionSafely = async (forceGenerate = false) => {
    console.log('[ChatbotCreateGoal] generateNextQuestionSafely called:', {
      forceGenerate,
      currentGoalType: state.currentGoalType,
      pendingSlots: state.pendingSlots,
      collectedSlots: state.collectedSlots
    });

    if (!state.currentGoalType || state.pendingSlots.length === 0) {
      console.log('[ChatbotCreateGoal] No goal type or pending slots, skipping question generation');
      return;
    }

    try {
      // Prepare conversation history for AI
      const conversationHistory = state.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Use AI to generate conversational question
      const { question, widgets, userState, extractedSchedule, conversationComplete, quests } = await generateNextQuestionWithAI(
        state.currentGoalType!,
        state.pendingSlots,
        state.collectedSlots,
        conversationHistory,
        state.userState
      );

      // Update user state if provided by AI
      if (userState) {
        actions.updateUserState(userState);
        console.log('[ChatbotCreateGoal] Updated user state:', userState);
      }

      // Process extracted schedule information if provided by AI
      if (extractedSchedule) {
        console.log('[ChatbotCreateGoal] Processing extracted schedule:', extractedSchedule);
        
        // Auto-populate slots with extracted schedule data
        if (extractedSchedule.weekdays && Array.isArray(extractedSchedule.weekdays)) {
          actions.updateSlot('weekdays', extractedSchedule.weekdays);
          console.log('[ChatbotCreateGoal] Auto-populated weekdays:', extractedSchedule.weekdays);
        }
        
        if (extractedSchedule.time) {
          actions.updateSlot('time', extractedSchedule.time);
          console.log('[ChatbotCreateGoal] Auto-populated time:', extractedSchedule.time);
        }
        
        if (extractedSchedule.weeklySchedule && typeof extractedSchedule.weeklySchedule === 'object') {
          actions.updateSlot('weeklySchedule', extractedSchedule.weeklySchedule);
          console.log('[ChatbotCreateGoal] Auto-populated weekly schedule:', extractedSchedule.weeklySchedule);
        }
      }

      // Check if conversation is complete and quests are provided
      if (conversationComplete && quests && quests.length > 0) {
        console.log('[ChatbotCreateGoal] AI completed conversation with quests:', quests);
        actions.markComplete(quests);
        actions.addMessage(
          `🎉 목표가 완성되었습니다! 총 ${quests.length}개의 맞춤형 퀘스트가 준비되었어요.`,
          'assistant'
        );
        return; // Don't add another question message
      }

      console.log('[ChatbotCreateGoal] AI Generated question:', {
        question,
        widgets: widgets.map(w => ({ type: w.type, slotId: w.slotId }))
      });

      // Auto-manage keyboard based on question type
      if (widgets && widgets.length > 0) {
        Keyboard.dismiss();
      }

      console.log('[ChatbotCreateGoal] Adding AI message with widgets:', {
        question,
        widgetCount: widgets.length,
        widgets: widgets.map(w => ({ type: w.type, slotId: w.slotId }))
      });

      actions.addMessage(question, 'assistant', widgets);
      setLastQuestionTime(Date.now());
    } catch (error) {
      console.error('[ChatbotCreateGoal] AI question generation failed:', error);
      actions.addMessage('죄송합니다. 잠시 후 다시 시도해주세요.', 'assistant');
    }
  };

  // Handle user input submission
  const handleUserInput = async () => {
    if (!userInput.trim()) return;

    const input = userInput.trim();
    setUserInput('');
    actions.addMessage(input, 'user');

    // Show typing indicator
    setIsTyping(true);

    try {
      // If no goal type is set, classify from title using AI
      if (!state.currentGoalType) {
        const goalType = await actions.classifyAndSetGoalType(input);
        
        // Store title in collected slots
        actions.updateSlot('title', input);
        
        // 즉시 확인 게이트 설정 - 레이스 컨디션 방지
        setAwaitingConfirmation('goalType');
        setIsTyping(false);
        const confirmationMessage = formatGoalTypeConfirmation(goalType);
        actions.addMessage(confirmationMessage, 'assistant');

        console.log('[CONFIRM.STATE] Set awaitingConfirmation=goalType immediately');
        return;
      }

      // Handle confirmation responses
      if (awaitingConfirmation === 'goalType') {
        const normalized = input.trim().toLowerCase();
        const isConfirmed =
          ['yes','y','yeah','yep'].some(t => normalized === t || normalized.includes(t)) ||
          ['네','예','맞아요','맞아','맞습니다','응'].some(t => input.includes(t));
        
        console.log('[CONFIRM.STATE] Parsing confirmation:', {
          input,
          normalized,
          isConfirmed
        });
        
        if (isConfirmed) {
          setAwaitingConfirmation(null);
          console.log('[CONFIRM.STATE] Cleared awaitingConfirmation - proceeding to next step');
          
          // 사용자 확인 후 다음 질문 생성 (AI 기반)
          setTimeout(async () => {
            console.log('[ChatbotCreateGoal] Generating next question after confirmation');
            await generateNextQuestionSafely(true); // 강제 생성
          }, 500); // 500ms 후 다음 질문 생성
        } else {
          // 부정/모호: 타입 선택 칩 제시
          actions.addMessage('어떤 유형의 목표인가요?', 'assistant', [
            {
              id: 'goaltype-selector',
              type: 'chips',
              slotId: 'goalType',
              label: '목표 유형 선택',
              props: { options: ['schedule', 'frequency', 'milestone'] },
              onSelect: () => {}
            }
          ]);
        }
        setIsTyping(false);
        return;
      }

      // Process other text inputs - next question will be auto-generated
      
    } catch (error) {
      console.error('Error processing user input:', error);
      setIsTyping(false);
      actions.addMessage('죄송합니다. 처리 중 오류가 발생했습니다. 다시 시도해주세요.', 'assistant');
    }
  };

  const proceedToNextQuestion = () => {
    setTimeout(() => {
      setIsTyping(false);
      
      if (state.isComplete) {
        // Generate quests and show review
        generateAndShowQuests();
        return;
      }

      if (state.currentGoalType && state.pendingSlots.length > 0) {
        // Use AI-based question generation instead of removed heuristic function
        actions.addMessage('목표에 대해 더 자세히 알려주세요.', 'assistant');
      }
    }, 1000);
  };

  const generateAndShowQuests = async () => {
    try {
      console.log('[GEN.END] Starting AI-based quest generation...');
      
      // Use AI to generate personalized quests
      const aiQuests = await AIService.generatePersonalizedQuests({
        goalType: state.currentGoalType!,
        goalTitle: String(state.collectedSlots.title || '목표'),
        collectedSlots: state.collectedSlots,
        userState: state.userState
      });

      if (aiQuests.length > 0) {
        console.log('[GEN.END] AI generated quests:', aiQuests);
        actions.markComplete(aiQuests);
        
        // Show quest preview message
        actions.addMessage(
          `🎉 목표가 완성되었습니다! 총 ${aiQuests.length}개의 맞춤형 퀘스트가 준비되었어요.`,
          'assistant'
        );
      } else {
        console.warn('[GEN.END] AI quest generation returned empty, using fallback');
        generateFallbackQuests();
      }
    } catch (error) {
      console.error('[GEN.END] AI quest generation failed:', error);
      generateFallbackQuests();
    }
  };

  // Fallback quest generation (simplified)
  const generateFallbackQuests = () => {
    const quests = generateMockQuests(state.currentGoalType!, state.collectedSlots);
    console.log('[GEN.END] Fallback quests generated:', quests);
    actions.markComplete(quests);
    
    actions.addMessage(
      `🎯 목표가 완성되었습니다! 총 ${quests.length}개의 퀘스트가 준비되었어요.`,
      'assistant'
    );
  };

  // Temporary mock quest generation
  const generateMockQuests = (goalType: string, slots: Record<string, any>) => {
    const baseTitle = String(slots.title || '목표');
    const period = slots.period as { startDate: string; endDate: string } | undefined;
    const verification = (slots.verification as string[]) || ['manual'];
    
    const quests = [];
    
    if (goalType === 'frequency') {
      const perWeek = Number(slots.perWeek) || 3;
      const weekCount = period ? 
        Math.ceil((new Date(period.endDate).getTime() - new Date(period.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)) : 2;
      
      for (let week = 1; week <= weekCount; week++) {
        for (let occurrence = 1; occurrence <= perWeek; occurrence++) {
          const questDate = period ? 
            new Date(new Date(period.startDate).getTime() + ((week - 1) * 7 + occurrence) * 24 * 60 * 60 * 1000) :
            new Date(Date.now() + ((week - 1) * 7 + occurrence) * 24 * 60 * 60 * 1000);
          
          quests.push({
            id: `freq-${week}-${occurrence}`,
            title: `${baseTitle} - ${week}주차 ${occurrence}회`,
            description: `${baseTitle} 목표를 달성하세요`,
            targetDate: questDate.toISOString().split('T')[0],
            verification
          });
        }
      }
    } else if (goalType === 'schedule') {
      const weekdays = (slots.weekdays as number[]) || [1, 3, 5];
      const time = String(slots.time || '09:00');
      
      if (period) {
        let currentDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);
        let questCount = 1;
        
        while (currentDate <= endDate && questCount <= 20) { // Limit to 20 quests
          const dayOfWeek = currentDate.getDay();
          
          if (weekdays.includes(dayOfWeek)) {
            quests.push({
              id: `schedule-${questCount}`,
              title: `${baseTitle} - ${currentDate.toLocaleDateString()}`,
              description: `${time}에 "${baseTitle}" 목표를 달성하세요`,
              targetDate: currentDate.toISOString().split('T')[0],
              verification
            });
            questCount++;
          }
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    } else if (goalType === 'milestone') {
      const milestones = (slots.milestones as string[]) || ['kickoff', 'mid', 'finish'];
      
      milestones.forEach((milestone, index) => {
        const targetDate = period ? 
          new Date(new Date(period.startDate).getTime() + (index / (milestones.length - 1)) * (new Date(period.endDate).getTime() - new Date(period.startDate).getTime())) :
          new Date(Date.now() + index * 7 * 24 * 60 * 60 * 1000);
          
        const labels: Record<string, string> = {
          kickoff: '시작',
          mid: '중간 점검', 
          finish: '완료'
        };
        
        quests.push({
          id: `milestone-${index + 1}`,
          title: `${baseTitle} - ${labels[milestone] || milestone}`,
          description: `"${baseTitle}" 목표의 ${labels[milestone] || milestone} 단계를 완료하세요`,
          targetDate: targetDate.toISOString().split('T')[0],
          verification
        });
      });
    }
    
    return quests;
  };

  // Handle widget selections
  const handleWidgetSelection = (slotId: string, value: SlotValue) => {
    console.log('[ChatbotCreateGoal] Widget selection START:', {
      slotId,
      value,
      valueType: typeof value,
      currentGoalType: state.currentGoalType,
      pendingSlots: state.pendingSlots,
      awaitingConfirmation,
      collectedSlotsKeys: Object.keys(state.collectedSlots)
    });

    // 위젯 확정 시 확인 상태 해제 폴백
    if (awaitingConfirmation === 'goalType') {
      setAwaitingConfirmation(null); // 사용자가 선택을 진행했으니 '예'로 간주
      console.log('[CONFIRM.STATE] Auto-clearing awaitingConfirmation due to widget interaction');
    }

    // 달력 선택 시 데이터 분리 처리
    if (slotId === 'period' && typeof value === 'object' && value) {
      const calendarData = value as any;

      // period 슬롯에는 기본 기간 정보만 저장
      const periodData = {
        startDate: calendarData.startDate,
        endDate: calendarData.endDate
      };
      actions.updateSlot('period', periodData);

      // schedule 타입인 경우 추가 데이터 저장
      if (state.currentGoalType === 'schedule') {
        if (calendarData.weeklySchedule) {
          actions.updateSlot('weeklySchedule', calendarData.weeklySchedule);
        }
        if (calendarData.weekdays) {
          actions.updateSlot('weekdays', calendarData.weekdays);
        }
      }

      console.log('[ChatbotCreateGoal] Calendar data processed:', {
        periodData,
        weeklySchedule: calendarData.weeklySchedule,
        weekdays: calendarData.weekdays,
        currentGoalType: state.currentGoalType
      });
    } else {
      // 일반적인 슬롯 업데이트
      actions.updateSlot(slotId, value);
    }

    console.log('[ChatbotCreateGoal] After updateSlot - checking state changes...');
    
    // Show user selection as a message with better formatting
    const displayValue = formatSelectionDisplay(slotId, value);
    actions.addMessage(displayValue, 'user');

    // 사용자 응답 후 다음 질문 생성 (AI 기반)
    setTimeout(async () => {
      console.log('[ChatbotCreateGoal] Generating next question after user response');
      await generateNextQuestionSafely(true); // 강제 생성
    }, 500); // 500ms 후 다음 질문 생성
    
    console.log('[ChatbotCreateGoal] Widget selection completed, next question will be generated');
  };

  // Format selection display for better UX
  const formatSelectionDisplay = (slotId: string, value: SlotValue): string => {
    console.log('[SLOT.UPDATE] Formatting display for:', { slotId, value, valueType: typeof value });
    
    switch (slotId) {
      case 'period':
        if (typeof value === 'object' && value && 'startDate' in value) {
          const period = value as { startDate: string; endDate: string };
          return `📅 ${period.startDate} ~ ${period.endDate}`;
        }
        return `📅 ${String(value)}`;
      
      case 'weekdays':
        if (Array.isArray(value)) {
          const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
          const selectedNames = (value as number[]).map(day => weekdayNames[day]).join('/');
          return `📆 ${selectedNames}`;
        }
        return `📆 ${String(value)}`;
      
      case 'time':
        return `🕐 ${String(value)}`;
      
      case 'perWeek':
        return `🎯 주 ${value}회`;
      
      case 'verification':
        if (Array.isArray(value)) {
          return `✅ ${(value as string[]).join(', ')}`;
        }
        return `✅ ${String(value)}`;
        
      case 'successRate':
        return `📊 목표 달성률 ${value}%`;
      
      case 'milestones':
        if (Array.isArray(value)) {
          return `🎯 단계: ${(value as string[]).join(', ')}`;
        }
        return `🎯 ${String(value)}`;
      
      default:
        if (Array.isArray(value)) {
          return `선택: ${value.join(', ')}`;
        }
        if (typeof value === 'object' && value !== null) {
          // Handle complex objects by showing key properties
          const obj = value as any;
          if (obj.startDate && obj.endDate) {
            return `📅 ${obj.startDate} ~ ${obj.endDate}`;
          }
          return `선택: ${JSON.stringify(value).substring(0, 50)}...`;
        }
        return `선택: ${String(value)}`;
    }
  };

  // Handle goal type selection from chips
  const handleGoalTypeSelection = (goalType: string) => {
    actions.setGoalType(goalType as 'schedule' | 'frequency' | 'milestone');
    actions.addMessage(`선택: ${goalType}`, 'user');
    setAwaitingConfirmation(null);
    // Next question will be auto-generated by useEffect
  };

  // Render embedded widgets
  const renderWidget = (widget: EmbeddedWidget) => {
    console.log('[ChatbotCreateGoal] Rendering widget:', {
      type: widget.type,
      slotId: widget.slotId,
      label: widget.label
    });
    
    const commonProps = {
      label: widget.label,
      value: state.collectedSlots[widget.slotId],
      onSelect: (value: SlotValue) => {
        if (widget.slotId === 'goalType') {
          handleGoalTypeSelection(String(value));
        } else {
          handleWidgetSelection(widget.slotId, value);
        }
      }
    };

    switch (widget.type) {
      case 'calendar':
        // For schedule goals, pass auto-parsed data
        const calendarValue = state.currentGoalType === 'schedule' ? {
          autoWeeklySchedule: (() => {
            const weeklySchedule = state.collectedSlots.weeklySchedule;
            if (!weeklySchedule) return {};
            
            // 이미 객체인 경우 그대로 사용
            if (typeof weeklySchedule === 'object') {
              return weeklySchedule;
            }
            
            // 문자열인 경우 JSON 파싱 시도
            if (typeof weeklySchedule === 'string') {
              try {
                return JSON.parse(weeklySchedule);
              } catch (error) {
                console.warn('[ChatbotCreateGoal] Failed to parse weeklySchedule:', error);
                return {};
              }
            }
            
            return {};
          })(),
          autoWeekdays: (state.collectedSlots.weekdays as number[]) || []
        } as SlotValue : commonProps.value;
        
        return (
          <AdvancedCalendarWidget 
            key={widget.id} 
            {...commonProps}
            value={calendarValue}
            goalType={state.currentGoalType || 'frequency'}
            {...widget.props} 
          />
        );
      case 'chips':
        return <ChipsWidget key={widget.id} {...commonProps} {...widget.props} />;
      case 'toggle':
        return <ToggleWidget key={widget.id} {...commonProps} {...widget.props} />;
      case 'counter':
        return <CounterWidget key={widget.id} {...commonProps} {...widget.props} />;
      case 'timePicker':
        return <TimePickerWidget key={widget.id} {...commonProps} {...widget.props} />;
      case 'weekdays':
        return <WeekdaysWidget key={widget.id} {...commonProps} {...widget.props} />;
      default:
        return null;
    }
  };

  // Handle save goal
  const handleSaveGoal = async () => {
    if (!state.questPreview || !user) {
      console.error('[SAVE.FAIL] Cannot save goal: missing quest preview or user');
      return;
    }

    setIsSaving(true);
    
    try {
      console.log('[SAVE.SUCCESS] Starting goal save process...');
      
      // Convert collected slots to CreateGoalForm format
      const goalFormData: CreateGoalForm & { userId: string } = {
        userId: user.id,
        title: String(state.collectedSlots.title || ''),
        description: `${state.currentGoalType} 목표`,
        category: 'personal', // Default category
        type: state.currentGoalType,
        verificationMethods: (state.collectedSlots.verification as any[]) || ['manual'],
        
        // Add success rate
        successRate: Number(state.collectedSlots.successRate) || 80,
        
        // Handle period data
        duration: (() => {
          const period = state.collectedSlots.period as { startDate: string; endDate: string };
          if (period) {
            return {
              type: 'range' as const,
              startDate: period.startDate,
              endDate: period.endDate
            };
          }
          return {
            type: 'weeks' as const,
            value: 2
          };
        })(),
        
        // Handle frequency data
        frequency: (() => {
          if (state.currentGoalType === 'frequency') {
            return {
              count: Number(state.collectedSlots.perWeek) || 3,
              unit: 'per_week' as const,
              targetPerWeek: Number(state.collectedSlots.perWeek) || 3
            };
          }
          return {
            count: 1,
            unit: 'per_day' as const
          };
        })(),
        
        // Handle schedule data differently based on goal type
        weeklyWeekdays: (() => {
          if (state.currentGoalType === 'schedule') {
            // Get weekdays from period data if it includes schedule info
            const period = state.collectedSlots.period as any;
            if (period && period.weekdays) {
              return period.weekdays;
            }
            return (state.collectedSlots.weekdays as number[]) || [];
          }
          return [];
        })(),
        
        // Handle weekly schedule for schedule goals
        weeklySchedule: (() => {
          if (state.currentGoalType === 'schedule') {
            const period = state.collectedSlots.period as any;
            if (period && period.weeklySchedule) {
              return period.weeklySchedule;
            }
            return (state.collectedSlots.weeklySchedule as any) || {};
          }
          return {};
        })(),
          
        // Handle milestones
        milestones: state.currentGoalType === 'milestone' 
          ? {
              milestones: (state.collectedSlots.milestones as string[] || ['kickoff', 'mid', 'finish']).map((key, index) => ({
                key,
                label: key === 'kickoff' ? '시작' : key === 'mid' ? '중간 점검' : '완료',
                targetDate: undefined
              })),
              totalDuration: 8
            }
          : undefined
      };

      console.log('[SAVE.SUCCESS] Goal data prepared:', goalFormData);

      // Save to database
      const goalId = await GoalService.createGoal(goalFormData);
      
      console.log('[SAVE.SUCCESS] Goal saved successfully with ID:', goalId);
      
      // Quests will be generated automatically when user views Goal Detail
      // This improves goal creation performance and prevents save errors
      
      // Show success message
      actions.addMessage('🎉 목표가 성공적으로 저장되었습니다! Goals 화면에서 확인하실 수 있습니다.', 'assistant');
      
      // Notify parent component with goal data
      const savedGoalData = {
        id: goalId,
        ...goalFormData,
        quests: state.questPreview
      };
      
      console.log('[GOALS.REFRESH] Triggering goals list refresh with:', savedGoalData);
      onGoalCreated(savedGoalData);
      
      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (error) {
      console.error('[SAVE.FAIL] Error saving goal:', error);
      actions.addMessage('❌ 목표 저장 중 오류가 발생했습니다. 다시 시도해주세요.', 'assistant');
    } finally {
      setIsSaving(false);
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
          <Text className="text-lg font-semibold text-gray-800">새 목표 만들기</Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-blue-500 font-medium">닫기</Text>
          </TouchableOpacity>
        </View>

      {/* Chat Messages */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4 py-4"
        showsVerticalScrollIndicator={false}
      >
        {state.messages.map((message) => (
          <View
            key={message.id}
            className={`mb-4 ${message.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <View
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                message.role === 'user'
                  ? 'bg-blue-500'
                  : 'bg-white border border-gray-200'
              }`}
            >
              <Text
                className={`text-sm ${
                  message.role === 'user' ? 'text-white' : 'text-gray-800'
                }`}
              >
                {message.content}
              </Text>
            </View>

            {/* Render embedded widgets */}
            {message.widgets && message.widgets.length > 0 && (
              <View className="w-full mt-2">
                {message.widgets.map(renderWidget)}
              </View>
            )}
          </View>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <View className="items-start mb-4">
            <View className="bg-white border border-gray-200 px-4 py-3 rounded-2xl">
              <Text className="text-gray-500 text-sm">입력 중...</Text>
            </View>
          </View>
        )}

        {/* Quest Preview - Enhanced */}
        {state.isComplete && state.questPreview && (
          <View className="mt-4">
            <View className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <Text className="text-lg font-semibold text-green-800 mb-2">🎯 목표 생성 완료!</Text>
              <Text className="text-green-700 text-sm">
                "{String(state.collectedSlots.title)}" 목표가 성공적으로 생성되었습니다.
              </Text>
              <Text className="text-green-600 text-xs mt-1">
                총 {state.questPreview.length}개의 퀘스트가 준비되었습니다.
              </Text>
            </View>
            
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold text-gray-800">📋 퀘스트 목록</Text>
              {state.questPreview.length > 3 && (
                <TouchableOpacity
                  onPress={() => setShowAllQuests(!showAllQuests)}
                  className="bg-blue-100 px-3 py-1 rounded-full"
                >
                  <Text className="text-blue-600 text-sm font-medium">
                    {showAllQuests ? '접기' : `전체 ${state.questPreview.length}개 보기`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Show preview or all quests based on state */}
            {(showAllQuests ? state.questPreview : state.questPreview.slice(0, 3)).map((quest, index) => (
              <View key={index} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-800 text-base">{quest.title}</Text>
                    <Text className="text-gray-600 text-sm mt-1">{quest.description}</Text>
                    
                    <View className="flex-row items-center mt-2 space-x-3">
                      <Text className="text-blue-600 text-xs bg-blue-50 px-2 py-1 rounded">
                        📅 {quest.targetDate}
                      </Text>
                      <Text className="text-green-600 text-xs bg-green-50 px-2 py-1 rounded">
                        ✅ {quest.verification.join(', ')}
                      </Text>
                    </View>
                  </View>
                  
                  <View className="bg-blue-100 w-8 h-8 rounded-full items-center justify-center">
                    <Text className="text-blue-600 font-bold text-sm">{index + 1}</Text>
                  </View>
                </View>
              </View>
            ))}
            
            {/* Show remaining count if not expanded */}
            {!showAllQuests && state.questPreview.length > 3 && (
              <View className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                <Text className="text-gray-600 text-center text-sm">
                  그 외 {state.questPreview.length - 3}개의 퀘스트가 더 있습니다.
                </Text>
                <Text className="text-gray-500 text-center text-xs mt-1">
                  위의 "전체 보기" 버튼을 눌러 모든 퀘스트를 확인하세요.
                </Text>
              </View>
            )}
            
            {/* Action Buttons */}
            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={() => {
                  // Reset to allow editing
                  actions.reset();
                }}
                className="flex-1 bg-gray-100 py-3 px-6 rounded-lg border border-gray-300"
              >
                <Text className="text-gray-700 text-center font-medium">다시 만들기</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleSaveGoal}
                disabled={isSaving}
                className={`flex-1 py-3 px-6 rounded-lg ${
                  isSaving ? 'bg-gray-400' : 'bg-blue-500'
                }`}
              >
                <Text className="text-white text-center font-semibold">
                  {isSaving ? '⏳ 저장 중...' : '🚀 목표 저장하기'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

        {/* Input Area */}
        {!state.isComplete && (
          <View className="bg-white border-t border-gray-200 px-4 py-3" style={{ paddingBottom: Platform.OS === 'ios' ? 20 : 10 }}>
            <View className="flex-row items-center">
              <TextInput
                value={userInput}
                onChangeText={setUserInput}
                placeholder="메시지를 입력하세요..."
                className="flex-1 border border-gray-300 rounded-full px-4 py-2 mr-3"
                multiline
                onSubmitEditing={handleUserInput}
                returnKeyType="send"
              />
              <TouchableOpacity
                onPress={handleUserInput}
                disabled={!userInput.trim() || isTyping}
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  userInput.trim() && !isTyping ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <Text className="text-white text-lg">→</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
