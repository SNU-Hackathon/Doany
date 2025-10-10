/**
 * Auth Hook - REST API Version
 * 
 * Replaces Firebase Auth with REST API auth.store
 */

import React, { useEffect, useState } from 'react';
import type { UserMe } from '../api/types';
import {
  clearAuth,
  getAuthState,
  setAuth,
  subscribe,
  type AuthState
} from '../state/auth.store';

export type User = UserMe;

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

  // Restore auth on mount
  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const storedToken = await getStoredToken();
        if (storedToken) {
          // Set token first
          setAuth({ accessToken: storedToken });
          
          // Fetch user profile
          try {
            const userProfile = await getMe();
            setUserInStore(userProfile);
          } catch (error) {
            console.error('[useAuth] Failed to fetch user profile:', error);
            // Clear invalid token
            await clearAuth();
          }
        }
      } catch (error) {
        console.error('[useAuth] Error restoring auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    restoreAuth();

    // Subscribe to auth state changes
    const unsubscribe = subscribe((newState) => {
      setAuthState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

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

  return {
    user: authState.user,
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

