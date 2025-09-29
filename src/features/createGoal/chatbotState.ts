// Chatbot state management for goal creation

import { useCallback, useReducer } from 'react';
import { AIService } from '../../services/ai';
import { ChatbotAction, ChatbotState, ChatMessage, EmbeddedWidget, SlotValue } from '../../types/chatbot';
import { getMissingSlots, getSchemaForGoalType, isSlotComplete } from './slotSchemas';
import { classifyGoalTypeFromTitleWithAI } from './state';

export const INITIAL_CHATBOT_STATE: ChatbotState = {
  messages: [],
  currentGoalType: undefined,
  pendingSlots: [],
  collectedSlots: {},
  isComplete: false,
  questPreview: undefined,
  userState: {
    currentLevel: undefined,
    experience: undefined,
    timeline: undefined,
    resources: undefined
  }
};

function chatbotReducer(state: ChatbotState, action: ChatbotAction): ChatbotState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload]
      };

    case 'SET_GOAL_TYPE':
      const schema = getSchemaForGoalType(action.payload);
      const requiredSlots = schema.slots.filter(s => s.required).map(s => s.id);
      return {
        ...state,
        currentGoalType: action.payload,
        pendingSlots: requiredSlots,
        collectedSlots: {} // Reset collected data when changing type
      };

    case 'UPDATE_SLOT':
      const newCollectedSlots = {
        ...state.collectedSlots,
        [action.payload.slotId]: action.payload.value
      };
      
      const missingSlots = state.currentGoalType 
        ? getMissingSlots(state.currentGoalType, newCollectedSlots)
        : [];

      const complete = state.currentGoalType 
        ? isSlotComplete(state.currentGoalType, newCollectedSlots)
        : false;

      return {
        ...state,
        collectedSlots: newCollectedSlots,
        pendingSlots: missingSlots,
        isComplete: complete
      };

    case 'SET_PENDING_SLOTS':
      return {
        ...state,
        pendingSlots: action.payload
      };

    case 'MARK_COMPLETE':
      return {
        ...state,
        isComplete: true,
        questPreview: action.payload
      };

    case 'UPDATE_USER_STATE':
      return {
        ...state,
        userState: { ...state.userState, ...action.payload }
      };

    case 'RESET':
      return INITIAL_CHATBOT_STATE;

    default:
      return state;
  }
}

