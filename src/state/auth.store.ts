/**
 * DoAny Auth Store
 * 
 * Manages authentication state and token persistence
 */

import { UserMe } from '../api/types';

export interface AuthState {
  accessToken: string | undefined;
  tokenType: 'Bearer' | undefined;
  expiresIn: number | undefined;
  userId: string | undefined;
  user: UserMe | undefined;
  isAuthenticated: boolean;
}

// In-memory auth state
let authState: AuthState = {
  accessToken: undefined,
  tokenType: undefined,
  expiresIn: undefined,
  userId: undefined,
  user: undefined,
  isAuthenticated: false,
};

// Listeners for state changes
type Listener = (state: AuthState) => void;
const listeners: Listener[] = [];

/**
 * Subscribe to auth state changes
 */
export function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Notify all listeners of state change
 */
function notify(): void {
  listeners.forEach((listener) => listener(authState));
}

/**
 * Get current auth state
 */
export function getAuthState(): AuthState {
  return { ...authState };
}

/**
 * Get access token
 */
export function getAccessToken(): string | undefined {
  return authState.accessToken;
}

/**
 * Set token only (for quick updates)
 */
export async function setToken(token: string | null): Promise<void> {
  if (token) {
    authState.accessToken = token;
    authState.isAuthenticated = true;
    await AsyncStorage.setItem('auth_token', token);
  } else {
    authState.accessToken = undefined;
    authState.isAuthenticated = false;
    await AsyncStorage.removeItem('auth_token');
  }
  notify();
}

/**
 * Get token from storage
 */
export async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem('auth_token');
  } catch (error) {
    console.error('[auth.store] Error getting token:', error);
    return null;
  }
}

/**
 * Set auth data from login response
 */
export function setAuth(data: {
  accessToken: string;
  tokenType?: 'Bearer';
  expiresIn?: number;
  userId?: string;
  user?: UserMe;
}): void {
  authState = {
    accessToken: data.accessToken,
    tokenType: data.tokenType || 'Bearer',
    expiresIn: data.expiresIn,
    userId: data.userId,
    user: data.user,
    isAuthenticated: true,
  };
  notify();

  // Persist token
  AsyncStorage.setItem('auth_token', data.accessToken).catch(err => {
    console.error('[auth.store] Failed to persist token:', err);
  });

  if (__DEV__) {
    console.log('[auth.store] Auth state updated:', {
      userId: data.userId || data.user?.userId,
      userName: data.user?.name,
    });
  }
}

/**
 * Set user profile
 */
export function setUser(user: UserMe | null): void {
  authState.user = user || undefined;
  authState.userId = user?.userId;
  notify();
}

/**
 * Clear auth state (logout)
 */
export async function clearAuth(): Promise<void> {
  authState = {
    accessToken: undefined,
    tokenType: undefined,
    expiresIn: undefined,
    userId: undefined,
    user: undefined,
    isAuthenticated: false,
  };
  notify();

  // Clear from AsyncStorage
  try {
    await AsyncStorage.removeItem('auth_token');
  } catch (error) {
    console.error('[auth.store] Error clearing token:', error);
  }

  if (__DEV__) {
    console.log('[auth.store] Auth state cleared');
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return authState.isAuthenticated && !!authState.accessToken;
}

