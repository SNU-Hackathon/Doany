// Partner verification service for review and chat functionality

import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { PartnerChatMessage, PartnerReview } from '../types/firestore';
import { auth, db } from './firebase';

export class PartnerVerificationService {
  /**
   * Submit verification for partner review
   * Note: This should only be called by the partner, not the verification owner
   */
  static async submitForPartnerReview(
    verificationId: string,
    partnerId: string,
    partnerName: string
  ): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    
    // Verify that the current user is the partner
    if (uid !== partnerId) {
      throw new Error('Only the assigned partner can create reviews');
    }

    const reviewData: Omit<PartnerReview, 'id'> = {
      verificationId,
      partnerId,
      partnerName,
      status: 'pending',
      createdAt: serverTimestamp() as any,
    };

    const docRef = await addDoc(
      collection(db, 'verifications', verificationId, 'partnerReviews'),
      reviewData
    );

    return docRef.id;
  }

  /**
   * Get partner reviews for a verification
   */
  static async getPartnerReviews(verificationId: string): Promise<PartnerReview[]> {
    const q = query(
      collection(db, 'verifications', verificationId, 'partnerReviews'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PartnerReview));
  }

  /**
   * Update partner review status
   */
  static async updatePartnerReview(
    verificationId: string,
    reviewId: string,
    status: 'approved' | 'rejected',
    comments?: string
  ): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');

    const { doc } = await import('firebase/firestore');
    await updateDoc(
      doc(db, 'verifications', verificationId, 'partnerReviews', reviewId),
      {
        status,
        comments,
        reviewedAt: serverTimestamp()
      }
    );
  }

  /**
   * Send chat message
   */
  static async sendChatMessage(
    verificationId: string,
    message: string,
    senderName: string
  ): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');

    const messageData: Omit<PartnerChatMessage, 'id'> = {
      verificationId,
      senderId: uid,
      senderName,
      message,
      timestamp: serverTimestamp() as any,
    };

    const docRef = await addDoc(
      collection(db, 'verifications', verificationId, 'chat'),
      messageData
    );

    return docRef.id;
  }

  /**
   * Get chat messages for a verification
   */
  static async getChatMessages(verificationId: string): Promise<PartnerChatMessage[]> {
    const q = query(
      collection(db, 'verifications', verificationId, 'chat'),
      orderBy('timestamp', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PartnerChatMessage));
  }

  /**
   * Get pending partner reviews for a partner
   */
  static async getPendingReviewsForPartner(partnerId: string): Promise<PartnerReview[]> {
    const q = query(
      collection(db, 'verifications'),
      where('partnerId', '==', partnerId),
      where('status', '==', 'partner_pending')
    );

    const snapshot = await getDocs(q);
    const reviews: PartnerReview[] = [];

    for (const verificationDoc of snapshot.docs) {
      const reviewQuery = query(
        collection(db, 'verifications', verificationDoc.id, 'partnerReviews'),
        where('partnerId', '==', partnerId),
        where('status', '==', 'pending')
      );

      const reviewSnapshot = await getDocs(reviewQuery);
      reviews.push(...reviewSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PartnerReview)));
    }

    return reviews;
  }
}

import { doc, getDoc } from 'firebase/firestore';

export async function applyPartnerReview(verificationId: string, approved: boolean) {
  const verificationRef = doc(db, 'verifications', verificationId);
  const verificationDoc = await getDoc(verificationRef);
  
  if (!verificationDoc.exists()) {
    throw new Error('Verification not found');
  }
  
  await updateDoc(verificationRef, {
    'signals.partner': { reviewed: true, approved },
    finalPass: approved ? true : false,
  });
}
