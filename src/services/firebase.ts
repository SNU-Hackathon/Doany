// Firebase configuration and service layer for React Native (Expo) project
// Implements Cloud Firestore with proper React Native optimizations

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import {
  collection,
  doc,
  enableNetwork,
  Firestore,
  getDoc,
  getFirestore,
  initializeFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp
} from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('🔥 Firebase configuration incomplete! Check your .env file.');
  console.log('Missing required environment variables:');
  if (!firebaseConfig.apiKey) console.log('- EXPO_PUBLIC_FIREBASE_API_KEY');
  if (!firebaseConfig.projectId) console.log('- EXPO_PUBLIC_FIREBASE_PROJECT_ID');
  if (!firebaseConfig.authDomain) console.log('- EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (!firebaseConfig.storageBucket) console.log('- EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET');
  if (!firebaseConfig.messagingSenderId) console.log('- EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  if (!firebaseConfig.appId) console.log('- EXPO_PUBLIC_FIREBASE_APP_ID');
}

// Initialize Firebase App (single instance pattern)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth with React Native optimizations (single instance)
export const auth: Auth = (() => {
  try {
    // IMPORTANT: In React Native/Expo, initializeAuth must be used with AsyncStorage persistence
    if (Platform.OS !== 'web') {
      const getReactNativePersistence = (require('firebase/auth') as any)
        .getReactNativePersistence as (storage: any) => any;
      return initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    }
    // Web fallback
    return getAuth(app);
  } catch (error) {
    if (__DEV__) console.warn('🔥 Auth initialization error:', error);
    // As a last resort, return default instance
    return getAuth(app);
  }
})();

// Initialize Firestore with React Native optimizations
export const db: Firestore = (() => {
  try {
    const instance = initializeFirestore(app, {
      experimentalForceLongPolling: true, // Required for React Native
    });
    // Reduce noisy Firestore warnings in console
    setLogLevel('error');
    return instance;
  } catch (error) {
    // If already initialized, get the existing instance
    console.warn('🔥 Firestore already initialized, using existing instance');
    const instance = getFirestore(app);
    setLogLevel('error');
    return instance;
  }
})();

// Initialize Firebase Storage
export const storage: FirebaseStorage = getStorage(app);

// Startup diagnostics with environment validation
if (__DEV__) {
  console.log('[FB] cfg', {
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    apiKeyPrefix: String(process.env.EXPO_PUBLIC_FIREBASE_API_KEY).slice(0, 6) + '***'
  });
}

// Environment validation check
if (__DEV__ && (!process.env.EXPO_PUBLIC_FIREBASE_API_KEY || !process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID)) {
  console.error('[FB] Missing env. Did you set .env and restart with `expo start --clear`?');
  console.error('[FB] Required EXPO_PUBLIC_ environment variables:');
  console.error('  - EXPO_PUBLIC_FIREBASE_API_KEY');
  console.error('  - EXPO_PUBLIC_FIREBASE_PROJECT_ID');
  console.error('  - EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN');
  console.error('[FB] Note: EXPO_PUBLIC_ prefix is required for client-side access');
}

// Log successful initialization
if (__DEV__) {
  console.log('🔥 Firebase initialized successfully');
  console.log(`📱 Project: ${firebaseConfig.projectId}`);
  console.log(`🔐 Auth Domain: ${firebaseConfig.authDomain}`);
}

/**
 * Ensures the device is online and Firestore network is enabled
 * Prevents "client is offline" errors by checking network connectivity
 */
export const ensureOnline = async (): Promise<boolean> => {
  try {
    // Check internet connectivity using NetInfo
    const netState = await NetInfo.fetch();
    
    if (!netState.isConnected || netState.isInternetReachable === false) {
      console.warn('📡 Device appears to be offline');
      return false;
    }
    
    // Enable Firestore network (safe to call multiple times)
    await enableNetwork(db);
    console.log('🔥 Firestore network enabled');
    
    return true;
  } catch (error) {
    console.error('❌ Error ensuring online status:', error);
    return false;
  }
};

/**
 * Performs a connectivity test by writing and reading a debug document
 * Confirms both write and read permissions are working
 * @param uid - User ID for the ping test
 * @returns Promise<boolean> - true if ping successful, false otherwise
 */
export const firestorePing = async (uid: string): Promise<boolean> => {
  if (!uid) {
    console.warn('🏓 Cannot ping Firestore without user ID');
    return false;
  }

  try {
    console.time('🏓 Firestore Ping');
    
    // Ensure we're online first
    const isOnline = await ensureOnline();
    if (!isOnline) {
      console.warn('🏓 Skipping ping - device offline');
      return false;
    }

    // Create ping document reference
    const pingRef = doc(db, 'users', uid, '__debug__', 'ping');
    
    // Write ping document with current timestamp
    const pingData = {
      lastPing: serverTimestamp(),
      timestamp: Date.now(),
      userAgent: 'React Native Expo',
    };
    
    await setDoc(pingRef, pingData);
    console.log('🏓 Ping write successful');
    
    // Read back the document to confirm round-trip
    const pingDoc = await getDoc(pingRef);
    
    if (pingDoc.exists()) {
      const data = pingDoc.data();
      console.log('🏓 Ping read successful:', {
        hasTimestamp: !!data.lastPing,
        localTimestamp: data.timestamp,
      });
      console.timeEnd('🏓 Firestore Ping');
      return true;
    } else {
      console.warn('🏓 Ping document not found after write');
      console.timeEnd('🏓 Firestore Ping');
      return false;
    }
    
  } catch (error: any) {
    console.error('🏓 Firestore ping failed:', error);
    console.timeEnd('🏓 Firestore Ping');
    
    // Log specific error types for debugging
    if (error.code === 'permission-denied') {
      console.error('🔒 Permission denied - check Firestore security rules');
    } else if (error.code === 'unavailable') {
      console.error('📡 Firestore unavailable - check network connection');
    }
    
    return false;
  }
};

// TypeScript interfaces for data models

export interface User {
  uid: string;
  name: string;
  email: string;
  createdAt: Timestamp;
}

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

export interface Activity {
  id: string;
  goalId: string;
  date: Timestamp;
  status: string;
  notes: string;
}

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
 * Creates a new goal document in the user's goals subcollection
 * @param uid - User ID
 * @param goalData - Goal data to create
 * @returns Promise<string> - The created goal document ID
 */
export const createGoalDraft = async (uid: string, goalData: Omit<Goal, 'id' | 'createdAt'>): Promise<string> => {
  if (!uid) {
    throw new Error('User ID is required to create a goal');
  }

  try {
    console.time('📝 Create Goal');
    
    // Ensure we're online before writing
    const isOnline = await ensureOnline();
    if (!isOnline) {
      throw new Error('Cannot create goal while offline. Please check your internet connection.');
    }

    // Create goal document reference (auto-generated ID)
    const goalRef = doc(collection(db, 'users', uid, 'goals'));
    
    // Prepare goal document with server timestamp
    const goalDoc = {
      ...goalData,
      createdAt: serverTimestamp(),
    };

    // Write the goal document
    await setDoc(goalRef, goalDoc);
    
    console.log('📝 Goal created successfully:', goalRef.id);
    console.timeEnd('📝 Create Goal');
    
    return goalRef.id;
    
  } catch (error: any) {
    console.error('❌ Error creating goal:', error);
    console.timeEnd('📝 Create Goal');
    
    // Provide user-friendly error messages
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Please sign in again.');
    } else if (error.code === 'unavailable') {
      throw new Error('Service unavailable. Please check your internet connection.');
    } else {
      throw new Error(`Failed to create goal: ${error.message}`);
    }
  }
};

