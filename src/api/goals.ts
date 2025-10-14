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
  PatchGoalRequest,
  PatchQuestRequest,
  PatchQuestResponse,
  PostProofRequest,
  PostProofResponse,
  ProofDetail
} from './types';

// ============================================================================
// Goal Read Endpoints
// ============================================================================

/**
 * Get my goals list
 * 
 * @endpoint GET /goals/me/{userId}
 * @param userId User ID (현재 로그인한 사용자의 ID)
 * @param query Query parameters for filtering and pagination
 * @param headers Optional headers (Prefer, X-Accept-Time-Format)
 * @returns Paginated list of goals with summary information
 * 
 * @example
 * ```typescript
 * const goals = await getMyGoals('user123', {
 *   page: 1,
 *   pageSize: 20,
 *   state: 'onTrack',
 *   category: 'exercise,health',
 *   sort: 'updatedAt_desc'
 * });
 * ```
 */
export async function getMyGoals(
  userId: string = '1',
  query?: {
    page?: number; // 기본 1
    pageSize?: number; // 기본 20, 최대 20
    state?: 'fail' | 'onTrack' | 'complete' | 'all'; // 기본 'onTrack'
    category?: string; // 쉼표 구분 (예: "study,exercise,health,all")
    sort?: 'updatedAt_desc' | 'successRate_desc' | 'title_asc'; // 기본 'updatedAt_desc'
    visibility?: 'public' | 'friends' | 'private';
  },
  headers?: {
    Prefer?: string; // 예: "max-stale=120"
    'X-Accept-Time-Format'?: string;
  }
): Promise<GoalListResponse> {
  try {
    console.log('[GOALS] 📝 Sending request to /goals/me/${userId}', {
      userId,
      query,
      headers
    });
    
    const response = await httpClient.get<GoalListResponse>(`/goals/me/${userId}`, { 
      params: query,
      headers
    });
    
    console.log('[GOALS] ✅ Response received:', response);
    return response;
  } catch (error) {
    console.error('[GOALS] ❌ Error:', error);
    throw error;
  }
}

/**
 * Get detailed goal information with quests
 * 
 * @endpoint GET /goals/quests/{goalId}
 * @param goalId Goal identifier
 * @returns Detailed goal information including quests
 * 
 * @example Response:
 * ```json
 * {
 *   "goalId": "goal_abc",
 *   "title": "Read 30 mins",
 *   "description": "Read book before bed",
 *   "GoalType": "schedule",
 *   "schedule": { "type": "daily", "time": "21:00" },
 *   "tags": ["reading"],
 *   "quests": [
 *     {"questId": "qst_1", "date": "2025-10-08", "description": "책 30분 읽기", "state": "complete"}
 *   ]
 * }
 * ```
 */
export async function getGoalWithQuests(
  goalId: string
): Promise<GoalDetail> {
  try {
    console.log('[GOALS] 📝 Fetching goal details:', goalId);
    const response = await httpClient.get<GoalDetail>(`/goals/quests/${goalId}`);
    console.log('[GOALS] ✅ Goal details received:', response);
    return response;
  } catch (error) {
    console.error('[GOALS] ❌ Error fetching goal details:', error);
    throw error;
  }
}

/**
 * Get detailed goal information (legacy, use getGoalWithQuests instead)
 * 
 * @deprecated Use getGoalWithQuests for goal details with quests
 * @endpoint GET /me/goals/{goalId}
 * @param goalId Goal identifier
 * @param query Query parameters
 * @param query.expand Comma-separated list of fields to expand (e.g., 'quests')
 * @returns Detailed goal information
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
 * @param query Query parameters (userId, visibility, goalType)
 * @param body Goal creation data based on goalType
 * @returns Created goal response with goalId and createdAt
 * 
 * @example Schedule 타입
 * ```typescript
 * const newGoal = await createGoal(
 *   { userId: 'user123', visibility: 'public', goalType: 'schedule' },
 *   {
 *     goalType: 'schedule',
 *     title: '매일 아침 7시 조깅하기',
 *     description: '건강을 위해 매일 아침 30분 조깅',
 *     tags: ['운동', '조깅', '건강'],
 *     startAt: '2025-10-12',
 *     endAt: '2025-11-12',
 *     quests: [
 *       { date: '2025-10-12', time: '07:00', description: '조깅 30분', verificationMethod: 'camera' }
 *     ]
 *   }
 * );
 * ```
 * 
 * @example Frequency 타입
 * ```typescript
 * const newGoal = await createGoal(
 *   { userId: 'user123', visibility: 'public', goalType: 'frequency' },
 *   {
 *     goalType: 'frequency',
 *     title: 'Read 30 mins',
 *     period: 'week',
 *     numbers: 4,
 *     quests: [
 *       { unit: 1, description: '책 30분 읽기', verificationMethod: 'camera' }
 *     ]
 *   }
 * );
 * ```
 */
export async function createGoal(
  query: {
    userId: string;
    visibility: 'public' | 'friends' | 'private';
    goalType: 'schedule' | 'frequency' | 'milestone';
  },
  body: CreateGoalRequest
): Promise<CreateGoalResponse> {
  return httpClient.post<CreateGoalResponse>('/goals', body, { params: query });
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
 * @endpoint GET /goals/proofs/me/{proofId}
 * @param proofId Proof identifier
 * @returns Detailed proof information
 * 
 * @example
 * ```typescript
 * const proof = await getProof('proof-789');
 * ```
 */
export async function getProof(proofId: string): Promise<ProofDetail> {
  return httpClient.get<ProofDetail>(`/goals/proofs/me/${proofId}`);
}

/**
 * Delete a proof
 * 
 * @endpoint DELETE /goals/proofs/{proofId}
 * @param proofId Proof identifier
 * 
 * @example
 * ```typescript
 * await deleteProof('proof-789');
 * ```
 */
export async function deleteProof(proofId: string): Promise<void> {
  return httpClient.delete(`/goals/proofs/${proofId}`);
}

