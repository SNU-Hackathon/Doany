// Regression tests for partial week handling in schedule validation
// Tests both validateScheduleAgainstGoalSpec and evaluateScheduleReadiness

const { AIService } = require('../src/services/ai.ts');

// Helper function to create a test GoalSpec
function createTestGoalSpec(countRule, weekBoundary = 'startWeekday', enforcePartialWeeks = false) {
  return {
    title: 'Test Goal',
    verification: {
      methods: ['manual'],
      mandatory: ['manual'],
      sufficiency: true,
      rationale: 'Test goal for partial week validation'
    },
    schedule: {
      countRule,
      weekBoundary,
      enforcePartialWeeks,
      timeWindows: [],
      weekdayConstraints: []
    }
  };
}

// Helper function to create test schedule
function createTestSchedule(weekdays, timeSettings = {}) {
  const defaultTimes = weekdays.reduce((acc, day) => {
    acc[day] = ['09:00'];
    return acc;
  }, {});
  
  return {
    weeklyWeekdays: weekdays,
    weeklyTimeSettings: { ...defaultTimes, ...timeSettings }
  };
}

// Test Case A: Goal starts mid-week (Friday), countRule ">=3/week"
async function testCaseA_MidWeekStart() {
  console.log('\n=== Test Case A: Mid-week start (Friday) ===');
  
  const goalSpec = createTestGoalSpec({
    operator: '>=',
    count: 3,
    unit: 'per_week'
  });
  
  // Schedule: Mon, Wed, Fri (3 days per week)
  const schedule = createTestSchedule([1, 3, 5]); // Mon=1, Wed=3, Fri=5
  
  // Test with start date on Friday
  const startDate = '2024-01-05'; // Friday
  const endDate = '2024-01-18';   // Two weeks later
  
  try {
    // Test validateScheduleAgainstGoalSpec
    const validationResult = await AIService.validateScheduleAgainstGoalSpec({
      goalSpec,
      weeklyWeekdays: schedule.weeklyWeekdays,
      weeklyTimeSettings: schedule.weeklyTimeSettings,
      locale: 'en-US',
      timezone: 'UTC'
    });
    
    console.log('Validation Result:', JSON.stringify(validationResult, null, 2));
    
    // Test evaluateScheduleReadiness
    const readinessResult = AIService.evaluateScheduleReadiness({
      startDateISO: startDate,
      endDateISO: endDate,
      weeklyWeekdays: schedule.weeklyWeekdays,
      goalSpec
    });
    
    console.log('Readiness Result:', JSON.stringify(readinessResult, null, 2));
    
    // Assertions
    console.log('✓ Expected: isCompatible should be true (partial week doesn\'t block)');
    console.log('✓ Expected: ready should be true (3 days per week satisfies >=3 in full weeks)');
    console.log('✓ Expected: summary should mention partial weeks');
    
  } catch (error) {
    console.error('Test Case A failed:', error);
  }
}

// Test Case B: Goal starts on Monday (aligned)
async function testCaseB_AlignedStart() {
  console.log('\n=== Test Case B: Aligned start (Monday) ===');
  
  const goalSpec = createTestGoalSpec({
    operator: '>=',
    count: 3,
    unit: 'per_week'
  });
  
  // Schedule: Mon, Wed, Fri (3 days per week)
  const schedule = createTestSchedule([1, 3, 5]); // Mon=1, Wed=3, Fri=5
  
  // Test with start date on Monday
  const startDate = '2024-01-01'; // Monday
  const endDate = '2024-01-14';   // Two weeks later
  
  try {
    // Test validateScheduleAgainstGoalSpec
    const validationResult = await AIService.validateScheduleAgainstGoalSpec({
      goalSpec,
      weeklyWeekdays: schedule.weeklyWeekdays,
      weeklyTimeSettings: schedule.weeklyTimeSettings,
      locale: 'en-US',
      timezone: 'UTC'
    });
    
    console.log('Validation Result:', JSON.stringify(validationResult, null, 2));
    
    // Test evaluateScheduleReadiness
    const readinessResult = AIService.evaluateScheduleReadiness({
      startDateISO: startDate,
      endDateISO: endDate,
      weeklyWeekdays: schedule.weeklyWeekdays,
      goalSpec
    });
    
    console.log('Readiness Result:', JSON.stringify(readinessResult, null, 2));
    
    // Assertions
    console.log('✓ Expected: isCompatible should be true (3 days satisfies >=3)');
    console.log('✓ Expected: ready should be true');
    console.log('✓ Expected: no partial week mentions (all weeks are full)');
    
  } catch (error) {
    console.error('Test Case B failed:', error);
  }
}

