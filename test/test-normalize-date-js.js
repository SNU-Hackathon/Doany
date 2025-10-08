/**
 * Unit tests for normalizeDate utility function (JavaScript implementation)
 * Tests various date input formats and edge cases
 */

// JavaScript implementation of normalizeDate for testing
function normalizeDate(input) {
  if (!input) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  try {
    let date;

    if (input instanceof Date) {
      date = input;
    } else if (input && typeof input.toDate === 'function') {
      // Firestore Timestamp simulation
      date = input.toDate();
    } else if (typeof input === 'string') {
      // Handle ISO string format (yyyy-MM-ddTHH:mm:ssZ)
      if (input.includes('T')) {
        const datePart = input.split('T')[0];
        if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(datePart)) {
          throw new Error('Invalid ISO date format');
        }
        return padDateString(datePart);
      }
      
      // Handle YYYY-MM-DD or YYYY-M-D format
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(input)) {
        return padDateString(input);
      }
      
      // Try to parse as Date if other string formats
      date = new Date(input);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date string format');
      }
    } else {
      throw new Error('Unsupported date type');
    }

    // Convert Date to YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    throw new Error(`Invalid date format. Use YYYY-MM-DD. Input: ${input}, Error: ${error.message}`);
  }
}

function padDateString(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }
  
  const [year, month, day] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function isValidYYYYMMDD(dateStr) {
  if (typeof dateStr !== 'string') return false;
  
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  
  // Check if it's a valid date
  const date = new Date(dateStr + 'T00:00:00.000Z');
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateStr;
}

function runNormalizeDateTests() {
  console.log('=== normalizeDate Unit Tests ===\n');
  
  const tests = [
    // Valid Date objects
    {
      name: 'Date object - 2024-01-15',
      input: new Date('2024-01-15T10:30:00.000Z'),
      expected: '2024-01-15',
      shouldPass: true
    },
    
    // Valid ISO strings
    {
      name: 'ISO string with time',
      input: '2024-01-15T10:30:00.000Z',
      expected: '2024-01-15',
      shouldPass: true
    },
    {
      name: 'ISO string with timezone',
      input: '2024-01-15T10:30:00+09:00',
      expected: '2024-01-15',
      shouldPass: true
    },
    
    // Valid YYYY-MM-DD strings
    {
      name: 'YYYY-MM-DD format',
      input: '2024-01-15',
      expected: '2024-01-15',
      shouldPass: true
    },
    
    // Valid YYYY-M-D strings (need padding)
    {
      name: 'YYYY-M-D format (need padding)',
      input: '2024-1-5',
      expected: '2024-01-05',
      shouldPass: true
    },
    {
      name: 'YYYY-MM-D format (need day padding)',
      input: '2024-01-5',
      expected: '2024-01-05',
      shouldPass: true
    },
    {
      name: 'YYYY-M-DD format (need month padding)',
      input: '2024-1-15',
      expected: '2024-01-15',
      shouldPass: true
    },
    
    // Firestore Timestamp simulation
    {
      name: 'Firestore Timestamp simulation',
      input: {
        toDate: () => new Date('2024-01-15T10:30:00.000Z')
      },
      expected: '2024-01-15',
      shouldPass: true
    },
    
    // Invalid inputs - should throw errors
    {
      name: 'Invalid string',
      input: 'invalid-date',
      expected: null,
      shouldPass: false
    },
    {
      name: 'Empty string',
      input: '',
      expected: null,
      shouldPass: false
    },
    {
      name: 'Null input',
      input: null,
      expected: null,
      shouldPass: false
    },
    {
      name: 'Undefined input',
      input: undefined,
      expected: null,
      shouldPass: false
    },
    {
      name: 'Invalid date format',
      input: '15-01-2024',
      expected: null,
      shouldPass: false
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    try {
      const result = normalizeDate(test.input);
      
      if (test.shouldPass) {
        if (result === test.expected) {
          console.log(`✅ ${test.name}: ${JSON.stringify(test.input)} → ${result}`);
          passed++;
        } else {
          console.log(`❌ ${test.name}: Expected ${test.expected}, got ${result}`);
          failed++;
        }
      } else {
        console.log(`❌ ${test.name}: Expected error but got ${result}`);
        failed++;
      }
    } catch (error) {
      if (test.shouldPass) {
        console.log(`❌ ${test.name}: Unexpected error: ${error.message}`);
        failed++;
      } else {
        console.log(`✅ ${test.name}: Correctly threw error: ${error.message.substring(0, 50)}...`);
        passed++;
      }
    }
  });
  
  console.log(`\n=== Test Results ===`);
  console.log(`Total: ${tests.length}, Passed: ${passed}, Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('🎉 All normalizeDate tests passed!');
  } else {
    console.log(`⚠️  ${failed} test(s) failed.`);
  }
  
  return failed === 0;
}

function runIsValidYYYYMMDDTests() {
  console.log('\n=== isValidYYYYMMDD Unit Tests ===\n');
  
  const tests = [
    // Valid formats
    { input: '2024-01-15', expected: true, name: 'Valid YYYY-MM-DD' },
    { input: '2024-12-31', expected: true, name: 'Valid year end date' },
    { input: '2024-02-29', expected: true, name: 'Valid leap year date' },
    
    // Invalid formats
    { input: '2024-1-15', expected: false, name: 'Missing month padding' },
    { input: '2024-01-5', expected: false, name: 'Missing day padding' },
    { input: '24-01-15', expected: false, name: 'Short year' },
    { input: '2024-13-01', expected: false, name: 'Invalid month' },
    { input: '2024-02-30', expected: false, name: 'Invalid date' },
    { input: '2023-02-29', expected: false, name: 'Invalid leap year' },
    { input: 'invalid', expected: false, name: 'Invalid string' },
    { input: '', expected: false, name: 'Empty string' },
    { input: null, expected: false, name: 'Null' },
    { input: undefined, expected: false, name: 'Undefined' }
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    try {
      const result = isValidYYYYMMDD(test.input);
      
      if (result === test.expected) {
        console.log(`✅ ${test.name}: ${JSON.stringify(test.input)} → ${result}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: Expected ${test.expected}, got ${result}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Unexpected error: ${error.message}`);
      failed++;
    }
  });
  
  console.log(`\n=== Validation Test Results ===`);
  console.log(`Total: ${tests.length}, Passed: ${passed}, Failed: ${failed}`);
  
  return failed === 0;
}

function runAllTests() {
  console.log('Running Date Utility Tests...\n');
  
  const normalizeTests = runNormalizeDateTests();
  const validationTests = runIsValidYYYYMMDDTests();
  
  console.log('\n=== Overall Results ===');
  if (normalizeTests && validationTests) {
    console.log('🎉 All date utility tests passed!');
    return true;
  } else {
    console.log('⚠️  Some tests failed. Please review the failures above.');
    return false;
  }
}

// Run tests
runAllTests();
