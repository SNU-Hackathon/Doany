/**
 * Quest Service Compatibility Adapter
 * 
 * Provides Firebase-compatible API while using REST API v1.3 internally.
 */

import * as goalsApi from '../api/goals';
import { Quest } from '../types/quest';

/**
 * Quest Service - Compatibility layer
 */
export class QuestService {
  /**
   * Create a quest
   * @param questData Quest data
   * @returns Quest ID
   */
  static async createQuest(questData: any): Promise<string> {
    try {
      // TODO: Implement quest creation via API
      console.warn('[QuestService.createQuest] Not yet fully implemented');
      throw new Error('QuestService.createQuest - Not yet migrated to REST API');
    } catch (error) {
      console.error('[QuestService.createQuest] Error:', error);
      throw error;
    }
  }

  /**
   * Update a quest
   * @param questId Quest ID
   * @param updates Partial quest updates
   */
  static async updateQuest(questId: string, updates: Partial<Quest>): Promise<void> {
    try {
      await goalsApi.patchQuest(questId, {
        state: updates.state as any,
        completedAt: updates.completedAt,
        description: updates.description,
      });
    } catch (error) {
      console.error('[QuestService.updateQuest] Error:', error);
      throw error;
    }
  }

  /**
   * Get quests by goal ID
   * @param goalId Goal ID
   * @returns Array of quests
   */
  static async getQuestsByGoalId(goalId: string): Promise<Quest[]> {
    try {
      const goal = await goalsApi.getGoal(goalId, { expand: 'quests' });
      
      if (!goal.quests) {
        return [];
      }

      // Transform to Quest type
      return goal.quests.map((apiQuest): Quest => ({
        id: apiQuest.questId,
        goalId: apiQuest.goalId,
        date: apiQuest.date,
        time: apiQuest.time,
        description: apiQuest.description,
        state: apiQuest.state as any,
        completedAt: apiQuest.completedAt,
        method: apiQuest.method as any,
      } as Quest));
    } catch (error) {
      console.error('[QuestService.getQuestsByGoalId] Error:', error);
      return [];
    }
  }
}

// Export individual functions
export const { createQuest, updateQuest, getQuestsByGoalId } = QuestService;

