// Chatbot system types for embedded controls and slot-based data collection

export type SlotValue = 
  | string 
  | number 
  | boolean 
  | Date 
  | string[] 
  | number[] 
  | null 
  | { startDate: string; endDate: string }
  | { startDate: string; endDate: string; weeklySchedule?: any; weekdays?: number[] }
  | { autoWeeklySchedule?: any; autoWeekdays?: number[]; [key: string]: any };

export interface Slot {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'dateRange' | 'chips' | 'toggle' | 'counter' | 'calendar' | 'timePicker' | 'weekdays';
  required: boolean;
  value?: SlotValue;
  options?: string[]; // For chips/select
  min?: number; // For counter/number
  max?: number; // For counter/number
  defaultValue?: SlotValue;
  label?: string;
  description?: string;
}

export interface SlotSchema {
  goalType: 'schedule' | 'frequency' | 'milestone';
  slots: Slot[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  widgets?: EmbeddedWidget[];
  metadata?: {
    goalType?: 'schedule' | 'frequency' | 'milestone';
    pendingSlots?: string[];
    collectedSlots?: Record<string, SlotValue>;
  };
}

export type WidgetType = 'calendar' | 'chips' | 'toggle' | 'counter' | 'timePicker' | 'weekdays';

export interface EmbeddedWidget {
  id: string;
  type: WidgetType;
  slotId: string;
  label: string;
  props: Record<string, any>;
  onSelect: (value: SlotValue) => void;
}

export interface UserState {
  currentLevel?: 'beginner' | 'intermediate' | 'advanced';
  experience?: string;
  timeline?: 'urgent' | 'moderate' | 'flexible';
  resources?: string;
}

export interface ChatbotState {
  messages: ChatMessage[];
  currentGoalType?: 'schedule' | 'frequency' | 'milestone';
  pendingSlots: string[];
  collectedSlots: Record<string, SlotValue>;
  isComplete: boolean;
  questPreview?: any[]; // Generated quests when complete
  userState?: UserState;
}

export type ChatbotAction = 
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_GOAL_TYPE'; payload: 'schedule' | 'frequency' | 'milestone' }
  | { type: 'UPDATE_SLOT'; payload: { slotId: string; value: SlotValue } }
  | { type: 'SET_PENDING_SLOTS'; payload: string[] }
  | { type: 'MARK_COMPLETE'; payload: any[] } // quests
  | { type: 'UPDATE_USER_STATE'; payload: UserState }
  | { type: 'RESET' };
