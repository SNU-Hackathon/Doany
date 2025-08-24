// Goal service functions for Firebase operations with performance optimizations

import { getAuth } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import { CreateGoalForm, Goal } from '../types';
import { sanitizeGoalPayload } from '../utils/firestoreSanitize';
import { db } from './firebase';

export class GoalService {
  // Create a new goal with batched writes for performance
  static async createGoal(goalData: CreateGoalForm & { userId: string }): Promise<string> {
    console.time('[GoalService] Create Goal');
    
    try {
      const batch = writeBatch(db);
      const goalRef = doc(collection(db, 'users', goalData.userId, 'goals'));
      
      // Clean targetLocation to remove undefined values
      const cleanTargetLocation = goalData.targetLocation ? {
        name: goalData.targetLocation.name || '',
        lat: goalData.targetLocation.lat || 0,
        lng: goalData.targetLocation.lng || 0,
        ...(goalData.targetLocation.placeId && { placeId: goalData.targetLocation.placeId }),
        ...(goalData.targetLocation.address && { address: goalData.targetLocation.address })
      } : null;

      // Log the payload before sanitization to debug timeWindows undefined issue
      console.log('[GoalPayload Before Sanitize]', JSON.stringify({
        ...goalData,
        // Mask PII fields
        userId: goalData.userId ? '***' : undefined,
        targetLocation: goalData.targetLocation ? {
          name: goalData.targetLocation.name ? '***' : undefined,
          lat: goalData.targetLocation.lat,
          lng: goalData.targetLocation.lng,
          placeId: goalData.targetLocation.placeId ? '***' : undefined,
          address: goalData.targetLocation.address ? '***' : undefined
        } : null,
        // Check schedule.timeWindows structure
        schedule: goalData.schedule ? {
          ...goalData.schedule,
          timeWindows: goalData.schedule.timeWindows ? goalData.schedule.timeWindows.map((w: any, i: number) => ({
            ...w,
            // Check for undefined fields in each timeWindow
            hasUndefinedFields: {
              label: w.label === undefined,
              range: w.range ? w.range.map((r: any, ri: number) => ({ index: ri, value: r, isUndefined: r === undefined })) : 'range is undefined',
              source: w.source === undefined
            }
          })) : 'timeWindows is undefined'
        } : 'schedule is undefined'
      }, null, 2));

      // Sanitize the payload to remove undefined values
      const sanitizedGoalData = sanitizeGoalPayload(goalData);
      
      // Log the sanitized payload
      console.log('[GoalPayload After Sanitize]', JSON.stringify({
        ...sanitizedGoalData,
        // Mask PII fields
        userId: sanitizedGoalData.userId ? '***' : undefined,
        targetLocation: sanitizedGoalData.targetLocation ? {
          name: sanitizedGoalData.targetLocation.name ? '***' : undefined,
          lat: sanitizedGoalData.targetLocation.lat,
          lng: sanitizedGoalData.targetLocation.lng,
          placeId: sanitizedGoalData.targetLocation.placeId ? '***' : undefined,
          address: sanitizedGoalData.targetLocation.address ? '***' : undefined
        } : null,
        // Check sanitized schedule.timeWindows structure
        schedule: sanitizedGoalData.schedule ? {
          ...sanitizedGoalData.schedule,
          timeWindows: sanitizedGoalData.schedule.timeWindows ? sanitizedGoalData.schedule.timeWindows.map((w: any, i: number) => ({
            ...w,
            // Check for undefined fields in each timeWindow after sanitization
            hasUndefinedFields: {
              label: w.label === undefined,
              range: w.range ? w.range.map((r: any, ri: number) => ({ index: ri, value: r, isUndefined: r === undefined })) : 'range is undefined',
              source: w.source === undefined
            }
          })) : 'timeWindows is undefined'
        } : 'schedule is undefined'
      }, null, 2));

      const goalDoc = {
        userId: sanitizedGoalData.userId,
        title: sanitizedGoalData.title,
        description: sanitizedGoalData.description,
        category: sanitizedGoalData.category,
        verificationMethods: sanitizedGoalData.verificationMethods || [sanitizedGoalData.verificationType || 'manual'],
        lockedVerificationMethods: sanitizedGoalData.lockedVerificationMethods || [],
        targetLocation: cleanTargetLocation,
        frequency: sanitizedGoalData.frequency || { count: 1, unit: 'per_day' },
        duration: sanitizedGoalData.duration || {
          type: 'range',
          startDate: sanitizedGoalData.startDate?.toISOString(),
          endDate: sanitizedGoalData.endDate?.toISOString()
        },
        notes: sanitizedGoalData.notes || '',
        // Weekly schedule and overrides
        needsWeeklySchedule: sanitizedGoalData.needsWeeklySchedule || false,
        weeklySchedule: sanitizedGoalData.weeklySchedule || {},
        weeklyWeekdays: sanitizedGoalData.weeklyWeekdays || [],
        includeDates: sanitizedGoalData.includeDates || [],
        excludeDates: sanitizedGoalData.excludeDates || [],
        // AI-generated schedule specifications
        schedule: sanitizedGoalData.schedule || null,
        // Dual timestamps: server authoritative + client for instant UI sort
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAtClient: Timestamp.fromDate(new Date()),
        updatedAtClient: Timestamp.fromDate(new Date()),
        // Legacy fields for backward compatibility
        verificationType: sanitizedGoalData.verificationType || sanitizedGoalData.verificationMethods?.[0] || 'manual',
        timeFrame: sanitizedGoalData.timeFrame || 'daily',
        startDate: sanitizedGoalData.startDate ? Timestamp.fromDate(sanitizedGoalData.startDate) : null,
        endDate: sanitizedGoalData.endDate ? Timestamp.fromDate(sanitizedGoalData.endDate) : null
      };

      batch.set(goalRef, goalDoc);
      
      // Optionally batch additional related documents here
      // For example, initial progress tracking documents
      
      await batch.commit();
      console.log('[GoalService] Goal created with ID:', goalRef.id);
      
      return goalRef.id;
    } catch (error) {
      console.error('[GoalService] Error creating goal:', error);
      throw error;
    } finally {
      console.timeEnd('[GoalService] Create Goal');
    }
  }

