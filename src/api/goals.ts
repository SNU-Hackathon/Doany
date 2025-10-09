/**
 * DoAny API v1.3 - Goals Module
 * 
 * Goal, quest, and proof management endpoints
 */

import { httpClient } from '../lib/http';
import {
    CreateGoalRequest,
    CreateGoalResponse,
    GoalDetail,
    GoalListResponse,
    GoalState,
    GoalVisibility,
    PatchGoalRequest,
    PatchQuestRequest,
    PatchQuestResponse,
    PostProofRequest,
    PostProofResponse,
    ProofDetail,
} from './types';

// ============================================================================
// Goal Read Endpoints
// ============================================================================

/**
 * Get my goals list
 * 
 * @endpoint GET /me/goals
 * @param query Query parameters for filtering and pagination
 * @returns Paginated list of goals
 * 
 * @example
 * ```typescript
 * const goals = await getMyGoals({
 *   page: 1,
 *   pageSize: 20,
 *   state: 'onTrack',
 *   visibility: 'public'
 * });
 * ```
 */
export async function getMyGoals(query?: {
  page?: number;
  pageSize?: number;
  state?: GoalState;
  visibility?: GoalVisibility;
  startAfter?: number | string;
  endBefore?: number | string;
}): Promise<GoalListResponse> {
  return httpClient.get<GoalListResponse>('/me/goals', { params: query });
}

/**
 * Get detailed goal information
 * 
 * @endpoint GET /me/goals/{goalId}
 * @param goalId Goal identifier
 * @param query Query parameters
 * @param query.expand Comma-separated list of fields to expand (e.g., 'quests')
 * @returns Detailed goal information
 * 
 * @example
 * ```typescript
 * const goal = await getGoal('goal-123', { expand: 'quests' });
 * ```
 */
export async function getGoal(
  goalId: string,
  query?: { expand?: string }
): Promise<GoalDetail> {
  return httpClient.get<GoalDetail>(`/me/goals/${goalId}`, { params: query });
}

// ============================================================================
// Goal Write Endpoints
// ============================================================================

/**
 * Create a new goal
 * 
 * @endpoint POST /goals
 * @param body Goal creation data
 * @returns Created goal summary
 * 
 * @example
 * ```typescript
 * const newGoal = await createGoal({
 *   title: 'Learn TypeScript',
 *   description: 'Master TypeScript in 30 days',
 *   visibility: 'public',
 *   tags: ['learning', 'programming'],
 *   method: 'schedule',
 *   startAt: Date.now(),
 *   endAt: Date.now() + 30 * 24 * 60 * 60 * 1000
 * });
 * ```
 */
export async function createGoal(body: CreateGoalRequest): Promise<CreateGoalResponse> {
  return httpClient.post<CreateGoalResponse>('/goals', body);
}

/**
 * Update an existing goal
 * 
 * @endpoint PATCH /goals/{goalId}
 * @param goalId Goal identifier
 * @param body Partial goal data to update
 * @returns Updated goal details (or void if 204)
 * 
 * @example
 * ```typescript
 * await patchGoal('goal-123', {
 *   title: 'Updated Title',
 *   state: 'complete'
 * });
 * ```
 */
export async function patchGoal(
  goalId: string,
  body: PatchGoalRequest
): Promise<GoalDetail | void> {
  return httpClient.patch<GoalDetail>(`/goals/${goalId}`, body);
}

/**
 * Delete a goal
 * 
 * @endpoint DELETE /goals/{goalId}
 * @param goalId Goal identifier
 * 
 * @example
 * ```typescript
 * await deleteGoal('goal-123');
 * ```
 */
export async function deleteGoal(goalId: string): Promise<void> {
  return httpClient.delete(`/goals/${goalId}`);
}

// ============================================================================
// Quest Endpoints
// ============================================================================

/**
 * Update a quest
 * 
 * @endpoint PATCH /quests/{questId}
 * @param questId Quest identifier (globally unique)
 * @param body Quest update data
 * @returns Updated quest data
 * 
 * @example
 * ```typescript
 * await patchQuest('quest-456', {
 *   state: 'complete',
 *   completedAt: Date.now()
 * });
 * ```
 */
export async function patchQuest(
  questId: string,
  body: PatchQuestRequest
): Promise<PatchQuestResponse> {
  return httpClient.patch<PatchQuestResponse>(`/quests/${questId}`, body);
}

// ============================================================================
// Proof Endpoints
// ============================================================================

/**
 * Submit proof for a quest
 * 
 * @endpoint POST /goals/{goalId}/quests/{questId}/proofs
 * @param goalId Goal identifier
 * @param questId Quest identifier
 * @param body Proof data (url, description, type)
 * @returns Created proof details
 * 
 * @example
 * ```typescript
 * const proof = await postProof('goal-123', 'quest-456', {
 *   url: 'https://cdn.example.com/proof.jpg',
 *   description: 'Completed task',
 *   type: 'photo'
 * });
 * ```
 */
export async function postProof(
  goalId: string,
  questId: string,
  body: PostProofRequest
): Promise<PostProofResponse> {
  return httpClient.post<PostProofResponse>(
    `/goals/${goalId}/quests/${questId}/proofs`,
    body
  );
}

/**
 * Get proof details
 * 
 * @endpoint GET /me/proofs/{proofId}
 * @param proofId Proof identifier
 * @returns Detailed proof information
 * 
 * @example
 * ```typescript
 * const proof = await getProof('proof-789');
 * ```
 */
export async function getProof(proofId: string): Promise<ProofDetail> {
  return httpClient.get<ProofDetail>(`/me/proofs/${proofId}`);
}

/**
 * Delete a proof
 * 
 * @endpoint DELETE /proofs/{proofId}
 * @param proofId Proof identifier
 * 
 * @example
 * ```typescript
 * await deleteProof('proof-789');
 * ```
 */
export async function deleteProof(proofId: string): Promise<void> {
  return httpClient.delete(`/proofs/${proofId}`);
}

