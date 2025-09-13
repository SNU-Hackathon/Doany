import { VERIFICATION_DEFAULTS } from '../config/verification';
import type { GoalType, VerificationSignals } from '../types/firestore';
import { isWithin } from '../utils/time';

function withinWindow(t?: { present?: boolean; windowStart?: number | null; windowEnd?: number | null }, toleranceMinutes: number = VERIFICATION_DEFAULTS.timeToleranceMinutes) {
  if (!t?.present) return false;
  if (!t.windowStart || !t.windowEnd) return true;
  
  const now = Date.now();
  const toleranceMs = toleranceMinutes * 60 * 1000;
  const effectiveStart = t.windowStart - toleranceMs;
  const effectiveEnd = t.windowEnd + toleranceMs;
  
  return isWithin(now, effectiveStart, effectiveEnd);
}

// Schedule: Time AND (Manual+Location OR Time+Photo)
export function evalScheduleRule(sig: VerificationSignals) {
  const timeOk = !!sig.time?.present;
  const manualLocOk = !!(sig.manual?.present && sig.location?.present);
  const photoOk = !!(sig.photo?.present && 
    sig.photo.validationResult?.timeValid && 
    sig.photo.validationResult?.freshnessValid);
  
  const either = manualLocOk || photoOk;
  return { 
    pass: timeOk && either, 
    details: { 
      timeOk, 
      manualLocOk, 
      photoOk,
      photoTimeValid: sig.photo?.validationResult?.timeValid,
      photoFreshValid: sig.photo?.validationResult?.freshnessValid
    } 
  };
}

// Frequency: (Manual+Location OR Manual+Photo)
export function evalFrequencyRule(sig: VerificationSignals) {
  const manualPhotoOk = !!(sig.manual?.present && 
    sig.photo?.present && 
    sig.photo.validationResult?.freshnessValid);
  const manualLocOk = !!(sig.manual?.present && sig.location?.present);
  
  return { 
    pass: manualLocOk || manualPhotoOk, 
    details: { 
      manualLocOk, 
      manualPhotoOk,
      photoFreshValid: sig.photo?.validationResult?.freshnessValid,
      photoLocationValid: sig.photo?.validationResult?.locationValid
    } 
  };
}

export function evaluateByGoalType(goalType: GoalType, sig: VerificationSignals) {
  return goalType === 'schedule' ? evalScheduleRule(sig) : evalFrequencyRule(sig);
}

// Inline smoke tests for rule validation
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Test Schedule rule: should FAIL with old photo
  const scheduleTestOldPhoto = evalScheduleRule({
    time: { present: true },
    photo: { 
      present: true,
      validationResult: { timeValid: false, freshnessValid: false } // old photo
    }
  });
  console.assert(!scheduleTestOldPhoto.pass, 'Schedule rule should FAIL with old photo');

  // Test Schedule rule: should PASS with fresh, time-valid photo
  const scheduleTestGoodPhoto = evalScheduleRule({
    time: { present: true },
    photo: { 
      present: true,
      validationResult: { timeValid: true, freshnessValid: true } // good photo
    }
  });
  console.assert(scheduleTestGoodPhoto.pass, 'Schedule rule should PASS with valid photo');

  // Test Frequency rule: should FAIL with manual+old photo
  const freqTestOldPhoto = evalFrequencyRule({
    manual: { present: true },
    photo: { 
      present: true,
      validationResult: { freshnessValid: false } // old photo
    }
  });
  console.assert(!freqTestOldPhoto.pass, 'Frequency rule should FAIL with old photo');

  console.log('[VerificationRules] ✅ Smoke tests passed');
}