  // Get active goals (legacy method for CalendarScreen compatibility)
  static async getActiveGoals(userId: string): Promise<Goal[]> {
    return this.getUserGoals(userId, 50); // Return up to 50 active goals
  }

  // Get user goals with pagination for performance
  static async getUserGoals(userId: string, pageSize: number = 20, lastGoal?: Goal): Promise<Goal[]> {
    console.time('[GoalService] Get User Goals');
    
    try {
      // Simplified query to avoid index requirement - temporarily using subcollection approach
      // TODO: Create proper index for production: userId ASC, createdAt DESC
      let q = query(
        collection(db, 'users', userId, 'goals'),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );

      // Add pagination cursor if provided
      if (lastGoal?.createdAt) {
        q = query(q, startAfter(Timestamp.fromDate(lastGoal.createdAt)));
      }
      
      const querySnapshot = await getDocs(q);
      const goals: Goal[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        goals.push(this.mapFirestoreToGoal(doc.id, data));
      });

      console.log(`[GoalService] Retrieved ${goals.length} goals`);
      return goals;
    } catch (error) {
      console.error('[GoalService] Error getting user goals:', error);
      throw error;
    } finally {
      console.timeEnd('[GoalService] Get User Goals');
    }
  }

  // Get recent goals for quick dashboard display
  static async getRecentGoals(userId: string, count: number = 5): Promise<Goal[]> {
    console.time('[GoalService] Get Recent Goals');
    
    try {
      const q = query(
        collection(db, 'goals'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(count)
      );
      
      const querySnapshot = await getDocs(q);
      const goals: Goal[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        goals.push(this.mapFirestoreToGoal(doc.id, data));
      });

      console.log(`[GoalService] Retrieved ${goals.length} recent goals`);
      return goals;
    } catch (error) {
      console.error('[GoalService] Error getting recent goals:', error);
      throw error;
    } finally {
      console.timeEnd('[GoalService] Get Recent Goals');
    }
  }

  // Get a single goal by ID with minimal data transfer
  static async getGoal(goalId: string): Promise<Goal | null> {
    console.time(`[GoalService] Get Goal ${goalId}`);
    
    try {
      // First, we need to get the current user to construct the correct path
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.error('[GoalService] No authenticated user found');
        throw new Error('User not authenticated');
      }
      
      const uid = currentUser.uid;
      const firestorePath = `users/${uid}/goals/${goalId}`;
      console.log('[GOAL:fetch:path]', firestorePath);
      
      const docRef = doc(db, 'users', uid, 'goals', goalId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const goal = this.mapFirestoreToGoal(docSnap.id, data);
        console.log('[GoalService] Goal found:', { id: goal.id, title: goal.title });
        return goal;
      } else {
        console.log('[GoalService] No goal found with ID:', goalId, 'at path:', firestorePath);
        return null;
      }
    } catch (error) {
      console.error('[GoalService] Error getting goal:', error);
      throw error;
    } finally {
      console.timeEnd(`[GoalService] Get Goal ${goalId}`);
    }
  }

  // Update goal with batched writes for related updates
  static async updateGoal(goalId: string, updates: Partial<CreateGoalForm>): Promise<void> {
    console.time(`[GoalService] Update Goal ${goalId}`);
    
    try {
      const batch = writeBatch(db);
      const goalRef = doc(db, 'goals', goalId);
      
      const updateData: any = {
        ...updates,
        updatedAt: serverTimestamp()
      };

      // Handle legacy field updates
      if (updates.verificationMethods) {
        updateData.verificationType = updates.verificationMethods[0];
      }
      if (updates.startDate) {
        updateData.startDate = Timestamp.fromDate(updates.startDate);
      }
      if (updates.endDate) {
        updateData.endDate = Timestamp.fromDate(updates.endDate);
      }

      batch.update(goalRef, updateData);
      
      // Batch any related document updates here
      
      await batch.commit();
      console.log('[GoalService] Goal updated:', goalId);
    } catch (error) {
      console.error('[GoalService] Error updating goal:', error);
      throw error;
    } finally {
      console.timeEnd(`[GoalService] Update Goal ${goalId}`);
    }
  }

  // Delete goal with cleanup of related data
  static async deleteGoal(goalId: string): Promise<void> {
    console.time(`[GoalService] Delete Goal ${goalId}`);
    
    try {
      const batch = writeBatch(db);
      const goalRef = doc(db, 'goals', goalId);
      
      batch.delete(goalRef);
      
      // Add deletion of related documents (progress, verifications, etc.)
      // This would be more efficient than multiple individual deletes
      
      await batch.commit();
      console.log('[GoalService] Goal deleted:', goalId);
    } catch (error) {
      console.error('[GoalService] Error deleting goal:', error);
      throw error;
    } finally {
      console.timeEnd(`[GoalService] Delete Goal ${goalId}`);
    }
  }

  // Search goals by title/category with optimized query
  static async searchGoals(userId: string, searchTerm: string, category?: string): Promise<Goal[]> {
    console.time('[GoalService] Search Goals');
    
    try {
      let q = query(
        collection(db, 'goals'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50) // Limit search results for performance
      );

      if (category) {
        q = query(q, where('category', '==', category));
      }
      
      const querySnapshot = await getDocs(q);
      const goals: Goal[] = [];
      const lowerSearchTerm = searchTerm.toLowerCase();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Client-side filtering for title search (Firestore doesn't support full-text search)
        if (data.title?.toLowerCase().includes(lowerSearchTerm) ||
            data.description?.toLowerCase().includes(lowerSearchTerm)) {
          goals.push(this.mapFirestoreToGoal(doc.id, data));
        }
      });

      console.log(`[GoalService] Found ${goals.length} goals matching "${searchTerm}"`);
      return goals;
    } catch (error) {
      console.error('[GoalService] Error searching goals:', error);
      throw error;
    } finally {
      console.timeEnd('[GoalService] Search Goals');
    }
  }

  // Get goals by category for filtered views
  static async getGoalsByCategory(userId: string, category: string, pageSize: number = 20): Promise<Goal[]> {
    console.time(`[GoalService] Get Goals by Category: ${category}`);
    
    try {
      const q = query(
        collection(db, 'goals'),
        where('userId', '==', userId),
        where('category', '==', category),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
      
      const querySnapshot = await getDocs(q);
      const goals: Goal[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        goals.push(this.mapFirestoreToGoal(doc.id, data));
      });

      console.log(`[GoalService] Retrieved ${goals.length} goals for category: ${category}`);
      return goals;
    } catch (error) {
      console.error('[GoalService] Error getting goals by category:', error);
      throw error;
    } finally {
      console.timeEnd(`[GoalService] Get Goals by Category: ${category}`);
    }
  }

  // Helper method to map Firestore data to Goal object with safe defaults
  private static mapFirestoreToGoal(id: string, data: any): Goal {
    return {
      id,
      userId: data.userId || '',
      title: data.title || '',
      description: data.description || '',
      category: data.category || 'Personal',
      verificationMethods: Array.isArray(data.verificationMethods) 
        ? data.verificationMethods 
        : [data.verificationType || 'manual'],
      lockedVerificationMethods: Array.isArray(data.lockedVerificationMethods) ? data.lockedVerificationMethods : [],
      frequency: data.frequency || { count: 1, unit: 'per_day' },
      duration: data.duration || {
        type: 'range',
        startDate: data.startDate instanceof Timestamp 
          ? data.startDate.toDate().toISOString() 
          : data.startDate,
        endDate: data.endDate instanceof Timestamp 
          ? data.endDate.toDate().toISOString() 
          : data.endDate
      },
      notes: data.notes || '',
      targetLocation: data.targetLocation || undefined,
      needsWeeklySchedule: data.needsWeeklySchedule || false,
      weeklySchedule: data.weeklySchedule || {},
      weeklyWeekdays: Array.isArray(data.weeklyWeekdays) ? data.weeklyWeekdays : [],
      includeDates: Array.isArray(data.includeDates) ? data.includeDates : [],
      excludeDates: Array.isArray(data.excludeDates) ? data.excludeDates : [],
      createdAt: data.createdAt instanceof Timestamp 
        ? data.createdAt.toDate() 
        : new Date(data.createdAt || Date.now()),
      updatedAt: data.updatedAt instanceof Timestamp 
        ? data.updatedAt.toDate() 
        : new Date(data.updatedAt || Date.now()),
      // Legacy fields for backward compatibility
      verificationType: data.verificationType,
      timeFrame: data.timeFrame,
      startDate: data.startDate instanceof Timestamp 
        ? data.startDate.toDate() 
        : data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate instanceof Timestamp 
        ? data.endDate.toDate() 
        : data.endDate ? new Date(data.endDate) : undefined
    };
  }

  // Bulk operations for performance
  static async createMultipleGoals(goals: (CreateGoalForm & { userId: string })[]): Promise<string[]> {
    console.time('[GoalService] Bulk Create Goals');
    
    try {
      const batch = writeBatch(db);
      const goalIds: string[] = [];
      
      goals.forEach((goalData) => {
        const goalRef = doc(collection(db, 'users', goalData.userId, 'goals'));
        goalIds.push(goalRef.id);
        
        const goalDoc = {
          userId: goalData.userId,
          title: goalData.title,
          description: goalData.description,
          category: goalData.category,
          verificationMethods: goalData.verificationMethods || ['manual'],
          targetLocation: goalData.targetLocation || null,
          frequency: goalData.frequency || { count: 1, unit: 'per_day' },
          duration: goalData.duration || { type: 'weeks', value: 2 },
          notes: goalData.notes || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        batch.set(goalRef, goalDoc);
      });
      
      await batch.commit();
      console.log(`[GoalService] Created ${goals.length} goals in batch`);
      
      return goalIds;
    } catch (error) {
      console.error('[GoalService] Error in bulk create:', error);
      throw error;
    } finally {
      console.timeEnd('[GoalService] Bulk Create Goals');
    }
  }

  // Archive old goals for performance (soft delete)
  static async archiveOldGoals(userId: string, olderThanDays: number = 365): Promise<number> {
    console.time('[GoalService] Archive Old Goals');
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const q = query(
        collection(db, 'goals'),
        where('userId', '==', userId),
        where('createdAt', '<', Timestamp.fromDate(cutoffDate)),
        limit(100) // Process in batches
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('[GoalService] No old goals to archive');
        return 0;
      }
      
      const batch = writeBatch(db);
      let count = 0;
      
      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, { 
          archived: true, 
          archivedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        count++;
      });
      
      await batch.commit();
      console.log(`[GoalService] Archived ${count} old goals`);
      
      return count;
    } catch (error) {
      console.error('[GoalService] Error archiving old goals:', error);
      throw error;
    } finally {
      console.timeEnd('[GoalService] Archive Old Goals');
    }
  }
}