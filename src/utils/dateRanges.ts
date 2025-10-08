export type DateRange = { start: Date; end: Date };

const ts = (d: Date) => d.getTime();

export const normalizeRange = (a: Date, b: Date): DateRange =>
  ts(a) <= ts(b) ? { start: a, end: b } : { start: b, end: a };

export const mergeRanges = (ranges: DateRange[]): DateRange[] => {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((r1, r2) => ts(r1.start) - ts(r2.start));
  const out: DateRange[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = out[out.length - 1];
    const cur = sorted[i];
    if (ts(cur.start) <= ts(new Date(prev.end.getTime() + 24*60*60*1000))) {
      // 겹치거나 인접하면 병합
      if (ts(cur.end) > ts(prev.end)) prev.end = cur.end;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
};

export const addRange = (ranges: DateRange[], r: DateRange) =>
  mergeRanges([...ranges, normalizeRange(r.start, r.end)]);

export const subtractRange = (ranges: DateRange[], cut: DateRange) => {
  const c = normalizeRange(cut.start, cut.end);
  const out: DateRange[] = [];
  for (const r of ranges) {
    if (ts(c.end) < ts(r.start) || ts(c.start) > ts(r.end)) { 
      out.push(r); 
      continue; 
    }
    // 겹침: 좌/우 남는 부분만 보관
    if (ts(c.start) > ts(r.start)) 
      out.push({ start: r.start, end: new Date(c.start.getTime() - 24*60*60*1000) });
    if (ts(c.end) < ts(r.end)) 
      out.push({ start: new Date(c.end.getTime() + 24*60*60*1000), end: r.end });
  }
  return out;
};

export const minMaxFromRanges = (ranges: DateRange[]) => {
  if (!ranges.length) return { start: null as Date|null, end: null as Date|null };
  let min = ranges[0].start, max = ranges[0].end;
  for (const r of ranges) { 
    if (ts(r.start) < ts(min)) min = r.start; 
    if (ts(r.end) > ts(max)) max = r.end; 
  }
  return { start: min, end: max };
};

export const isDateInRanges = (date: Date, ranges: DateRange[]): boolean => {
  const dateTs = ts(date);
  return ranges.some(range => dateTs >= ts(range.start) && dateTs <= ts(range.end));
};