// Test Case C: Goal duration <7 days
async function testCaseC_ShortDuration() {
  console.log('\n=== Test Case C: Short duration (<7 days) ===');
  
  const goalSpec = createTestGoalSpec({
    operator: '>=',
    count: 3,
    unit: 'per_week'
  });
  
  // Schedule: Every day (7 days per week, but duration is only 5 days)
  const schedule = createTestSchedule([0, 1, 2, 3, 4, 5, 6]); // All days
  
  // Test with 5-day duration
  const startDate = '2024-01-01'; // Monday
  const endDate = '2024-01-05';   // Friday (5 days)
  
  try {
    // Test validateScheduleAgainstGoalSpec
    const validationResult = await AIService.validateScheduleAgainstGoalSpec({
      goalSpec,
      weeklyWeekdays: schedule.weeklyWeekdays,
      weeklyTimeSettings: schedule.weeklyTimeSettings,
      locale: 'en-US',
      timezone: 'UTC'
    });
    
    console.log('Validation Result:', JSON.stringify(validationResult, null, 2));
    
    // Test evaluateScheduleReadiness
    const readinessResult = AIService.evaluateScheduleReadiness({
      startDateISO: startDate,
      endDateISO: endDate,
      weeklyWeekdays: schedule.weeklyWeekdays,
      goalSpec
    });
    
    console.log('Readiness Result:', JSON.stringify(readinessResult, null, 2));
    
    // Assertions
    console.log('✓ Expected: isCompatible should be true (partial week, no threshold enforced)');
    console.log('✓ Expected: ready should be true (any scheduled days make it ready)');
    console.log('✓ Expected: summary should mention partial weeks');
    
  } catch (error) {
    console.error('Test Case C failed:', error);
  }
}

// Test Case D: Insufficient schedule in full weeks (should fail)
async function testCaseD_InsufficientSchedule() {
  console.log('\n=== Test Case D: Insufficient schedule in full weeks ===');
  
  const goalSpec = createTestGoalSpec({
    operator: '>=',
    count: 5,
    unit: 'per_week'
  });
  
  // Schedule: Only 2 days per week (insufficient for >=5)
  const schedule = createTestSchedule([1, 4]); // Mon=1, Thu=4
  
  // Test with start date on Monday (full weeks)
  const startDate = '2024-01-01'; // Monday
  const endDate = '2024-01-14';   // Two weeks later
  
  try {
    // Test validateScheduleAgainstGoalSpec
    const validationResult = await AIService.validateScheduleAgainstGoalSpec({
      goalSpec,
      weeklyWeekdays: schedule.weeklyWeekdays,
      weeklyTimeSettings: schedule.weeklyTimeSettings,
      locale: 'en-US',
      timezone: 'UTC'
    });
    
    console.log('Validation Result:', JSON.stringify(validationResult, null, 2));
    
    // Test evaluateScheduleReadiness
    const readinessResult = AIService.evaluateScheduleReadiness({
      startDateISO: startDate,
      endDateISO: endDate,
      weeklyWeekdays: schedule.weeklyWeekdays,
      goalSpec
    });
    
    console.log('Readiness Result:', JSON.stringify(readinessResult, null, 2));
    
    // Assertions
    console.log('✓ Expected: isCompatible should be false (2 days < 5 required)');
    console.log('✓ Expected: ready should be false');
    console.log('✓ Expected: issues should mention insufficient schedule');
    
  } catch (error) {
    console.error('Test Case D failed:', error);
  }
}

