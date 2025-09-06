/**
 * Validation Mock Helper
 * 
 * validateGoalByCalendarEvents를 모킹하여 다양한 시나리오 테스트
 */

/**
 * Mock Implementation of AIService.validateGoalByCalendarEvents
 */
class ValidationMockHelper {
  constructor() {
    this.mockResults = new Map();
    this.callHistory = [];
  }

  /**
   * Set mock result for specific scenario
   */
  setMockResult(scenarioKey, result) {
    this.mockResults.set(scenarioKey, result);
  }

  /**
   * Get mock result based on events/goalSpec characteristics
   */
  getMockResult(events, goalSpec, startDate, endDate) {
    const scenarioKey = this.detectScenario(events, goalSpec);
    this.callHistory.push({ scenarioKey, events: events.length, startDate, endDate });
    
    return this.mockResults.get(scenarioKey) || this.getDefaultFailure();
  }

  /**
   * Detect test scenario based on input characteristics
   */
  detectScenario(events, goalSpec) {
    const eventCount = events.length;
    const requiredCount = goalSpec?.schedule?.countRule?.count || 3;
    
    // Scenario detection logic
    if (eventCount < requiredCount) {
      return 'insufficient_frequency';
    }
    
    // Check weekday distribution
    const weekdays = new Set(events.map(e => new Date(e.date).getDay()));
    if (weekdays.size < 2) {
      return 'insufficient_weekday_spread';
    }
    
    // Check time consistency
    const times = new Set(events.map(e => e.time));
    if (times.size === 0) {
      return 'missing_times';
    }
    
    return 'success';
  }

  /**
   * Pre-configured scenario results
   */
  setupDefaultScenarios() {
    // Insufficient frequency
    this.setMockResult('insufficient_frequency', {
      isCompatible: false,
      issues: ['주 3회 필요하지만 2회만 확인됨'],
      summary: 'Insufficient weekly frequency',
      completeWeekCount: 2,
      validationDetails: {
        frequencyCheck: { passed: false, required: 3, actual: 2, details: 'Week 1: 2회, Week 2: 2회' },
        weekdayCheck: { passed: true, missing: [] },
        timeCheck: { passed: true }
      }
    });

    // Insufficient weekday spread
    this.setMockResult('insufficient_weekday_spread', {
      isCompatible: false,
      issues: ['월요일과 수요일에 일정이 필요하지만 없음'],
      summary: 'Insufficient weekday distribution',
      completeWeekCount: 2,
      validationDetails: {
        frequencyCheck: { passed: true, required: 3, actual: 3 },
        weekdayCheck: { passed: false, missing: ['Monday', 'Wednesday'] },
        timeCheck: { passed: true }
      }
    });

    // Missing times
    this.setMockResult('missing_times', {
      isCompatible: false,
      issues: ['시간 정보가 누락되었습니다'],
      summary: 'Missing time information',
      completeWeekCount: 2,
      validationDetails: {
        frequencyCheck: { passed: true, required: 3, actual: 3 },
        weekdayCheck: { passed: true, missing: [] },
        timeCheck: { passed: false, details: 'Time information required' }
      }
    });

    // Success
    this.setMockResult('success', {
      isCompatible: true,
      issues: [],
      summary: 'Schedule is compatible with goal requirements. 2 complete weeks validated.',
      completeWeekCount: 2,
      validationDetails: {
        frequencyCheck: { passed: true, required: 3, actual: 3 },
        weekdayCheck: { passed: true, missing: [] },
        timeCheck: { passed: true }
      }
    });
  }

  /**
   * Default failure result
   */
  getDefaultFailure() {
    return {
      isCompatible: false,
      issues: ['Unknown validation failure'],
      summary: 'Validation failed',
      completeWeekCount: 0,
      validationDetails: {
        frequencyCheck: { passed: false, required: 3, actual: 0 },
        weekdayCheck: { passed: false, missing: [] },
        timeCheck: { passed: false }
      }
    };
  }

  /**
   * Get call history for debugging
   */
  getCallHistory() {
    return this.callHistory;
  }

  /**
   * Clear history and mocks
   */
  reset() {
    this.mockResults.clear();
    this.callHistory = [];
  }
}

/**
 * Factory function to create and configure mock helper
 */
function createValidationMockHelper() {
  const helper = new ValidationMockHelper();
  helper.setupDefaultScenarios();
  return helper;
}

/**
 * Integration with AIService for testing
 */
function mockAIServiceValidation(mockHelper) {
  // This would be used in test environment to replace actual validation
  const originalValidation = global.AIService?.validateGoalByCalendarEvents;
  
  global.AIService = global.AIService || {};
  global.AIService.validateGoalByCalendarEvents = (events, goalSpec, startDate, endDate) => {
    console.log('[MOCK] validateGoalByCalendarEvents called with:', {
      eventCount: events.length,
      startDate,
      endDate,
      requiredCount: goalSpec?.schedule?.countRule?.count
    });
    
    return mockHelper.getMockResult(events, goalSpec, startDate, endDate);
  };
  
  // Return restore function
  return () => {
    if (originalValidation) {
      global.AIService.validateGoalByCalendarEvents = originalValidation;
    } else {
      delete global.AIService.validateGoalByCalendarEvents;
    }
  };
}

// Export for use in tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ValidationMockHelper,
    createValidationMockHelper,
    mockAIServiceValidation
  };
}

// Example usage
if (typeof window === 'undefined' && require.main === module) {
  console.log('🧪 Testing Validation Mock Helper\n');
  
  const mockHelper = createValidationMockHelper();
  
  // Test insufficient frequency
  const events1 = [
    { date: '2025-01-06', time: '07:00' }, // Monday
    { date: '2025-01-08', time: '07:00' }  // Wednesday
  ];
  const goalSpec = { schedule: { countRule: { count: 3 } } };
  
  const result1 = mockHelper.getMockResult(events1, goalSpec, '2025-01-01', '2025-01-31');
  console.log('Test 1 - Insufficient frequency:');
  console.log('Result:', result1);
  
  // Test success
  const events2 = [
    { date: '2025-01-06', time: '07:00' }, // Monday
    { date: '2025-01-08', time: '07:00' }, // Wednesday
    { date: '2025-01-10', time: '07:00' }  // Friday
  ];
  
  const result2 = mockHelper.getMockResult(events2, goalSpec, '2025-01-01', '2025-01-31');
  console.log('\nTest 2 - Success:');
  console.log('Result:', result2);
  
  console.log('\nCall History:', mockHelper.getCallHistory());
}
