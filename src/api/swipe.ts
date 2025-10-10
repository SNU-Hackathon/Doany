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
 * Updates voteCount (+1 for yes, -1 for no) and increments voteAttempt
 * 
 * @param proofId Proof ID
 * @param vote 'yes' or 'no'
 * @param serveId Session identifier
 * @returns Updated proof with vote stats
 * 
 * @example
 * ```typescript
 * const result = await voteOnProof('proof-456', 'yes', 'serve-session-789');
 * ```
 */
export async function voteOnProof(
  proofId: string,
  vote: VoteValue,
  serveId: string
): Promise<VoteResponse> {
  if (__DEV__) {
    console.log(`[voteOnProof] proofId=${proofId}, vote=${vote}`);
  }

  return httpClient.patch<VoteResponse>(`/swipe/proofs/${proofId}`, {
    vote,
    serveId,
  });
}

/**
 * Complete proof voting (finalize state)
 * 
 * @endpoint PATCH /swipe-complete/proofs/{proofId}
 * Sets state to 'complete' or 'fail' based on quorum
 * 
 * @param proofId Proof ID
 * @returns Final proof state
 * 
 * @example
 * ```typescript
 * // Call when voteAttempt reaches quorum
 * const result = await completeProofVoting('proof-456');
 * ```
 */
export async function completeProofVoting(proofId: string): Promise<VoteResponse> {
  if (__DEV__) {
    console.log(`[completeProofVoting] proofId=${proofId}`);
  }

  return httpClient.patch<VoteResponse>(`/swipe-complete/proofs/${proofId}`, {});
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

