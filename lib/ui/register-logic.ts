import type { EntryInput, PeriodKind } from "../validate";

export type Kind = "boss" | "mission";

// --- ordering -------------------------------------------------------------------------------------

// Moves the first occurrence of id by delta; unknown id or an out-of-range move returns an unchanged copy.
export function moveItem(list: string[], id: string, delta: -1 | 1): string[] {
  const out = [...list];
  const i = out.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// Full order of a character's entries after moving one inside its own kind: bosses first, then missions, never mixed.
export function reorderGroup(items: { id: string; kind: Kind }[], id: string, delta: -1 | 1): string[] {
  const target = items.find((x) => x.id === id);
  const ids = (kind: Kind) => items.filter((x) => x.kind === kind).map((x) => x.id);
  const bosses = target?.kind === "boss" ? moveItem(ids("boss"), id, delta) : ids("boss");
  const missions = target?.kind === "mission" ? moveItem(ids("mission"), id, delta) : ids("mission");
  return [...bosses, ...missions];
}

// --- save input -----------------------------------------------------------------------------------

export type EntryFields = { title: string; minutes: string; party: string; target: string; doping: string; memo: string; period: PeriodKind };
type Original = { tags: string[]; sort_order: number };

// Editing keeps the original tags exactly; creating adds the kind tag of the group.
export function buildEntryInput(o: {
  original?: Original; kind: Kind; characterId: string | null; sortOrder: number; reward: number; fields: EntryFields;
}): EntryInput {
  const f = o.fields;
  return {
    title: f.title,
    period_kind: f.period,
    clear_minutes: Number(f.minutes),
    reward_meso: o.reward,
    party_size: Number(f.party),
    doping: f.doping.trim() || undefined,
    memo: f.memo,
    target_count: Number(f.target),
    tags: o.original ? [...o.original.tags] : [o.kind],
    sort_order: o.original?.sort_order ?? o.sortOrder,
    character_id: o.characterId,
  };
}

export const isConflict = (message: string): boolean => /먼저 수정/.test(message);

// --- paste preview --------------------------------------------------------------------------------

export type Snapshot = { text: string; kind: Kind; period: PeriodKind; characterId: string | null };

export const sameSnapshot = (a: Snapshot | null, b: Snapshot | null): boolean =>
  !!a && !!b && a.text === b.text && a.kind === b.kind && a.period === b.period && a.characterId === b.characterId;

// Register only what the user is looking at: the preview must belong to the current snapshot and be clean.
export function canRegister(current: Snapshot, preview: { snap: Snapshot; rows: number; errors: number } | null): boolean {
  return !!preview && sameSnapshot(current, preview.snap) && preview.rows > 0 && preview.errors === 0;
}
