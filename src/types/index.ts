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

export type VerificationType = 'location' | 'time' | 'screentime' | 'manual';
export type TimeFrame = 'daily' | 'weekly' | 'monthly';
export type VerificationStatus = 'success' | 'fail';

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

// AI Goal types
export interface AIGoal {
  title: string;
  category?: string;
  verificationMethods: VerificationType[];
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
  weeklySchedule?: { [key: string]: string };
}
