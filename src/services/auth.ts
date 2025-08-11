// Robust authentication service with comprehensive error handling
// Provides normalized error handling and detailed diagnostics

import NetInfo from '@react-native-community/netinfo';
import {
    createUserWithEmailAndPassword,
    User as FirebaseUser,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface AuthError {
  code: string;
  message: string;
  friendlyMessage: string;
  isRetryable: boolean;
  suggestedAction?: string;
}

export interface AuthResult {
  user: FirebaseUser;
  isNewUser: boolean;
}

/**
 * Maps Firebase auth errors to user-friendly messages with actionable suggestions
 */
export function mapAuthError(error: any): AuthError {
  const code = error.code || 'unknown';
  const message = error.message || 'Unknown error occurred';
  
  console.warn('[AUTH] Error mapping:', { code, message });

  switch (code) {
    // Provider/Configuration errors
    case 'auth/operation-not-allowed':
      return {
        code,
        message,
        friendlyMessage: 'Email/Password sign-in is not enabled for this app.',
        isRetryable: false,
        suggestedAction: 'Enable Email/Password in Firebase Console → Authentication → Sign-in method'
      };

    case 'auth/invalid-api-key':
    case 'auth/configuration-not-found':
      return {
        code,
        message,
        friendlyMessage: 'App configuration error. Please contact support.',
        isRetryable: false,
        suggestedAction: 'Check that EXPO_PUBLIC_* keys belong to the same Firebase project'
      };

    // Network errors
    case 'auth/network-request-failed':
      return {
        code,
        message,
        friendlyMessage: 'Network connection failed. Check your internet connection.',
        isRetryable: true,
        suggestedAction: 'Check your internet connection and try again'
      };

    // Rate limiting / Blocking
    case 'auth/too-many-requests':
      return {
        code,
        message,
        friendlyMessage: 'Too many failed attempts. Please try again later or reset your password.',
        isRetryable: true,
        suggestedAction: 'Wait a few minutes or try password reset'
      };

    case 'auth/blocked-by-remote-service':
      return {
        code,
        message,
        friendlyMessage: 'Sign-in temporarily blocked. Please try password reset.',
        isRetryable: false,
        suggestedAction: 'Try password reset or contact support'
      };

    // User-related errors
    case 'auth/email-already-in-use':
      return {
        code,
        message,
        friendlyMessage: 'An account with this email already exists. Try signing in instead.',
        isRetryable: false,
        suggestedAction: 'Use Sign In instead of Sign Up'
      };

    case 'auth/user-not-found':
      return {
        code,
        message,
        friendlyMessage: 'No account found with this email. Please sign up first.',
        isRetryable: false,
        suggestedAction: 'Use Sign Up to create an account'
      };

    case 'auth/wrong-password':
      return {
        code,
        message,
        friendlyMessage: 'Incorrect password. Please try again or reset your password.',
        isRetryable: true,
        suggestedAction: 'Check your password or use password reset'
      };

    case 'auth/invalid-email':
      return {
        code,
        message,
        friendlyMessage: 'Please enter a valid email address.',
        isRetryable: true,
        suggestedAction: 'Check your email format'
      };

    case 'auth/weak-password':
      return {
        code,
        message,
        friendlyMessage: 'Password is too weak. Please use at least 6 characters.',
        isRetryable: true,
        suggestedAction: 'Use a stronger password (6+ characters)'
      };

    case 'auth/user-disabled':
      return {
        code,
        message,
        friendlyMessage: 'This account has been disabled. Please contact support.',
        isRetryable: false,
        suggestedAction: 'Contact support'
      };

    // Generic errors
    default:
      return {
        code,
        message,
        friendlyMessage: 'Authentication failed. Please try again.',
        isRetryable: true,
        suggestedAction: 'Try again or contact support if the problem persists'
      };
  }
}

/**
 * Check network connectivity before auth operations
 */
async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    const netState = await NetInfo.fetch();
    const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);
    
    console.log('[AUTH] Network status:', {
      isConnected: netState.isConnected,
      isInternetReachable: netState.isInternetReachable,
      isOnline
    });
    
    return isOnline;
  } catch (error) {
    console.warn('[AUTH] Failed to check network:', error);
    return true; // Assume online if check fails
  }
}

/**
 * Create minimal user document in Firestore after successful signup
 */
async function createUserDocument(user: FirebaseUser): Promise<void> {
  try {
    console.log('[AUTH] Creating user document for:', user.uid);
    
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      displayName: user.displayName || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      depositBalance: 0,
      points: 0
    }, { merge: true });
    
    console.log('[AUTH] User document created successfully');
  } catch (error) {
    console.warn('[AUTH] Failed to create user document (non-blocking):', error);
    // Don't throw - user document creation failure shouldn't block auth flow
  }
}

