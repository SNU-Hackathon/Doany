import React, { createContext, ReactNode, useContext, useReducer } from 'react';

export type GoalType = 'schedule' | 'frequency' | 'milestone';

export interface CreateGoalState {
  type: GoalType;                // current selection (user can override)
  aiGuess?: GoalType;            // AI guessed type for badge
  title: string;
  step: number;                  // current step in the creation flow
  typeLockedByUser?: boolean;    // 사용자가 직접 타입을 바꿨는지 여부

  // schedule
  times?: Array<{ dow?: number; time?: string; atMs?: number }>; // either DOW+time or exact datetime

  // frequency / partner
  period?: { startMs: number; endMs: number };
  perWeek?: number; // frequency only

  // methods (verification signals on Create view)
  methods: { manual: boolean; location: boolean; photo: boolean };
  photo?: { exifEnabled?: boolean }; // just a flag for Create view guidance

  // milestone
  milestones?: { milestones: { key: string; label: string; targetDate?: string }[]; totalDuration?: number };

  // Additional properties for compatibility
  basic?: any;
  schedule?: any;
  verification?: any;
  targetLocation?: any;
}

export const INITIAL_CREATE_GOAL_STATE: CreateGoalState = {
  type: 'frequency', // 기본 fallback은 frequency, AI guess로 덮어씌워짐
  aiGuess: undefined,
  title: '',
  step: 0,
  times: [],
  period: undefined,
  perWeek: 3,
  methods: { manual: false, location: false, photo: false },
  photo: { exifEnabled: true },
  milestones: undefined,
  typeLockedByUser: false,
  basic: undefined,
  schedule: undefined,
  verification: undefined,
  targetLocation: undefined,
};

export async function classifyGoalTypeFromTitleWithAI(title: string): Promise<GoalType> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  
  if (!apiKey) {
    console.warn('[AI] Missing OpenAI API key, falling back to heuristic classification');
    return classifyGoalTypeFromTitle(title);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          { 
            role: 'system', 
            content: `You are a goal classification assistant. Classify the given goal title into one of three types:

1. "schedule" - Goals that have specific days of the week AND specific times (e.g., "월수금 아침 7시에 헬스장 가기", "매주 화요일 오후 3시에 영어 수업")
2. "frequency" - Goals that specify how many times per week/day/month (e.g., "주 3회 운동하기", "일주일에 2번 독서하기")  
3. "milestone" - Goals that are project-based or achievement-oriented (e.g., "유학 준비하기", "프로젝트 완성하기", "스킬 배우기")

Respond with ONLY one word: "schedule", "frequency", or "milestone"`
          },
          { 
            role: 'user', 
            content: `Classify this goal: "${title}"`
          }
        ]
      })
    });

    const data = await response.json();
    const classification = data.choices?.[0]?.message?.content?.trim().toLowerCase();
    
    if (['schedule', 'frequency', 'milestone'].includes(classification)) {
      console.log('[AI] Goal classification result:', { title, classification });
      return classification as GoalType;
    } else {
      console.warn('[AI] Invalid classification result:', classification);
      return classifyGoalTypeFromTitle(title);
    }
  } catch (error) {
    console.error('[AI] Classification failed:', error);
    return classifyGoalTypeFromTitle(title);
  }
}

export function classifyGoalTypeFromTitle(title: string): GoalType {
  const t = title.toLowerCase();
  
  // 1. Schedule: 요일 AND 시간이 모두 있는 경우  
  const hasWeekday = /(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일|mon|tue|wed|thu|fri|sat|sun)/.test(t);
  const hasTime = /(\d{1,2}:\d{2}|\d{1,2}시|\d+am|\d+pm|오전|오후|아침|저녁|at\s+\d+)/.test(t);
  
  if (hasWeekday && hasTime) return 'schedule';
  
  // 2. Frequency: 횟수 패턴
  if (/(times\s+per\s+(week|day|month))|(\bper\s+week\b)|(\bweekly\b)/.test(t) ||
      /(\d+)\s*(times?|x|회)\s*(?:a\s+|per\s+)?(?:week|daily|month|일|주|달|월)/.test(t) ||
      /주\s*\d+\s*회/.test(t) || 
      /일주일에\s*\d+/.test(t)) return 'frequency';
  
  // 3. Milestone: 큰 성취/단계적 성취 (기본값도 milestone)
  if (/(milestone|phase|stage)|\b(project|goal|skill)\s+(completion|achievement)|\b(kickoff|mid|finish|final)\b/.test(t) ||
      /하기$/.test(title.trim()) ||
      /(학습|유학|창업|완성|달성|learn|study|complete|achieve)/.test(t)) return 'milestone';
  
  // 4. Default: milestone (as per new rules)
  return 'milestone';
}

// Context and hook for Create Goal state management

interface CreateGoalActions {
  setType: (type: GoalType) => void;
  setTypeLocked: (type: GoalType, locked: boolean) => void;
  setTitle: (title: string) => void;
  setTimes: (times: Array<{ dow?: number; time?: string; atMs?: number }>) => void;
  setPeriod: (period: { startMs: number; endMs: number }) => void;
  setPerWeek: (perWeek: number) => void;
  setMethods: (methods: { manual: boolean; location: boolean; photo: boolean }) => void;
  setPhoto: (photo: { exifEnabled?: boolean }) => void;
  setMilestones: (milestones: { milestones: { key: string; label: string; targetDate?: string }[]; totalDuration?: number }) => void;
  setAiGuess: (aiGuess?: GoalType) => void;
  setStep: (step: number) => void;
  setBasic: (basic: any) => void;
  setSchedule: (schedule: any) => void;
  setVerification: (verification: any) => void;
  setTargetLocation: (targetLocation: any) => void;
  reset: () => void;
}

