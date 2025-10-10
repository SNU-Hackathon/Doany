/**
 * React hooks for Swipe API
 */

import { useCallback, useEffect, useState } from 'react';
import * as swipeApi from '../api/swipe';
import { SwipeProofItem, VoteRequest, VoteResponse } from '../api/types';
import proofsMock from '../mocks/swipe.proofs.json';

// Check if mock mode is enabled
const USE_MOCKS = String(process.env.EXPO_PUBLIC_USE_API_MOCKS ?? 'true') === 'true';

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
      // If mock mode is enabled, use mock data directly
      if (USE_MOCKS) {
        console.log('[useSwipeProofs] Using mock data (EXPO_PUBLIC_USE_API_MOCKS=true)');
        const mockData = Array.isArray(proofsMock) 
          ? proofsMock.slice(0, query?.pageSize || 10) 
          : ((proofsMock as any).items ?? []);
        setData(mockData as SwipeProofItem[]);
        setIsLoading(false);
        return;
      }

      // Try to fetch from API
      const result = await swipeApi.getSwipeProofs(query);
      
      // If result is empty or null, fallback to mock data
      if (!result || (Array.isArray(result) && result.length === 0)) {
        console.log('[useSwipeProofs] API returned empty, falling back to mock data');
        const mockData = Array.isArray(proofsMock) 
          ? proofsMock.slice(0, query?.pageSize || 10) 
          : ((proofsMock as any).items ?? []);
        setData(mockData as SwipeProofItem[]);
      } else {
        setData(result);
      }
    } catch (err) {
      console.error('[useSwipeProofs] Error fetching proofs, falling back to mock data:', err);
      // On error, fallback to mock data
      const mockData = Array.isArray(proofsMock) 
        ? proofsMock.slice(0, query?.pageSize || 10) 
        : ((proofsMock as any).items ?? []);
      setData(mockData as SwipeProofItem[]);
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

