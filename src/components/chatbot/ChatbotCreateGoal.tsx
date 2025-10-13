// Main chatbot interface for goal creation with embedded controls

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { formatGoalTypeConfirmation, generateNextQuestionWithAI, useChatbotState } from '../../features/createGoal/chatbotState';
import { useAuth } from '../../hooks/useAuth';
import { GoalSpecV2, SlotId } from '../../schemas/goalSpecV2';
import { AIService } from '../../services/ai';
import { createGoal } from '../../services/goalService';
import { normalize } from '../../services/normalize';
import { buildOccurrences, previewOccurrences } from '../../services/scheduleCompute';
import { EmbeddedWidget, SlotValue } from '../../types/chatbot';
import OccurrenceListComponent, { OccurrenceItem } from '../OccurrenceList';
import {
  CalendarWidget,
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
  const isGeneratingQuestion = useRef<boolean>(false);
  const [isGeneratingQuests, setIsGeneratingQuests] = useState(false);
  
  // === Quest generation phase tracking ===
  const [generationPhase, setGenerationPhase] = useState<'idle' | 'generating' | 'done'>('idle');

  // === NEW: GoalSpec V2 State Management ===
  const [specV2, setSpecV2] = useState<Partial<GoalSpecV2>>({
    version: 0,
    locale: 'ko-KR',
    timezone: 'Asia/Seoul'
  });
  const [occurrencePreview, setOccurrencePreview] = useState<OccurrenceItem[]>([]);
  const [showOccurrenceList, setShowOccurrenceList] = useState(false);
  
  // === DEBUG: Monitor state changes ===
  useEffect(() => {
    console.log('[STATE.CHANGE] Occurrence system state:', {
      showOccurrenceList,
      occurrencePreviewLength: occurrencePreview.length,
      specType: specV2.type,
      SHOULD_RENDER: showOccurrenceList && occurrencePreview.length > 0
    });
  }, [showOccurrenceList, occurrencePreview.length, specV2.type]);

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

  // Generate and show quests - useCallback to maintain reference
  const generateAndShowQuests = useCallback(async () => {
    console.log('[GEN.END] 🎯 generateAndShowQuests called, checking conditions...');
    console.log('[GEN.END] isGeneratingQuests:', isGeneratingQuests);
    console.log('[GEN.END] state.isComplete:', state.isComplete);
    console.log('[GEN.END] state.questPreview:', state.questPreview?.length || 0);
    
    // STRICT: Prevent duplicate quest generation
    if (isGeneratingQuests) {
      console.log('[GEN.END] ⛔ Already generating quests, BLOCKING duplicate call');
      return;
    }

    // Check if quests already generated (not just isComplete)
    if (state.questPreview && state.questPreview.length > 0) {
      console.log('[GEN.END] ⛔ Quests already generated, BLOCKING duplicate generation');
      return;
    }

    // Set flags FIRST to prevent any duplicate calls
    setIsGeneratingQuests(true);
    setGenerationPhase('generating');
    console.log('[GEN.START] 🔒 Set isGeneratingQuests = true, phase = generating');

    try {
      console.log('[GEN.END] 🚀 Starting AI-based quest generation...');
      console.log('[GEN.END] 📊 Full state:', {
        goalType: state.currentGoalType,
        collectedSlots: state.collectedSlots,
        userState: state.userState,
        pendingSlots: state.pendingSlots
      });
      
      // === B. COMPUTE targetCount based on goal type ===
      let targetCount = 10; // Default
      const period = state.collectedSlots.period as { startDate: string; endDate: string } | undefined;
      const successRate = Number(state.collectedSlots.successRate) || 80;
      
      if (period && period.startDate && period.endDate) {
        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        const weeks = Math.max(1, Math.ceil(daysDiff / 7));
        
        if (state.currentGoalType === 'frequency') {
          const perWeek = Number(state.collectedSlots.perWeek) || 3;
          const totalCount = weeks * perWeek;
          const requiredCount = Math.ceil(totalCount * successRate / 100);
          targetCount = requiredCount;
          
          console.log('[CONFIRM] 📊 Frequency goal calculation:', {
            weeks,
            perWeek,
            totalCount,
            successRate: successRate + '%',
            requiredCount,
            targetCount
          });
        } else if (state.currentGoalType === 'schedule') {
          const weekdays = (state.collectedSlots.weekdays as number[]) || [];
          targetCount = Math.min(weeks * weekdays.length, 15);
          
          console.log('[CONFIRM] 📊 Schedule goal calculation:', {
            weeks,
            weekdays,
            targetCount
          });
        } else if (state.currentGoalType === 'milestone') {
          const milestones = (state.collectedSlots.milestones as string[]) || ['시작', '중간', '완료'];
          targetCount = milestones.length;
          
          console.log('[CONFIRM] 📊 Milestone goal calculation:', {
            milestones,
            targetCount
          });
        }
      }
      
      // Clamp to reasonable range
      targetCount = Math.max(5, Math.min(targetCount, 15));
      console.log('[GEN.END] 🎯 Final targetCount:', targetCount);
      
      // Show loading indicator - CLEAR and VISIBLE
      setIsTyping(true);
      console.log('[GEN.END] 💬 Adding "생성 중..." message');
      actions.addMessage('🎨 퀘스트 생성 중입니다. 잠시만 기다려주세요...', 'assistant');
      
      // Small delay to ensure message is rendered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('[GEN.END] 🤖 Calling AIService.generatePersonalizedQuests...');
      
      // Create timeout promise (40 seconds for reliable generation)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Quest generation timeout after 40s')), 40000);
      });
      
      // === NEW: Use GoalSpecV2 if available, otherwise fallback to legacy ===
      const useV2 = specV2.type && specV2.title && specV2.period;
      
      let aiQuests;
      
      if (useV2) {
        console.log('[GEN.END] 🆕 Using GoalSpecV2 for quest generation');
        console.log('[GEN.END] 📊 SpecV2 details:', {
          type: specV2.type,
          hasOccurrences: !!specV2.schedule?.occurrences,
          occurrencesCount: specV2.schedule?.occurrences?.length || 0,
          firstOccurrence: specV2.schedule?.occurrences?.[0],
          verification: specV2.verification,
          successCriteria: specV2.successCriteria
        });
        
        // Race between AI generation and timeout
        aiQuests = await Promise.race([
          AIService.generatePersonalizedQuests({
            goalType: specV2.type!,
            goalTitle: specV2.title!,
            collectedSlots: {
              period: specV2.period,
              weekdays: specV2.schedule?.rules?.[0]?.byWeekday,
              time: specV2.schedule?.rules?.[0]?.time,
              occurrences: specV2.schedule?.occurrences, // ✅ 확정된 일정 전달
              perWeek: specV2.frequency?.targetPerWeek,
              milestones: specV2.milestone?.milestones,
              currentState: specV2.milestone?.currentState,
              verification: specV2.verification?.signals,
              successRate: specV2.successCriteria?.targetRate
            },
            userState: state.userState,
            targetCount,
            specV2 // ✅ 전체 spec 전달 (occurrences 포함)
          }),
          timeoutPromise
        ]);
        
        console.log('[GEN.END] 📝 AI returned:', aiQuests?.length || 0, 'quests');
      } else {
        console.log('[GEN.END] 📦 Using legacy collectedSlots for quest generation');
        
        // Race between AI generation and timeout
        aiQuests = await Promise.race([
          AIService.generatePersonalizedQuests({
            goalType: state.currentGoalType!,
            goalTitle: String(state.collectedSlots.title || '목표'),
            collectedSlots: state.collectedSlots,
            userState: state.userState,
            targetCount // Pass computed targetCount
          }),
          timeoutPromise
        ]);
      }

      console.log('[GEN.END] 🎉 AI response received:', aiQuests);
      setIsTyping(false);

      if (aiQuests && aiQuests.length > 0) {
        console.log('[GEN.END] ✅ AI generated', aiQuests.length, 'quests successfully');
        console.log('[GEN.END] 📝 Quest samples:', aiQuests.slice(0, 2));
        console.log('[GEN.END] 📝 All quest IDs:', aiQuests.map(q => q.id));
        console.log('[GEN.END] 📝 Calling markComplete with quests');
        
        // Mark complete with quests
        actions.markComplete(aiQuests);
        
        // Set phase to done BEFORE adding completion message
        setGenerationPhase('done');
        console.log('[GEN.END] ✅ Set generationPhase = done');
        
        // Wait for state to propagate
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log('[GEN.END] 💬 Adding completion message');
        actions.addMessage(
          `🎉 목표가 완성되었습니다! 총 ${aiQuests.length}개의 맞춤형 퀘스트가 준비되었어요.`,
          'assistant'
        );
        
        // Force scroll to bottom to show quests
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 300);
        
        console.log('[GEN.END] ✅ Quest generation complete - UI should update now');
        console.log('[GEN.END] 🔍 Current state.isComplete:', state.isComplete);
        console.log('[GEN.END] 🔍 Current state.questPreview:', state.questPreview?.length || 0);
        console.log('[GEN.END] 🔍 Current generationPhase:', 'done');
      } else {
        console.error('[GEN.END] ⚠️ AI returned empty array, using fallback');
        const simpleQuests = generateSimpleQuests();
        console.log('[GEN.END] 📝 Generated', simpleQuests.length, 'simple quests');
        
        if (simpleQuests.length > 0) {
          actions.markComplete(simpleQuests);
          setGenerationPhase('done');
          await new Promise(resolve => setTimeout(resolve, 150));
          actions.addMessage(
            `🎯 목표가 완성되었습니다! 총 ${simpleQuests.length}개의 퀘스트가 준비되었어요.`,
            'assistant'
          );
        }
      }
    } catch (error) {
      console.error('[GEN.ERROR] ❌ AI quest generation failed with error:', error);
      console.error('[GEN.ERROR] Error details:', error instanceof Error ? error.message : String(error));
      console.error('[GEN.ERROR] Stack trace:', error instanceof Error ? error.stack : 'N/A');
      setIsTyping(false);
      
      console.log('[GEN.ERROR] 🔄 Using fallback simple quest generation');
      const simpleQuests = generateSimpleQuests();
      console.log('[GEN.ERROR] 📝 Generated', simpleQuests.length, 'simple quests as fallback');
      
      if (simpleQuests.length > 0) {
        actions.markComplete(simpleQuests);
        setGenerationPhase('done');
        await new Promise(resolve => setTimeout(resolve, 150));
        actions.addMessage(
          `🎯 목표가 완성되었습니다! 총 ${simpleQuests.length}개의 퀘스트가 준비되었어요.`,
          'assistant'
        );
      } else {
        console.error('[GEN.ERROR] ❌ Even fallback generation failed!');
        setGenerationPhase('idle');
      }
    } finally {
      // ALWAYS clear the generating flag after a delay
      setTimeout(() => {
        setIsGeneratingQuests(false);
        console.log('[GEN.END] 🔓 Released isGeneratingQuests');
      }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentGoalType, state.collectedSlots, state.userState, state.isComplete, isGeneratingQuests, actions]);

  // Simple quest generation as fallback
  const generateSimpleQuests = useCallback(() => {
    const baseTitle = String(state.collectedSlots.title || '목표');
    const period = state.collectedSlots.period as { startDate: string; endDate: string } | undefined;
    const verification = (state.collectedSlots.verification as string[]) || ['체크리스트'];
    const startDate = period?.startDate ? new Date(period.startDate) : new Date();
    const endDate = period?.endDate ? new Date(period.endDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    
    const quests = [];
    
    if (state.currentGoalType === 'schedule') {
      const weekdays = (state.collectedSlots.weekdays as number[]) || [1, 3, 5];
      const time = String(state.collectedSlots.time || '09:00');
      
      let currentDate = new Date(startDate);
      let questCount = 0;
      
      while (currentDate <= endDate && questCount < 15) {
        const dayOfWeek = currentDate.getDay();
        
        if (weekdays.includes(dayOfWeek)) {
          quests.push({
            id: `quest-schedule-${questCount + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: `${baseTitle} - ${currentDate.toLocaleDateString('ko-KR')}`,
            description: `${time}에 "${baseTitle}" 목표를 달성하세요`,
            targetDate: currentDate.toISOString().split('T')[0],
            verification
          });
          questCount++;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (state.currentGoalType === 'frequency') {
      const perWeek = Number(state.collectedSlots.perWeek) || 3;
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      const weeks = Math.ceil(daysDiff / 7);
      
      for (let week = 1; week <= weeks && quests.length < 15; week++) {
        for (let occurrence = 1; occurrence <= perWeek && quests.length < 15; occurrence++) {
          const daysFromStart = (week - 1) * 7 + occurrence - 1;
          const questDate = new Date(startDate.getTime() + daysFromStart * 24 * 60 * 60 * 1000);
          
          if (questDate <= endDate) {
            quests.push({
              id: `quest-frequency-${quests.length + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              title: `${baseTitle} ${week}주차 ${occurrence}회차`,
              description: `"${baseTitle}" 목표를 달성하세요`,
              targetDate: questDate.toISOString().split('T')[0],
              verification
            });
          }
        }
      }
    } else if (state.currentGoalType === 'milestone') {
      const milestones = (state.collectedSlots.milestones as string[]) || ['시작', '중간', '완료'];
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      
      milestones.forEach((milestone, index) => {
        const progress = index / (milestones.length - 1);
        const daysFromStart = Math.floor(daysDiff * progress);
        const questDate = new Date(startDate.getTime() + daysFromStart * 24 * 60 * 60 * 1000);
        
        quests.push({
          id: `quest-milestone-${index + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: `${baseTitle} - ${milestone}`,
          description: `"${baseTitle}" 목표의 ${milestone} 단계를 완료하세요`,
          targetDate: questDate.toISOString().split('T')[0],
          verification
        });
      });
    }
    
    console.log('[GEN.END] Generated simple quests:', quests);
    return quests;
  }, [state.currentGoalType, state.collectedSlots]);

  // Auto-generate next question or quests based on pending slots
  useEffect(() => {
    const runEffect = async () => {
      const collectedSlotsCount = Object.keys(state.collectedSlots).length;
      
      console.log('[ChatbotCreateGoal] useEffect triggered:', {
        awaitingConfirmation,
        isComplete: state.isComplete,
        pendingSlotsLength: state.pendingSlots.length,
        pendingSlots: state.pendingSlots,
        currentGoalType: state.currentGoalType,
        collectedSlotsCount,
        collectedSlotsKeys: Object.keys(state.collectedSlots),
        isGenerating: isGeneratingQuestion.current,
        isGeneratingQuests
      });

      // STRICT: Block if any generation is in progress
      if (isGeneratingQuestion.current || isGeneratingQuests || isTyping) {
        console.log('[ChatbotCreateGoal] ⛔ Generation in progress, BLOCKING');
        return;
      }

      // Block if waiting for confirmation
      if (awaitingConfirmation) {
        console.log('[ChatbotCreateGoal] ⛔ Waiting for confirmation');
        return;
      }

      // Block if no goal type set
      if (!state.currentGoalType) {
        console.log('[ChatbotCreateGoal] ⛔ No goal type set');
        return;
      }

      // Case 1: All slots filled AND quests not yet generated → Generate quests
      if (state.pendingSlots.length === 0 && (!state.questPreview || state.questPreview.length === 0)) {
        console.log('[ChatbotCreateGoal] ✅ All slots filled, checking quest generation conditions');
        
        // For schedule goals, ensure occurrences are confirmed
        if (state.currentGoalType === 'schedule') {
          if (!specV2.schedule?.occurrences || specV2.schedule.occurrences.length === 0) {
            console.log('[ChatbotCreateGoal] ⚠️ Schedule goal needs occurrence confirmation first - BLOCKING quest generation');
            return;
          }
          console.log('[ChatbotCreateGoal] ✅ Occurrences confirmed, proceeding to quest generation');
        }
        
        console.log('[ChatbotCreateGoal] 🎯 Triggering quest generation NOW');
        setTimeout(() => {
          generateAndShowQuests();
        }, 500);
        return;
      }

      // Case 2: Pending slots remain → Generate next question
      if (state.pendingSlots.length > 0) {
        console.log('[ChatbotCreateGoal] 📝 Pending slots exist, generating next question');
        console.log('[ChatbotCreateGoal] Next pending slot:', state.pendingSlots[0]);
        
        // Small delay to ensure state is stable
        setTimeout(async () => {
          setIsTyping(true);
          await generateNextQuestionSafely(true);
          
          setTimeout(() => {
            setIsTyping(false);
          }, 500);
        }, 300);
      }
    };

    runEffect();
  }, [
    state.pendingSlots.length,
    state.currentGoalType,
    state.isComplete,
    awaitingConfirmation,
    isGeneratingQuests,
    specV2.schedule?.occurrences?.length, // ← Track occurrences
    generateAndShowQuests
  ]);

  // 안전한 질문 생성 함수 (AI 기반)
  const generateNextQuestionSafely = async (forceGenerate = false) => {
    // Prevent duplicate question generation - STRICT CHECK
    if (isGeneratingQuestion.current) {
      console.log('[ChatbotCreateGoal] ⛔ Question generation already in progress, BLOCKING duplicate call');
      return;
    }

    console.log('[ChatbotCreateGoal] generateNextQuestionSafely called:', {
      forceGenerate,
      currentGoalType: state.currentGoalType,
      pendingSlotsLength: state.pendingSlots.length,
      pendingSlots: state.pendingSlots,
      collectedSlotsKeys: Object.keys(state.collectedSlots)
    });

    if (!state.currentGoalType || state.pendingSlots.length === 0) {
      console.log('[ChatbotCreateGoal] ⛔ No goal type or no pending slots, skipping question generation');
      return;
    }

    // Set generation flag IMMEDIATELY to block any concurrent calls
    isGeneratingQuestion.current = true;
    console.log('[ChatbotCreateGoal] 🔒 Set isGeneratingQuestion = true');

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

      // Note: extractedSchedule is for pre-populating widgets, not for auto-filling slots
      // Each slot (period, weekdays, time) should be asked separately
      if (extractedSchedule) {
        console.log('[ChatbotCreateGoal] AI extracted schedule info for widget pre-population:', extractedSchedule);
      }

      // Check if conversation is complete and quests are provided
      if (conversationComplete && quests && quests.length > 0) {
        console.log('[ChatbotCreateGoal] AI completed conversation with quests:', quests);
        actions.markComplete(quests);
        actions.addMessage(
          `🎉 목표가 완성되었습니다! 총 ${quests.length}개의 맞춤형 퀘스트가 준비되었어요.`,
          'assistant'
        );
        isGeneratingQuestion.current = false;
        console.log('[ChatbotCreateGoal] 🔓 Released isGeneratingQuestion (conversation complete)');
        return; // Don't add another question message
      }

      // Check if this question was already asked (prevent duplicates)
      const lastAssistantMessage = state.messages.filter(m => m.role === 'assistant').pop();
      if (lastAssistantMessage && lastAssistantMessage.content === question) {
        console.log('[ChatbotCreateGoal] ⛔ DUPLICATE question detected, skipping');
        isGeneratingQuestion.current = false;
        return;
      }

      console.log('[ChatbotCreateGoal] ✅ AI Generated NEW question:', {
        question: question.substring(0, 50) + '...',
        widgets: widgets.map(w => ({ type: w.type, slotId: w.slotId }))
      });

      // Auto-manage keyboard based on question type
      if (widgets && widgets.length > 0) {
        Keyboard.dismiss();
      }

      actions.addMessage(question, 'assistant', widgets);
      setLastQuestionTime(Date.now());
      
      console.log('[ChatbotCreateGoal] 📨 Message added successfully');
    } catch (error) {
      console.error('[ChatbotCreateGoal] ❌ AI question generation failed:', error);
      actions.addMessage('죄송합니다. 잠시 후 다시 시도해주세요.', 'assistant');
    } finally {
      // ALWAYS clear generation flag - with delay to prevent immediate re-trigger
      setTimeout(() => {
        isGeneratingQuestion.current = false;
        console.log('[ChatbotCreateGoal] 🔓 Released isGeneratingQuestion (after delay)');
      }, 1000); // 1 second delay before allowing next question generation
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
        
        // === NEW: Update specV2 with type and title ===
        setSpecV2(prev => ({
          ...prev,
          type: goalType,
          title: input,
          version: (prev.version || 0) + 1
        }));
        console.log('[SPEC.INIT] Set initial type and title:', { type: goalType, title: input });
        
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
          
          // Show AI thinking indicator
          setIsTyping(true);
          
          // 사용자 확인 후 다음 질문 생성 (AI 기반)
          setTimeout(async () => {
            console.log('[ChatbotCreateGoal] Generating next question after confirmation');
            await generateNextQuestionSafely(true); // 강제 생성
            setIsTyping(false);
          }, 800); // 800ms 후 다음 질문 생성
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

  // === NEW: Unified slot confirmation handler with GoalSpecV2 integration ===
  const handleSlotConfirm = useCallback(async (slotId: string, rawValue: SlotValue) => {
    console.log('[ANSWER]', { slotId, raw: rawValue, currentType: state.currentGoalType });

    // Auto-clear confirmation state if widget interaction occurs
    if (awaitingConfirmation === 'goalType') {
      setAwaitingConfirmation(null);
      console.log('[CONFIRM.STATE] Auto-clearing awaitingConfirmation due to widget interaction');
    }

    // Step 1: Update legacy collectedSlots (for backward compatibility)
    if (slotId === 'period' && typeof rawValue === 'object' && rawValue) {
      const calendarData = rawValue as any;
      const periodData = {
        startDate: calendarData.startDate,
        endDate: calendarData.endDate
      };
      actions.updateSlot('period', periodData);
    } else {
      actions.updateSlot(slotId, rawValue);
    }

    // Step 2: Update GoalSpecV2 (new system)
    try {
      const normalized = normalize(slotId as SlotId, rawValue, specV2.timezone);
      console.log('[ANSWER] Normalized:', normalized);

      // Update spec immutably
      const nextSpec: Partial<GoalSpecV2> = {
        ...specV2,
        version: (specV2.version || 0) + 1
      };

      // Map slot to spec field (handle both legacy and new slot IDs)
      const normalizedSlotId = slotId === 'weekdays' ? 'baseRule.weekdays' : slotId === 'time' ? 'baseRule.time' : slotId;
      
      switch (normalizedSlotId) {
        case 'type':
          nextSpec.type = normalized;
          break;
        case 'title':
          nextSpec.title = normalized;
          break;
        case 'period':
          nextSpec.period = normalized;
          break;
        case 'baseRule.weekdays':
        case 'weekdays':
          if (!nextSpec.schedule) nextSpec.schedule = {};
          if (!nextSpec.schedule.rules) nextSpec.schedule.rules = [{ byWeekday: [], time: undefined }];
          nextSpec.schedule.rules[0].byWeekday = normalized;
          break;
        case 'baseRule.time':
        case 'time':
          if (!nextSpec.schedule) nextSpec.schedule = {};
          if (!nextSpec.schedule.rules) nextSpec.schedule.rules = [{ byWeekday: [], time: undefined }];
          nextSpec.schedule.rules[0].time = normalized;
          break;
        case 'perWeek':
          nextSpec.frequency = normalized;
          break;
        case 'milestones':
          if (!nextSpec.milestone) nextSpec.milestone = { milestones: [] };
          nextSpec.milestone.milestones = normalized;
          break;
        case 'currentState':
          if (!nextSpec.milestone) nextSpec.milestone = { milestones: [] };
          nextSpec.milestone.currentState = normalized;
          break;
        case 'verification':
          nextSpec.verification = normalized;
          break;
        case 'successRate':
          nextSpec.successCriteria = normalized;
          break;
      }

      setSpecV2(nextSpec);
      console.log('[SPEC.SAVE]', { version: nextSpec.version, slotId, diff: slotId });
      
      // === DEBUG: Full spec status ===
      console.log('[SPEC.STATUS]', {
        type: nextSpec.type,
        hasTitle: !!nextSpec.title,
        hasPeriod: !!nextSpec.period,
        hasWeekdays: !!nextSpec.schedule?.rules?.[0]?.byWeekday,
        weekdays: nextSpec.schedule?.rules?.[0]?.byWeekday,
        hasTime: !!nextSpec.schedule?.rules?.[0]?.time,
        time: nextSpec.schedule?.rules?.[0]?.time,
        hasOccurrences: !!nextSpec.schedule?.occurrences
      });

      // Step 3: For schedule type, check if we should show occurrence preview
      // ✅ NEW ORDER: Show occurrence list AFTER verification and successRate
      const shouldTrigger = nextSpec.type === 'schedule' && 
          nextSpec.period && 
          nextSpec.schedule?.rules?.[0]?.byWeekday?.length > 0 &&
          nextSpec.schedule?.rules?.[0]?.time &&
          nextSpec.verification?.signals && nextSpec.verification.signals.length > 0 && // ✅ 검증 방법 필수
          nextSpec.successCriteria?.targetRate && // ✅ 성공률 필수
          !nextSpec.schedule?.occurrences;
      
      console.log('[TRIGGER.CHECK]', {
        typeCheck: nextSpec.type === 'schedule',
        periodCheck: !!nextSpec.period,
        weekdaysCheck: (nextSpec.schedule?.rules?.[0]?.byWeekday?.length ?? 0) > 0,
        timeCheck: !!nextSpec.schedule?.rules?.[0]?.time,
        verificationCheck: !!nextSpec.verification?.signals && nextSpec.verification.signals.length > 0, // ✅ 추가
        successRateCheck: !!nextSpec.successCriteria?.targetRate, // ✅ 추가
        notConfirmedCheck: !nextSpec.schedule?.occurrences,
        SHOULD_TRIGGER: shouldTrigger
      });
      
      if (shouldTrigger) { // ✅ shouldTrigger already has all conditions
        
        console.log('[SCHED.PREVIEW] Generating occurrence preview...');
        console.log('[SCHED.PREVIEW] Current spec:', {
          type: nextSpec.type,
          period: nextSpec.period,
          weekdays: nextSpec.schedule?.rules?.[0]?.byWeekday,
          time: nextSpec.schedule?.rules?.[0]?.time,
          timezone: nextSpec.timezone
        });
        
        try {
          // Ensure required fields are present for preview
          if (!nextSpec.timezone) nextSpec.timezone = 'Asia/Seoul';
          if (!nextSpec.title) nextSpec.title = state.collectedSlots.title as string || '목표';
          
          const preview = previewOccurrences(nextSpec as GoalSpecV2);
          setOccurrencePreview(preview);
          
          // Show occurrence list widget
          if (preview.length > 0) {
            console.log('[SCHED.PREVIEW] ✅ Showing', preview.length, 'occurrences');
            setShowOccurrenceList(true);
            
            // Add occurrence preview message
            actions.addMessage(
              `📅 ${preview.length}개의 일정이 생성되었습니다. 아래에서 확인하고 수정할 수 있습니다.`,
              'assistant'
            );
          }
        } catch (error) {
          console.error('[SCHED.PREVIEW] ❌ Preview generation failed:', error);
        }
      }

    } catch (error) {
      console.error('[ANSWER] Normalization failed:', error);
    }

    // Step 4: Show user selection as message
    const displayValue = formatSelectionDisplay(slotId, rawValue);
    actions.addMessage(displayValue, 'user');

    console.log('[ChatbotCreateGoal] Slot confirmed, waiting for state update');
  }, [state.currentGoalType, state.collectedSlots, specV2, awaitingConfirmation, actions]); // ✅ state.collectedSlots 추가!

  // Backward compatibility: map to new handler
  const handleWidgetSelection = handleSlotConfirm;

  // === NEW: Occurrence editing handlers ===
  const handleOccurrenceRetime = useCallback((date: string, newTime: string) => {
    console.log('[SCHED.EDIT] Retime:', { date, newTime });
    
    const override = { kind: 'retime' as const, date, time: newTime };
    const nextSpec: Partial<GoalSpecV2> = {
      ...specV2,
      schedule: {
        ...specV2.schedule,
        overrides: [...(specV2.schedule?.overrides || []), override]
      },
      version: (specV2.version || 0) + 1
    };
    
    setSpecV2(nextSpec);
    
    // Regenerate preview
    const newPreview = previewOccurrences(nextSpec);
    setOccurrencePreview(newPreview);
    
    console.log('[SCHED.EDIT] Updated preview:', newPreview.length);
  }, [specV2]);

  const handleOccurrenceCancel = useCallback((date: string) => {
    console.log('[SCHED.EDIT] Cancel:', { date });
    
    const override = { kind: 'cancel' as const, date };
    const nextSpec: Partial<GoalSpecV2> = {
      ...specV2,
      schedule: {
        ...specV2.schedule,
        overrides: [...(specV2.schedule?.overrides || []), override]
      },
      version: (specV2.version || 0) + 1
    };
    
    setSpecV2(nextSpec);
    
    // Regenerate preview
    const newPreview = previewOccurrences(nextSpec);
    setOccurrencePreview(newPreview);
    
    console.log('[SCHED.EDIT] Updated preview:', newPreview.length);
  }, [specV2]);

  const handleOccurrenceAdd = useCallback((date: string, time: string) => {
    console.log('[SCHED.EDIT] Add:', { date, time });
    
    const override = { kind: 'add' as const, date, time };
    const nextSpec: Partial<GoalSpecV2> = {
      ...specV2,
      schedule: {
        ...specV2.schedule,
        overrides: [...(specV2.schedule?.overrides || []), override]
      },
      version: (specV2.version || 0) + 1
    };
    
    setSpecV2(nextSpec);
    
    // Regenerate preview
    const newPreview = previewOccurrences(nextSpec);
    setOccurrencePreview(newPreview);
    
    console.log('[SCHED.EDIT] Updated preview:', newPreview.length);
  }, [specV2]);

  const handleOccurrenceMove = useCallback((fromDate: string, toDate: string, toTime: string) => {
    console.log('[SCHED.EDIT] Move:', { fromDate, toDate, toTime });
    
    const override = { kind: 'move' as const, from: fromDate, toDate, toTime };
    const nextSpec: Partial<GoalSpecV2> = {
      ...specV2,
      schedule: {
        ...specV2.schedule,
        overrides: [...(specV2.schedule?.overrides || []), override]
      },
      version: (specV2.version || 0) + 1
    };
    
    setSpecV2(nextSpec);
    
    // Regenerate preview
    const newPreview = previewOccurrences(nextSpec);
    setOccurrencePreview(newPreview);
    
    console.log('[SCHED.EDIT] Updated preview:', newPreview.length);
  }, [specV2]);

  const handleOccurrenceConfirm = useCallback(async (finalItems: OccurrenceItem[]) => {
    console.log('[SCHED.CONFIRM] User confirmed', finalItems.length, 'occurrences');
    
    // Build final occurrences from current spec using the LATEST spec
    const finalOccurrences = buildOccurrences(specV2 as GoalSpecV2);
    
    const nextSpec: Partial<GoalSpecV2> = {
      ...specV2,
      schedule: {
        ...specV2.schedule,
        occurrences: finalOccurrences
      },
      version: (specV2.version || 0) + 1
    };
    
    setSpecV2(nextSpec);
    setShowOccurrenceList(false);
    
    console.log('[SCHED.CONFIRM] ✅ Occurrences saved:', finalOccurrences.length);
    console.log('[SCHED.CONFIRM] 📊 Updated spec:', { version: nextSpec.version, occurrences: finalOccurrences.length });
    
    actions.addMessage(
      `✅ ${finalOccurrences.length}개의 일정이 확정되었습니다!`,
      'assistant'
    );
    
    console.log('[SCHED.CONFIRM] 🎯 Checking if ready for quest generation...');
    console.log('[SCHED.CONFIRM] 📋 Missing slots:', state.pendingSlots);
    console.log('[SCHED.CONFIRM] 📋 Current goal type:', state.currentGoalType);
    
    // For schedule goals, check if we have all required info to generate quests
    if (state.currentGoalType === 'schedule') {
      // Ensure we have verification and successRate
      const hasVerification = state.collectedSlots.verification || nextSpec.verification;
      const hasSuccessRate = state.collectedSlots.successRate || nextSpec.successCriteria;
      
      console.log('[SCHED.CONFIRM] 🔍 Prerequisites check:', {
        hasVerification: !!hasVerification,
        hasSuccessRate: !!hasSuccessRate,
        hasOccurrences: finalOccurrences.length > 0
      });
      
      // If we have all prerequisites, trigger quest generation immediately
      if (hasVerification && hasSuccessRate && finalOccurrences.length > 0) {
        console.log('[SCHED.CONFIRM] 🚀 All prerequisites met! Triggering quest generation NOW');
        
        // Small delay to ensure state is updated
        setTimeout(() => {
          console.log('[SCHED.CONFIRM] 🎯 Calling generateAndShowQuests...');
          generateAndShowQuests();
        }, 500);
      } else {
        console.log('[SCHED.CONFIRM] ⏳ Still need to collect:', {
          needsVerification: !hasVerification,
          needsSuccessRate: !hasSuccessRate
        });
        console.log('[SCHED.CONFIRM] 📝 Will ask for missing slots next');
        
        // Trigger next question generation after a short delay
        setTimeout(() => {
          setIsTyping(true);
          setTimeout(async () => {
            await generateNextQuestionSafely(true);
            setIsTyping(false);
          }, 300);
        }, 500);
      }
    }
  }, [specV2, actions, state.pendingSlots, state.currentGoalType, state.collectedSlots, generateAndShowQuests]);

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
  const renderWidget = (widget: EmbeddedWidget, messageId: string) => {
    console.log('[ChatbotCreateGoal] Rendering widget:', {
      type: widget.type,
      slotId: widget.slotId,
      label: widget.label,
      messageId
    });
    
    const commonProps = {
      label: widget.label,
      value: state.collectedSlots[widget.slotId],
      onSelect: (value: SlotValue) => {
        if (widget.slotId === 'goalType') {
          handleGoalTypeSelection(String(value));
        } else {
          // Just update temporary selection, don't proceed to next question
          console.log('[WIDGET.SELECT] Temporary selection:', { slotId: widget.slotId, value });
        }
      },
      onConfirm: (value: SlotValue) => {
        // Only proceed when "선택 완료" button is clicked
        console.log('[WIDGET.CONFIRM] Confirmed selection:', { slotId: widget.slotId, value });
        handleSlotConfirm(widget.slotId, value);
      }
    };

    switch (widget.type) {
      case 'calendar':
        return (
          <CalendarWidget 
            {...commonProps}
            mode="range"
            {...widget.props} 
          />
        );
      case 'chips':
        return <ChipsWidget {...commonProps} {...widget.props} />;
      case 'toggle':
        return <ToggleWidget {...commonProps} {...widget.props} />;
      case 'counter':
        return <CounterWidget {...commonProps} {...widget.props} />;
      case 'timePicker':
        return <TimePickerWidget {...commonProps} {...widget.props} />;
      case 'weekdays':
        return <WeekdaysWidget {...commonProps} {...widget.props} />;
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
      console.log('[SAVE.DEBUG] currentGoalType:', state.currentGoalType);
      console.log('[SAVE.DEBUG] questPreview:', state.questPreview);
      console.log('[SAVE.DEBUG] collectedSlots:', state.collectedSlots);
      
      // Get period data (API expects ISO format: "2025-10-12T09:00")
      const period = state.collectedSlots.period as { startDate: string; endDate: string };
      const startAt = period?.startDate ? `${period.startDate}T00:00` : undefined;
      const endAt = period?.endDate ? `${period.endDate}T00:00` : undefined;
      
      if (!startAt || !endAt) {
        console.error('[SAVE.FAIL] Missing start or end date');
        actions.addMessage('❌ 시작일과 종료일을 선택해주세요.', 'assistant');
        return;
      }
      
      // Prepare goal data based on goalType
      let goalData: any;
      const userId = user.userId || '1';
      const title = String(state.collectedSlots.title || '');
      const description = `${state.currentGoalType} 목표`;
      const tags = ['personal'];
      
      if (state.currentGoalType === 'schedule') {
        // Schedule type: quests with date, time, description, verificationMethod
        // Extract time from collectedSlots
        const timeSlot = state.collectedSlots.time as string || '09:00';
        
        const quests = (state.questPreview || []).map((quest: any) => {
          const date = quest.date || quest.scheduledDate || startAt?.split('T')[0];
          const time = quest.time || timeSlot;
          return {
            date: `${date}T${time}`, // "2025-10-12T09:00"
            description: quest.description || quest.title || '퀘스트 완료',
            verificationMethod: 'camera' as const
          };
        });
        
        console.log('[SAVE.SCHEDULE] Generated schedule quests:', quests);
        
        goalData = {
          goalType: 'schedule' as const,
          title,
          description,
          tags: tags || ['운동', '건강'],
          startAt,
          endAt,
          quests
        };
      } else if (state.currentGoalType === 'frequency') {
        // Frequency type: period, numbers, quests with unit
        const perWeek = Number(state.collectedSlots.perWeek) || 3;
        const quests = (state.questPreview || []).map((quest: any, index: number) => ({
          unit: index + 1,
          description: quest.description || quest.title || '퀘스트 완료',
          verificationMethod: 'camera' as const
        }));
        
        goalData = {
          goalType: 'frequency' as const,
          title,
          description,
          tags: tags || ['학습', '자기계발'],
          startAt,
          endAt,
          period: 'week' as const,
          numbers: perWeek,
          quests
        };
      } else {
        // Milestone type: quests with title, targetValue, description
        // Use AI-generated quests if available, otherwise use default milestones
        let quests: Array<{ title: string; targetValue: number; description: string }>;
        
        if (state.questPreview && state.questPreview.length > 0) {
          // Use AI-generated quests
          quests = state.questPreview.map((quest: any) => ({
            title: quest.title || '단계',
            targetValue: quest.targetValue || 100,
            description: quest.description || '목표 달성'
          }));
        } else {
          // Fallback to default milestones
          const milestones = state.collectedSlots.milestones as string[] || ['kickoff', 'mid', 'finish'];
          quests = milestones.map((key: string, index: number) => ({
            title: key === 'kickoff' ? '기초 완성' : key === 'mid' ? '중급 달성' : '목표 달성',
            targetValue: (index + 1) * 100,
            description: key === 'kickoff' ? '기본기 다지기' : 
                        key === 'mid' ? '중급 단계 진행' : 
                        '최종 목표 달성'
          }));
        }
        
        console.log('[SAVE.MILESTONE] Generated milestone quests:', quests);
        
        goalData = {
          goalType: 'milestone' as const,
          title,
          description,
          tags: tags || ['자기계발', '학습'],
          startAt,
          endAt,
          scheduleMethod: 'milestone' as const,
          quests,
          totalSteps: quests.length,
          currentStepIndex: 0,
          overallTarget: quests[quests.length - 1]?.targetValue || 100,
          config: {
            rewardPerStep: 100,
            maxFails: 1
          }
        };
      }

      console.log('[SAVE.SUCCESS] Goal data prepared:', JSON.stringify(goalData, null, 2));

      // Save to database - pass goalData with userId separately
      const result = await createGoal({ ...goalData, userId });
      const goalId = result.goalId;
      
      console.log('[SAVE.SUCCESS] Goal saved successfully with ID:', goalId);
      
      // === QUESTS INFO ===
      // Note: In API v1.3, quests are created together with the goal in POST /goals
      // Separate quest creation is not supported
      if (state.questPreview && state.questPreview.length > 0) {
        console.log('[SAVE.QUESTS] ℹ️ ', state.questPreview.length, 'quests were included in goal creation');
        console.log('[SAVE.QUESTS] ℹ️ API v1.3: Quests are saved automatically with POST /goals');
        // No separate quest save needed - they are included in the goal creation request
      }
      
      // Show success message
      actions.addMessage('🎉 목표가 성공적으로 저장되었습니다! Goals 화면에서 확인하실 수 있습니다.', 'assistant');
      
      // Notify parent component with goal data
      const savedGoalData = {
        id: goalId,
        ...goalData,
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
        {state.messages.map((message) => {
          // Check if this message has any unconfirmed widgets
          const hasUnconfirmedWidgets = message.widgets?.some(widget => {
            const isSlotConfirmed = state.collectedSlots[widget.slotId] !== undefined && 
                                   state.collectedSlots[widget.slotId] !== null;
            return !isSlotConfirmed;
          });
          
          // Only render messages that are user messages, text-only assistant messages, or have unconfirmed widgets
          const shouldRenderMessage = message.role === 'user' || 
                                     !message.widgets || 
                                     message.widgets.length === 0 || 
                                     hasUnconfirmedWidgets;
          
          if (!shouldRenderMessage) {
            return null; // Skip messages with only confirmed widgets
          }
          
          return (
            <View
              key={`msg-${message.id}`}
              className={`mb-3 ${message.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <View
                style={{
                  maxWidth: '75%',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 20,
                  backgroundColor: message.role === 'user' ? '#007AFF' : '#FFFFFF',
                  ...message.role === 'assistant' && {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    elevation: 2,
                    borderWidth: 1,
                    borderColor: '#F0F0F0',
                  }
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    lineHeight: 22,
                    color: message.role === 'user' ? '#FFFFFF' : '#1C1C1E',
                    fontWeight: message.role === 'assistant' ? '400' : '500',
                  }}
                >
                  {message.content}
                </Text>
              </View>

              {/* Render embedded widgets - only show if slot not yet collected */}
              {message.widgets && message.widgets.length > 0 && (
                <View className="w-full mt-2">
                  {message.widgets.map((widget, widgetIndex) => {
                    // Hide widget if slot is already confirmed (to prevent key errors)
                    const isSlotConfirmed = state.collectedSlots[widget.slotId] !== undefined && 
                                           state.collectedSlots[widget.slotId] !== null;
                    
                    if (isSlotConfirmed) {
                      return null; // Don't render confirmed widgets
                    }
                    
                    return (
                      <View key={`${message.id}-widget-${widget.slotId}-${widgetIndex}-${Date.now()}`}>
                        {renderWidget(widget, message.id)}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {/* Typing indicator - Apple style */}
        {isTyping && (
          <View className="items-start mb-3">
            <View
              style={{
                backgroundColor: '#F0F0F0',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 20,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View className="flex-row gap-1 mr-2">
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#8E8E93' }} />
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#8E8E93', opacity: 0.6 }} />
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#8E8E93', opacity: 0.3 }} />
              </View>
              <Text style={{ color: '#8E8E93', fontSize: 14 }}>작성 중</Text>
            </View>
          </View>
        )}

        {/* === NEW: Occurrence List Preview - Moved outside ScrollView === */}

        {/* Loading indicator during quest generation - Clean design */}
        {generationPhase === 'generating' && (
          <View 
            style={{
              marginTop: 16,
              padding: 24,
              backgroundColor: '#F9F9F9',
              borderRadius: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#1C1C1E', marginBottom: 8 }}>
              퀘스트 생성 중
            </Text>
            <Text style={{ fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20 }}>
              맞춤형 퀘스트를 준비하고 있습니다{'\n'}잠시만 기다려주세요
            </Text>
          </View>
        )}

        {/* Quest Preview - Enhanced with collapsible view */}
        {generationPhase === 'done' && state.isComplete && state.questPreview && state.questPreview.length > 0 && (
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
            
            {/* Quest List Header */}
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold text-gray-800">📋 퀘스트 미리보기</Text>
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
            
            {/* Show first 3 or all quests based on state */}
            {(showAllQuests ? state.questPreview : state.questPreview.slice(0, 3)).map((quest, index) => (
              <View key={`quest-${quest.id}-${index}-${Date.now()}`} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-2">
                    <Text className="font-semibold text-gray-800 text-base mb-1">{quest.title}</Text>
                    <Text className="text-gray-600 text-sm mb-2">{quest.description}</Text>
                    
                    <View className="flex-row flex-wrap gap-2">
                      <View className="bg-blue-50 px-2 py-1 rounded">
                        <Text className="text-blue-600 text-xs">📅 {quest.targetDate}</Text>
                      </View>
                      {quest.verification && quest.verification.length > 0 && (
                        <View className="bg-green-50 px-2 py-1 rounded">
                          <Text className="text-green-600 text-xs">✅ {quest.verification.join(', ')}</Text>
                        </View>
                      )}
                      {quest.difficulty && (
                        <View className="bg-purple-50 px-2 py-1 rounded">
                          <Text className="text-purple-600 text-xs">⭐ {quest.difficulty}</Text>
                        </View>
                      )}
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
              <TouchableOpacity
                onPress={() => setShowAllQuests(true)}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4"
              >
                <Text className="text-gray-700 text-center text-sm font-medium">
                  + {state.questPreview.length - 3}개의 퀘스트 더보기
                </Text>
                <Text className="text-gray-500 text-center text-xs mt-1">
                  탭하여 모든 퀘스트 확인하기
                </Text>
              </TouchableOpacity>
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
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  borderRadius: 12,
                  backgroundColor: isSaving ? '#C7C7CC' : '#007AFF',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                  {isSaving ? '저장 중...' : '목표 저장하기'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* === Occurrence List Preview (Outside ScrollView to avoid VirtualizedList warning) === */}
      {showOccurrenceList && occurrencePreview.length > 0 && !specV2.schedule?.occurrences && (
        <View className="bg-white border-t border-gray-200" style={{ height: 400 }}>
          <OccurrenceListComponent
            items={occurrencePreview}
            onRetime={handleOccurrenceRetime}
            onCancel={handleOccurrenceCancel}
            onAdd={handleOccurrenceAdd}
            onMove={handleOccurrenceMove}
            onConfirm={handleOccurrenceConfirm}
            isConfirmed={!!specV2.schedule?.occurrences}
          />
        </View>
      )}

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
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: userInput.trim() && !isTyping ? '#007AFF' : '#E5E5EA',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>↑</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
