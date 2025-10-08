// Deterministic quest generation logic - replaces AI-based quest generation

import { SlotValue } from '../../types/chatbot';

export interface GeneratedQuest {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  verification: string[];
  metadata: {
    dayOfWeek?: number;
    time?: string;
    type: 'schedule' | 'frequency' | 'milestone';
    weekNumber?: number;
    occurrence?: number;
  };
}

// Generate quests based on collected slot data using deterministic rules
export async function generateDeterministicQuests(
  goalType: 'schedule' | 'frequency' | 'milestone',
  collectedSlots: Record<string, SlotValue>
): Promise<GeneratedQuest[]> {
  
  console.log('[DeterministicQuests] Generating quests for:', {
    goalType,
    collectedSlots
  });

  switch (goalType) {
    case 'schedule':
      return generateScheduleQuests(collectedSlots);
    case 'frequency':
      return generateFrequencyQuests(collectedSlots);
    case 'milestone':
      return generateMilestoneQuests(collectedSlots);
    default:
      throw new Error(`Unknown goal type: ${goalType}`);
  }
}

function generateScheduleQuests(slots: Record<string, SlotValue>): GeneratedQuest[] {
  const title = String(slots.title || '목표');
  const period = slots.period as { startDate: string; endDate: string };
  const weekdays = slots.weekdays as number[];
  const time = String(slots.time || '09:00');
  const verification = slots.verification as string[];

  if (!period || !weekdays || weekdays.length === 0) {
    throw new Error('Schedule goal requires period and weekdays');
  }

  const startDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);
  const quests: GeneratedQuest[] = [];

  // Generate quests for each occurrence
  let currentDate = new Date(startDate);
  let questId = 1;

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    
    if (weekdays.includes(dayOfWeek)) {
      quests.push({
        id: `schedule-${questId}`,
        title: `${title} - ${formatDate(currentDate)}`,
        description: `${formatWeekday(dayOfWeek)} ${time}에 "${title}" 목표를 달성하세요.`,
        targetDate: formatDateISO(currentDate),
        verification: verification || ['manual', 'time'],
        metadata: {
          dayOfWeek,
          time,
          type: 'schedule',
          occurrence: questId
        }
      });
      questId++;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return quests.slice(0, 100); // Limit to 100 quests
}

function generateFrequencyQuests(slots: Record<string, SlotValue>): GeneratedQuest[] {
  const title = String(slots.title || '목표');
  const period = slots.period as { startDate: string; endDate: string };
  const perWeek = Number(slots.perWeek || 3);
  const allowedDays = slots.allowedDays as number[] || [1, 2, 3, 4, 5]; // Default to weekdays
  const verification = slots.verification as string[];

  if (!period) {
    throw new Error('Frequency goal requires period');
  }

  const startDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);
  const quests: GeneratedQuest[] = [];

  // Calculate number of weeks
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.ceil(totalDays / 7);

  let questId = 1;

  for (let week = 0; week < totalWeeks; week++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + (week * 7));
    
    // Generate specified number of quests for this week
    for (let occurrence = 1; occurrence <= perWeek; occurrence++) {
      // Find a valid day within allowed days
      const validDays = allowedDays.filter(day => {
        const checkDate = new Date(weekStart);
        checkDate.setDate(weekStart.getDate() + ((day - weekStart.getDay() + 7) % 7));
        return checkDate >= startDate && checkDate <= endDate;
      });

      if (validDays.length === 0) continue;

      // Distribute occurrences across valid days
      const selectedDayIndex = (occurrence - 1) % validDays.length;
      const selectedDay = validDays[selectedDayIndex];
      
      const questDate = new Date(weekStart);
      questDate.setDate(weekStart.getDate() + ((selectedDay - weekStart.getDay() + 7) % 7));

      if (questDate <= endDate) {
        quests.push({
          id: `frequency-${questId}`,
          title: `${title} - ${occurrence}/${perWeek} (${week + 1}주차)`,
          description: `${formatWeekday(selectedDay)}에 "${title}" 목표를 달성하세요. (이번 주 ${occurrence}번째)`,
          targetDate: formatDateISO(questDate),
          verification: verification || ['manual'],
          metadata: {
            dayOfWeek: selectedDay,
            type: 'frequency',
            weekNumber: week + 1,
            occurrence
          }
        });
        questId++;
      }
    }
  }

  return quests.slice(0, 100); // Limit to 100 quests
}

function generateMilestoneQuests(slots: Record<string, SlotValue>): GeneratedQuest[] {
  const title = String(slots.title || '목표');
  const period = slots.period as { startDate: string; endDate: string };
  const milestones = slots.milestones as string[] || ['kickoff', 'mid', 'finish'];
  const verification = slots.verification as string[];

  if (!period) {
    throw new Error('Milestone goal requires period');
  }

  const startDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const quests: GeneratedQuest[] = [];

  milestones.forEach((milestone, index) => {
    // Distribute milestones evenly across the period
    const progressRatio = milestones.length === 1 ? 1 : index / (milestones.length - 1);
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + Math.floor(totalDays * progressRatio));

    const milestoneLabels: Record<string, string> = {
      kickoff: '시작',
      mid: '중간 점검',
      finish: '완료'
    };

    quests.push({
      id: `milestone-${index + 1}`,
      title: `${title} - ${milestoneLabels[milestone] || milestone}`,
      description: `"${title}" 목표의 ${milestoneLabels[milestone] || milestone} 단계를 완료하세요.`,
      targetDate: formatDateISO(targetDate),
      verification: verification || ['manual'],
      metadata: {
        type: 'milestone',
        occurrence: index + 1
      }
    });
  });

  return quests;
}

// Helper functions
function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatWeekday(dayOfWeek: number): string {
  const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return weekdays[dayOfWeek];
}

// Validation functions
export function validateQuestGeneration(
  goalType: 'schedule' | 'frequency' | 'milestone',
  collectedSlots: Record<string, SlotValue>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Common validations
  if (!collectedSlots.title) {
    errors.push('목표 제목이 필요합니다.');
  }

  if (!collectedSlots.period) {
    errors.push('목표 기간이 필요합니다.');
  }

  // Type-specific validations
  switch (goalType) {
    case 'schedule':
      if (!collectedSlots.weekdays || !(collectedSlots.weekdays as any[]).length) {
        errors.push('스케줄 목표는 요일 선택이 필요합니다.');
      }
      if (!collectedSlots.time) {
        errors.push('스케줄 목표는 시간 선택이 필요합니다.');
      }
      break;

    case 'frequency':
      if (!collectedSlots.perWeek || Number(collectedSlots.perWeek) < 1) {
        errors.push('빈도 목표는 주당 횟수가 필요합니다.');
      }
      break;

    case 'milestone':
      if (!collectedSlots.milestones || !(collectedSlots.milestones as any[]).length) {
        errors.push('마일스톤 목표는 단계 설정이 필요합니다.');
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
