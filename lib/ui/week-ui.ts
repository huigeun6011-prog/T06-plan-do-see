// Pure helpers for the this-week screen.

export const NOTICE = "지금은 로그인이 없어 링크를 아는 사람은 누구나 볼 수 있습니다. 남이 봐도 괜찮은 내용만 넣으세요";

// 37 -> "37분", 80 -> "1시간 20분", 120 -> "2시간", 0 -> "0분".
export function formatMinutes(n: number): string {
  const m = Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}분`;
  return r === 0 ? `${h}시간` : `${h}시간 ${r}분`;
}

type Done = { is_done: boolean };
type GroupLike = { bosses: Done[]; missions: Done[]; others: Done[] };

export const visibleTodos = <T extends Done>(todos: T[], onlyRemaining: boolean): T[] =>
  onlyRemaining ? todos.filter((t) => !t.is_done) : todos;

export const groupHasVisible = (g: GroupLike, onlyRemaining: boolean): boolean =>
  [g.bosses, g.missions, g.others].some((list) => visibleTodos(list, onlyRemaining).length > 0);

export type BoxState = "locked" | "filled" | "empty";

// One box per unit: boxes covered by other days are locked, then today's filled boxes, then empty ones.
export function boxStates(target: number, lockedCount: number, todayCount: number): BoxState[] {
  const t = Math.max(0, Math.floor(target));
  const locked = Math.min(Math.max(0, lockedCount), t);
  const today = Math.min(Math.max(0, todayCount), t - locked);
  return Array.from({ length: t }, (_, i) => (i < locked ? "locked" : i < locked + today ? "filled" : "empty"));
}

// Click box `clickedIndex` (0-based): fill up to it; clicking today's last filled box takes one back. Locked boxes do nothing.
export function nextTodayCount(currentToday: number, clickedIndex: number, lockedCount: number, target: number): number {
  const locked = Math.min(Math.max(0, lockedCount), target);
  const room = Math.max(0, target - locked);
  const current = Math.min(Math.max(0, currentToday), room);
  if (clickedIndex < locked || clickedIndex >= target) return current;
  const k = clickedIndex - locked + 1;
  return k === current ? current - 1 : Math.min(k, room);
}

// Digits only; empty clears (null); 0 to 10000 allowed.
export function parseMinutesInput(text: string): { ok: true; value: number | null } | { ok: false } {
  const t = text.trim();
  if (t === "") return { ok: true, value: null };
  if (!/^\d{1,5}$/.test(t)) return { ok: false };
  const n = Number(t);
  return n <= 10000 ? { ok: true, value: n } : { ok: false };
}

export const hasAnyTodos = (periods: { groups: GroupLike[] }[]): boolean =>
  periods.some((p) => p.groups.some((g) => groupHasVisible(g, false)));
