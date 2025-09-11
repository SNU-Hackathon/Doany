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
import { auth, db, storage } from './firebase';

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
