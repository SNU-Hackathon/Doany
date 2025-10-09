// TypeScript interfaces for Firestore data models
// Provides type safety for Firebase Firestore operations

import { Timestamp } from 'firebase/firestore';

export type GoalType = 'schedule' | 'frequency' | 'milestone';

export interface PhotoEvidence {
  present: boolean;
  url?: string;
  exif?: {
    timestampMs?: number;
    location?: { lat: number; lng: number };
    deviceModel?: string;
  };
  validationResult?: {
    timeValid?: boolean;
    locationValid?: boolean;
    freshnessValid?: boolean;
  };
}

export interface VerificationSignals {
  time?: { present: boolean; windowStart?: number | null; windowEnd?: number | null };
  location?: { present: boolean; inside?: boolean; lat?: number; lng?: number; radiusM?: number };
  manual?: { present: boolean; pass?: boolean };
  photo?: PhotoEvidence;
  partner?: { reviewed?: boolean; approved?: boolean };
}

export interface VerificationDoc {
  id: string;
  goalId: string;
  createdAt: number;
  // 기존 status, photoUrl 등의 필드는 유지
  signals?: VerificationSignals;
  autoPass?: boolean;
  finalPass?: boolean;
  isDuplicate?: boolean; // Flag for duplicate PASS attempts
}

export interface GoalDoc {
  id: string;
  type: GoalType;
  scheduleSpec?: {
    events: Array<{ start: string; end?: string | null; tz?: string; locationId?: string | null }>;
  };
  frequencySpec?: {
    window: { start: string; end: string };
    targetCount: number;
    locationId?: string | null;
  };
}

export interface PartnerChatMessage {
  id: string;
  verificationId: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: Timestamp;
}

export interface PartnerReview {
  id: string;
  verificationId: string;
  partnerId: string;
  partnerName: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  createdAt: Timestamp;
  reviewedAt?: Timestamp;
}

/**
 * User document in the users collection
 * Path: users/{uid}
 */
export interface User {
  uid: string;
  name: string;
  email: string;
  createdAt: Timestamp;
}

/**
 * Goal document in the user's goals subcollection
 * Path: users/{uid}/goals/{goalId}
 */
export interface Goal {
  id: string;
  title: string;
  category: string;
  verificationMethods: string[];
  frequency: string;
  duration: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  startDate: Timestamp;
  createdAt: Timestamp;
}

/**
 * Activity document in the user's activities subcollection
 * Path: users/{uid}/activities/{activityId}
 */
export interface Activity {
  id: string;
  goalId: string;
  date: Timestamp;
  status: 'completed' | 'missed' | 'partial';
  notes: string;
  createdAt: Timestamp;
}

/**
 * Place index document in the global placesIndex collection
 * Path: placesIndex/{placeId}
 */
export interface PlaceIndex {
  id: string;
  name: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  updatedAt: Timestamp;
}

/**
 * Debug ping document for connectivity testing
 * Path: users/{uid}/__debug__/ping
 */
export interface DebugPing {
  lastPing: Timestamp;
  timestamp: number;
  userAgent: string;
}

/**
 * Input type for creating a new goal (omits auto-generated fields)
 */
export type CreateGoalInput = Omit<Goal, 'id' | 'createdAt'>;

/**
 * Input type for creating a new activity (omits auto-generated fields)
 */
export type CreateActivityInput = Omit<Activity, 'id' | 'createdAt'>;

/**
 * Input type for creating a new user (omits auto-generated fields)
 */
export type CreateUserInput = Omit<User, 'uid' | 'createdAt'>;

/**
 * Input type for creating a place index entry (omits auto-generated fields)
 */
export type CreatePlaceIndexInput = Omit<PlaceIndex, 'id' | 'updatedAt'>;

/**
 * Goal categories enum for type safety
 */
export enum GoalCategory {
  FITNESS = 'Fitness',
  HEALTH = 'Health',
  PRODUCTIVITY = 'Productivity',
  EDUCATION = 'Education',
  PERSONAL = 'Personal',
  CAREER = 'Career',
  SPIRITUAL = 'Spiritual',
  OTHER = 'Other',
}

/**
 * Verification methods enum for type safety
 */
