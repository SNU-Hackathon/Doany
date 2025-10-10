/**
 * Auth Hook - REST API Version
 * 
 * Replaces Firebase Auth with REST API auth.store
 */

import React, { useEffect, useState } from 'react';
import { loginPassword } from '../api/auth';
import { clearAuth, getAuthState, setAuth, subscribe, type AuthState } from '../state/auth.store';

export interface User {
  id: string;
  name: string;
  email?: string;
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
 * const { user, isAuthenticated, isLoading } = useAuth();
 * 
 * if (isLoading) return <Loading />;
 * if (!isAuthenticated) return <Login />;
 * return <Dashboard user={user} />;
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>(getAuthState());
  const [isLoading] = useState(false); // No async loading needed for in-memory store

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = subscribe((newState) => {
      setAuthState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const authResponse = await loginPassword({ email, password });
      setAuth({
        accessToken: authResponse.accessToken,
        refreshToken: authResponse.refreshToken,
        user: authResponse.user,
      });
    } catch (error) {
      console.error('[useAuth.signIn] Error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, userData?: any) => {
    console.warn('[useAuth.signUp] Not yet implemented - use src/api/users.join');
    throw new Error('signUp not yet implemented');
  };

  const signOut = async () => {
    clearAuth();
  };

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading,
    loading: isLoading, // Alias for compatibility
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

