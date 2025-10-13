// Slot schemas for different goal types - defines required information per goal type

import { SlotSchema } from '../../types/chatbot';

export const SCHEDULE_SLOTS: SlotSchema = {
  goalType: 'schedule',
  slots: [
    {
      id: 'title',
      name: 'Goal Title',
      type: 'text',
      required: true,
      label: '목표 제목',
      description: '달성하고자 하는 목표를 입력해주세요'
    },
    {
      id: 'period',
      name: 'Period',
      type: 'calendar', // Simple date range selection only
      required: true,
      label: '기간',
      description: '목표를 진행할 기간을 선택해주세요'
    },
    {
      id: 'weekdays',
      name: 'Weekdays',
      type: 'weekdays', // Separate weekday selection
      required: true,
      label: '요일',
      description: '어떤 요일에 진행할까요?'
    },
    {
      id: 'time',
      name: 'Time',
      type: 'timePicker', // Separate time selection
      required: true,
      label: '시간',
      description: '몇 시에 진행할까요?'
    },
    {
      id: 'verification',
      name: 'Verification Methods',
      type: 'chips',
      required: true,
      label: '검증 방법',
      description: '목표 달성을 확인할 방법을 선택해주세요',
      options: ['사진', '위치 등록', '체크리스트'],
      defaultValue: ['위치 등록', '체크리스트'] // Recommended for schedule goals
    },
    {
      id: 'successRate',
      name: 'Success Rate Target',
      type: 'counter',
      required: true,
      label: '목표 달성률',
      description: '몇 퍼센트 이상 달성하면 성공으로 인정할까요?',
      min: 50,
      max: 100,
      defaultValue: 80
    }
  ]
};

export const FREQUENCY_SLOTS: SlotSchema = {
  goalType: 'frequency',
  slots: [
    {
      id: 'title',
      name: 'Goal Title',
      type: 'text',
      required: true,
      label: '목표 제목',
      description: '달성하고자 하는 목표를 입력해주세요'
    },
    {
      id: 'period',
      name: 'Period',
      type: 'dateRange',
      required: true,
      label: '기간',
      description: '목표를 진행할 기간을 선택해주세요'
    },
    {
      id: 'perWeek',
      name: 'Frequency per Week',
      type: 'counter',
      required: true,
      label: '주당 횟수',
      description: '일주일에 몇 번 달성할 것인지 선택해주세요',
      min: 1,
      max: 7,
      defaultValue: 3
    },
    {
      id: 'verification',
      name: 'Verification Methods',
      type: 'chips',
      required: true,
      label: '검증 방법',
      description: '목표 달성을 확인할 방법을 선택해주세요',
      options: ['사진', '위치 등록', '체크리스트'],
      defaultValue: ['체크리스트'] // Recommended for frequency goals
    },
    {
      id: 'successRate',
      name: 'Success Rate Target',
      type: 'counter',
      required: true,
      label: '목표 달성률',
      description: '몇 퍼센트 이상 달성하면 성공으로 인정할까요?',
      min: 50,
      max: 100,
      defaultValue: 80
    }
  ]
};

export const MILESTONE_SLOTS: SlotSchema = {
  goalType: 'milestone',
  slots: [
    {
      id: 'title',
      name: 'Goal Title',
      type: 'text',
      required: true,
      label: '목표 제목',
      description: '달성하고자 하는 목표를 입력해주세요'
    },
    {
      id: 'period',
      name: 'Period',
      type: 'dateRange',
      required: true,
      label: '기간',
      description: '목표를 진행할 기간을 선택해주세요'
    },
    {
      id: 'milestones',
      name: 'Milestone Steps',
      type: 'text',
      required: true,
      label: '단계 목록',
      description: '목표를 단계별로 나누어주세요 (AI가 자동으로 생성합니다)'
    },
    {
      id: 'currentState',
      name: 'Current State',
      type: 'text',
      required: true,
      label: '현재 상태',
      description: '현재 어느 수준인지 알려주세요'
    },
    {
      id: 'verification',
      name: 'Verification Methods',
      type: 'chips',
      required: true,
      label: '검증 방법',
      description: '목표 달성을 확인할 방법을 선택해주세요',
      options: ['사진', '위치 등록', '체크리스트'],
      defaultValue: ['체크리스트']
    },
    {
      id: 'successRate',
      name: 'Success Rate Target',
      type: 'counter',
      required: true,
      label: '목표 달성률',
      description: '몇 퍼센트 이상 달성하면 성공으로 인정할까요?',
      min: 50,
      max: 100,
      defaultValue: 80
    }
  ]
};

