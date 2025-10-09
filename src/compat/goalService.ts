/**
 * Goal Service Compatibility Adapter
 * 
 * Provides Firebase-compatible API while using REST API v1.3 internally.
 * This allows existing components to work without modification.
 */

import * as goalsApi from '../api/goals';
import { CreateGoalResponse, GoalDetail, GoalListResponse } from '../api/types';
import { CreateGoalForm, Goal } from '../types';

/**
 * Goal Service - Compatibility layer
 * Maps old Firebase-style calls to new REST API
 */
export class GoalService {
  /**
   * Create a new goal
   * @param goalData Goal creation data with userId
   * @returns Goal ID
   */
  static async createGoal(goalData: CreateGoalForm & { userId: string }): Promise<string> {
    try {
      const result: CreateGoalResponse = await goalsApi.createGoal({
        title: goalData.title,
        description: goalData.description,
        tags: goalData.category ? [goalData.category] : [],
        visibility: 'public',
        startAt: goalData.duration?.startDate,
        endAt: goalData.duration?.endDate,
      });
      return result.goalId;
    } catch (error) {
      console.error('[GoalService.createGoal] Error:', error);
      throw error;
    }
  }

  /**
   * Get user's goals
   * @param userId User ID
   * @returns Array of goals
   */
  static async getUserGoals(userId: string): Promise<Goal[]> {
    try {
      const response: GoalListResponse = await goalsApi.getMyGoals({
        page: 1,
        pageSize: 100,
      });

      // Transform API response to local Goal type
      return response.items.map((apiGoal): Goal => ({
        id: apiGoal.goalId,
        userId: userId,
        title: apiGoal.title,
        description: apiGoal.description || '',
        category: apiGoal.tags?.[0] || '',
        verificationMethods: [],
        frequency: { count: 1, unit: 'per_day' },
        duration: { type: 'days', value: 30 },
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    } catch (error) {
      console.error('[GoalService.getUserGoals] Error:', error);
      return [];
    }
  }

  /**
   * Update a goal
   * @param goalId Goal ID
   * @param updates Partial goal updates
   */
  static async updateGoal(goalId: string, updates: Partial<Goal>): Promise<void> {
    try {
      await goalsApi.patchGoal(goalId, {
        title: updates.title,
        description: updates.description,
        tags: updates.category ? [updates.category] : undefined,
      });
    } catch (error) {
      console.error('[GoalService.updateGoal] Error:', error);
      throw error;
    }
  }

  /**
   * Delete a goal
   * @param goalId Goal ID
   */
  static async deleteGoal(goalId: string): Promise<void> {
    try {
      await goalsApi.deleteGoal(goalId);
    } catch (error) {
      console.error('[GoalService.deleteGoal] Error:', error);
      throw error;
    }
  }

  /**
   * Get goal by ID
   * @param goalId Goal ID
   * @returns Goal detail
   */
  static async getGoal(goalId: string): Promise<GoalDetail | null> {
    try {
      return await goalsApi.getGoal(goalId, { expand: 'quests' });
    } catch (error) {
      console.error('[GoalService.getGoal] Error:', error);
      return null;
    }
  }
}

// Export individual functions for convenience
export const { createGoal, getUserGoals, updateGoal, deleteGoal, getGoal } = GoalService;

