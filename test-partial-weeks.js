// Test complete week validation logic
// Note: This is a simplified test that demonstrates the logic without requiring the full module

function testCompleteWeekValidation() {
  console.log('Testing complete week validation logic...\n');

  // Test case 1: Complete week validation (7 days)
  console.log('Test 1: Complete week validation (7 days)');
  const testCase1 = {
    goalSpec: {
      schedule: {
        countRule: { count: 4, operator: '>=', unit: 'per_week' },
        enforcePartialWeeks: false,
        weekBoundary: 'startWeekday'
      }
    },
    weeklyWeekdays: [1, 3, 5, 6], // Mon, Wed, Fri, Sat
    weeklyTimeSettings: { 1: ['09:00'], 3: ['14:00'], 5: ['18:00'], 6: ['10:00'] }
  };
  
  // Simulate the validation logic for complete weeks
  const weeklyPatternCount = testCase1.weeklyWeekdays.reduce((sum, d) => 
    sum + (testCase1.weeklyTimeSettings[d] || []).length, 0);
  
  const isCompatible1 = weeklyPatternCount >= testCase1.goalSpec.schedule.countRule.count;
  console.log(`Weekly pattern count: ${weeklyPatternCount}`);
  console.log(`Required: ${testCase1.goalSpec.schedule.countRule.count}`);
  console.log(`Result: isCompatible = ${isCompatible1}`);
  console.log('Expected: isCompatible = true (4 sessions >= 4 required)\n');

  // Test case 2: Incomplete week validation (less than 7 days)
  console.log('Test 2: Incomplete week validation (less than 7 days)');
  const testCase2 = {
    goalSpec: {
      schedule: {
        countRule: { count: 3, operator: '>=', unit: 'per_week' },
        enforcePartialWeeks: false,
        weekBoundary: 'startWeekday'
      }
    },
    weeklyWeekdays: [1, 3], // Mon, Wed (only 2 days)
    weeklyTimeSettings: { 1: ['09:00'], 3: ['14:00'] }
  };
  
  const weeklyPatternCount2 = testCase2.weeklyWeekdays.reduce((sum, d) => 
    sum + (testCase2.weeklyTimeSettings[d] || []).length, 0);
  
  const isCompatible2 = weeklyPatternCount2 >= testCase2.goalSpec.schedule.countRule.count;
  console.log(`Weekly pattern count: ${weeklyPatternCount2}`);
  console.log(`Required: ${testCase2.goalSpec.schedule.countRule.count}`);
  console.log(`Result: isCompatible = ${isCompatible2}`);
  console.log('Expected: isCompatible = false (2 sessions < 3 required)\n');

  // Test case 3: Complete week partitioning logic
  console.log('Test 3: Complete week partitioning logic');
  const testCase3 = {
    startDate: '2024-01-08', // Monday
    endDate: '2024-01-22',   // Monday (15 days total)
    weeklyWeekdays: [1, 3, 5], // Mon, Wed, Fri
    weeklyTimeSettings: { 1: ['09:00'], 3: ['14:00'], 5: ['18:00'] }
  };
  
  // Simulate complete week partitioning
  const start = new Date(testCase3.startDate);
  const end = new Date(testCase3.endDate);
  
  const completeWeeks = [];
  let currentWeekStart = new Date(start);
  
  while (currentWeekStart <= end) {
    // Calculate the end of the current week (6 days later)
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    
    // Check if this week is complete (all 7 days within the goal period)
    const weekStart = new Date(currentWeekStart);
    const weekEnd = new Date(currentWeekEnd);
    
    // Adjust week boundaries to stay within the goal period
    if (weekStart < start) weekStart.setTime(start.getTime());
    if (weekEnd > end) weekEnd.setTime(end.getTime());
    
    // Calculate the number of days in this week
    const daysInWeek = Math.floor((weekEnd.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    // Only include complete weeks (7 days) in validation
    if (daysInWeek === 7) {
      completeWeeks.push({
        start: weekStart.toISOString().split('T')[0],
        end: weekEnd.toISOString().split('T')[0],
        daysInWeek
      });
    }
    
    // Move to the next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }
  
  console.log(`Goal period: ${testCase3.startDate} to ${testCase3.endDate}`);
  console.log(`Complete weeks found: ${completeWeeks.length}`);
  completeWeeks.forEach((week, index) => {
    console.log(`  Week ${index + 1}: ${week.start} to ${week.end} (${week.daysInWeek} days)`);
  });
  console.log('Expected: 2 complete weeks (8-14 and 15-21), last day (22) excluded\n');

  // Test case 4: Weekday constraints validation in complete weeks
  console.log('Test 4: Weekday constraints validation in complete weeks');
  const testCase4 = {
    goalSpec: {
      schedule: {
        countRule: { count: 3, operator: '>=', unit: 'per_week' },
        weekdayConstraints: [1, 3, 5], // Mon, Wed, Fri only
        enforcePartialWeeks: false,
        weekBoundary: 'startWeekday'
      }
    },
    weeklyWeekdays: [1, 3, 5, 6], // Mon, Wed, Fri, Sat
    weeklyTimeSettings: { 1: ['09:00'], 3: ['14:00'], 5: ['18:00'], 6: ['10:00'] }
  };
  
  // Check if selected weekdays are subset of allowed weekdays
  const allowed = testCase4.goalSpec.schedule.weekdayConstraints;
  const selected = testCase4.weeklyWeekdays;
  const notSubset = selected.some(d => !allowed.includes(d));
  
  if (notSubset) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const invalidDays = selected.filter(d => !allowed.includes(d)).map(d => dayNames[d]);
    console.log(`Invalid weekdays selected: ${invalidDays.join(', ')}`);
    console.log(`Result: isCompatible = false (weekday constraint violation)`);
  } else {
    console.log(`All selected weekdays are allowed`);
    console.log(`Result: isCompatible = true (weekday constraints satisfied)`);
  }
  console.log('Expected: isCompatible = false (Sat not in allowed weekdays)\n');
}

// Run tests
testCompleteWeekValidation();
