/**
 * React hooks for Swipe API
 */

import { useCallback, useEffect, useState } from 'react';
import * as swipeApi from '../api/swipe';
import { SwipeProofItem, VoteRequest, VoteResponse } from '../api/types';

/**
 * Hook to fetch swipe proofs
 */
export function useSwipeProofs(query?: {
  page?: number;
  pageSize?: number;
}) {
  const [data, setData] = useState<SwipeProofItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Stringify query to avoid infinite loop
  const queryStr = JSON.stringify(query || {});

  const fetchProofs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await swipeApi.getSwipeProofs(query);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [queryStr]); // Use stringified query

  useEffect(() => {
    fetchProofs();
  }, [fetchProofs]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchProofs,
  };
}

/**
 * Hook for voting with optimistic updates
 */
export function useVoteMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const vote = useCallback(
    async (opts: {
      goalId?: string;
      proofId?: string;
      body: VoteRequest;
    }): Promise<VoteResponse | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await swipeApi.voteOnProof(opts);
        return result;
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    vote,
    isLoading,
    error,
  };
}

