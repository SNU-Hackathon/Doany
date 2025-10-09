/**
 * Auth Hook - REST API Version
 * 
 * Replaces Firebase Auth with REST API auth.store
 */

import { useEffect, useState } from 'react';
import { getAuthState, subscribe, type AuthState } from '../state/auth.store';

export interface User {
  id: string;
  name: string;
  email?: string;
}

export interface UseAuthReturn {
  user: User | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
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

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading,
  };
}

/**
 * Legacy export for backwards compatibility
 * @deprecated Use named export `useAuth` instead
 */
export default useAuth;

