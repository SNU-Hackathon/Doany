// Quest Management Service
// Handles CRUD operations for quests

import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { createCatalogError } from '../constants/errorCatalog';
import { Quest, QuestStatus } from '../types/quest';
import { db } from './firebase';

export class QuestService {
  
  /**
   * Generate quests for preview (without saving to Firestore)
   */
  static async generateQuestsForPreview(
    goalData: any, 
    userId: string
  ): Promise<Quest[]> {
    console.log('[QuestService] Generating quests for preview');
    console.log('[QuestService] Input goalData:', {
      title: goalData?.title,
      type: goalData?.type,
      duration: goalData?.duration,
      frequency: goalData?.frequency,
      userId
    });
    
    try {
      console.log('[QuestService] Importing QuestGeneratorService...');
      // Import QuestGeneratorService dynamically to avoid circular imports
      const { QuestGeneratorService } = await import('./questGenerator');
      console.log('[QuestService] QuestGeneratorService imported successfully');
      
      console.log('[QuestService] Creating quest generation request...');
      // Create quest generation request
      const request = this.createQuestGenerationRequest('preview', goalData);
      console.log('[QuestService] Request created:', {
        goalId: request.goalId,
        goalTitle: request.goalTitle,
        goalType: request.goalType,
        duration: request.duration,
        schedule: request.schedule
      });
      
      console.log('[QuestService] Calling QuestGeneratorService.generateQuestsFromGoal...');
      // Generate quests using AI
      const result = await QuestGeneratorService.generateQuestsFromGoal(request);
      console.log('[QuestService] QuestGeneratorService returned:', result.quests.length, 'quests');
      
      console.log('[QuestService] Successfully generated', result.quests.length, 'quests for preview');
      return result.quests;
      
    } catch (error) {
      console.error('[QuestService] Error generating preview quests:', error);
      console.error('[QuestService] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        goalData: {
          title: goalData?.title,
          type: goalData?.type,
          duration: goalData?.duration,
          frequency: goalData?.frequency
        }
      });
      throw createCatalogError('QUEST_GENERATION_ERROR', error);
    }
  }

  /**
   * Generate and save quests for a goal
   */
  static async generateAndSaveQuestsForGoal(
    goalId: string, 
    goalData: any, 
    userId: string
  ): Promise<Quest[]> {
    console.log('[QuestService] Generating quests for goal:', goalId);
    
    try {
      // Import QuestGeneratorService dynamically to avoid circular imports
      const { QuestGeneratorService } = await import('./questGenerator');
      
      // Create quest generation request
      const request = this.createQuestGenerationRequest(goalId, goalData);
      
      // Generate quests using AI
      const result = await QuestGeneratorService.generateQuestsFromGoal(request);
      
      // Save quests to Firestore
      const savedQuests = await this.saveQuests(result.quests, userId);
      
      console.log('[QuestService] Successfully generated and saved', savedQuests.length, 'quests');
      return savedQuests;
      
    } catch (error) {
      console.error('[QuestService] Error generating quests:', error);
      throw createCatalogError('QUEST_GENERATION_ERROR', error);
    }
  }
  
  /**
   * Save quests to Firestore
   */
  static async saveQuests(quests: Quest[], userId: string): Promise<Quest[]> {
    const batch = [];
    const savedQuests: Quest[] = [];
    
    try {
      for (const quest of quests) {
        // Add quest to Firestore
        const questRef = doc(collection(db, 'users', userId, 'quests'));
        const questWithId = { ...quest, id: questRef.id };
        
        batch.push(setDoc(questRef, questWithId));
        savedQuests.push(questWithId);
      }
      
      await Promise.all(batch);
      console.log('[QuestService] Saved', savedQuests.length, 'quests to Firestore');
      
      return savedQuests;
      
    } catch (error) {
      console.error('[QuestService] Error saving quests:', error);
      throw createCatalogError('QUEST_SAVE_ERROR', error);
    }
  }
  
  /**
   * Get all quests for a goal
   */
  static async getQuestsForGoal(goalId: string, userId: string): Promise<Quest[]> {
    try {
      const questsRef = collection(db, 'users', userId, 'quests');
      const q = query(
        questsRef, 
        where('goalId', '==', goalId),
        orderBy('createdAt', 'asc')
      );
      
      const snapshot = await getDocs(q);
      const quests: Quest[] = [];
      
      snapshot.forEach(doc => {
        quests.push(doc.data() as Quest);
      });
      
      console.log('[QuestService] Retrieved', quests.length, 'quests for goal:', goalId);
      return quests;
      
    } catch (error) {
      console.error('[QuestService] Error getting quests:', error);
      throw createCatalogError('QUEST_FETCH_ERROR', error);
    }
  }
  
  /**
   * Get a single quest by ID
   */
  static async getQuestById(questId: string, userId: string): Promise<Quest | null> {
    try {
      const questRef = doc(db, 'users', userId, 'quests', questId);
      const snapshot = await getDoc(questRef);
      
      if (snapshot.exists()) {
        return snapshot.data() as Quest;
      }
      
      return null;
      
    } catch (error) {
      console.error('[QuestService] Error getting quest:', error);
      throw createCatalogError('QUEST_FETCH_ERROR', error);
    }
  }
  
  /**
   * Update quest status
   */
  static async updateQuestStatus(
    questId: string, 
    status: QuestStatus, 
    userId: string,
    metadata?: { completedAt?: string; notes?: string }
  ): Promise<void> {
    try {
      const questRef = doc(db, 'users', userId, 'quests', questId);
      const updateData: any = { status };
      
      if (status === 'completed') {
        updateData.completedAt = new Date().toISOString();
      }
      
      if (metadata) {
        updateData.metadata = { ...updateData.metadata, ...metadata };
      }
      
      await updateDoc(questRef, updateData);
      console.log('[QuestService] Updated quest status:', questId, 'to', status);
      
    } catch (error) {
      console.error('[QuestService] Error updating quest status:', error);
      throw createCatalogError('QUEST_UPDATE_ERROR', error);
    }
  }
  
  /**
   * Delete a quest
   */
  static async deleteQuest(questId: string, userId: string): Promise<void> {
    try {
      const questRef = doc(db, 'users', userId, 'quests', questId);
      await deleteDoc(questRef);
      console.log('[QuestService] Deleted quest:', questId);
      
    } catch (error) {
      console.error('[QuestService] Error deleting quest:', error);
      throw createCatalogError('QUEST_DELETE_ERROR', error);
    }
  }
  
  /**
   * Delete all quests for a goal
   */
  static async deleteQuestsForGoal(goalId: string, userId: string): Promise<void> {
    try {
      const quests = await this.getQuestsForGoal(goalId, userId);
      
      const batch = [];
      for (const quest of quests) {
        batch.push(deleteDoc(doc(db, 'users', userId, 'quests', quest.id)));
      }
      
      await Promise.all(batch);
      console.log('[QuestService] Deleted', quests.length, 'quests for goal:', goalId);
      
    } catch (error) {
      console.error('[QuestService] Error deleting quests for goal:', error);
      throw createCatalogError('QUEST_DELETE_ERROR', error);
    }
  }
  
  /**
   * Get quest statistics for a goal
   */
  static async getQuestStats(goalId: string, userId: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    failed: number;
    completionRate: number;
  }> {
    try {
      const quests = await this.getQuestsForGoal(goalId, userId);
      
      const stats = {
        total: quests.length,
        completed: quests.filter(q => q.status === 'completed').length,
        pending: quests.filter(q => q.status === 'pending').length,
        failed: quests.filter(q => q.status === 'failed').length,
        completionRate: 0
      };
      
      stats.completionRate = stats.total > 0 ? stats.completed / stats.total : 0;
      
      return stats;
      
    } catch (error) {
      console.error('[QuestService] Error getting quest stats:', error);
      throw createCatalogError('QUEST_STATS_ERROR', error);
    }
  }
  
  /**
   * Create quest generation request from goal data
   */
  private static createQuestGenerationRequest(goalId: string, goalData: any): any {
    console.log('[QuestService] Creating quest generation request with goalData:', {
      title: goalData.title,
      type: goalData.type,
      duration: goalData.duration,
      frequency: goalData.frequency,
      weeklyWeekdays: goalData.weeklyWeekdays,
      weeklySchedule: goalData.weeklySchedule,
      verificationMethods: goalData.verificationMethods,
      targetLocation: goalData.targetLocation,
      allKeys: Object.keys(goalData)
    });

    // Calculate duration more accurately
    let startDate = goalData.duration?.startDate;
    let endDate = goalData.duration?.endDate;
    
    if (!startDate || !endDate) {
      // Fallback to reasonable defaults
      const now = new Date();
      startDate = now.toISOString().split('T')[0];
      endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    return {
      goalId,
      goalTitle: goalData.title,
      goalDescription: goalData.description,
      goalType: goalData.type,
      duration: {
        startDate,
        endDate
      },
      schedule: goalData.type === 'schedule' ? {
        weekdays: goalData.weeklyWeekdays || [],
        time: goalData.weeklySchedule ? Object.values(goalData.weeklySchedule).flat() : [],
        location: goalData.targetLocation?.name,
        frequency: goalData.frequency?.count || 1
      } : goalData.type === 'frequency' ? {
        weekdays: [],
        time: [],
        location: goalData.targetLocation?.name,
        frequency: goalData.frequency?.count || 3
      } : undefined,
      verificationMethods: goalData.verificationMethods || ['manual'],
      targetLocation: goalData.targetLocation
    };
  }
}
