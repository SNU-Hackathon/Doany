/**
 * Goal Service - Thin Re-export Layer
 * 
 * Re-exports functions from REST API v1.3 with minimal adapters for legacy compatibility.
 * This allows existing components to keep their imports unchanged.
 */

// Re-export all named exports from api/goals
export {
    createGoal, deleteGoal, getGoal, getMyGoals, patchGoal
} from '../api/goals';

// Import namespace for default export
import * as GoalsAPI from '../api/goals';
import { GoalListResponse } from '../api/types';
import { Goal } from '../types';

/**
 * Adapter: Get active goals (filters for onTrack state)
 * Maps legacy getUserGoals to REST API getMyGoals
 */
export async function getActiveGoals(userId: string): Promise<Goal[]> {
  const response: GoalListResponse = await GoalsAPI.getMyGoals({
    page: 1,
    pageSize: 100,
    state: 'onTrack',
  });

  // Transform to legacy Goal type
  return response.items.map(apiGoal => ({
    id: apiGoal.goalId,
    userId: userId,
    title: apiGoal.title,
    description: apiGoal.description || '',
    category: apiGoal.tags?.[0] || '',
    verificationMethods: [],
    frequency: { count: 1, unit: 'per_day' as const },
    duration: { type: 'days' as const, value: 30 },
    createdAt: typeof apiGoal.createdAt === 'number' 
      ? new Date(apiGoal.createdAt) 
      : new Date(),
    updatedAt: typeof apiGoal.updatedAt === 'number'
      ? new Date(apiGoal.updatedAt)
      : new Date(),
  } as Goal));
}

/**
 * Adapter: Get user's goals
 * Maps to REST API getMyGoals
 */
export async function getUserGoals(userId: string): Promise<Goal[]> {
  const response: GoalListResponse = await GoalsAPI.getMyGoals({
    page: 1,
    pageSize: 100,
  });

  return response.items.map(apiGoal => ({
    id: apiGoal.goalId,
    userId: userId,
    title: apiGoal.title,
    description: apiGoal.description || '',
    category: apiGoal.tags?.[0] || '',
    verificationMethods: [],
    frequency: { count: 1, unit: 'per_day' as const },
    duration: { type: 'days' as const, value: 30 },
    createdAt: typeof apiGoal.createdAt === 'number'
      ? new Date(apiGoal.createdAt)
      : new Date(),
    updatedAt: typeof apiGoal.updatedAt === 'number'
      ? new Date(apiGoal.updatedAt)
      : new Date(),
  } as Goal));
}

/**
 * GoalService namespace for legacy callers using GoalService.method() syntax
 */
export const GoalService = {
  createGoal: GoalsAPI.createGoal,
  getGoal: GoalsAPI.getGoal,
  getMyGoals: GoalsAPI.getMyGoals,
  patchGoal: GoalsAPI.patchGoal,
  deleteGoal: GoalsAPI.deleteGoal,
  getActiveGoals,
  getUserGoals,
  updateGoal: GoalsAPI.patchGoal, // Alias
};

// Default export for legacy imports
export default GoalsAPI;