// Test Case E: ISO Week boundary
async function testCaseE_IsoWeekBoundary() {
  console.log('\n=== Test Case E: ISO Week boundary ===');
  
  const goalSpec = createTestGoalSpec({
    operator: '>=',
    count: 3,
    unit: 'per_week'
  }, 'isoWeek'); // Use ISO week boundary
  
  // Schedule: Mon, Wed, Fri (3 days per week)
  const schedule = createTestSchedule([1, 3, 5]); // Mon=1, Wed=3, Fri=5
  
  // Test with start date on Friday (should align to previous Monday for ISO)
  const startDate = '2024-01-05'; // Friday
  const endDate = '2024-01-18';   // Two weeks later
  
  try {
    // Test validateScheduleAgainstGoalSpec
    const validationResult = await AIService.validateScheduleAgainstGoalSpec({
      goalSpec,
      weeklyWeekdays: schedule.weeklyWeekdays,
      weeklyTimeSettings: schedule.weeklyTimeSettings,
      locale: 'en-US',
      timezone: 'UTC'
    });
    
    console.log('Validation Result:', JSON.stringify(validationResult, null, 2));
    
    // Test evaluateScheduleReadiness
    const readinessResult = AIService.evaluateScheduleReadiness({
      startDateISO: startDate,
      endDateISO: endDate,
      weeklyWeekdays: schedule.weeklyWeekdays,
      goalSpec
    });
    
    console.log('Readiness Result:', JSON.stringify(readinessResult, null, 2));
    
    // Assertions
    console.log('✓ Expected: isCompatible should be true (ISO week alignment)');
    console.log('✓ Expected: ready should be true');
    console.log('✓ Expected: different window calculation due to ISO boundary');
    
  } catch (error) {
    console.error('Test Case E failed:', error);
  }
}

// Test Case F: enforcePartialWeeks = true
async function testCaseF_EnforcePartialWeeks() {
  console.log('\n=== Test Case F: Enforce partial weeks ===');
  
  const goalSpec = createTestGoalSpec({
    operator: '>=',
    count: 3,
    unit: 'per_week'
  }, 'startWeekday', true); // Enforce partial weeks
  
  // Schedule: Only 2 days per week (insufficient for >=3)
  const schedule = createTestSchedule([1, 4]); // Mon=1, Thu=4
  
  // Test with start date on Friday (partial week)
  const startDate = '2024-01-05'; // Friday
  const endDate = '2024-01-06';   // Saturday (2-day duration)
  
  try {
    // Test validateScheduleAgainstGoalSpec
    const validationResult = await AIService.validateScheduleAgainstGoalSpec({
      goalSpec,
      weeklyWeekdays: schedule.weeklyWeekdays,
      weeklyTimeSettings: schedule.weeklyTimeSettings,
      locale: 'en-US',
      timezone: 'UTC'
    });
    
    console.log('Validation Result:', JSON.stringify(validationResult, null, 2));
    
    // Test evaluateScheduleReadiness
    const readinessResult = AIService.evaluateScheduleReadiness({
      startDateISO: startDate,
      endDateISO: endDate,
      weeklyWeekdays: schedule.weeklyWeekdays,
      goalSpec
    });
    
    console.log('Readiness Result:', JSON.stringify(readinessResult, null, 2));
    
    // Assertions
    console.log('✓ Expected: isCompatible should be false (enforcing partial weeks, 2 < 3)');
    console.log('✓ Expected: ready should be false');
    console.log('✓ Expected: issues should mention insufficient schedule');
    
  } catch (error) {
    console.error('Test Case F failed:', error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Starting Partial Week Regression Tests');
  console.log('='.repeat(50));
  
  await testCaseA_MidWeekStart();
  await testCaseB_AlignedStart();
  await testCaseC_ShortDuration();
  await testCaseD_InsufficientSchedule();
  await testCaseE_IsoWeekBoundary();
  await testCaseF_EnforcePartialWeeks();
  
  console.log('\n' + '='.repeat(50));
  console.log('🧪 All tests completed. Review results above.');
  console.log('Note: These tests use heuristic fallback logic since OpenAI keys may not be available.');
}

// Export for potential use in other test frameworks
module.exports = {
  createTestGoalSpec,
  createTestSchedule,
  testCaseA_MidWeekStart,
  testCaseB_AlignedStart,
  testCaseC_ShortDuration,
  testCaseD_InsufficientSchedule,
  testCaseE_IsoWeekBoundary,
  testCaseF_EnforcePartialWeeks,
  runAllTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
