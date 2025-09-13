// Verification service functions for Firebase operations

import { getAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Location, Verification, VerificationStatus } from '../types';
import type { GoalDoc, VerificationDoc, VerificationSignals } from '../types/firestore';
import { auth, db, storage } from './firebase';
import { networkService } from './network/NetworkService';
import { createQueuedAttempt, enqueueAttempt } from './verification/OfflineQueue';
import { evaluateByGoalType } from './verificationRules';

export class VerificationService {
  // Create a new verification record
  static async createVerification(
    goalId: string,
    userId: string,
    status: VerificationStatus,
    location?: Location,
    screenshotBlob?: Blob
  ): Promise<string> {
    try {
      let screenshotUrl: string | undefined;
      
      // Upload screenshot if provided
      if (screenshotBlob) {
        const timestamp = Date.now();
        const screenshotRef = ref(storage, `verifications/${userId}/${goalId}/${timestamp}.jpg`);
        await uploadBytes(screenshotRef, screenshotBlob);
        screenshotUrl = await getDownloadURL(screenshotRef);
      }
      
      const verificationDoc = {
        goalId,
        userId,
        status,
        timestamp: serverTimestamp(),
        location: location || null,
        screenshotUrl: screenshotUrl || null
      };

      const docRef = await addDoc(collection(db, 'verifications'), verificationDoc);
      return docRef.id;
    } catch (error) {
      console.error('Error creating verification:', error);
      throw error;
    }
  }

  // Get verifications for a specific goal
  static async getGoalVerifications(goalId: string): Promise<Verification[]> {
    try {
      const uid = (auth?.currentUser?.uid) ?? getAuth().currentUser?.uid;
      if (!uid) throw new Error('Not authenticated');
      
      // Simplified query to avoid index requirement (temporary fix)
      const q = query(
        collection(db, 'verifications'),
        where('userId', '==', uid),
        where('goalId', '==', goalId)
        // , orderBy('timestamp','desc')
      );
      
      const querySnapshot = await getDocs(q);
      const verifications: Verification[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        verifications.push({
          id: doc.id,
          goalId: data.goalId,
          userId: data.userId,
          status: data.status,
          timestamp: data.timestamp instanceof Timestamp 
            ? data.timestamp.toDate() 
            : new Date(data.timestamp),
          location: data.location,
          screenshotUrl: data.screenshotUrl
        });
      });
      
      // Sort by timestamp desc in memory since we can't use orderBy
      verifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      return verifications;
    } catch (error) {
      console.error('Error getting goal verifications:', error);
      throw error;
    }
  }

  // Get all verifications for a user
  static async getUserVerifications(userId: string): Promise<Verification[]> {
    try {
      const uid = (auth?.currentUser?.uid) ?? getAuth().currentUser?.uid;
      if (!uid) throw new Error('Not authenticated');
      
      // Simplified query to avoid index requirement (temporary fix)
      const q = query(
        collection(db, 'verifications'),
        where('userId', '==', uid)
        // , orderBy('timestamp','desc')
      );
      
      const querySnapshot = await getDocs(q);
      const verifications: Verification[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        verifications.push({
          id: doc.id,
          goalId: data.goalId,
          userId: data.userId,
          status: data.status,
          timestamp: data.timestamp instanceof Timestamp 
            ? data.timestamp.toDate() 
            : new Date(data.timestamp),
          location: data.location,
          screenshotUrl: data.screenshotUrl
        });
      });
      
      // Sort by timestamp desc in memory since we can't use orderBy
      verifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      return verifications;
    } catch (error) {
      console.error('Error getting user verifications:', error);
      throw error;
    }
  }

  // Get recent verifications for a goal (last 30 days)
  static async getRecentGoalVerifications(goalId: string, days: number = 30): Promise<Verification[]> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);
      
      const allVerifications = await this.getGoalVerifications(goalId);
      return allVerifications.filter(verification => 
        verification.timestamp >= thirtyDaysAgo
      );
    } catch (error) {
      console.error('Error getting recent goal verifications:', error);
      throw error;
    }
  }

  // Get latest verification for a goal
  static async getLatestVerification(goalId: string): Promise<Verification | null> {
    try {
      // Get all verifications for the goal and sort in memory
      const verifications = await this.getGoalVerifications(goalId);
      
      if (verifications.length === 0) {
        return null;
      }
      
      // Return the first (most recent) verification since they're already sorted
      return verifications[0];
    } catch (error) {
      console.error('Error getting latest verification:', error);
      throw error;
    }
  }

  // Calculate success rate for a goal
  static async calculateGoalSuccessRate(goalId: string, days: number = 30): Promise<number> {
    try {
      const verifications = await this.getRecentGoalVerifications(goalId, days);
      
      if (verifications.length === 0) {
        return 0;
      }
      
      const successCount = verifications.filter(v => v.status === 'success').length;
      return (successCount / verifications.length) * 100;
    } catch (error) {
      console.error('Error calculating goal success rate:', error);
      throw error;
    }
  }
}