/**
 * Loads the user's goals from Firestore, ordered by creation date (newest first)
 * @param uid - User ID
 * @param limitCount - Maximum number of goals to fetch (default: 10)
 * @returns Promise<Goal[]> - Array of goal documents
 */
export const loadGoals = async (uid: string, limitCount: number = 10): Promise<Goal[]> => {
  if (!uid) {
    throw new Error('User ID is required to load goals');
  }

  try {
    console.time('📚 Load Goals');
    
    // Ensure we're online before reading
    const isOnline = await ensureOnline();
    if (!isOnline) {
      console.warn('📚 Loading goals while offline - may return cached data');
    }

    // Create query for user's goals, ordered by creation date (newest first)
    const goalsRef = collection(db, 'users', uid, 'goals');
    const goalsQuery = query(
      goalsRef,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    // Execute the query
    const { getDocs } = await import('firebase/firestore');
    const snapshot = await getDocs(goalsQuery);
    
    // Transform documents to Goal objects
    const goals: Goal[] = [];
    snapshot.forEach((doc) => {
      goals.push({
        id: doc.id,
        ...doc.data(),
      } as Goal);
    });

    console.log(`📚 Loaded ${goals.length} goals for user ${uid}`);
    console.timeEnd('📚 Load Goals');
    
    return goals;
    
  } catch (error: any) {
    console.error('❌ Error loading goals:', error);
    console.timeEnd('📚 Load Goals');
    
    // Provide user-friendly error messages
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Please sign in again.');
    } else if (error.code === 'unavailable') {
      throw new Error('Service unavailable. Please check your internet connection.');
    } else {
      throw new Error(`Failed to load goals: ${error.message}`);
    }
  }
};

/**
 * Creates a user document in the users collection
 * @param uid - User ID
 * @param userData - User data to create
 */
export const createUserDocument = async (uid: string, userData: Omit<User, 'uid'>): Promise<void> => {
  if (!uid) {
    throw new Error('User ID is required to create user document');
  }

  try {
    console.time('👤 Create User');
    
    // Ensure we're online before writing
    const isOnline = await ensureOnline();
    if (!isOnline) {
      throw new Error('Cannot create user document while offline.');
    }

    // Create user document reference
    const userRef = doc(db, 'users', uid);
    
    // Prepare user document with server timestamp
    const userDoc = {
      ...userData,
      createdAt: serverTimestamp(),
    };

    // Write the user document
    await setDoc(userRef, userDoc);
    
    console.log('👤 User document created successfully');
    console.timeEnd('👤 Create User');
    
  } catch (error: any) {
    console.error('❌ Error creating user document:', error);
    console.timeEnd('👤 Create User');
    throw error;
  }
};

// Export the Firebase app instance for advanced use cases
export { app };

// Log initialization status
if (__DEV__) console.log('✅ Firebase services exported successfully');