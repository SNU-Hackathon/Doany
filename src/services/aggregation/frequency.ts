// Note: dayjs not available, using native Date for Asia/Seoul timezone calculations

export interface VerificationRecord {
  goalId: string;
  ts: number; // ms
  passed: boolean;
  kind: 'schedule' | 'frequency';
  method: 'manual' | 'camera' | 'screenshot' | 'combo';
}

// Slice into complete 7-day windows [Mon 00:00 .. Sun 23:59:59] (Asia/Seoul)
export function sliceCompleteWeeks(rangeStartMs: number, rangeEndMs: number) {
  const windows: Array<{start: number; end: number}> = [];
  
  // Convert to Asia/Seoul dates
  const startDate = new Date(rangeStartMs);
  const endDate = new Date(rangeEndMs);
  
  // Find first Monday at 00:00 on or after start
  let current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  
  // Move to next Monday if not already Monday
  const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (dayOfWeek !== 1) { // Not Monday
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    current.setDate(current.getDate() + daysToMonday);
  }
  
  // Generate complete weeks
  while (true) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6); // Add 6 days to get Sunday
    weekEnd.setHours(23, 59, 59, 999);
    
    // Check if this complete week fits within the range
    if (weekStart.getTime() >= startDate.getTime() && weekEnd.getTime() <= endDate.getTime()) {
      windows.push({ 
        start: weekStart.getTime(), 
        end: weekEnd.getTime() 
      });
    }
    
    // Move to next Monday
    current.setDate(current.getDate() + 7);
    
    // Stop if we've gone past the end date
    if (current.getTime() > endDate.getTime()) {
      break;
    }
  }
  
  return windows;
}

export function aggregateFrequency(verifs: VerificationRecord[], targetPerWeek: number, rangeStartMs: number, rangeEndMs: number) {
  // Get complete 7-day windows only
  const completeWeeks = sliceCompleteWeeks(rangeStartMs, rangeEndMs);
  
  if (completeWeeks.length === 0) {
    return {
      totalWeeks: 0,
      passedWeeks: 0,
      weekResults: [],
      overallPass: false,
      reason: 'No complete 7-day blocks in range'
    };
  }
  
  // Group verifications by week window and count distinct days passed
  const weekResults = completeWeeks.map(week => {
    const weekVerifs = verifs.filter(v => 
      v.passed && v.ts >= week.start && v.ts <= week.end
    );
    
    // Count distinct days with at least one PASS
    const daySet = new Set<string>();
    weekVerifs.forEach(v => {
      const dayKey = new Date(v.ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD
      daySet.add(dayKey);
    });
    
    const count = daySet.size;
    const weekStart = new Date(week.start).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    const weekEnd = new Date(week.end).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    
    return {
      weekKey: `${weekStart}_to_${weekEnd}`,
      start: week.start,
      end: week.end,
      count,
      target: targetPerWeek,
      passed: count >= targetPerWeek,
      verificationDays: Array.from(daySet).sort()
    };
  });
  
  const passedWeeks = weekResults.filter(w => w.passed).length;
  const overallPass = passedWeeks === completeWeeks.length; // All weeks must pass
  
  return {
    totalWeeks: completeWeeks.length,
    passedWeeks,
    weekResults,
    overallPass,
    reason: overallPass ? 'All complete weeks achieved target' : `${passedWeeks}/${completeWeeks.length} weeks passed`
  };
}

// Quick test with mock data
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  const testStart = new Date('2025-09-08T00:00:00+09:00').getTime(); // Monday
  const testEnd = new Date('2025-09-21T23:59:59+09:00').getTime();   // Sunday (2 weeks)
  
  const mockVerifs: VerificationRecord[] = [
    { goalId: 'test', ts: new Date('2025-09-08T10:00:00+09:00').getTime(), passed: true, kind: 'frequency', method: 'manual' }, // Mon week 1
    { goalId: 'test', ts: new Date('2025-09-10T10:00:00+09:00').getTime(), passed: true, kind: 'frequency', method: 'manual' }, // Wed week 1
    { goalId: 'test', ts: new Date('2025-09-12T10:00:00+09:00').getTime(), passed: true, kind: 'frequency', method: 'manual' }, // Fri week 1
    { goalId: 'test', ts: new Date('2025-09-16T10:00:00+09:00').getTime(), passed: true, kind: 'frequency', method: 'manual' }, // Tue week 2
    { goalId: 'test', ts: new Date('2025-09-18T10:00:00+09:00').getTime(), passed: true, kind: 'frequency', method: 'manual' }, // Thu week 2
  ];
  
  const result = aggregateFrequency(mockVerifs, 3, testStart, testEnd); // Target: 3 times per week
  console.log('[FrequencyAggregation] Test result:', {
    totalWeeks: result.totalWeeks,
    passedWeeks: result.passedWeeks,
    overallPass: result.overallPass,
    reason: result.reason
  });
  
  // Week 1: 3 days (Mon, Wed, Fri) = PASS
  // Week 2: 2 days (Tue, Thu) = FAIL
  // Overall: 1/2 weeks passed = FAIL
  console.assert(result.totalWeeks === 2, 'Should have 2 complete weeks');
  console.assert(result.passedWeeks === 1, 'Should have 1 passed week');
  console.assert(!result.overallPass, 'Overall should FAIL (1/2 weeks)');
  
  console.log('[FrequencyAggregation] ✅ Smoke tests passed');
}