// TODO: 아래 3개는 프로젝트의 실제 구현으로 연결하세요.
async function uploadPhotoAndGetUrl(blob: Blob): Promise<string> {
  // 기존 사진 업로드 유틸/스토리지 로직으로 대체
  const timestamp = Date.now();
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  
  const photoRef = ref(storage, `verifications/${uid}/${timestamp}.jpg`);
  await uploadBytes(photoRef, blob);
  return await getDownloadURL(photoRef);
}

async function saveVerificationDoc(doc: VerificationDoc): Promise<void> {
  // 기존 Firestore 저장 로직으로 대체
  await addDoc(collection(db, 'verifications'), doc);
}

function generateId(): string {
  return Math.random().toString(36).slice(2);
}

export async function createVerificationWithSignals(
  goal: GoalDoc,
  rawSignals: VerificationSignals
): Promise<VerificationDoc> {
  // Check if we're online
  const isOnline = networkService.isOnline();
  
  if (!isOnline) {
    console.log('[VerificationService] Offline detected, queuing verification');
    
    // Create queued attempt
    const queuedAttempt = createQueuedAttempt(
      generateId(),
      {
        goal,
        rawSignals
      }
    );
    
    await enqueueAttempt(queuedAttempt);
    
    console.log('[VerificationService] Verification queued for offline processing:', queuedAttempt.id);
    
    // Return a temporary doc that will be processed when online
    return {
      id: queuedAttempt.id,
      goalId: goal.id,
      createdAt: Date.now(),
      signals: rawSignals,
      autoPass: false,
      finalPass: false,
      isQueued: true // Flag to indicate this is queued
    } as VerificationDoc & { isQueued: boolean };
  }

  // Online processing
  return await processVerificationOnline(goal, rawSignals);
}

async function processVerificationOnline(
  goal: GoalDoc,
  rawSignals: VerificationSignals
): Promise<VerificationDoc> {
  console.group(`[VerificationService] Processing verification for goal ${goal.id}`);
  console.time(`[VerificationService] Process time for ${goal.id}`);
  
  const signals: VerificationSignals = { ...rawSignals };
  
  // photo blob 지원: signals.photo에 blob이 들어왔다면 업로드 후 url 주입
  const anyPhoto = (signals as any).photo;
  if (anyPhoto && anyPhoto.blob) {
    console.log('[PhotoVerification] Processing photo blob...');
    console.time('[PhotoVerification] Upload time');
    
    const url = await uploadPhotoAndGetUrl(anyPhoto.blob);
    
    // Preserve EXIF and validation results, add URL
    signals.photo = { 
      ...anyPhoto,
      present: true, 
      url 
    };
    delete (anyPhoto as any).blob;
    
    console.timeEnd('[PhotoVerification] Upload time');
    console.log('[PhotoVerification] Photo uploaded successfully:', {
      url: url.substring(0, 50) + '...',
      exif: signals.photo?.exif,
      validationResult: signals.photo?.validationResult
    });
  }

  console.log('[VerificationService] Evaluating signals with rules engine...');
  const { pass, details } = evaluateByGoalType(goal.type, signals);
  console.log('[VerificationService] Rules evaluation result:', { pass, details });
  
  // Check for duplicate PASS if this would be a pass
  if (pass) {
    const dayKey = getDayKey(Date.now());
    console.log(`[VerificationService] Checking for duplicate PASS on ${dayKey}...`);
    
    const isDuplicate = await isDuplicatePass(goal.id, dayKey);
    
    if (isDuplicate) {
      console.warn(`[VerificationService] Duplicate PASS detected for goal ${goal.id} on ${dayKey}, marking as duplicate`);
      
      // Create a duplicate verification record
      const doc: VerificationDoc = {
        id: generateId(),
        goalId: goal.id,
        createdAt: Date.now(),
        signals,
        autoPass: false, // Mark as failed due to duplicate
        finalPass: false,
        isDuplicate: true // Flag to indicate this is a duplicate
      };
      await saveVerificationDoc(doc);
      
      console.timeEnd(`[VerificationService] Process time for ${goal.id}`);
      console.groupEnd();
      return doc;
    } else {
      console.log(`[VerificationService] No duplicate found, proceeding with PASS`);
    }
  }
  
  const doc: VerificationDoc = {
    id: generateId(),
    goalId: goal.id,
    createdAt: Date.now(),
    signals,
    autoPass: pass,
    finalPass: pass,
  };
  
  console.log('[VerificationService] Saving verification document...');
  await saveVerificationDoc(doc);
  
  console.log('[VerificationService] Verification processed successfully:', {
    id: doc.id,
    goalId: doc.goalId,
    pass: doc.finalPass,
    isDuplicate: doc.isDuplicate
  });
  
  console.timeEnd(`[VerificationService] Process time for ${goal.id}`);
  console.groupEnd();
  return doc;
}