export enum VerificationMethod {
  LOCATION = 'location',
  TIME = 'time',
  SCREENTIME = 'screentime',
  MANUAL = 'manual',
}

/**
 * Frequency options enum for type safety
 */
export enum GoalFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

/**
 * Activity status enum for type safety
 */
export enum ActivityStatus {
  COMPLETED = 'completed',
  MISSED = 'missed',
  PARTIAL = 'partial',
}

/**
 * Firestore collection paths as constants
 */
export const FIRESTORE_PATHS = {
  USERS: 'users',
  GOALS: 'goals',
  ACTIVITIES: 'activities',
  PLACES_INDEX: 'placesIndex',
  DEBUG: '__debug__',
  PING: 'ping',
} as const;

/**
 * Helper function to create a goal with default values
 */
export const createGoalWithDefaults = (input: Partial<CreateGoalInput>): CreateGoalInput => {
  return {
    title: input.title || '',
    category: input.category || GoalCategory.OTHER,
    verificationMethods: input.verificationMethods || [VerificationMethod.MANUAL],
    frequency: input.frequency || GoalFrequency.DAILY,
    duration: input.duration || '30 days',
    location: input.location || {
      lat: 0,
      lng: 0,
      address: '',
    },
    startDate: input.startDate || Timestamp.now(),
  };
};

/**
 * Helper function to create an activity with default values
 */
export const createActivityWithDefaults = (input: Partial<CreateActivityInput>): CreateActivityInput => {
  return {
    goalId: input.goalId || '',
    date: input.date || Timestamp.now(),
    status: input.status || ActivityStatus.COMPLETED,
    notes: input.notes || '',
  };
};

/**
 * Type guard to check if an object is a valid Goal
 */
export const isGoal = (obj: any): obj is Goal => {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.category === 'string' &&
    Array.isArray(obj.verificationMethods) &&
    typeof obj.frequency === 'string' &&
    typeof obj.duration === 'string' &&
    typeof obj.location === 'object' &&
    typeof obj.location.lat === 'number' &&
    typeof obj.location.lng === 'number' &&
    typeof obj.location.address === 'string' &&
    obj.startDate instanceof Timestamp &&
    obj.createdAt instanceof Timestamp
  );
};

/**
 * Type guard to check if an object is a valid Activity
 */
export const isActivity = (obj: any): obj is Activity => {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.goalId === 'string' &&
    obj.date instanceof Timestamp &&
    ['completed', 'missed', 'partial'].includes(obj.status) &&
    typeof obj.notes === 'string' &&
    obj.createdAt instanceof Timestamp
  );
};

/**
 * Error types for Firebase operations
 */
export interface FirebaseError {
  code: string;
  message: string;
  name: string;
}

/**
 * Common Firebase error codes
 */
export enum FirebaseErrorCode {
  PERMISSION_DENIED = 'permission-denied',
  NOT_FOUND = 'not-found',
  ALREADY_EXISTS = 'already-exists',
  UNAVAILABLE = 'unavailable',
  UNAUTHENTICATED = 'unauthenticated',
  RESOURCE_EXHAUSTED = 'resource-exhausted',
  FAILED_PRECONDITION = 'failed-precondition',
}

/**
 * Helper function to get user-friendly error messages
 */
export const getFirebaseErrorMessage = (error: FirebaseError): string => {
  switch (error.code) {
    case FirebaseErrorCode.PERMISSION_DENIED:
      return 'You do not have permission to perform this action. Please sign in again.';
    case FirebaseErrorCode.NOT_FOUND:
      return 'The requested data was not found.';
    case FirebaseErrorCode.UNAVAILABLE:
      return 'The service is currently unavailable. Please check your internet connection.';
    case FirebaseErrorCode.UNAUTHENTICATED:
      return 'Please sign in to continue.';
    case FirebaseErrorCode.RESOURCE_EXHAUSTED:
      return 'Too many requests. Please try again later.';
    case FirebaseErrorCode.FAILED_PRECONDITION:
      return 'Operation failed due to invalid conditions. Please refresh and try again.';
    default:
      return `An unexpected error occurred: ${error.message}`;
  }
};
