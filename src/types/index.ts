// TypeScript type definitions for Doany app

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
  depositBalance: number;
  points: number;
}

export interface Location {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  placeId?: string;
}

// New location types for the location picker
export interface TargetLocation {
  name: string;
  placeId?: string;
  lat: number;
  lng: number;
  address?: string;
}

export interface PlacePrediction {
  placeId: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

export type VerificationType = 'location' | 'time' | 'screentime' | 'photo' | 'manual';
export type TimeFrame = 'daily' | 'weekly' | 'monthly';
export type VerificationStatus = 'success' | 'fail';

// GoalSpec type for AI-generated goal specifications
export interface GoalSpec {
  title: string;
  verification: {
    methods: VerificationType[];
    mandatory: VerificationType[];
    constraints?: {
      location?: {
        mode?: 'geofence' | 'movement';
        name?: string;
        placeId?: string;
        radiusM?: number;
        minDwellMin?: number;
        minDistanceKm?: number;
        evidence?: 'GPS' | 'HealthKit' | 'GoogleFit';
      };
      screentime?: {
        bundleIds?: string[];
        category?: string;
      };
      photo?: {
        required?: boolean;
      };
    };
    sufficiency: boolean;
    rationale: string;
  };
  schedule: {
    countRule?: {
      operator: '>=' | '==' | '<=';
      count: number;
      unit: 'per_week' | 'per_day' | 'per_month';
    };
    weekdayConstraints?: number[];
    timeRules?: Array<{
      days: number[]; // 0=Sun..6=Sat
      range: [string, string]; // HH:MM format
      label?: string;
      source: 'user_text' | 'inferred';
    }>;
    timeWindows?: Array<{
      label: string;
      range: [string, string]; // HH:MM format
      source: 'user_text' | 'inferred';
    }>;
    weekBoundary?: 'startWeekday' | 'isoWeek';
    enforcePartialWeeks?: boolean;
    requiresDisambiguation?: boolean;
    followUpQuestion?: string;
  };
  missingFields?: string[];
}

export interface GoalFrequency {
  count: number;
  unit: 'per_day' | 'per_week' | 'per_month';
}

export interface GoalDuration {
  type: 'days' | 'weeks' | 'months' | 'range';
  value?: number;
  startDate?: string;
  endDate?: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  verificationMethods: VerificationType[]; // Multiple verification methods allowed
  // AI-selected mandatory methods (locked in UI); optional field on stored goals
  lockedVerificationMethods?: VerificationType[];
  targetLocation?: TargetLocation;
  frequency: GoalFrequency;
  duration: GoalDuration;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Legacy fields for backward compatibility
  verificationType?: VerificationType;
  timeFrame?: TimeFrame;
  startDate?: Date;
  endDate?: Date;
  
  // Weekly schedule and per-date overrides
  needsWeeklySchedule?: boolean;
  weeklySchedule?: { [key: string]: string[] };
  weeklyWeekdays?: number[];
  includeDates?: string[]; // YYYY-MM-DD within duration
  excludeDates?: string[]; // YYYY-MM-DD within duration
  
  // AI-generated schedule specifications
  schedule?: {
    countRule?: { count: number; operator: string; unit: string };
    timeWindows?: Array<{ label: string; range: [string, string]; source: string }>;
    weekdayConstraints?: number[];
    weekBoundary?: 'startWeekday' | 'isoWeek';
    enforcePartialWeeks?: boolean;
  };
}

export interface Verification {
  id: string;
  goalId: string;
  userId: string;
  status: VerificationStatus;
  timestamp: Date;
  location?: Location;
  screenshotUrl?: string;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  
  GoalDetail: { goalId: string };
  LocationPicker: { 
    returnTo?: string; 
    onSelect?: (location: TargetLocation) => void;
  };
};

export type MainTabParamList = {
  MyGoals: undefined;
  Calendar: undefined;
  Profile: undefined;
};

// Auth context types
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Screen time tracking type
export interface ScreenTimeData {
  appName: string;
  duration: number; // in minutes
  date: Date;
}

// Calendar event type for unified schedule management
export interface CalendarEvent {
  id: string;          // uuid
  date: string;        // YYYY-MM-DD (Asia/Seoul 기준)
  time?: string;       // "HH:mm"
  goalId: string;
  source: 'weekly' | 'override';
  createdAt?: Date;
  updatedAt?: Date;
}

// Validation result type for goal validation
export interface ValidationResult {
  isCompatible: boolean;
  issues: string[];
  fixes?: Record<string, any>;
  summary: string;
  completeWeekCount: number;
  validationDetails: {
    frequencyCheck: { passed: boolean; details: string };
    weekdayCheck: { passed: boolean; details: string };
    timeCheck: { passed: boolean; details: string };
  };
}

// AI Goal types
export interface AIGoal {
  title: string;
  category?: string;
  verificationMethods: VerificationType[];
  // Subset of verificationMethods that are required and cannot be deselected by the user
  mandatoryVerificationMethods?: VerificationType[];
  frequency: {
    count: number;
    unit: 'per_day' | 'per_week' | 'per_month';
  };
  duration: {
    type: 'days' | 'weeks' | 'months' | 'range';
    value?: number;
    startDate?: string;
    endDate?: string;
  };
  targetLocation?: {
    name: string;
    lat?: number;
    lng?: number;
    placeId?: string;
  };
  notes?: string;
  missingFields?: string[];
  followUpQuestion?: string;
  needsWeeklySchedule?: boolean;
  weeklySchedule?: { [key: string]: string }; // Day-specific time settings (e.g., { "monday": "09:00", "wednesday": "14:00" })
  // Added to carry index-based schedule representation
  weeklyWeekdays?: number[];
  weeklyTimeSettings?: { [key: number]: string[] } | { [key: string]: string[] };
}

export interface AIContext {
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  partialGoal?: Partial<AIGoal>;
}

// Goal creation form type
export interface CreateGoalForm {
  title: string;
  description: string;
  category: string;
  verificationMethods: VerificationType[];
  // Methods selected by AI as mandatory and locked in the UI
  lockedVerificationMethods?: VerificationType[];
  targetLocation?: TargetLocation;
  frequency: GoalFrequency;
  duration: GoalDuration;
  notes?: string;
  
  // Legacy fields for backward compatibility
  verificationType?: VerificationType;
  timeFrame?: TimeFrame;
  startDate?: Date;
  endDate?: Date;
  
  // Weekly schedule support
  needsWeeklySchedule?: boolean;
  weeklySchedule?: { [key: string]: string[] };
  weeklyWeekdays?: number[];
  includeDates?: string[];
  excludeDates?: string[];
  
  // AI-generated schedule specifications
  schedule?: {
    countRule?: { count: number; operator: string; unit: string };
    timeWindows?: Array<{ label: string; range: [string, string]; source: string }>;
    weekdayConstraints?: number[];
    weekBoundary?: 'startWeekday' | 'isoWeek';
    enforcePartialWeeks?: boolean;
  };
}
