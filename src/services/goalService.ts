/**
 * Goal Service - REST API Stub
 * 
 * TODO: Migrate to use REST API from src/api/goals.ts
 * This is a temporary stub to avoid compilation errors
 */

import { CreateGoalForm, Goal } from '../types';

export class GoalService {
  static async createGoal(goalData: CreateGoalForm & { userId: string }): Promise<string> {
    console.warn('[GoalService] Using legacy stub - migrate to REST API');
    // TODO: Use createGoal from src/api/goals.ts
    throw new Error('GoalService.createGoal - Not yet migrated to REST API');
  }

  static async getUserGoals(userId: string): Promise<Goal[]> {
    console.warn('[GoalService] Using legacy stub - migrate to REST API');
    // TODO: Use getMyGoals from src/api/goals.ts
    return [];
  }

  static async updateGoal(goalId: string, updates: Partial<Goal>): Promise<void> {
    console.warn('[GoalService] Using legacy stub - migrate to REST API');
    // TODO: Use patchGoal from src/api/goals.ts
    throw new Error('GoalService.updateGoal - Not yet migrated to REST API');
  }

  static async deleteGoal(goalId: string): Promise<void> {
    console.warn('[GoalService] Using legacy stub - migrate to REST API');
    // TODO: Use deleteGoal from src/api/goals.ts
    throw new Error('GoalService.deleteGoal - Not yet migrated to REST API');
  }
}

