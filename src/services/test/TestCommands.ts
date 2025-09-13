// Development-only test commands
// Access via console: window.runVerificationTests()

if (__DEV__) {
  // Make test commands available globally
  (global as any).runVerificationTests = async () => {
    console.log('🚀 Starting verification tests...');
    
    try {
      const { VerificationTestHarness } = await import('./VerificationTestHarness');
      const result = await VerificationTestHarness.runAllTests();
      
      if (result.allPassed) {
        console.log('🎉 All verification tests passed!');
      } else {
        console.log('⚠️ Some tests failed. Check the logs above.');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      return { allPassed: false, error };
    }
  };
  
  (global as any).clearTestData = async () => {
    console.log('🧹 Clearing test data...');
    
    try {
      const { VerificationTestHarness } = await import('./VerificationTestHarness');
      await VerificationTestHarness.cleanup();
      console.log('✅ Test data cleared');
    } catch (error) {
      console.error('❌ Failed to clear test data:', error);
    }
  };
  
  (global as any).testOfflineQueue = async () => {
    console.log('📱 Testing offline queue...');
    
    try {
      const { VerificationTestHarness } = await import('./VerificationTestHarness');
      const result = await VerificationTestHarness.testOfflineQueueFlow();
      console.log('Offline queue test result:', result ? '✅ PASS' : '❌ FAIL');
      return result;
    } catch (error) {
      console.error('❌ Offline queue test failed:', error);
      return false;
    }
  };
  
  console.log('🧪 Test commands available:');
  console.log('  window.runVerificationTests() - Run all tests');
  console.log('  window.clearTestData() - Clear test data');
  console.log('  window.testOfflineQueue() - Test offline queue only');
}
