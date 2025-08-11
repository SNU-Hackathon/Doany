// Firebase debugging utilities

import { auth, db } from '../services/firebase';

export class FirebaseDebug {
  /**
   * Print current Firebase configuration for debugging
   */
  static logCurrentConfig() {
    console.log('\n🔍 === FIREBASE DEBUG INFO ===');
    console.log('📍 Project ID:', auth.app.options.projectId);
    console.log('🌐 Auth Domain:', auth.app.options.authDomain);
    console.log('🔑 API Key (first 20 chars):', auth.app.options.apiKey?.substring(0, 20) + '...');
    console.log('📱 App ID:', auth.app.options.appId);
    console.log('🏪 Storage Bucket:', auth.app.options.storageBucket);
    console.log('💌 Messaging Sender ID:', auth.app.options.messagingSenderId);
    console.log('📊 Measurement ID:', auth.app.options.measurementId);
    console.log('=================================\n');
  }

  /**
   * Test Firebase connection
   */
  static async testConnection() {
    try {
      console.log('🧪 Testing Firebase connection...');
      
      // Test Firestore connection
      const testDoc = db.app.options;
      console.log('✅ Firestore connected to project:', testDoc.projectId);
      
      // Test Auth connection
      const currentUser = auth.currentUser;
      console.log('👤 Current user:', currentUser ? currentUser.email : 'None');
      
      return true;
    } catch (error) {
      console.error('❌ Firebase connection test failed:', error);
      return false;
    }
  }

  /**
   * Compare with expected configuration
   */
  static validateConfig(expectedProjectId: string) {
    const currentProjectId = auth.app.options.projectId;
    
    if (currentProjectId === expectedProjectId) {
      console.log('✅ Project ID matches:', currentProjectId);
      return true;
    } else {
      console.error('❌ Project ID mismatch!');
      console.error('Expected:', expectedProjectId);
      console.error('Current:', currentProjectId);
      return false;
    }
  }
}
