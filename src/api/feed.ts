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
 * Get feed of completed goals (community space)
 * 
 * @endpoint GET /space/goals
 * @param query Query parameters for filtering and pagination
 * @returns Paginated list of completed goal cards
 * 
 * @example
 * ```typescript
 * const feed = await getFeedGoals({
 *   page: 1,
 *   pageSize: 20,
 *   category: 'reading,fitness',
 *   timeRange: '30d'
 * });
 * ```
 */
export async function getFeedGoals(query?: {
  page?: number; // 기본 1
  pageSize?: number; // 기본 20, 최대 20
  category?: string; // 쉼표 구분 태그 필터 (예: "reading,fitness")
  timeRange?: 'today' | '7d' | '30d' | 'all'; // 기본 30d
}): Promise<FeedGoalsResponse> {
  return httpClient.get<FeedGoalsResponse>('/space/goals', { params: query });
}

/**
 * Like a goal (add to saved/liked list)
 * 
 * @endpoint POST /space/goals/{goalId}/likes/me
 * @param goalId Goal identifier
 * @returns Updated like status
 * 
 * @example
 * ```typescript
 * const result = await likeGoal('goal-123');
 * console.log(result.social.didILike); // true
 * console.log(result.social.likes); // 125
 * ```
 */
export async function likeGoal(goalId: string): Promise<LikeToggleResponse> {
  return httpClient.post<LikeToggleResponse>(`/space/goals/${goalId}/likes/me`);
}

/**
 * Unlike a goal (remove from saved/liked list)
 * 
 * @endpoint PATCH /space/goals/{goalId}/likes/me
 * @param goalId Goal identifier
 * @returns Updated like status
 * 
 * @example
 * ```typescript
 * const result = await unlikeGoal('goal-123');
 * console.log(result.social.didILike); // false
 * console.log(result.social.likes); // 124
 * ```
 */
export async function unlikeGoal(goalId: string): Promise<LikeToggleResponse> {
  return httpClient.patch<LikeToggleResponse>(`/space/goals/${goalId}/likes/me`);
}

/**
 * Get my liked goals (saved goals)
 * 
 * @endpoint GET /space/likes/me
 * @param query Query parameters for pagination and filtering
 * @returns Paginated list of liked goals
 * 
 * @example
 * ```typescript
 * const myLikes = await getMyLikes({
 *   page: 1,
 *   pageSize: 20,
 *   type: 'completion',
 *   tags: 'reading,fitness',
 *   timeRange: '30d'
 * });
 * ```
 */
export async function getMyLikes(query?: {
  page?: number; // 기본 1
  pageSize?: number; // 기본 20, 최대 50
  type?: 'completion'; // 기본값 (이후 확장 대비)
  tags?: string; // 쉼표 구분 (예: "reading,fitness")
  timeRange?: 'today' | '7d' | '30d' | 'all'; // 선택적
}): Promise<MyLikesResponse> {
  return httpClient.get<MyLikesResponse>('/space/likes/me', { params: query });
}

