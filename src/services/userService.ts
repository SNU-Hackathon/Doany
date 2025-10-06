// User service functions for Firebase operations

import {
  User as FirebaseUser,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { User } from '../types';
import { signIn as authSignIn, signUp as authSignUp, sendReset } from './auth';
import { auth, db } from './firebase';
import { fetchUserDoc } from './userData';

export class UserService {
  // Sign up new user using robust auth service
  static async signUp(email: string, password: string, displayName: string): Promise<User> {
    try {
      console.log('[UserService] Starting sign up process...');
      
      // Use the robust auth service which handles everything
      const authResult = await authSignUp(email, password, displayName);
      
      // Return user object for the hook
      const user: User = {
        id: authResult.user.uid,
        uid: authResult.user.uid,  // Alias for id
        email: authResult.user.email || email,
        displayName: authResult.user.displayName || displayName,
        createdAt: new Date(),
        updatedAt: new Date(),
        depositBalance: 0,
        points: 0
      };
      
      console.log('[UserService] Sign up completed successfully');
      return user;
    } catch (error: any) {
      console.error('[UserService] Sign up error:', error);
      throw error;
    }
  }

  // Sign in existing user using robust auth service
  static async signIn(email: string, password: string): Promise<User> {
    try {
      console.log('[UserService] Starting sign in process...');
      
      // Use the robust auth service for authentication
      const authResult = await authSignIn(email, password);
      
      // Try to fetch user document
      const userData = await fetchUserDoc(authResult.user.uid);
      
      if (!userData) {
        // Create a minimal user if document doesn't exist (shouldn't happen for existing users)
        console.warn('[UserService] User document not found, creating minimal user');
        return {
          id: authResult.user.uid,
          uid: authResult.user.uid,  // Alias for id
          email: authResult.user.email || email,
          displayName: authResult.user.displayName || 'User',
          createdAt: new Date(),
          updatedAt: new Date(),
          depositBalance: 0,
          points: 0
        };
      }
      
      console.log('[UserService] Sign in completed successfully');
      return userData;
    } catch (error: any) {
      console.error('❌ [DEBUG] Sign in failed:', error);
      console.log('🔍 [DEBUG] Error code:', error.code);
      console.log('🔍 [DEBUG] Error message:', error.message);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/user-not-found') {
        throw new Error(`No account found with email: ${email}. Please check if you signed up with this email or try signing up instead.`);
      }
      
      if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password. Please check your password or reset it if you forgot.');
      }
      
      if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email format. Please check your email address.');
      }
      
      if (error.code === 'auth/user-disabled') {
        throw new Error('This account has been disabled. Please contact support.');
      }
      
      // Handle offline errors more gracefully
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        throw new Error('You appear to be offline. Please check your internet connection and try again.');
      }
      
      throw error;
    }
  }

  // Sign out current user
  static async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  // Send password reset email
  static async resetPassword(email: string): Promise<void> {
    try {
      console.log('🔍 [DEBUG] Sending password reset email to:', email);
      console.log('🔍 [DEBUG] Using Firebase project:', auth.app.options.projectId);
      
      // Use the robust auth service
      await sendReset(email);
      
      console.log('✅ [DEBUG] Password reset email sent successfully');
    } catch (error: any) {
      console.error('❌ [DEBUG] Password reset failed:', error);
      console.log('🔍 [DEBUG] Error code:', error.code);
      
      if (error.code === 'auth/user-not-found') {
        throw new Error(`No account found with email: ${email}. Please check if you signed up with this email.`);
      }
      
      if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email format. Please check your email address.');
      }
      
      throw error;
    }
  }

  // Get user data from Firestore
  static async getUserData(userId: string): Promise<User> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }
      
      const userData = userDoc.data();
      return {
        id: userId,
        uid: userId,  // Alias for id
        email: userData.email,
        displayName: userData.displayName,
        createdAt: userData.createdAt instanceof Timestamp 
          ? userData.createdAt.toDate() 
          : new Date(userData.createdAt),
        updatedAt: userData.updatedAt instanceof Timestamp 
          ? userData.updatedAt.toDate() 
          : new Date(userData.updatedAt),
        depositBalance: userData.depositBalance || 0,
        points: userData.points || 0
      };
    } catch (error: any) {
      console.error('Error getting user data:', error);
      
      // Handle offline errors more gracefully
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        throw new Error('You appear to be offline. Please check your internet connection and try again.');
      }
      
      throw error;
    }
  }

  // Update user data
  static async updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Get current Firebase user
  static getCurrentFirebaseUser(): FirebaseUser | null {
    return auth.currentUser;
  }
}
