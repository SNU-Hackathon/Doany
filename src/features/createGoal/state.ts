import React, { createContext, ReactNode, useContext, useReducer } from 'react';

// State shape
export interface CreateGoalState {
  step: 0 | 1 | 2; // 0: AI/Title & Category, 1: Date & Duration, 2: Review
  basic: {
    title: string;
    category: string;
    description?: string;
  };
  schedule: {
    startDate: string;
    endDate: string;
    weekdays: number[];
    timeOfDay: string;
    frequency: { count: number; unit: string };
    duration: { type: string; value: number };
  };
  verification: {
    methods: string[];
  };
  targetLocation?: {
    name: string;
    placeId?: string;
    lat: number;
    lng: number;
    address?: string;
  };
  deposit?: {
    amount: number;
    currency: string;
  };
}

// Actions
export type CreateGoalAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_BASIC'; payload: Partial<CreateGoalState['basic']> }
  | { type: 'SET_SCHEDULE'; payload: Partial<CreateGoalState['schedule']> }
  | { type: 'SET_VERIFICATION'; payload: Partial<CreateGoalState['verification']> }
  | { type: 'SET_TARGET_LOCATION'; payload: CreateGoalState['targetLocation'] }
  | { type: 'SET_DEPOSIT'; payload: Partial<CreateGoalState['deposit']> }
  | { type: 'RESET' };

// Initial state
const initialState: CreateGoalState = {
  step: 0,
  basic: {
    title: '',
    category: '',
    description: '',
  },
  schedule: {
    startDate: '',
    endDate: '',
    weekdays: [],
    timeOfDay: '10:00',
    frequency: { count: 1, unit: 'per_week' },
    duration: { type: 'weeks', value: 2 },
  },
  verification: {
    methods: [],
  },
  targetLocation: undefined,
  deposit: undefined,
};

// Reducer
function createGoalReducer(state: CreateGoalState, action: CreateGoalAction): CreateGoalState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload as 0 | 1 | 2 };
    case 'NEXT_STEP':
      return { ...state, step: Math.min(state.step + 1, 2) as 0 | 1 | 2 };
    case 'PREV_STEP':
      return { ...state, step: Math.max(state.step - 1, 0) as 0 | 1 | 2 };
    case 'SET_BASIC':
      return { ...state, basic: { ...state.basic, ...action.payload } };
    case 'SET_SCHEDULE':
      return { ...state, schedule: { ...state.schedule, ...action.payload } };
    case 'SET_VERIFICATION':
      return { ...state, verification: { ...state.verification, ...action.payload } };
    case 'SET_TARGET_LOCATION':
      return { ...state, targetLocation: action.payload };
    case 'SET_DEPOSIT':
      if (action.payload && typeof action.payload === 'object') {
        return { 
          ...state, 
          deposit: state.deposit ? { ...state.deposit, ...action.payload } : action.payload as CreateGoalState['deposit']
        };
      }
      return state;
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// Context
interface CreateGoalContextType {
  state: CreateGoalState;
  dispatch: React.Dispatch<CreateGoalAction>;
  actions: {
    setStep: (step: number) => void;
    next: () => void;
    prev: () => void;
    setBasic: (data: Partial<CreateGoalState['basic']>) => void;
    setSchedule: (data: Partial<CreateGoalState['schedule']>) => void;
    setVerification: (data: Partial<CreateGoalState['verification']>) => void;
    setTargetLocation: (location: CreateGoalState['targetLocation']) => void;
    setDeposit: (data: Partial<CreateGoalState['deposit']>) => void;
    reset: () => void;
  };
}

const CreateGoalContext = createContext<CreateGoalContextType | undefined>(undefined);

// Provider
export function CreateGoalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(createGoalReducer, initialState);

  const actions = {
    setStep: (step: number) => dispatch({ type: 'SET_STEP', payload: step }),
    next: () => dispatch({ type: 'NEXT_STEP' }),
    prev: () => dispatch({ type: 'PREV_STEP' }),
    setBasic: (data: Partial<CreateGoalState['basic']>) => dispatch({ type: 'SET_BASIC', payload: data }),
    setSchedule: (data: Partial<CreateGoalState['schedule']>) => dispatch({ type: 'SET_SCHEDULE', payload: data }),
    setVerification: (data: Partial<CreateGoalState['verification']>) => dispatch({ type: 'SET_VERIFICATION', payload: data }),
    setTargetLocation: (location: CreateGoalState['targetLocation']) => dispatch({ type: 'SET_TARGET_LOCATION', payload: location }),
    setDeposit: (data: Partial<CreateGoalState['deposit']>) => dispatch({ type: 'SET_DEPOSIT', payload: data }),
    reset: () => dispatch({ type: 'RESET' }),
  };

  return React.createElement(
    CreateGoalContext.Provider,
    { value: { state, dispatch, actions } },
    children
  );
}

// Hook
export function useCreateGoal() {
  const context = useContext(CreateGoalContext);
  if (context === undefined) {
    throw new Error('useCreateGoal must be used within a CreateGoalProvider');
  }
  return context;
}
