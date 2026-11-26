export type Countable = { id: string; minutes: number; target?: number };

// Next count on click: a single tile toggles, a cumulative tile cycles 0..target and wraps to 0.
export function nextCount(target: number, count: number): number {
  return target > 1 ? (count + 1) % (target + 1) : count >= 1 ? 0 : 1;
}

// Done tiles and remaining minutes (minutes x units left; a finished tile counts 0).
export function summarize(bosses: Countable[], counts: Record<string, number>): { done: number; minutes: number } {
  let done = 0;
  let minutes = 0;
  for (const b of bosses) {
    const left = Math.max(0, (b.target ?? 1) - (counts[b.id] ?? 0));
    if (left === 0) done++;
    minutes += b.minutes * left;
  }
  return { done, minutes };
}
