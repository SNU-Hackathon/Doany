/**
 * DoAny API v1.3 - Auth Module
 * 
 * Authentication endpoints
 */

import { httpClient } from '../lib/http';
import { LoginRequest, LoginResponse } from './types';

/**
 * Login (unified endpoint)
 * 
 * @endpoint POST /auth/login
 * @param body Login request (password or OAuth)
 * @returns Login response with access token
 * 
 * @example Password
 * ```typescript
 * const result = await login({
 *   provider: 'password',
 *   email: 'user@example.com',
 *   password: 'secure-password'
 * });
 * ```
 * 
 * @example OAuth
 * ```typescript
 * const result = await login({
 *   provider: 'google',
 *   code: 'oauth-code',
 *   redirectUri: 'https://app.example.com/cb'
 * });
 * ```
 */
export async function login(body: LoginRequest): Promise<LoginResponse> {
  return httpClient.post<LoginResponse>('/auth/login', body);
}

/**
 * Login with email and password (convenience wrapper)
 * 
 * @param credentials Email and password
 * @returns Login response
 */
export async function loginPassword(credentials: {
  email: string;
  password: string;
}): Promise<LoginResponse> {
  return login({
    provider: 'password',
    email: credentials.email,
    password: credentials.password,
  });
}

/**
 * Login with Google OAuth (convenience wrapper)
 * 
 * @param oauth OAuth data
 * @returns Login response
 */
export async function loginGoogle(oauth: {
  code: string;
  redirectUri: string;
}): Promise<LoginResponse> {
  return login({
    provider: 'google',
    code: oauth.code,
    redirectUri: oauth.redirectUri,
  });
}

/**
 * Logout (client-side)
 * Note: No server-side logout endpoint in v1.3 spec
 */
export async function logout(): Promise<void> {
  const { clearAuth } = await import('../state/auth.store');
  await clearAuth();
  
  if (__DEV__) {
    console.log('[auth] logout - cleared auth state');
  }
}

