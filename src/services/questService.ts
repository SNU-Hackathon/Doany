/**
 * Quest Service - Thin Re-export Layer
 * 
 * Re-exports quest functions from REST API v1.3 with adapters for legacy compatibility.
 */

// Re-export from api/goals (quest endpoints)
export { patchQuest } from '../api/goals';

import * as GoalsAPI from '../api/goals';
import { Quest } from '../types/quest';

/**
 * Adapter: Get quest by ID
 * Note: API doesn't have direct getQuestById endpoint
 * Need goalId context from caller
 */
export async function getQuestById(questId: string, userId: string): Promise<Quest | null> {
  console.warn('[QuestService.getQuestById] Requires goalId context - not available in v1.3 API');
  console.warn('[QuestService.getQuestById] Consider passing goalId to use getGoal() with expand=quests');
  
  // TODO: Either add goalId parameter or fetch from parent context
  // For now, return null to avoid breaking the app
  return null;
}

/**
 * Adapter: Get quests for a goal
 * Maps to GET /me/goals/{goalId}?expand=quests
 */
export async function getQuestsForGoal(goalId: string, userId: string): Promise<Quest[]> {
  try {
    const goal = await GoalsAPI.getGoal(goalId, { expand: 'quests' });
    
    if (!goal.quests) {
      return [];
    }

    // Transform to Quest type
    return goal.quests.map(apiQuest => {
      // Normalize API state to Quest status
      let status: 'pending' | 'completed' | 'failed' | 'skipped' = 'pending';
      if (apiQuest.state === 'complete') status = 'completed';
      else if (apiQuest.state === 'fail') status = 'failed';
      else if (apiQuest.state === 'onTrack') status = 'pending';

      return {
        id: apiQuest.questId,
        goalId: apiQuest.goalId,
        userId: userId,
        title: apiQuest.description || '',
        description: apiQuest.description,
        status,
        targetDate: apiQuest.date,
        completedAt: typeof apiQuest.completedAt === 'number' 
          ? new Date(apiQuest.completedAt).toISOString() 
          : apiQuest.completedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Quest;
    });
  } catch (error) {
    console.error('[QuestService.getQuestsForGoal] Error:', error);
    return [];
  }
}

/**
 * Adapter: Update quest status
 * Maps to PATCH /quests/{questId}
 * 
 * Normalizes Quest.status ('completed') to API state ('complete')
 */
export async function updateQuestStatus(
  questId: string,
  status: 'pending' | 'completed' | 'failed' | 'skipped' | 'onTrack' | 'ontrack' | 'complete' | 'fail',
  userId: string,
  extra?: {
    completedAt?: number | string | Date;
    note?: string;
    description?: string;
  }
): Promise<void> {
  // Normalize Quest.status to API state
  let state: 'complete' | 'fail' | 'onTrack';
  if (status === 'completed' || status === 'complete') {
    state = 'complete';
  } else if (status === 'ontrack' || status === 'onTrack' || status === 'pending') {
    state = 'onTrack';
  } else if (status === 'failed' || status === 'fail' || status === 'skipped') {
    state = 'fail';
  } else {
    state = status as any;
  }

  // Normalize completedAt to number
  let completedAt: number | string | undefined;
  if (extra?.completedAt) {
    if (extra.completedAt instanceof Date) {
      completedAt = extra.completedAt.getTime();
    } else {
      completedAt = extra.completedAt;
    }
  }

  await GoalsAPI.patchQuest(questId, {
    state,
    completedAt,
    description: extra?.note || extra?.description,
  });
}

/**
 * Adapter: Save quests (create multiple quests for a goal)
 * Note: v1.3 API creates quests together with goal in POST /goals
 * For adding quests to existing goal, not supported in v1.3
 */
export async function saveQuests(quests: any[], userId: string): Promise<string[]> {
  console.warn('[QuestService.saveQuests] Not supported in API v1.3');
  console.warn('[QuestService.saveQuests] Use POST /goals with quests[] array during goal creation');
  throw new Error('saveQuests - Add quests during goal creation (POST /goals with quests array)');
}

/**
 * Adapter: Generate quests for preview
 * This is client-side logic, not an API call
 */
export async function generateQuestsForPreview(data: any, userId?: string): Promise<any[]> {
  console.warn('[QuestService.generateQuestsForPreview] Client-side preview generation');
  // Return empty array - this should be client-side logic
  return [];
}

/**
 * QuestService namespace for legacy callers
 */
export const QuestService = {
  getQuestById,
  getQuestsForGoal,
  updateQuestStatus,
  saveQuests,
  generateQuestsForPreview,
  patchQuest: GoalsAPI.patchQuest,
};

// Default export
export default QuestService;

