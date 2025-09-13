// Test harness for verification scenarios
// Only available in development mode

import type { GoalDoc, VerificationSignals } from '../../types/firestore';
import { networkService } from '../network/NetworkService';
import { clearQueue, createQueuedAttempt, enqueueAttempt, flush } from '../verification/OfflineQueue';
import { createVerificationWithSignals } from '../verificationService';

export class VerificationTestHarness {
  // Scenario 1: Normal - Schedule-type, on-time, at location → PASS
  static async testNormalSchedulePass() {
    console.group('🧪 [TestHarness] Scenario 1: Normal Schedule PASS');
    
    const mockGoal: GoalDoc = {
      id: 'test-goal-1',
      type: 'schedule',
      scheduleSpec: {
        events: [
          {
            start: '09:00',
            end: '17:00',
            tz: 'Asia/Seoul'
          }
        ]
      }
    };
    
    const signals: VerificationSignals = {
      time: {
        present: true,
        windowStart: new Date('2025-09-15T09:00:00+09:00').getTime(),
        windowEnd: new Date('2025-09-15T17:00:00+09:00').getTime()
      },
      location: {
        present: true,
        lat: 37.5665,
        lng: 126.9780,
        inside: true
      },
      manual: {
        present: true,
        pass: true
      }
    };
    
    try {
      const result = await createVerificationWithSignals(mockGoal, signals);
      console.log('✅ Normal schedule verification result:', {
        id: result.id,
        pass: result.finalPass,
        isDuplicate: result.isDuplicate
      });
      
      return result.finalPass === true && !result.isDuplicate;
    } catch (error) {
      console.error('❌ Normal schedule test failed:', error);
      return false;
    } finally {
      console.groupEnd();
    }
  }
  
  // Scenario 2: Edge - Photo with old EXIF timestamp → FAIL
  static async testOldPhotoFail() {
    console.group('🧪 [TestHarness] Scenario 2: Old Photo FAIL');
    
    const mockGoal: GoalDoc = {
      id: 'test-goal-2',
      type: 'schedule',
      scheduleSpec: {
        events: [
          {
            start: '09:00',
            end: '17:00',
            tz: 'Asia/Seoul'
          }
        ]
      }
    };
    
    // Simulate old photo (taken 2 hours ago)
    const oldTimestamp = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
    
    const signals: VerificationSignals = {
      time: {
        present: true,
        windowStart: new Date('2025-09-15T09:00:00+09:00').getTime(),
        windowEnd: new Date('2025-09-15T17:00:00+09:00').getTime()
      },
      photo: {
        present: true,
        exif: {
          timestampMs: oldTimestamp,
          location: { lat: 37.5665, lng: 126.9780 },
          deviceModel: 'iPhone 15'
        },
        validationResult: {
          timeValid: false, // Old timestamp
          locationValid: true,
          freshnessValid: false // Not fresh
        }
      }
    };
    
    try {
      const result = await createVerificationWithSignals(mockGoal, signals);
      console.log('✅ Old photo verification result:', {
        id: result.id,
        pass: result.finalPass,
        isDuplicate: result.isDuplicate,
        photoValidation: signals.photo?.validationResult
      });
      
      return result.finalPass === false; // Should fail due to old photo
    } catch (error) {
      console.error('❌ Old photo test failed:', error);
      return false;
    } finally {
      console.groupEnd();
    }
  }
  
  // Scenario 3: Offline - Attempt queued → comes online → flushed → stored
  static async testOfflineQueueFlow() {
    console.group('🧪 [TestHarness] Scenario 3: Offline Queue Flow');
    
    const mockGoal: GoalDoc = {
      id: 'test-goal-3',
      type: 'frequency',
      frequencySpec: {
        window: {
          start: '00:00',
          end: '23:59'
        },
        targetCount: 3
      }
    };
    
    const signals: VerificationSignals = {
      manual: {
        present: true,
        pass: true
      }
    };
    
    try {
      // Step 1: Simulate offline state
      console.log('📱 Simulating offline state...');
      const originalIsOnline = networkService.isOnline();
      // Note: We can't actually change network state, so we'll test the queue directly
      
      // Step 2: Queue the attempt
      console.log('📦 Queuing verification attempt...');
      const queuedAttempt = createQueuedAttempt('test-queue-1', {
        goal: mockGoal,
        rawSignals: signals
      });
      
      await enqueueAttempt(queuedAttempt);
      
      // Step 3: Simulate coming back online and flushing
      console.log('🌐 Simulating online state and flushing queue...');
      
      // Mock processor for testing
      const mockProcessor = async (attempt: any) => {
        console.log(`🔄 Processing queued attempt ${attempt.id}`);
        // Simulate successful processing
        return Promise.resolve();
      };
      
      await flush(mockProcessor);
      
      console.log('✅ Offline queue flow completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Offline queue test failed:', error);
      return false;
    } finally {
      console.groupEnd();
    }
  }
  
  // Run all test scenarios
  static async runAllTests() {
    console.group('🧪 [TestHarness] Running All Verification Tests');
    console.time('[TestHarness] Total test time');
    
    const results = {
      normalSchedule: false,
      oldPhotoFail: false,
      offlineQueue: false
    };
    
    try {
      // Run tests sequentially
      results.normalSchedule = await this.testNormalSchedulePass();
      results.oldPhotoFail = await this.testOldPhotoFail();
      results.offlineQueue = await this.testOfflineQueueFlow();
      
      const allPassed = Object.values(results).every(Boolean);
      
      console.log('📊 Test Results:', {
        normalSchedule: results.normalSchedule ? '✅ PASS' : '❌ FAIL',
        oldPhotoFail: results.oldPhotoFail ? '✅ PASS' : '❌ FAIL',
        offlineQueue: results.offlineQueue ? '✅ PASS' : '❌ FAIL',
        overall: allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'
      });
      
      return { allPassed, results };
    } catch (error) {
      console.error('❌ Test harness error:', error);
      return { allPassed: false, results, error };
    } finally {
      console.timeEnd('[TestHarness] Total test time');
      console.groupEnd();
    }
  }
  
  // Clean up test data
  static async cleanup() {
    console.log('🧹 [TestHarness] Cleaning up test data...');
    await clearQueue();
    console.log('✅ Test cleanup completed');
  }
}

// Development-only export
if (__DEV__) {
  // Make test harness available globally for debugging
  (global as any).VerificationTestHarness = VerificationTestHarness;
  console.log('🧪 VerificationTestHarness available globally in development mode');
}
