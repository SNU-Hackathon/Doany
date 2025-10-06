// User data service with retry logic and offline handling

import { doc, getDoc } from 'firebase/firestore';
import { User } from '../types';
import { logNetworkStatus, waitForOnline } from '../utils/networkUtils';
import { db } from './firebase';

export interface UserDoc {
  email: string;
  displayName: string;
  createdAt: any;
  updatedAt: any;
  depositBalance: number;
  points: number;
}

/**
 * Fetch user document with retry logic and network awareness
 * @param uid User ID
 * @returns User document or null if not found
 */
export const fetchUserDoc = async (uid: string): Promise<User | null> => {
  console.time(`[UserData] Fetch User Doc: ${uid}`);
  
  // Log network status before attempting
  const networkStatus = await logNetworkStatus('Before user doc fetch');
  
  // Wait for online status if needed
  if (!networkStatus.isOnline) {
    console.log('[UserData] Waiting for network connection...');
    const isOnline = await waitForOnline(5000);
    
    if (!isOnline) {
      console.warn('[UserData] Network timeout, attempting fetch anyway');
    }
  }

  // Ensure Firestore network is enabled - temporarily disabled
  // try {
  //   await ensureOnline();
  // } catch (error) {
  //   console.warn('[UserData] Failed to enable Firestore network:', error);
  // }

  // Attempt to fetch with retry logic
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`[UserData] Fetch attempt ${attempt}/2 for user: ${uid}`);
      
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data() as UserDoc;
        
        const user: User = {
          id: uid,
          uid: uid,
          email: data.email,
          displayName: data.displayName,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          depositBalance: data.depositBalance || 0,
          points: data.points || 0
        };
        
        console.log(`[UserData] Successfully fetched user data on attempt ${attempt}`);
        console.timeEnd(`[UserData] Fetch User Doc: ${uid}`);
        return user;
      } else {
        console.warn(`[UserData] User document not found: ${uid}`);
        console.timeEnd(`[UserData] Fetch User Doc: ${uid}`);
        return null;
      }
      
    } catch (error: any) {
      console.error(`[UserData] Fetch attempt ${attempt} failed:`, error);
      
      // Check if this is a network/offline error
      const isOfflineError = error.code === 'unavailable' || 
                           error.message?.includes('offline') ||
                           error.message?.includes('Failed to get document because the client is offline');
      
      if (isOfflineError && attempt < 2) {
        console.log(`[UserData] Offline error detected, retrying in 300ms...`);
        await new Promise(resolve => setTimeout(resolve, 300));
        continue;
      }
      
      // If this is the last attempt or not an offline error, handle appropriately
      if (attempt === 2 || !isOfflineError) {
        console.error(`[UserData] Final attempt failed for user ${uid}:`, error);
        
        if (isOfflineError) {
          // Create a placeholder user for offline scenarios
          console.warn('[UserData] Creating placeholder user due to offline error');
          console.timeEnd(`[UserData] Fetch User Doc: ${uid}`);
          return null; // Let the app handle this gracefully
        } else {
          // Re-throw non-offline errors
          console.timeEnd(`[UserData] Fetch User Doc: ${uid}`);
          throw error;
        }
      }
    }
  }
  
  console.timeEnd(`[UserData] Fetch User Doc: ${uid}`);
  return null;
};

/**
 * Get error message for user-friendly display
 * @param error The error object
 * @returns User-friendly error message
 */
export const getUserDataErrorMessage = (error: any): string => {
  if (error.code === 'unavailable' || error.message?.includes('offline')) {
    return 'Unable to load user data while offline. Your data will sync when you reconnect.';
  }
  
  if (error.code === 'permission-denied') {
    return 'Permission denied. Please sign in again.';
  }
  
  if (error.code === 'not-found') {
    return 'User profile not found. Please contact support.';
  }
  
  return 'Failed to load user data. Please try again.';
};
