/**
 * Token resolver for DoAny API
 * 
 * This module manages authentication tokens.
 * Currently returns undefined - will be wired to auth store later.
 */

/**
 * Get the current access token
 * @returns Access token string or undefined if not authenticated
 * 
 * TODO: Wire this to the auth store once authentication is implemented
 * For now, returns undefined to allow unauthenticated mock API calls
 */
export const getAccessToken = (): string | undefined => {
  // TODO: Read from auth store when auth module is complete
  // Example:
  // import { useAuthStore } from '@/state/auth.store';
  // return useAuthStore.getState().accessToken;
  
  return undefined;
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return getAccessToken() !== undefined;
};

/**
 * Get authorization header value
 */
export const getAuthorizationHeader = (): string | undefined => {
  const token = getAccessToken();
  return token ? `Bearer ${token}` : undefined;
};

