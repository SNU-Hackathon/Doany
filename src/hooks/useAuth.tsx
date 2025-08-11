// Authentication context and hook for Doany app with reliable navigation gating

import { onAuthStateChanged } from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../services/firebase';
import { fetchUserDoc } from '../services/userData';
import { UserService } from '../services/userService';
import { AuthContextType, User } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user data in background without blocking navigation
  const loadUserDataInBackground = useCallback(async (uid: string) => {
    try {
      console.log('[Auth] Loading user data in background for:', uid);
      const userData = await fetchUserDoc(uid);
      
      if (userData) {
        setUser(userData);
        console.log('[Auth] User data loaded successfully in background');
      } else {
        // Keep minimal user if no document found - don't overwrite
        console.warn('[Auth] User document not found, keeping minimal user');
      }
    } catch (error) {
      console.error('[Auth] Error loading user data in background:', error);
      // Don't overwrite the minimal user on error
    }
  }, []);

  // Single auth state change subscription - the core navigation gate
  useEffect(() => {
    console.log('[Auth] Setting up onAuthStateChanged subscription');
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('[AUTH] onAuthStateChanged', !!firebaseUser, firebaseUser?.uid);
      
      if (firebaseUser) {
        console.log('[Auth] User authenticated, creating minimal user immediately for navigation');
        
        // Create minimal user immediately for navigation - don't block on Firestore
        const minimalUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'User',
          createdAt: new Date(),
          updatedAt: new Date(),
          depositBalance: 0,
          points: 0
        };
        
        setUser(minimalUser);
        setLoading(false);
        
        // Load full user data in background (non-blocking)
        loadUserDataInBackground(firebaseUser.uid);
        
      } else {
        console.log('[Auth] User signed out');
        setUser(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [loadUserDataInBackground]);

  // Memoize context value to prevent unnecessary rerenders
  const contextValue = useMemo(() => ({
    user,
    loading,
    signIn: async (email: string, password: string): Promise<void> => {
      console.time('[Auth] Sign In');
      try {
        await UserService.signIn(email, password);
        // Don't set user here - let onAuthStateChanged handle it
        console.log('[Auth] Sign in successful, onAuthStateChanged will handle navigation');
      } catch (error) {
        console.error('[Auth] Sign in failed:', error);
        throw error;
      } finally {
        console.timeEnd('[Auth] Sign In');
      }
    },
    signUp: async (email: string, password: string, displayName: string): Promise<void> => {
      console.time('[Auth] Sign Up');
      try {
        await UserService.signUp(email, password, displayName);
        // Don't set user here - let onAuthStateChanged handle it
        console.log('[Auth] Sign up successful, onAuthStateChanged will handle navigation');
      } catch (error) {
        console.error('[Auth] Sign up failed:', error);
        throw error;
      } finally {
        console.timeEnd('[Auth] Sign Up');
      }
    },
    signOut: async (): Promise<void> => {
      try {
        await UserService.signOut();
        // Don't set user here - let onAuthStateChanged handle it
        console.log('[Auth] Sign out successful');
      } catch (error) {
        console.error('[Auth] Sign out failed:', error);
        throw error;
      }
    }
  }), [user, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}