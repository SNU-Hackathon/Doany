/**
 * DoAny Auth Store
 * 
 * Simple auth state management (scaffolding only - not wired to UI yet)
 * 
 * @todo Replace with Zustand or integrate with existing auth system
 * @todo Wire to login/logout flows in UI
 * @todo Persist tokens to AsyncStorage
 */

export interface AuthState {
  accessToken: string | undefined;
  refreshToken: string | undefined;
  user:
    | {
        id: string;
        name: string;
        email?: string;
      }
    | undefined;
  isAuthenticated: boolean;
}

// Simple in-memory store (will be replaced with proper state management)
let authState: AuthState = {
  accessToken: undefined,
  refreshToken: undefined,
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
 * Set auth tokens and user data
 */
export function setAuth(data: {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; name: string; email?: string };
}): void {
  authState = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
    isAuthenticated: true,
  };
  notify();

  // TODO: Persist to AsyncStorage
  if (__DEV__) {
    console.log('[auth.store] Auth state updated:', {
      userId: data.user.id,
      userName: data.user.name,
    });
  }
}

/**
 * Clear auth state (logout)
 */
export function clearAuth(): void {
  authState = {
    accessToken: undefined,
    refreshToken: undefined,
    user: undefined,
    isAuthenticated: false,
  };
  notify();

  // TODO: Clear from AsyncStorage
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

