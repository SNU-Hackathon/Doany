/**
 * Goal Service - Thin Re-export Layer
 * 
 * Re-exports functions from REST API v1.3 with minimal adapters for legacy compatibility.
 * This allows existing components to keep their imports unchanged.
 */

// Import namespace for default export
import * as GoalsAPI from '../api/goals';
import { CreateGoalRequest, CreateGoalResponse, GoalListResponse } from '../api/types';
import { CreateGoalForm, Goal } from '../types';

// Re-export most functions directly
export {
  deleteGoal, getGoal, getMyGoals, patchGoal
} from '../api/goals';

/**
 * Adapter: Create goal with form data transformation
 * Converts CreateGoalForm to CreateGoalRequest
 */
export async function createGoal(
  goalData: (CreateGoalForm & { userId: string }) | CreateGoalRequest
): Promise<CreateGoalResponse> {
  // Extract userId
  const userId = 'userId' in goalData ? goalData.userId : '1';
  
  // If already in API format, use directly
  if ('goalType' in goalData) {
    const query = {
      userId,
      visibility: 'public' as const,
      goalType: goalData.goalType,
    };
    return GoalsAPI.createGoal(query, goalData as CreateGoalRequest);
  }

  // Transform CreateGoalForm to CreateGoalRequest
  const formData = goalData as CreateGoalForm & { userId: string };
  
  // Determine goal type from form data
  const goalType: 'schedule' | 'frequency' | 'milestone' = 
    formData.type === 'schedule' ? 'schedule' :
    formData.type === 'frequency' ? 'frequency' : 'frequency';

  // Build API request based on goal type
  let apiRequest: CreateGoalRequest;
  
  if (goalType === 'schedule') {
    apiRequest = {
      goalType: 'schedule',
      title: formData.title,
      description: formData.description,
      tags: formData.category ? [formData.category] : [],
      startAt: formData.duration?.startDate ? `${formData.duration.startDate}T00:00` : undefined,
      endAt: formData.duration?.endDate ? `${formData.duration.endDate}T00:00` : undefined,
      quests: [], // Empty for now, should be filled by caller
    };
  } else if (goalType === 'frequency') {
    apiRequest = {
      goalType: 'frequency',
      title: formData.title,
      description: formData.description,
      tags: formData.category ? [formData.category] : [],
      startAt: formData.duration?.startDate ? `${formData.duration.startDate}T00:00` : undefined,
      endAt: formData.duration?.endDate ? `${formData.duration.endDate}T00:00` : undefined,
      period: 'week',
      numbers: formData.frequency?.count || 3,
      quests: [], // Empty for now, should be filled by caller
    };
  } else {
    apiRequest = {
      goalType: 'milestone',
      title: formData.title,
      description: formData.description,
      tags: formData.category ? [formData.category] : [],
      startAt: formData.duration?.startDate ? `${formData.duration.startDate}T00:00` : undefined,
      endAt: formData.duration?.endDate ? `${formData.duration.endDate}T00:00` : undefined,
      scheduleMethod: 'milestone',
      quests: [], // Empty for now, should be filled by caller
      totalSteps: 3, // Default value
      currentStepIndex: 0,
      overallTarget: 100,
      config: {
        rewardPerStep: 100,
        maxFails: 1
      }
    };
  }

  const query = {
    userId,
    visibility: 'public' as const,
    goalType,
  };

  return GoalsAPI.createGoal(query, apiRequest);
}

/**
 * Adapter: Get active goals (filters for onTrack state)
 * Maps legacy getUserGoals to REST API getMyGoals
 */
export async function getActiveGoals(userId: string = '1'): Promise<Goal[]> {
  const response: GoalListResponse = await GoalsAPI.getMyGoals(userId, {
    page: 1,
    pageSize: 100,
    state: 'onTrack',
  });

  // Transform to legacy Goal type
  return response.items.map(apiGoal => ({
    id: String(apiGoal.goalId),
    userId: userId,
    title: apiGoal.title,
    description: apiGoal.description || '',
    category: apiGoal.tag || '',
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
export async function getUserGoals(userId: string = '1'): Promise<Goal[]> {
  const response: GoalListResponse = await GoalsAPI.getMyGoals(userId, {
    page: 1,
    pageSize: 100,
  });

  return response.items.map(apiGoal => ({
    id: String(apiGoal.goalId),
    userId: userId,
    title: apiGoal.title,
    description: apiGoal.description || '',
    category: apiGoal.tag || '',
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
  createGoal, // Use adapter
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

