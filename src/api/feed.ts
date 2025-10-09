/**
 * DoAny API v1.3 - Feed Module
 * 
 * Feed, likes, and social interaction endpoints
 */

import { httpClient } from '../lib/http';
import {
    FeedGoalsResponse,
    GoalState,
    GoalVisibility,
    LikeToggleResponse,
    MyLikesResponse,
} from './types';

/**
 * Get feed of public/friends goals
 * 
 * @endpoint GET /feed/goals
 * @param query Query parameters for filtering and pagination
 * @returns Paginated list of feed items
 * 
 * @example
 * ```typescript
 * const feed = await getFeedGoals({
 *   page: 1,
 *   pageSize: 20,
 *   visibility: 'public',
 *   state: 'onTrack'
 * });
 * ```
 */
export async function getFeedGoals(query?: {
  page?: number;
  pageSize?: number;
  visibility?: GoalVisibility;
  state?: GoalState;
  userId?: string; // Filter by specific user
  tags?: string; // Comma-separated tags
}): Promise<FeedGoalsResponse> {
  return httpClient.get<FeedGoalsResponse>('/feed/goals', { params: query });
}

/**
 * Like a goal
 * 
 * @endpoint POST /feed/goals/{goalId}/likes/me
 * @param goalId Goal identifier
 * @returns Updated like status
 * 
 * @example
 * ```typescript
 * const result = await likeGoal('goal-123');
 * console.log(result.liked); // true
 * console.log(result.likes); // 16
 * ```
 */
export async function likeGoal(goalId: string): Promise<LikeToggleResponse> {
  return httpClient.post<LikeToggleResponse>(`/feed/goals/${goalId}/likes/me`);
}

/**
 * Unlike a goal
 * 
 * @endpoint DELETE /feed/goals/{goalId}/likes/me
 * @param goalId Goal identifier
 * @returns Updated like status
 * 
 * @example
 * ```typescript
 * const result = await unlikeGoal('goal-123');
 * console.log(result.liked); // false
 * console.log(result.likes); // 15
 * ```
 */
export async function unlikeGoal(goalId: string): Promise<LikeToggleResponse> {
  return httpClient.delete<LikeToggleResponse>(`/feed/goals/${goalId}/likes/me`);
}

/**
 * Get my liked goals
 * 
 * @endpoint GET /me/likes
 * @param query Query parameters for pagination
 * @returns Paginated list of liked goals
 * 
 * @example
 * ```typescript
 * const myLikes = await getMyLikes({
 *   page: 1,
 *   pageSize: 50
 * });
 * ```
 */
export async function getMyLikes(query?: {
  page?: number;
  pageSize?: number; // Max 50 for likes endpoint
}): Promise<MyLikesResponse> {
  return httpClient.get<MyLikesResponse>('/me/likes', { params: query });
}

