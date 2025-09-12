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
  const signals: VerificationSignals = { ...rawSignals };
  // photo blob 지원: signals.photo에 blob이 들어왔다면 업로드 후 url 주입
  const anyPhoto = (signals as any).photo;
  if (anyPhoto && anyPhoto.blob) {
    const url = await uploadPhotoAndGetUrl(anyPhoto.blob);
    signals.photo = { present: true, url };
    delete (anyPhoto as any).blob;
  }

  const { pass } = evaluateByGoalType(goal.type, signals);
  const doc: VerificationDoc = {
    id: generateId(),
    goalId: goal.id,
    createdAt: Date.now(),
    signals,
    autoPass: pass,
    finalPass: pass,
  };
  await saveVerificationDoc(doc);
  return doc;
}

// 편의 헬퍼 (UI 버튼/자동화에서 사용)
export async function verifyManual(goal: GoalDoc, ok = true) {
  return createVerificationWithSignals(goal, { manual: { present: true, pass: ok } });
}
export async function verifyPhoto(goal: GoalDoc, blob: Blob) {
  return createVerificationWithSignals(goal, { photo: { present: true, /* blob */ } } as any);
}
export async function verifyLocation(goal: GoalDoc, inside: boolean) {
  return createVerificationWithSignals(goal, { location: { inside } });
}
export async function verifyTimeWindow(goal: GoalDoc, start?: number | null, end?: number | null) {
  return createVerificationWithSignals(goal, { time: { now: Date.now(), windowStart: start ?? null, windowEnd: end ?? null } });
}
