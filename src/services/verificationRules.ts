import type { GoalType, VerificationSignals } from '../types/firestore';

function withinWindow(t?: { now: number; windowStart?: number | null; windowEnd?: number | null }) {
  if (!t) return true;
  const { now, windowStart, windowEnd } = t;
  if (windowStart != null && now < windowStart) return false;
  if (windowEnd != null && now > windowEnd) return false;
  return true;
}

// Schedule: Time AND (Manual+Location OR Time+Photo)
export function evalScheduleRule(sig: VerificationSignals) {
  const timeOk = withinWindow(sig.time);
  const manual = !!sig.manual?.present && sig.manual.pass !== false;
  const loc = !!sig.location?.inside;
  const photo = !!sig.photo?.present;
  const either = (manual && loc) || (timeOk && photo);
  return { pass: timeOk && either, details: { timeOk, manual, loc, photo } };
}

// Frequency: (Manual+Location OR Manual+Photo)
export function evalFrequencyRule(sig: VerificationSignals) {
  const manual = !!sig.manual?.present && sig.manual.pass !== false;
  const loc = !!sig.location?.inside;
  const photo = !!sig.photo?.present;
  const either = (manual && loc) || (manual && photo);
  return { pass: either, details: { manual, loc, photo } };
}

export function evaluateByGoalType(goalType: GoalType, sig: VerificationSignals) {
  return goalType === 'schedule' ? evalScheduleRule(sig) : evalFrequencyRule(sig);
}