// Quest data models for goal-based task management

export interface Quest {
  id: string;
  goalId: string;
  title: string;
  description?: string;
  type?: QuestType;
  status: QuestStatus;
  targetDate?: string; // ISO date string (YYYY-MM-DD) - preferred for new quests
  scheduledDate?: string; // ISO date string - legacy field
  weekNumber?: number; // For frequency goals
  sequence?: number; // For milestone goals
  verificationPhotos?: string[]; // Array of photo URLs from verifications
  verification?: string[]; // Verification methods (사진, 위치 등록, etc.)
  verificationRules?: VerificationRule[]; // Legacy detailed rules
  difficulty?: string; // easy, medium, hard
  estimatedTime?: string; // e.g., "60분"
  tips?: string[]; // Quest tips
  createdAt?: string | Date;
  updatedAt?: string | Date;
  completedAt?: string;
  metadata?: QuestMetadata;
  userId?: string; // User who owns this quest
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
  originalGoalData?: {
    category?: string;
    notes?: string;
    weeklyWeekdays?: number[];
    weeklySchedule?: any;
    schedule?: any;
    includeDates?: string[];
    excludeDates?: string[];
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
