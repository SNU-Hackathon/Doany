/**
 * Verification Service - Thin Re-export Layer
 * 
 * Maps verification/proof functions to REST API v1.3.
 * Verifications are called "proofs" in the API.
 */

// Re-export proof functions
export {
    deleteProof, getProof, postProof
} from '../api/goals';

import * as GoalsAPI from '../api/goals';

/**
 * Adapter: Create verification (maps to postProof)
 */
export async function createVerification(data: {
  goalId: string;
  questId: string;
  url: string;
  description?: string;
  type?: 'photo' | 'video' | 'pdf';
}): Promise<string> {
  const result = await GoalsAPI.postProof(data.goalId, data.questId, {
    url: data.url,
    description: data.description,
    type: data.type || 'photo',
  });
  return result.proofId;
}

/**
 * Adapter: Get goal verifications
 * Maps to GET /me/goals/{goalId}?expand=quests (includes proofs)
 */
export async function getGoalVerifications(goalId: string): Promise<any[]> {
  try {
    const goal = await GoalsAPI.getGoal(goalId, { expand: 'quests' });
    
    if (!goal.quests) {
      return [];
    }

    // Extract proofs from quests
    const proofs: any[] = [];
    for (const quest of goal.quests) {
      if (quest.proof) {
        proofs.push({
          id: quest.proof.proofId,
          proofId: quest.proof.proofId,
          questId: quest.questId,
          goalId: goalId,
          url: quest.proof.url,
          description: quest.proof.description,
          type: quest.proof.type,
          votes: quest.proof.votes,
          createdAt: quest.proof.createdAt,
          updatedAt: quest.proof.updatedAt,
        });
      }
    }

    return proofs;
  } catch (error) {
    console.error('[VerificationService.getGoalVerifications] Error:', error);
    return [];
  }
}

/**
 * Adapter: Get latest verification for a goal
 */
export async function getLatestVerification(goalId: string): Promise<any | null> {
  const verifications = await getGoalVerifications(goalId);
  if (verifications.length === 0) return null;
  
  // Return most recent
  return verifications.sort((a, b) => {
    const aTime = typeof a.createdAt === 'number' ? a.createdAt : 0;
    const bTime = typeof b.createdAt === 'number' ? b.createdAt : 0;
    return bTime - aTime;
  })[0];
}

/**
 * Adapter: Get recent goal verifications count
 */
export async function getRecentGoalVerifications(
  userId: string | number,
  goalId: string
): Promise<number> {
  const verifications = await getGoalVerifications(goalId);
  return verifications.length;
}

/**
 * Adapter: Calculate goal success rate
 */
export async function calculateGoalSuccessRate(
  userId: string | number,
  goalId: string
): Promise<number> {
  try {
    const goal = await GoalsAPI.getGoal(goalId, { expand: 'quests' });
    
    if (!goal.quests || goal.quests.length === 0) {
      return 0;
    }

    const completedCount = goal.quests.filter(q => q.state === 'complete').length;
    return completedCount / goal.quests.length;
  } catch (error) {
    console.error('[VerificationService.calculateGoalSuccessRate] Error:', error);
    return 0;
  }
}

/**
 * VerificationService namespace for legacy callers
 */
export const VerificationService = {
  createVerification,
  getGoalVerifications,
  getLatestVerification,
  getRecentGoalVerifications,
  calculateGoalSuccessRate,
  // Stub functions for unused methods
  getVerifications: async () => [],
  updateVerification: async () => {},
  deleteVerification: GoalsAPI.deleteProof,
  processQueuedVerification: async () => {
    console.warn('[VerificationService.processQueuedVerification] Not implemented');
  },
};

// Default export
export default VerificationService;

