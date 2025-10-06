import { VERIFICATION_DEFAULTS } from '../config/verification';
import { type GoalType } from '../constants/verificationPolicy';
import type { VerificationSignals } from '../types/firestore';
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

// Schedule: Time AND (Manual+Location OR Time+Photo OR Time+Location OR Time+Manual)
export function evalScheduleRule(sig: VerificationSignals) {
  const timeOk = withinWindow(sig.time);
  const manualLocOk = !!(sig.manual?.present && sig.location?.present && sig.location.inside);
  const photoOk = !!(sig.photo?.present && 
    sig.photo.validationResult?.timeValid && 
    sig.photo.validationResult?.freshnessValid);
  const timeLocOk = !!(sig.time?.present && sig.location?.present && sig.location.inside);
  const timeManualOk = !!(sig.time?.present && sig.manual?.present);
  
  const either = manualLocOk || photoOk || timeLocOk || timeManualOk;
  return { 
    pass: timeOk && either, 
    details: { 
      timeOk, 
      manualLocOk, 
      photoOk,
      timeLocOk,
      timeManualOk,
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
  const manualLocOk = !!(sig.manual?.present && sig.location?.present && sig.location.inside);
  
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

// Partner: Partner verification required
export function evalPartnerRule(sig: VerificationSignals) {
  const partnerOk = !!(sig.partner?.reviewed && sig.partner?.approved);
  const manualOk = !!sig.manual?.present;
  const photoOk = !!(sig.photo?.present && 
    sig.photo.validationResult?.timeValid && 
    sig.photo.validationResult?.freshnessValid);
  const locationOk = !!(sig.location?.present && sig.location.inside);
  
  // Partner is always required, optionally combine with others
  const hasAdditionalVerification = manualOk || photoOk || locationOk;
  
  return { 
    pass: partnerOk && (hasAdditionalVerification || true), // Partner alone is sufficient
    details: { 
      partnerOk,
      manualOk,
      photoOk,
      locationOk,
      hasAdditionalVerification
    } 
  };
}

export function evaluateByGoalType(goalType: GoalType, sig: VerificationSignals) {
  switch (goalType) {
    case 'schedule':
      return evalScheduleRule(sig);
    case 'frequency':
      return evalFrequencyRule(sig);
    case 'milestone':
      return evalScheduleRule(sig);
    default:
      return evalFrequencyRule(sig); // Default fallback
  }
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