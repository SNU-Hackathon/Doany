/**
 * DoAny API v1.3 - Swipe Module
 * 
 * Swipe voting and proof verification endpoints
 */

import { apiConfig } from '../config/api';
import { httpClient } from '../lib/http';
import {
    Paged,
    SwipeProofItem,
    SwipeProofsResponse,
    VoteRequest,
    VoteResponse,
} from './types';

/**
 * Get proofs for swipe voting
 * 
 * @endpoint GET /swipe/proofs
 * @param query Query parameters for pagination
 * @returns Proofs to vote on (normalized to array)
 * 
 * @example
 * ```typescript
 * const proofs = await getSwipeProofs({ page: 1, pageSize: 10 });
 * ```
 */
export async function getSwipeProofs(query?: {
  page?: number;
  pageSize?: number;
}): Promise<SwipeProofItem[]> {
  const response = await httpClient.get<SwipeProofsResponse>('/swipe/proofs', {
    params: query,
  });

  // Normalize response to array
  return normalizeSwipeProofsResponse(response);
}

/**
 * Vote on a proof
 * 
 * @endpoint POST /swipe/proofs/{goalId}/votes (new, preferred)
 * @endpoint POST /swipe/proofs/{proofId}/votes (old, fallback)
 * 
 * @param opts Voting options
 * @param opts.goalId Goal ID (for new path)
 * @param opts.proofId Proof ID (for old path)
 * @param opts.body Vote data (vote: yes/no, serveId)
 * @returns Vote result with updated stats
 * 
 * Behavior based on VOTE_PATH_MODE:
 * - 'goal': Use /swipe/proofs/{goalId}/votes
 * - 'proof': Use /swipe/proofs/{proofId}/votes
 * - 'auto': Try goal-path first, fallback to proof-path on 404
 * 
 * @example
 * ```typescript
 * const result = await voteOnProof({
 *   goalId: 'goal-123',
 *   proofId: 'proof-456',
 *   body: {
 *     vote: 'yes',
 *     serveId: 'serve-session-789'
 *   }
 * });
 * ```
 */
export async function voteOnProof(opts: {
  goalId?: string;
  proofId?: string;
  body: VoteRequest;
}): Promise<VoteResponse> {
  const { goalId, proofId, body } = opts;
  const mode = apiConfig.votePathMode;

  if (__DEV__) {
    console.log(`[voteOnProof] mode=${mode}, goalId=${goalId}, proofId=${proofId}`);
  }

  // Mode: goal - always use goal path
  if (mode === 'goal') {
    if (!goalId) {
      throw new Error('goalId is required for vote path mode "goal"');
    }
    return httpClient.post<VoteResponse>(`/swipe/proofs/${goalId}/votes`, body);
  }

  // Mode: proof - always use proof path
  if (mode === 'proof') {
    if (!proofId) {
      throw new Error('proofId is required for vote path mode "proof"');
    }
    return httpClient.post<VoteResponse>(`/swipe/proofs/${proofId}/votes`, body);
  }

  // Mode: auto - try goal path first, fallback to proof path on 404
  if (mode === 'auto') {
    // Try goal path first if goalId is available
    if (goalId) {
      try {
        return await httpClient.post<VoteResponse>(
          `/swipe/proofs/${goalId}/votes`,
          body
        );
      } catch (error: any) {
        // On 404, try proof path if proofId is available
        if (error?.response?.status === 404 && proofId) {
          if (__DEV__) {
            console.log(
              '[voteOnProof] Goal path returned 404, trying proof path...'
            );
          }
          return httpClient.post<VoteResponse>(
            `/swipe/proofs/${proofId}/votes`,
            body
          );
        }
        throw error;
      }
    }

    // If no goalId, try proof path
    if (proofId) {
      return httpClient.post<VoteResponse>(`/swipe/proofs/${proofId}/votes`, body);
    }

    throw new Error('Either goalId or proofId must be provided for voting');
  }

  throw new Error(`Unknown vote path mode: ${mode}`);
}

/**
 * Normalize SwipeProofsResponse to array
 * Handles single object, array, or paginated response
 */
function normalizeSwipeProofsResponse(
  response: SwipeProofsResponse
): SwipeProofItem[] {
  // Already an array
  if (Array.isArray(response)) {
    return response;
  }

  // Paginated response
  if (response && typeof response === 'object' && 'items' in response) {
    return (response as Paged<SwipeProofItem>).items;
  }

  // Single object
  if (response && typeof response === 'object') {
    return [response as SwipeProofItem];
  }

  return [];
}