export function useChatbotState() {
  const [state, dispatch] = useReducer(chatbotReducer, INITIAL_CHATBOT_STATE);

  const addMessage = useCallback((content: string, role: 'user' | 'assistant', widgets?: EmbeddedWidget[]) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      widgets,
      metadata: {
        goalType: state.currentGoalType,
        pendingSlots: state.pendingSlots,
        collectedSlots: state.collectedSlots
      }
    };
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  }, []);

  const setGoalType = useCallback((goalType: 'schedule' | 'frequency' | 'milestone') => {
    dispatch({ type: 'SET_GOAL_TYPE', payload: goalType });
  }, []);

  const updateSlot = useCallback((slotId: string, value: SlotValue) => {
    dispatch({ type: 'UPDATE_SLOT', payload: { slotId, value } });
  }, []);

  const markComplete = useCallback((quests: any[]) => {
    dispatch({ type: 'MARK_COMPLETE', payload: quests });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const updateUserState = useCallback((userState: any) => {
    dispatch({ type: 'UPDATE_USER_STATE', payload: userState });
  }, []);

  const classifyAndSetGoalType = useCallback(async (title: string) => {
    const goalType = await classifyGoalTypeFromTitleWithAI(title);
    setGoalType(goalType);
    return goalType;
  }, [setGoalType]);

  return {
    state,
    actions: {
      addMessage,
      setGoalType,
      updateSlot,
      markComplete,
      reset,
      updateUserState,
      classifyAndSetGoalType
    }
  };
}

// Helper functions for chatbot flow
export async function generateNextQuestionWithAI(
  goalType: 'schedule' | 'frequency' | 'milestone',
  pendingSlots: string[],
  collectedSlots: Record<string, SlotValue>,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userState?: any
): Promise<{ 
  question: string; 
  widgets: EmbeddedWidget[]; 
  userState?: any;
  extractedSchedule?: {
    weekdays?: number[];
    time?: string;
    weeklySchedule?: Record<string, string[]>;
  };
  conversationComplete?: boolean;
  quests?: Array<{
    id: string;
    title: string;
    description: string;
    targetDate: string;
    verification: string[];
    difficulty?: string;
    estimatedTime?: string;
    tips?: string[];
  }>;
}> {
  console.log('[generateNextQuestionWithAI] Called with:', {
    goalType,
    pendingSlots,
    pendingSlotsLength: pendingSlots.length,
    collectedSlotsKeys: Object.keys(collectedSlots),
    collectedSlotsCount: Object.keys(collectedSlots).length
  });

  if (pendingSlots.length === 0) {
    console.log('[generateNextQuestionWithAI] No pending slots, returning completion message');
    return {
      question: '모든 정보가 수집되었습니다. 퀘스트를 생성하겠습니다.',
      widgets: [],
      userState: undefined,
      extractedSchedule: undefined,
      conversationComplete: false,
      quests: undefined
    };
  }

  try {
    // Use AI to generate conversational question
    const aiResponse = await AIService.generateConversationalQuestion({
      goalType,
      collectedSlots,
      pendingSlots,
      conversationHistory
    });

    // Update user state if provided by AI
    if (aiResponse.userState) {
      console.log('[generateNextQuestionWithAI] AI provided user state:', aiResponse.userState);
    }

    // Process extracted schedule information if provided by AI
    if (aiResponse.extractedSchedule) {
      console.log('[generateNextQuestionWithAI] AI extracted schedule:', aiResponse.extractedSchedule);
      
      // Store extracted schedule data for auto-population
      if (aiResponse.extractedSchedule.weekdays) {
        // This will be handled by the component to update slots
        console.log('[generateNextQuestionWithAI] Extracted weekdays:', aiResponse.extractedSchedule.weekdays);
      }
      if (aiResponse.extractedSchedule.time) {
        console.log('[generateNextQuestionWithAI] Extracted time:', aiResponse.extractedSchedule.time);
      }
      if (aiResponse.extractedSchedule.weeklySchedule) {
        console.log('[generateNextQuestionWithAI] Extracted weekly schedule:', aiResponse.extractedSchedule.weeklySchedule);
      }
    }

    // Convert AI widgets to our widget format with extracted data
    const widgets: EmbeddedWidget[] = (aiResponse.widgets || []).map((widget, index) => {
      let props = widget.props || {};
      
      // Add extracted schedule data to calendar widget
      if (widget.type === 'calendar' && aiResponse.extractedSchedule) {
        props = {
          ...props,
          extractedSchedule: aiResponse.extractedSchedule
        };
      }
      
      return {
        id: `ai-widget-${index}`,
        type: widget.type as any,
        slotId: widget.slotId,
        label: widget.slotId === 'period' ? '기간 선택' : 
               widget.slotId === 'weekdays' ? '요일 선택' :
               widget.slotId === 'time' ? '시간 선택' :
               widget.slotId === 'perWeek' ? '주간 횟수' :
               widget.slotId === 'verification' ? '검증 방법' :
               widget.slotId === 'successRate' ? '성공률' :
               widget.slotId === 'milestones' ? '단계 설정' :
               widget.slotId === 'currentState' ? '현재 상태' : '선택',
        props,
        onSelect: () => {}
      };
    });

    console.log('[generateNextQuestionWithAI] AI generated question:', {
      question: aiResponse.question,
      widgets: widgets.map(w => ({ type: w.type, slotId: w.slotId })),
      userState: aiResponse.userState,
      extractedSchedule: aiResponse.extractedSchedule
    });

    return {
      question: aiResponse.question,
      widgets,
      userState: aiResponse.userState,
      extractedSchedule: aiResponse.extractedSchedule,
      conversationComplete: aiResponse.conversationComplete,
      quests: aiResponse.quests
    };
  } catch (error) {
    console.error('[generateNextQuestionWithAI] AI generation failed:', error);
    return {
      question: '죄송합니다. 잠시 후 다시 시도해주세요.',
      widgets: [],
      userState: undefined,
      extractedSchedule: undefined,
      conversationComplete: false,
      quests: undefined
    };
  }
}

// 휴리스틱 기반 질문 생성 함수 제거됨 - AI 기반으로 완전 대체
// generateNextQuestion 함수는 더 이상 사용되지 않음

export function formatGoalTypeConfirmation(goalType: 'schedule' | 'frequency' | 'milestone'): string {
  const typeLabels = {
    schedule: '스케줄형 목표',
    frequency: '빈도형 목표',
    milestone: '마일스톤형 목표'
  };

  const descriptions = {
    schedule: '정해진 요일과 시간에 진행하는 목표',
    frequency: '주당 특정 횟수를 달성하는 목표',
    milestone: '단계별로 진행하는 프로젝트형 목표'
  };

  return `이 목표는 ${typeLabels[goalType]}로 분류됩니다.\n${descriptions[goalType]}\n\n맞나요?`;
}
