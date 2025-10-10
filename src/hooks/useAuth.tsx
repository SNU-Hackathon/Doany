/**
 * Auth Hook - REST API Version
 * 
 * Replaces Firebase Auth with REST API auth.store
 */

import React, { useCallback, useEffect, useState } from 'react';
import { loginPassword as apiLoginPassword, logout as apiLogout } from '../api/auth';
import type { LoginResponse, UserMe } from '../api/types';
import { getMe } from '../api/users';
import {
  clearAuth,
  getAuthState,
  getStoredToken,
  setAuth,
  setUser as setUserInStore,
  subscribe,
  type AuthState
} from '../state/auth.store';

/**
 * User type with id alias for backwards compatibility
 */
export interface User extends UserMe {
  id: string; // Alias for userId
}

export interface UseAuthReturn {
  user: User | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
  loading: boolean; // Alias for compatibility
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData?: any) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Hook to access authentication state
 * 
 * @example
 * ```typescript
 * const { user, isAuthenticated, isLoading, signIn, signOut } = useAuth();
 * 
 * if (isLoading) return <Loading />;
 * if (!isAuthenticated) return <Login />;
 * return <Dashboard user={user} />;
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>(getAuthState());
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = subscribe((newState) => {
      setAuthState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Restore auth on mount (only once)
  useEffect(() => {
    let mounted = true;

    const restoreAuth = async () => {
      try {
        const storedToken = await getStoredToken();
        if (storedToken && mounted) {
          // Set token first
          setAuth({ accessToken: storedToken });
          
          // Fetch user profile (only if mounted)
          try {
            const userProfile = await getMe();
            if (mounted) {
              setUserInStore(userProfile);
            }
          } catch (error) {
            console.error('[useAuth] Failed to fetch user profile:', error);
            // Clear invalid token
            if (mounted) {
              await clearAuth();
            }
          }
        }
      } catch (error) {
        console.error('[useAuth] Error restoring auth:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    restoreAuth();

    return () => {
      mounted = false;
    };
  }, []); // Empty deps - run only once on mount

  /**
   * Sign in with credentials
   */
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Call login API
      const loginResponse: LoginResponse = await apiLoginPassword({ email, password });
      
      // Store auth data
      setAuth({
        accessToken: loginResponse.accessToken,
        tokenType: loginResponse.tokenType,
        expiresIn: loginResponse.expiresIn,
        userId: loginResponse.userId,
      });
      
      // Fetch user profile
      const userProfile = await getMe();
      const userWithAlias: User = {
        ...userProfile,
        id: userProfile.userId, // Add id alias
      };
      setUserInStore(userProfile);
      
      if (__DEV__) {
        console.log('[useAuth.signIn] Login successful:', {
          userId: loginResponse.userId,
          userName: userProfile.name,
        });
      }
    } catch (error) {
      console.error('[useAuth.signIn] Error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Sign up (placeholder)
   */
  const signUp = useCallback(async (email: string, password: string, userData?: any) => {
    console.warn('[useAuth.signUp] Not yet implemented - use src/api/users.join');
    throw new Error('signUp not yet implemented');
  }, []);

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    await apiLogout();
    setIsLoading(false);
  }, []);

  // Add id alias to user
  const userWithAlias: User | undefined = authState.user 
    ? { ...authState.user, id: authState.user.userId }
    : undefined;

  return {
    user: userWithAlias,
    isAuthenticated: authState.isAuthenticated,
    isLoading,
    loading: isLoading,
    signIn,
    signUp,
    signOut,
  };
}

/**
 * Legacy export for backwards compatibility
 * @deprecated Use named export `useAuth` instead
 */
export default useAuth;

/**
 * AuthProvider - Simple pass-through provider
 * For compatibility with existing App.tsx structure
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

