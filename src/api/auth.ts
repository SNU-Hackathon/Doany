/**
 * DoAny API v1.3 - Auth Module
 * 
 * Authentication endpoints (scaffolding only - UI not wired yet)
 */

import { httpClient } from '../lib/http';
import { AuthResponse } from './types';

/**
 * Login with email and password
 * 
 * @endpoint POST /auth/login
 * @param credentials Email and password
 * @returns Auth tokens and user data
 * 
 * @example
 * ```typescript
 * const auth = await loginPassword({
 *   email: 'user@example.com',
 *   password: 'secure-password'
 * });
 * ```
 * 
 * @todo Wire to UI and auth store
 */
export async function loginPassword(credentials: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return httpClient.post<AuthResponse>('/auth/login', credentials);
}

/**
 * Login with Google OAuth
 * 
 * @endpoint POST /auth/login
 * @param googleToken Google OAuth token
 * @returns Auth tokens and user data
 * 
 * @example
 * ```typescript
 * const auth = await loginGoogle({
 *   provider: 'google',
 *   token: 'google-oauth-token'
 * });
 * ```
 * 
 * @todo Wire to Google Sign-In and auth store
 */
export async function loginGoogle(googleToken: {
  provider: 'google';
  token: string;
}): Promise<AuthResponse> {
  return httpClient.post<AuthResponse>('/auth/login', googleToken);
}

/**
 * Logout (client-side only for now)
 * 
 * @todo Add server-side logout endpoint if spec provides one
 */
export async function logout(): Promise<void> {
  // TODO: Clear auth store
  // TODO: Call server logout endpoint if available
  if (__DEV__) {
    console.log('[auth] logout - clearing local auth state');
  }
}

