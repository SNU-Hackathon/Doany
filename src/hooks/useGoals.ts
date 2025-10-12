/**
 * React hooks for Goals API
 */

import { useCallback, useEffect, useState } from 'react';
import * as goalsApi from '../api/goals';
import {
  CreateGoalRequest,
  CreateGoalResponse,
  GoalDetail,
  GoalListResponse,
  PatchGoalRequest
} from '../api/types';

/**
 * Hook to fetch my goals list
 * 명세서: GET /goals/me/{userId}
 */
export function useMyGoals(
  userId: string = '1',
  query?: {
    page?: number;
    pageSize?: number;
    state?: 'fail' | 'onTrack' | 'complete' | 'all';
    category?: string;
    sort?: 'updatedAt_desc' | 'successRate_desc' | 'title_asc';
    visibility?: 'public' | 'friends' | 'private';
  }
) {
  const [data, setData] = useState<GoalListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Stringify query to avoid infinite loop from object reference changes
  const queryStr = JSON.stringify(query || {});

  const fetchGoals = useCallback(async () => {
    if (!userId) {
      setError(new Error('userId is required'));
      return;
    }
    
    console.log('[USE_GOALS] 📝 Fetching goals for userId:', userId, 'with query:', query);
    setIsLoading(true);
    setError(null);
    try {
      const result = await goalsApi.getMyGoals(userId, query);
      console.log('[USE_GOALS] ✅ Fetched goals:', result);
      setData(result);
    } catch (err) {
      console.error('[USE_GOALS] ❌ Error fetching goals:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, queryStr]); // Use stringified query

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchGoals,
  };
}

/**
 * Hook to fetch a single goal
 */
export function useGoal(goalId: string, expand?: string) {
  const [data, setData] = useState<GoalDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchGoal = useCallback(async () => {
    if (!goalId) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await goalsApi.getGoal(goalId, { expand });
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [goalId, expand]); // These are primitives, safe for dependencies

  useEffect(() => {
    fetchGoal();
  }, [fetchGoal]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchGoal,
  };
}

/**
 * Hook for goal mutations (create, update, delete)
 */
export function useGoalMutations() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createGoal = useCallback(
    async (
      query: {
        userId: string;
        visibility: 'public' | 'friends' | 'private';
        goalType: 'schedule' | 'frequency' | 'milestone';
      },
      body: CreateGoalRequest
    ): Promise<CreateGoalResponse | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await goalsApi.createGoal(query, body);
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

  const updateGoal = useCallback(
    async (
      goalId: string,
      body: PatchGoalRequest
    ): Promise<GoalDetail | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await goalsApi.patchGoal(goalId, body);
        return result || null;
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const deleteGoal = useCallback(async (goalId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await goalsApi.deleteGoal(goalId);
      return true;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createGoal,
    updateGoal,
    deleteGoal,
    isLoading,
    error,
  };
}

