// Test calendar events functionality
// Note: This is a simplified test that demonstrates the logic without requiring the full module

function testCalendarEvents() {
  console.log('Testing calendar events functionality...\n');

  // Test case 1: Weekly schedule to calendar events conversion
  console.log('Test 1: Weekly schedule to calendar events conversion');
  const testCase1 = {
    goalId: 'goal-123',
    weeklyWeekdays: [1, 3, 5], // Mon, Wed, Fri
    weeklyTimeSettings: { 1: ['09:00'], 3: ['14:00'], 5: ['18:00'] },
    startDate: '2024-01-08', // Monday
    endDate: '2024-01-14'    // Sunday
  };
  
  // Simulate the conversion logic
  const events = [];
  const start = new Date(testCase1.startDate);
  const end = new Date(testCase1.endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay();
    const dateStr = d.toISOString().split('T')[0];
    
    if (testCase1.weeklyWeekdays.includes(weekday)) {
      const times = testCase1.weeklyTimeSettings[weekday] || [];
      
      if (times.length > 0) {
        times.forEach(time => {
          events.push({
            date: dateStr,
            time: time,
            goalId: testCase1.goalId,
            source: 'weekly'
          });
        });
      } else {
        events.push({
          date: dateStr,
          goalId: testCase1.goalId,
          source: 'weekly'
        });
      }
    }
  }
  
  console.log(`Weekly schedule events: ${events.length}`);
  events.forEach(event => {
    console.log(`  ${event.date} ${event.time || 'no time'} (${event.source})`);
  });
  console.log('Expected: 3 events for Mon, Wed, Fri\n');

  // Test case 2: Include/exclude dates to calendar events
  console.log('Test 2: Include/exclude dates to calendar events');
  const testCase2 = {
    goalId: 'goal-123',
    includeDates: ['2024-01-10', '2024-01-12'], // Wed, Fri
    excludeDates: ['2024-01-11'] // Thu
  };
  
  const includeEvents = testCase2.includeDates.map(date => ({
    date,
    goalId: testCase2.goalId,
    source: 'override'
  }));
  
  const excludeEvents = testCase2.excludeDates.map(date => ({
    date,
    goalId: testCase2.goalId,
    source: 'override'
  }));
  
  console.log(`Include events: ${includeEvents.length}`);
  includeEvents.forEach(event => {
    console.log(`  ${event.date} (${event.source})`);
  });
  
  console.log(`Exclude events: ${excludeEvents.length}`);
  excludeEvents.forEach(event => {
    console.log(`  ${event.date} (${event.source})`);
  });
  console.log('Expected: 2 include events, 1 exclude event\n');

  // Test case 3: Calendar events by source grouping
  console.log('Test 3: Calendar events by source grouping');
  const allEvents = [...events, ...includeEvents, ...excludeEvents];
  
  const weeklyEvents = allEvents.filter(e => e.source === 'weekly');
  const overrideEvents = allEvents.filter(e => e.source === 'override');
  
  console.log(`Total events: ${allEvents.length}`);
  console.log(`Weekly events: ${weeklyEvents.length}`);
  console.log(`Override events: ${overrideEvents.length}`);
  console.log('Expected: 3 weekly + 3 override = 6 total events\n');

  // Test case 4: Date range filtering
  console.log('Test 4: Date range filtering');
  const startDate = '2024-01-09'; // Tuesday
  const endDate = '2024-01-13';   // Saturday
  
  const filteredEvents = allEvents.filter(event => 
    event.date >= startDate && event.date <= endDate
  );
  
  console.log(`Events in range ${startDate} to ${endDate}: ${filteredEvents.length}`);
  filteredEvents.forEach(event => {
    console.log(`  ${event.date} ${event.time || 'no time'} (${event.source})`);
  });
  console.log('Expected: Events within the specified date range\n');

  // Test case 5: Validation simulation (CalendarEvent-based)
  console.log('Test 5: Validation simulation (CalendarEvent-based)');
  
  // Simulate goal specification
  const goalSpec = {
    schedule: {
      countRule: { operator: '>=', count: 3, unit: 'per_week' },
      weekdayConstraints: [1, 3, 5], // Mon, Wed, Fri
      timeRules: {
        1: [['08:00', '10:00']], // Mon: 8-10 AM
        3: [['13:00', '15:00']], // Wed: 1-3 PM
        5: [['17:00', '19:00']]  // Fri: 5-7 PM
      }
    }
  };

  // Validate weekly events against goal spec
  let validationPassed = true;
  const issues = [];
  
  // Check frequency (3 events per week)
  if (weeklyEvents.length < 3) {
    validationPassed = false;
    issues.push(`Frequency requirement not met: expected >=3, got ${weeklyEvents.length}`);
  }
  
  // Check weekdays
  const eventWeekdays = new Set(weeklyEvents.map(e => new Date(e.date).getDay()));
  const missingDays = [1, 3, 5].filter(day => !eventWeekdays.has(day));
  if (missingDays.length > 0) {
    validationPassed = false;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    issues.push(`Missing weekdays: ${missingDays.map(d => dayNames[d]).join(', ')}`);
  }
  
  // Check times
  weeklyEvents.forEach(event => {
    if (event.time) {
      const eventDate = new Date(event.date);
      const dayOfWeek = eventDate.getDay();
      const timeRules = goalSpec.schedule.timeRules[dayOfWeek] || [];
      
      let timeValid = false;
      for (const rule of timeRules) {
        if (event.time >= rule[0] && event.time <= rule[1]) {
          timeValid = true;
          break;
        }
      }
      
      if (!timeValid) {
        validationPassed = false;
        issues.push(`Time ${event.time} on day ${dayOfWeek} is outside allowed ranges`);
      }
    }
  });
  
  console.log(`Validation result: ${validationPassed ? 'PASSED' : 'FAILED'}`);
  if (issues.length > 0) {
    console.log('Issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log('  All validation checks passed');
  }
  console.log('Expected: Validation should pass for properly configured events\n');
}

// Run tests
testCalendarEvents();
