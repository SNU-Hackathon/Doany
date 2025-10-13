/**
 * DoAny API v1.3 - Swipe Module
 * 
 * Swipe voting and proof verification endpoints
 */

import { httpClient } from '../lib/http';
import {
    Paged,
    SwipeProofItem,
    SwipeProofsResponse,
    VoteRequest,
    VoteResponse
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
 * Vote on a proof (per API v1.3 spec)
 * 
 * @endpoint PATCH /swipe/proofs/{proofId}
 * Updates voteCount (+1 for yes, -1 for no) and decrements voteAttempt by 1
 * 
 * @param proofId Proof ID
 * @param vote 'yes' or 'no'
 * @returns Updated proof with vote stats
 * 
 * @example
 * ```typescript
 * const result = await voteOnProof({ proofId: 'proof-456', body: { vote: 'yes' } });
 * ```
 */
export async function voteOnProof(opts: {
  goalId?: string;
  proofId?: string;
  body: VoteRequest;
}): Promise<VoteResponse> {
  const { proofId, body } = opts;
  
  if (!proofId) {
    throw new Error('proofId is required for voting');
  }

  if (__DEV__) {
    console.log(`[voteOnProof] proofId=${proofId}, vote=${body.vote}`);
  }

  return httpClient.patch<VoteResponse>(`/swipe/proofs/${proofId}`, body);
}

/**
 * Complete proof voting (per API v1.3 spec)
 * 
 * @endpoint PATCH /swipe/swipe-complete/proofs/{proofId}
 * Sets state to 'complete' or 'fail' based on quorum (voteCount >= 0 → complete, < 0 → fail)
 * Called when voteAttempt reaches 1 (last vote)
 * 
 * @param proofId Proof ID
 * @returns Final proof state
 * 
 * @example
 * ```typescript
 * const result = await completeProofVoting('proof-456');
 * ```
 */
export async function completeProofVoting(
  proofId: string
): Promise<{ proofId: string; state: 'complete' | 'fail'; stats: { yes: number; no: number } }> {
  if (__DEV__) {
    console.log(`[completeProofVoting] proofId=${proofId}`);
  }
  
  return httpClient.patch<{ proofId: string; state: 'complete' | 'fail'; stats: { yes: number; no: number } }>(
    `/swipe/swipe-complete/proofs/${proofId}`,
    {}
  );
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

