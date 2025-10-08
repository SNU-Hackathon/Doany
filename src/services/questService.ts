// Quest Management Service
// Handles CRUD operations for quests

import { collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
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
    const savedQuests: Quest[] = [];
    
    // Validate inputs
    if (!userId || !quests || quests.length === 0) {
      console.warn('[QuestService] Invalid inputs for saveQuests:', { userId, questCount: quests?.length });
      return [];
    }
    
    try {
      // Use batch write for better performance and atomicity
      const batch = writeBatch(db);
      
      for (const quest of quests) {
        // Validate quest data
        if (!quest || typeof quest !== 'object') {
          console.warn('[QuestService] Skipping invalid quest:', quest);
          continue;
        }
        
        // Add quest to Firestore
        const questRef = doc(collection(db, 'users', userId, 'quests'));
        
        // Clean quest data by removing undefined fields
        const questWithMetadata = { 
          ...quest, 
          id: questRef.id,
          goalId: quest.goalId || ''
        };
        const cleanQuestData = this.cleanQuestDataForFirestore(questWithMetadata);
        
        console.log('[QuestService] Saving quest:', {
          id: cleanQuestData.id,
          title: cleanQuestData.title,
          scheduledDate: cleanQuestData.scheduledDate,
          weekNumber: cleanQuestData.weekNumber,
          goalId: cleanQuestData.goalId
        });
        
        batch.set(questRef, cleanQuestData);
        savedQuests.push(cleanQuestData);
      }
      
      await batch.commit();
      console.log('[QuestService] Batch saved', savedQuests.length, 'quests to Firestore');
      
      return savedQuests;
      
    } catch (error) {
      console.error('[QuestService] Error saving quests:', error);
      throw createCatalogError('QUEST_SAVE_ERROR', error);
    }
  }

  /**
   * Clean quest data for Firestore by removing undefined fields
   */
  private static cleanQuestDataForFirestore(quest: Quest): Quest {
    const cleaned = { ...quest };
    
    // Recursively remove undefined fields from object and nested objects
    const removeUndefined = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return null;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(removeUndefined).filter(item => item !== undefined);
      }
      
      if (typeof obj === 'object') {
        const cleanedObj: any = {};
        Object.keys(obj).forEach(key => {
          const value = removeUndefined(obj[key]);
          if (value !== undefined) {
            cleanedObj[key] = value;
          }
        });
        return cleanedObj;
      }
      
      return obj;
    };
    
    const fullyCleanedQuest = removeUndefined(cleaned);
    
    // Ensure required fields have default values
    if (!fullyCleanedQuest.createdAt) {
      fullyCleanedQuest.createdAt = new Date().toISOString();
    }
    
    if (!fullyCleanedQuest.status) {
      fullyCleanedQuest.status = 'pending';
    }
    
    // Ensure metadata exists and has required fields
    if (!fullyCleanedQuest.metadata) {
      fullyCleanedQuest.metadata = {};
    }
    
    // Remove undefined fields from metadata specifically
    if (fullyCleanedQuest.metadata.sequence === undefined) {
      delete fullyCleanedQuest.metadata.sequence;
    }
    
    return fullyCleanedQuest;
  }
  
  /**
   * Get all quests for a goal
   */
  static async getQuestsForGoal(goalId: string, userId: string): Promise<Quest[]> {
    try {
      console.log('[QuestService] Getting quests for goal:', goalId, 'user:', userId);
      
      // Validate inputs
      if (!goalId || !userId) {
        console.log('[QuestService] Invalid inputs, returning empty array');
        return [];
      }
      
      const questsRef = collection(db, 'users', userId, 'quests');
      
      // Use simple query without orderBy to avoid index issues
      const q = query(
        questsRef, 
        where('goalId', '==', goalId)
      );
      
      console.log('[QuestService] Executing simple query without orderBy');
      const snapshot = await getDocs(q);
      const quests: Quest[] = [];
      
      snapshot.forEach(doc => {
        try {
          const questData = doc.data() as Quest;
          quests.push(questData);
        } catch (parseError) {
          console.error('[QuestService] Error parsing quest document:', doc.id, parseError);
        }
      });
      
      // Sort in memory by createdAt
      quests.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateA.getTime() - dateB.getTime();
      });
      
      console.log('[QuestService] Retrieved', quests.length, 'quests for goal:', goalId);
      return quests;
      
    } catch (error) {
      console.error('[QuestService] Error getting quests:', error);
      console.error('[QuestService] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        goalId,
        userId
      });
      
      // Return empty array instead of throwing error to prevent UI blocking
      console.log('[QuestService] Returning empty array due to error');
      return [];
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
      category: goalData.category,
      type: goalData.type,
      duration: goalData.duration,
      frequency: goalData.frequency,
      frequencyDetails: goalData.frequency ? {
        count: goalData.frequency.count,
        unit: goalData.frequency.unit,
        type: typeof goalData.frequency,
        keys: Object.keys(goalData.frequency)
      } : null,
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

    // Determine goal type based on available data
    let goalType = 'frequency'; // default
    
    // Check if it has schedule-specific data
    if (goalData.weeklyWeekdays && goalData.weeklyWeekdays.length > 0) {
      goalType = 'schedule';
    } else if (goalData.schedule?.weekdayConstraints && goalData.schedule.weekdayConstraints.length > 0) {
      goalType = 'schedule';
    } else if (goalData.frequency?.count && goalData.frequency?.unit && goalData.frequency.unit === 'per_week') {
      goalType = 'frequency';
    } else if (goalData.frequency?.count && goalData.frequency.count > 1) {
      // If frequency count is greater than 1, it's likely a frequency goal
      goalType = 'frequency';
    }
    
    console.log('[QuestService] Determined goal type:', goalType, 'based on data:', {
      hasWeeklyWeekdays: !!(goalData.weeklyWeekdays && goalData.weeklyWeekdays.length > 0),
      hasScheduleConstraints: !!(goalData.schedule?.weekdayConstraints && goalData.schedule.weekdayConstraints.length > 0),
      hasFrequency: !!(goalData.frequency?.count && goalData.frequency?.unit)
    });

    // Enhanced quest generation request with more context
    const request = {
      goalId,
      goalTitle: goalData.title,
      goalDescription: goalData.description,
      goalType,
      duration: {
        startDate,
        endDate
      },
      schedule: goalType === 'schedule' ? {
        weekdays: goalData.weeklyWeekdays || goalData.schedule?.weekdayConstraints || [],
        time: goalData.weeklySchedule ? Object.values(goalData.weeklySchedule).flat() : [],
        location: goalData.targetLocation?.name,
        frequency: 1 // Schedule은 각 일정당 1회
      } : goalType === 'frequency' ? {
        weekdays: goalData.weeklyWeekdays || [], // Frequency도 설정된 요일 사용
        time: goalData.weeklySchedule ? Object.values(goalData.weeklySchedule).flat() : [],
        location: goalData.targetLocation?.name,
        frequency: goalData.frequency?.count || 3 // 사용자가 설정한 빈도 사용
      } : undefined,
      verificationMethods: goalData.verificationMethods || ['manual'],
      targetLocation: goalData.targetLocation,
      // Additional context for AI
      originalGoalData: {
        category: goalData.category,
        notes: goalData.notes,
        weeklyWeekdays: goalData.weeklyWeekdays,
        weeklySchedule: goalData.weeklySchedule,
        schedule: goalData.schedule,
        includeDates: goalData.includeDates,
        excludeDates: goalData.excludeDates
      }
    };
    
    console.log('[QuestService] Final quest generation request:', {
      goalId: request.goalId,
      goalTitle: request.goalTitle,
      goalType: request.goalType,
      duration: request.duration,
      schedule: request.schedule,
      originalGoalData: request.originalGoalData
    });
    
    return request;
  }
}
