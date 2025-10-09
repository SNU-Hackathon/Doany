/**
 * React hooks for Feed API
 */

import { useCallback, useEffect, useState } from 'react';
import * as feedApi from '../api/feed';
import {
    FeedGoalsResponse,
    GoalState,
    GoalVisibility,
    MyLikesResponse,
} from '../api/types';

/**
 * Hook to fetch feed goals
 */
export function useFeedGoals(query?: {
  page?: number;
  pageSize?: number;
  visibility?: GoalVisibility;
  state?: GoalState;
  userId?: string;
  tags?: string;
}) {
  const [data, setData] = useState<FeedGoalsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFeed = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await feedApi.getFeedGoals(query);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [query?.page, query?.pageSize, query?.visibility, query?.state, query?.userId, query?.tags]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchFeed,
  };
}

/**
 * Hook to fetch my liked goals
 */
export function useMyLikes(query?: {
  page?: number;
  pageSize?: number;
}) {
  const [data, setData] = useState<MyLikesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLikes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await feedApi.getMyLikes(query);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [query?.page, query?.pageSize]);

  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchLikes,
  };
}

/**
 * Hook for like/unlike mutations with optimistic updates
 */
export function useLikeMutations() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const toggleLike = useCallback(
    async (goalId: string, currentlyLiked: boolean): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        if (currentlyLiked) {
          await feedApi.unlikeGoal(goalId);
        } else {
          await feedApi.likeGoal(goalId);
        }
        return !currentlyLiked; // Return new state
      } catch (err) {
        setError(err as Error);
        return currentlyLiked; // Rollback on error
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    toggleLike,
    isLoading,
    error,
  };
}