/**
 * Robust sign-up function with comprehensive error handling
 */
export async function signUp(email: string, password: string, displayName?: string): Promise<AuthResult> {
  console.log('[AUTH] signUp attempt for:', email.trim());
  console.time('[AUTH] signUp duration');
  
  try {
    // Check network connectivity first
    const isOnline = await checkNetworkConnectivity();
    if (!isOnline) {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    // Attempt sign up
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const user = userCredential.user;
    
    console.log('[AUTH] signUp success:', { uid: user.uid, email: user.email });
    
    // Update display name if provided
    if (displayName && displayName.trim()) {
      try {
        const { updateProfile } = await import('firebase/auth');
        await updateProfile(user, { displayName: displayName.trim() });
        console.log('[AUTH] Display name updated');
      } catch (error) {
        console.warn('[AUTH] Failed to update display name (non-blocking):', error);
      }
    }
    
    // Create user document (non-blocking)
    createUserDocument(user);
    
    console.timeEnd('[AUTH] signUp duration');
    return { user, isNewUser: true };
    
  } catch (error: any) {
    console.warn('[AUTH] signUp fail:', { 
      code: error.code, 
      message: error.message,
      email: email.trim()
    });
    
    console.timeEnd('[AUTH] signUp duration');
    throw mapAuthError(error);
  }
}

/**
 * Robust sign-in function with retry capability
 */
export async function signIn(email: string, password: string, retryCount: number = 0): Promise<AuthResult> {
  console.log('[AUTH] signIn attempt for:', email.trim(), `(retry: ${retryCount})`);
  console.time('[AUTH] signIn duration');
  
  try {
    // Check network connectivity first
    const isOnline = await checkNetworkConnectivity();
    if (!isOnline && retryCount === 0) {
      console.warn('[AUTH] Offline detected, waiting for connectivity...');
      // Wait a moment and retry once
      await new Promise(resolve => setTimeout(resolve, 2000));
      return signIn(email, password, retryCount + 1);
    }

    // Attempt sign in
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const user = userCredential.user;
    
    console.log('[AUTH] signIn success:', { uid: user.uid, email: user.email });
    
    console.timeEnd('[AUTH] signIn duration');
    return { user, isNewUser: false };
    
  } catch (error: any) {
    console.warn('[AUTH] signIn fail:', { 
      code: error.code, 
      message: error.message,
      email: email.trim(),
      retryCount
    });
    
    // Retry once for network errors
    if (error.code === 'auth/network-request-failed' && retryCount === 0) {
      console.log('[AUTH] Retrying sign-in due to network error...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return signIn(email, password, retryCount + 1);
    }
    
    console.timeEnd('[AUTH] signIn duration');
    throw mapAuthError(error);
  }
}

/**
 * Send password reset email with error handling
 */
export async function sendReset(email: string): Promise<void> {
  console.log('[AUTH] sendReset attempt for:', email.trim());
  console.time('[AUTH] sendReset duration');
  
  try {
    // Check network connectivity first
    const isOnline = await checkNetworkConnectivity();
    if (!isOnline) {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    await sendPasswordResetEmail(auth, email.trim());
    
    console.log('[AUTH] sendReset success for:', email.trim());
    console.timeEnd('[AUTH] sendReset duration');
    
  } catch (error: any) {
    console.warn('[AUTH] sendReset fail:', { 
      code: error.code, 
      message: error.message,
      email: email.trim()
    });
    
    console.timeEnd('[AUTH] sendReset duration');
    throw mapAuthError(error);
  }
}

/**
 * Development-only smoke test for auth functionality
 */
export async function devSmokeTest(): Promise<void> {
  if (__DEV__) {
    try {
      const testEmail = `test-${Date.now()}@example.com`;
      const testPassword = 'testpassword123';
      
      console.log('[AUTH] Dev smoke test starting...');
      
      const result = await signUp(testEmail, testPassword, 'Test User');
      console.log('[AUTH] Dev smoke test passed:', result.user.uid);
      
      // Clean up test user (optional)
      try {
        await result.user.delete();
        console.log('[AUTH] Test user cleaned up');
      } catch (cleanupError) {
        console.warn('[AUTH] Failed to cleanup test user:', cleanupError);
      }
      
    } catch (error) {
      console.warn('[AUTH] Dev smoke test failed:', error);
    }
  }
}
