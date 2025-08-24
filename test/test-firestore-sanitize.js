// Test for firestoreSanitize utility
const { sanitizeForFirestore, sanitizeScheduleTimeWindows, sanitizeGoalPayload } = require('../dist/firestoreSanitize');

console.log('🧪 Testing firestoreSanitize utility...\n');

// Test 1: Basic undefined removal
console.log('Test 1: Basic undefined removal');
const testObj1 = {
  name: 'test',
  value: undefined,
  nested: {
    key: 'value',
    undefinedKey: undefined
  }
};
const sanitized1 = sanitizeForFirestore(testObj1);
console.log('Original:', JSON.stringify(testObj1, null, 2));
console.log('Sanitized:', JSON.stringify(sanitized1, null, 2));
console.log('✅ Passed\n');

// Test 2: Array with undefined elements
console.log('Test 2: Array with undefined elements');
const testObj2 = {
  items: ['a', undefined, 'c', null, 'e'],
  nested: [
    { id: 1, value: 'test' },
    { id: 2, value: undefined },
    undefined,
    { id: 3, value: null }
  ]
};
const sanitized2 = sanitizeForFirestore(testObj2);
console.log('Original:', JSON.stringify(testObj2, null, 2));
console.log('Sanitized:', JSON.stringify(sanitized2, null, 2));
console.log('✅ Passed\n');

// Test 3: schedule.timeWindows specific sanitization
console.log('Test 3: schedule.timeWindows specific sanitization');
const testSchedule1 = {
  countRule: { operator: '>=', count: 3, unit: 'per_week' },
  timeWindows: [
    {
      label: '07:00',
      range: ['07:00', '07:00'],
      source: 'user_text'
    },
    {
      label: undefined, // Invalid: missing label
      range: ['09:00', '09:00'],
      source: 'inferred'
    },
    {
      label: '10:00',
      range: ['10:00', undefined], // Invalid: missing range end
      source: 'inferred'
    },
    {
      label: '11:00',
      range: ['11:00', '11:00'],
      source: undefined // Invalid: missing source
    }
  ]
};
const sanitizedSchedule1 = sanitizeScheduleTimeWindows(testSchedule1);
console.log('Original schedule:', JSON.stringify(testSchedule1, null, 2));
console.log('Sanitized schedule:', JSON.stringify(sanitizedSchedule1, null, 2));
console.log('✅ Passed\n');

// Test 4: Empty timeWindows handling
console.log('Test 4: Empty timeWindows handling');
const testSchedule2 = {
  countRule: { operator: '>=', count: 3, unit: 'per_week' },
  timeWindows: [] // Empty array
};
const sanitizedSchedule2 = sanitizeScheduleTimeWindows(testSchedule2);
console.log('Original schedule:', JSON.stringify(testSchedule2, null, 2));
console.log('Sanitized schedule:', JSON.stringify(sanitizedSchedule2, null, 2));
console.log('✅ Passed\n');

// Test 5: Goal payload sanitization
console.log('Test 5: Goal payload sanitization');
const testGoalPayload = {
  title: 'Test Goal',
  description: 'Test Description',
  schedule: {
    countRule: { operator: '>=', count: 3, unit: 'per_week' },
    timeWindows: [
      {
        label: '07:00',
        range: ['07:00', '07:00'],
        source: 'user_text'
      },
      {
        label: undefined,
        range: ['09:00', '09:00'],
        source: 'inferred'
      }
    ]
  },
  extraField: undefined
};
const sanitizedGoalPayload = sanitizeGoalPayload(testGoalPayload);
console.log('Original goal payload:', JSON.stringify(testGoalPayload, null, 2));
console.log('Sanitized goal payload:', JSON.stringify(sanitizedGoalPayload, null, 2));
console.log('✅ Passed\n');

console.log('🎉 All tests passed!');
