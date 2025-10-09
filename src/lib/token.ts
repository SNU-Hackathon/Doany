/**
 * Token resolver for DoAny API
 * 
 * This module manages authentication tokens.
 * Reads from auth store when available.
 */

import { getAccessToken as getAccessTokenFromStore } from '../state/auth.store';

/**
 * Get the current access token
 * @returns Access token string or undefined if not authenticated
 */
export const getAccessToken = (): string | undefined => {
  return getAccessTokenFromStore();
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

