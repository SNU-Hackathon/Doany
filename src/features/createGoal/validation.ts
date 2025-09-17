import type { CreateGoalState, GoalType } from './state';

export type PlanType = 'schedule'|'frequency'|'partner';
export interface VerificationPlan {
  type: PlanType;                      // 결정된 목표 타입
  methods: Array<'manual'|'location'|'photo'>;
  mandatory: Array<'time'|'manual'|'location'|'photo'>;
  ok: boolean;                         // 규칙 충족 여부(간단 판단; 상세 평가는 런타임)
  reason?: string;                     // 부족 사유 또는 요약
  partnerRecommended?: boolean;        // Partner로 전환 권장
}

// Normalize date input to YYYY-MM-DD string
export function toDateOnlyString(input?: string | Date): string | undefined {
  if (!input) return undefined;
  const d = (input instanceof Date) ? input : new Date(input);
  if (isNaN(d.getTime())) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Simple frequency validation
export function validateFrequencyDraft(draft: any): boolean {
  try {
    const target = Number(draft?.frequency?.count ?? draft?.frequency?.targetPerWeek ?? 0);
    if (target <= 0) return false;

    const startRaw = draft?.schedule?.startDate;
    const endRaw = draft?.schedule?.endDate;
    const start = toDateOnlyString(startRaw);
    const end = toDateOnlyString(endRaw);

    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      if (s.getTime() > e.getTime()) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function computeVerificationPlan(type: PlanType, s: CreateGoalState): VerificationPlan {
  const methods: Array<'manual'|'location'|'photo'> = [];
  if (s.methods?.manual) methods.push('manual');
  if (s.methods?.location) methods.push('location');
  if (s.methods?.photo) methods.push('photo');

  if (type === 'schedule') {
    const hasTime = !!(s.times && s.times.length);
    const manualLocOk = s.methods?.manual && s.methods?.location;
    const photoOk = !!s.methods?.photo; // EXIF 유효성은 런타임에서
    const ok = !!(hasTime && (manualLocOk || photoOk));
    return {
      type, methods, ok,
      mandatory: ['time'],
      reason: ok ? 'Time window + (Manual+Location OR Photo)' : 'Need Time and either (Manual+Location) or Photo',
      partnerRecommended: !ok
    };
  }

  if (type === 'frequency') {
    const hasPeriod = !!s.period;
    const perWeekOk = (s.perWeek ?? 0) > 0;
    const manualOk = !!s.methods?.manual;
    const locOrPhoto = !!(s.methods?.location || s.methods?.photo);
    const ok = !!(hasPeriod && perWeekOk && manualOk && locOrPhoto);
    return {
      type, methods, ok,
      mandatory: ['manual'],
      reason: ok ? 'Manual + (Location OR Photo). Aggregated by complete weeks.' : 'Manual is required and choose Location or Photo; set period & N/week',
      partnerRecommended: !ok
    };
  }

  // partner
  const partnerChosen = !!(s.partner?.id || s.partner?.inviteEmail);
  const hasPeriod = !!s.period;
  const ok = !!(hasPeriod && partnerChosen);
  return {
    type, methods, ok,
    mandatory: [],
    reason: ok ? 'Partner approval decides the result.' : 'Select/invite a partner and set a period',
    partnerRecommended: false
  };
}

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