export const SLOT_SCHEMAS: Record<string, SlotSchema> = {
  schedule: SCHEDULE_SLOTS,
  frequency: FREQUENCY_SLOTS,
  milestone: MILESTONE_SLOTS
};

// Helper functions
export function getSchemaForGoalType(goalType: 'schedule' | 'frequency' | 'milestone'): SlotSchema {
  return SLOT_SCHEMAS[goalType];
}

export function getRequiredSlots(goalType: 'schedule' | 'frequency' | 'milestone'): string[] {
  const schema = getSchemaForGoalType(goalType);
  return schema.slots.filter(slot => slot.required).map(slot => slot.id);
}

export function getMissingSlots(goalType: 'schedule' | 'frequency' | 'milestone', collectedSlots: Record<string, any>): string[] {
  const required = getRequiredSlots(goalType);
  const missing = required.filter(slotId => {
    const value = collectedSlots[slotId];

    console.log(`[getMissingSlots] Checking slot ${slotId}:`, {
      value,
      valueType: typeof value,
      hasValue: value !== null && value !== undefined && value !== ''
    });

    // null, undefined, 빈 문자열 체크
    if (value === null || value === undefined || value === '') {
      console.log(`[getMissingSlots] Slot ${slotId} is missing (null/undefined/empty)`);
      return true;
    }

    // 배열인 경우 빈 배열 체크
    if (Array.isArray(value)) {
      const isEmpty = value.length === 0;
      console.log(`[getMissingSlots] Slot ${slotId} is array, empty:`, isEmpty);
      return isEmpty;
    }

    // 객체인 경우 특별 처리
    if (typeof value === 'object') {
      // period 슬롯의 경우 startDate와 endDate가 있는지 체크
      if (slotId === 'period') {
        const hasStartDate = value && value.startDate;
        const hasEndDate = value && value.endDate;
        const isEmpty = !hasStartDate || !hasEndDate;
        console.log(`[getMissingSlots] Slot ${slotId} (period):`, {
          value,
          hasStartDate,
          hasEndDate,
          isEmpty
        });
        return isEmpty;
      }
      // 다른 객체 슬롯의 경우 빈 객체인지 체크
      const isEmpty = Object.keys(value).length === 0;
      console.log(`[getMissingSlots] Slot ${slotId} is object, empty:`, isEmpty);
      return isEmpty;
    }

    // 숫자인 경우 0 체크 (성공률 등)
    if (typeof value === 'number') {
      const isEmpty = value <= 0;
      console.log(`[getMissingSlots] Slot ${slotId} is number, empty:`, isEmpty);
      return isEmpty;
    }

    console.log(`[getMissingSlots] Slot ${slotId} is valid`);
    return false;
  });

  console.log('[getMissingSlots] Final result:', {
    goalType,
    required,
    collectedSlotsKeys: Object.keys(collectedSlots),
    collectedSlots,
    missing,
    missingCount: missing.length,
    slotChecks: required.map(slotId => ({
      slotId,
      value: collectedSlots[slotId],
      valueType: typeof collectedSlots[slotId],
      isMissing: missing.includes(slotId)
    }))
  });

  return missing;
}

export function isSlotComplete(goalType: 'schedule' | 'frequency' | 'milestone', collectedSlots: Record<string, any>): boolean {
  const missingSlots = getMissingSlots(goalType, collectedSlots);
  const isComplete = missingSlots.length === 0;
  
  console.log('[isSlotComplete]', {
    goalType,
    missingSlots,
    isComplete
  });
  
  return isComplete;
}