interface CreateGoalContextType {
  state: CreateGoalState;
  actions: CreateGoalActions;
}

const CreateGoalContext = createContext<CreateGoalContextType | undefined>(undefined);

type CreateGoalAction = 
  | { type: 'SET_TYPE'; payload: GoalType }
  | { type: 'SET_TYPE_LOCKED'; payload: { type: GoalType; locked: boolean } }
  | { type: 'SET_TITLE'; payload: string }
  | { type: 'SET_TIMES'; payload: Array<{ dow?: number; time?: string; atMs?: number }> }
  | { type: 'SET_PERIOD'; payload: { startMs: number; endMs: number } }
  | { type: 'SET_PER_WEEK'; payload: number }
  | { type: 'SET_METHODS'; payload: { manual: boolean; location: boolean; photo: boolean } }
  | { type: 'SET_PHOTO'; payload: { exifEnabled?: boolean } }
  | { type: 'SET_MILESTONES'; payload: { milestones: { key: string; label: string; targetDate?: string }[]; totalDuration?: number } }
  | { type: 'SET_AI_GUESS'; payload: GoalType | undefined }
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_BASIC'; payload: any }
  | { type: 'SET_SCHEDULE'; payload: any }
  | { type: 'SET_VERIFICATION'; payload: any }
  | { type: 'SET_TARGET_LOCATION'; payload: any }
  | { type: 'RESET' };

function createGoalReducer(state: CreateGoalState, action: CreateGoalAction): CreateGoalState {
  switch (action.type) {
    case 'SET_TYPE':
      return { ...state, type: action.payload };
    case 'SET_TYPE_LOCKED':
      return { ...state, type: action.payload.type, typeLockedByUser: action.payload.locked };
    case 'SET_TITLE':
      return { ...state, title: action.payload };
    case 'SET_TIMES':
      return { ...state, times: action.payload };
    case 'SET_PERIOD':
      return { ...state, period: action.payload };
    case 'SET_PER_WEEK':
      return { ...state, perWeek: action.payload };
    case 'SET_METHODS':
      return { ...state, methods: action.payload };
    case 'SET_PHOTO':
      return { ...state, photo: action.payload };
    case 'SET_MILESTONES':
      return { ...state, milestones: action.payload };
    case 'SET_AI_GUESS':
      return { ...state, aiGuess: action.payload };
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'SET_BASIC':
      return { ...state, basic: action.payload };
    case 'SET_SCHEDULE':
      return { ...state, schedule: action.payload };
    case 'SET_VERIFICATION':
      return { ...state, verification: action.payload };
    case 'SET_TARGET_LOCATION':
      return { ...state, targetLocation: action.payload };
    case 'RESET':
      return INITIAL_CREATE_GOAL_STATE;
    default:
      return state;
  }
}

export function CreateGoalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(createGoalReducer, INITIAL_CREATE_GOAL_STATE);

  const actions: CreateGoalActions = {
    setType: (type) => dispatch({ type: 'SET_TYPE', payload: type }),
    setTypeLocked: (type, locked) => dispatch({ type: 'SET_TYPE_LOCKED', payload: { type, locked } }),
    setTitle: (title) => dispatch({ type: 'SET_TITLE', payload: title }),
    setTimes: (times) => dispatch({ type: 'SET_TIMES', payload: times }),
    setPeriod: (period) => dispatch({ type: 'SET_PERIOD', payload: period }),
    setPerWeek: (perWeek) => dispatch({ type: 'SET_PER_WEEK', payload: perWeek }),
    setMethods: (methods) => dispatch({ type: 'SET_METHODS', payload: methods }),
    setPhoto: (photo) => dispatch({ type: 'SET_PHOTO', payload: photo }),
    setMilestones: (milestones) => dispatch({ type: 'SET_MILESTONES', payload: milestones }),
    setAiGuess: (aiGuess) => dispatch({ type: 'SET_AI_GUESS', payload: aiGuess }),
    setStep: (step) => dispatch({ type: 'SET_STEP', payload: step }),
    setBasic: (basic) => dispatch({ type: 'SET_BASIC', payload: basic }),
    setSchedule: (schedule) => dispatch({ type: 'SET_SCHEDULE', payload: schedule }),
    setVerification: (verification) => dispatch({ type: 'SET_VERIFICATION', payload: verification }),
    setTargetLocation: (targetLocation) => dispatch({ type: 'SET_TARGET_LOCATION', payload: targetLocation }),
    reset: () => dispatch({ type: 'RESET' }),
  };

  return (
    <CreateGoalContext.Provider value={{ state, actions }}>
      {children}
    </CreateGoalContext.Provider>
  );
}

export function useCreateGoal() {
  const context = useContext(CreateGoalContext);
  if (context === undefined) {
    throw new Error('useCreateGoal must be used within a CreateGoalProvider');
  }
  return context;
}