// 편의 헬퍼 (UI 버튼/자동화에서 사용)
export async function verifyManual(goal: GoalDoc, ok = true) {
  return createVerificationWithSignals(goal, { manual: { present: true, pass: ok } });
}
export async function verifyPhoto(goal: GoalDoc, blob: Blob, photoSignals?: any) {
  const signals = photoSignals || { present: true };
  // Add blob for upload processing
  (signals as any).blob = blob;
  return createVerificationWithSignals(goal, { photo: signals });
}
export async function verifyLocation(goal: GoalDoc, inside: boolean) {
  return createVerificationWithSignals(goal, { location: { present: true, inside } });
}
export async function verifyTimeWindow(goal: GoalDoc, start?: number | null, end?: number | null) {
  return createVerificationWithSignals(goal, { time: { present: true, windowStart: start ?? undefined, windowEnd: end ?? undefined } });
}

// TODO: 실제 Firestore 조회 유틸로 대체
async function fetchVerifications(goalId: string, start: number, end: number): Promise<VerificationDoc[]> {
  const q = query(
    collection(db, 'verifications'),
    where('goalId', '==', goalId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as VerificationDoc))
    .filter(v => v.createdAt >= start && v.createdAt <= end);
}

export async function aggregateFrequency(goal: GoalDoc, periodStart: number, periodEnd: number) {
  console.group(`[FrequencyAggregate] Aggregating frequency for goal ${goal.id}`);
  console.time(`[FrequencyAggregate] Aggregation time for ${goal.id}`);
  
  const list = await fetchVerifications(goal.id, periodStart, periodEnd);
  console.log(`[FrequencyAggregate] Fetched ${list.length} verifications from Firestore`);
  
  // Convert to VerificationRecord format for aggregation
  const allRecords = list.map(v => ({
    goalId: v.goalId,
    ts: v.createdAt,
    passed: (v.finalPass ?? v.autoPass) === true,
    isDuplicate: v.isDuplicate,
    kind: goal.type as 'schedule' | 'frequency',
    method: (v.signals?.photo?.present ? 'photo' : 
            v.signals?.location?.present ? 'location' : 
            v.signals?.manual?.present ? 'manual' : 'combo') as 'manual' | 'location' | 'photo' | 'combo'
  }));
  
  const duplicateCount = allRecords.filter(r => r.isDuplicate).length;
  const records = allRecords.filter(v => !v.isDuplicate); // Exclude duplicate verifications from aggregation
  
  console.log(`[FrequencyAggregate] Filtered records: ${records.length} valid, ${duplicateCount} duplicates excluded`);
  console.log(`[FrequencyAggregate] Passed verifications: ${records.filter(r => r.passed).length}`);
  
  const target = goal.frequencySpec?.targetCount ?? 0;
  console.log(`[FrequencyAggregate] Target: ${target} per week`);
  
  // Use complete weeks aggregation
  const { aggregateFrequency: aggFunc } = await import('./aggregation/frequency');
  const result = aggFunc(records, target, periodStart, periodEnd);
  
  console.log(`[FrequencyAggregate] Aggregation result:`, {
    totalWeeks: result.totalWeeks,
    passedWeeks: result.passedWeeks,
    overallPass: result.overallPass,
    reason: result.reason
  });
  
  console.timeEnd(`[FrequencyAggregate] Aggregation time for ${goal.id}`);
  console.groupEnd();
  
  return { 
    verified: result.passedWeeks, 
    target: result.totalWeeks, 
    pass: result.overallPass,
    details: result
  };
}

// Check if a goal already has a PASS for the given day
export async function isDuplicatePass(goalId: string, dayKey: string): Promise<boolean> {
  try {
    const startOfDay = new Date(dayKey + 'T00:00:00+09:00').getTime(); // Asia/Seoul
    const endOfDay = new Date(dayKey + 'T23:59:59.999+09:00').getTime();
    
    const q = query(
      collection(db, 'verifications'),
      where('goalId', '==', goalId),
      where('createdAt', '>=', startOfDay),
      where('createdAt', '<=', endOfDay),
      where('finalPass', '==', true)
    );
    
    const snapshot = await getDocs(q);
    const hasPass = !snapshot.empty;
    
    console.log(`[VerificationService] Duplicate check for ${goalId} on ${dayKey}: ${hasPass ? 'DUPLICATE' : 'UNIQUE'}`);
    return hasPass;
  } catch (error) {
    console.error('[VerificationService] Failed to check duplicate pass:', error);
    return false; // On error, allow the verification to proceed
  }
}

// Get day key in YYYY-MM-DD format for Asia/Seoul timezone
export function getDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  // Convert to Asia/Seoul timezone
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  const kstTime = new Date(utcTime + (9 * 3600000));
  return kstTime.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Process queued verification attempts (called by NetworkService)
export async function processQueuedVerification(attempt: any): Promise<void> {
  console.log('[VerificationService] Processing queued verification:', attempt.id);
  
  try {
    const { goal, rawSignals } = attempt.payload;
    
    // Process the verification online
    await processVerificationOnline(goal, rawSignals);
    
    console.log('[VerificationService] Successfully processed queued verification:', attempt.id);
  } catch (error) {
    console.error('[VerificationService] Failed to process queued verification:', attempt.id, error);
    throw error; // Re-throw to trigger retry logic
  }
}
