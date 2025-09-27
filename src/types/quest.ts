// Quest data models for goal-based task management

export interface Quest {
  id: string;
  goalId: string;
  title: string;
  description?: string;
  type: QuestType;
  status: QuestStatus;
  scheduledDate?: string; // ISO date string
  weekNumber?: number; // For frequency goals
  verificationRules: VerificationRule[];
  createdAt: string;
  completedAt?: string;
  metadata?: QuestMetadata;
}

export type QuestType = 'schedule' | 'frequency' | 'milestone';
export type QuestStatus = 'pending' | 'completed' | 'failed' | 'skipped';

export interface VerificationRule {
  type: 'location' | 'photo' | 'manual' | 'time' | 'partner';
  required: boolean;
  config?: {
    location?: {
      name: string;
      coordinates?: { lat: number; lng: number };
      radius?: number; // meters
    };
    time?: {
      window: { start: string; end: string }; // HH:MM format
      tolerance?: number; // minutes
    };
    photo?: {
      required: boolean;
      exifValidation?: boolean;
    };
    partner?: {
      required: boolean;
      partnerId?: string;
    };
  };
}

export interface QuestMetadata {
  sequence?: number; // For milestone ordering
  dependencies?: string[]; // Quest IDs that must be completed first
  priority?: 'low' | 'medium' | 'high';
  estimatedDuration?: number; // minutes
  category?: string;
}

export interface QuestGenerationRequest {
  goalId: string;
  goalTitle: string;
  goalDescription?: string;
  goalType: QuestType;
  duration: {
    startDate: string;
    endDate: string;
  };
  schedule?: {
    weekdays?: number[]; // 0=Sunday, 1=Monday, etc.
    time?: string; // HH:MM format
    location?: string;
    frequency?: number; // per week
  };
  verificationMethods: string[];
  targetLocation?: {
    name: string;
    coordinates?: { lat: number; lng: number };
  };
}

export interface QuestGenerationResult {
  goalType: QuestType;
  quests: Quest[];
  totalQuests: number;
  schedule?: {
    duration: string;
    pattern: string;
  };
  metadata: {
    generatedAt: string;
    aiModel?: string;
    confidence: number; // 0-1
  };
}
