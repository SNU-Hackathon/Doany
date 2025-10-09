/**
 * Quest Service - REST API Stub
 * 
 * TODO: Migrate to use REST API from src/api/goals.ts
 * This is a temporary stub to avoid compilation errors
 */

import { Quest } from '../types/quest';

export class QuestService {
  static async createQuest(questData: any): Promise<string> {
    console.warn('[QuestService] Using legacy stub - migrate to REST API');
    // TODO: Use quest endpoints from src/api/goals.ts
    throw new Error('QuestService.createQuest - Not yet migrated to REST API');
  }

  static async updateQuest(questId: string, updates: Partial<Quest>): Promise<void> {
    console.warn('[QuestService] Using legacy stub - migrate to REST API');
    // TODO: Use patchQuest from src/api/goals.ts
    throw new Error('QuestService.updateQuest - Not yet migrated to REST API');
  }

  static async getQuestsByGoalId(goalId: string): Promise<Quest[]> {
    console.warn('[QuestService] Using legacy stub - migrate to REST API');
    // TODO: Use getGoal with expand=quests from src/api/goals.ts
    return [];
  }
}

