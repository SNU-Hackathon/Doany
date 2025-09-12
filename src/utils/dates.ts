export const KST = 'Asia/Seoul';

export function toKstDate(ts: number | Date) {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  // Convert to KST date string (YYYY-MM-DD) without external libs
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const day = String(kst.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfWeekKST(d = new Date()) {
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  const dow = (kst.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const start = new Date(kst);
  start.setDate(kst.getDate() - dow);
  start.setHours(0,0,0,0);
  return start;
}

export function endOfWeekKST(d = new Date()) {
  const start = startOfWeekKST(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return end;
}

export function clampToFullWeeksKST(period: {start: Date; end: Date}) {
  // Trim to full Mon-Sun windows, exclude partial head/tail weeks
  const start = startOfWeekKST(period.start);
  const end = endOfWeekKST(new Date(period.end.getTime() - 1)); // end exclusive
  return { start, end };
}

export function* iterateWeeksKST(period: {start: Date; end: Date}) {
  let cur = startOfWeekKST(period.start);
  const limit = endOfWeekKST(new Date(period.end.getTime() - 1));
  while (cur < limit) {
    const ws = new Date(cur);
    const we = new Date(cur); we.setDate(ws.getDate() + 7);
    yield { weekStart: ws, weekEnd: we };
    cur = we;
  }
}
