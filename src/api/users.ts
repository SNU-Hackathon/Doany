/**
 * DoAny API v1.3 - Users Module
 * 
 * User profile and registration endpoints
 */

import { httpClient } from '../lib/http';
import { UserMe } from './types';

/**
 * Get current user profile
 * 
 * @endpoint GET /users/me
 * @param params Optional query parameters
 * @param params.id Optional user ID (for admin/friends viewing)
 * @returns User profile data
 * 
 * @example
 * ```json
 * {
 *   "userId": "user-123",
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   "streak": 7,
 *   "badges": ["early-adopter", "consistent"],
 *   "swipeStats": {
 *     "totalVotes": 150,
 *     "accuracy": 0.85
 *   },
 *   "createdAt": 1609459200000,
 *   "updatedAt": 1609545600000
 * }
 * ```
 */
export async function getMe(params?: { id?: string }): Promise<UserMe> {
  return httpClient.get<UserMe>('/users/me', { params });
}

/**
 * Join/register new user
 * 
 * @endpoint POST /users/join
 * @param payload Registration data
 * @returns User data or success response
 * 
 * @todo Define exact payload shape when backend spec is finalized
 */
export async function join(payload: Record<string, unknown>): Promise<unknown> {
  return httpClient.post('/users/join', payload);
}

