import type { CreateGoalState, GoalType } from './state';

export function validateCreateView(type: GoalType, s: CreateGoalState): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (type === 'schedule') {
    const hasTime = (s.times && s.times.length > 0);
    if (!hasTime) issues.push('Pick at least one date & time');
    
    const manualLocOk = s.methods.manual && s.methods.location;
    const photoOk = s.methods.photo; // on Create, we only check selection; runtime will enforce EXIF
    if (!(manualLocOk || photoOk)) issues.push('Choose (Manual + Location) or Photo');
  }
  
  if (type === 'frequency') {
    if (!s.period) issues.push('Set a period');
    if (!s.perWeek || s.perWeek < 1) issues.push('Set times per week');
    if (!s.methods.manual) issues.push('Manual is required');
    if (!(s.methods.location || s.methods.photo)) issues.push('Choose Location or Photo');
  }
  
  if (type === 'partner') {
    if (!s.period) issues.push('Set a period');
    if (!s.partner || (!s.partner.id && !s.partner.inviteEmail)) issues.push('Select or invite a partner');
  }
  
  return { ok: issues.length === 0, issues };
}
