import type { NeonQueryFunctionInTransaction } from "@neondatabase/serverless";
import type { SqlClient } from "./client";
import { entryKind, MAX_WEEKLY_BOSSES_PER_CHARACTER } from "../lib/limits";
import { type EntryInput, ValidationError } from "../lib/validate";

// Keep the database predicate in step with entryKind, including untagged entries.
export const CURRENT_WEEKLY_BOSS_SQL = `
  e.use_yn = 'Y' AND e.period_kind = 'weekly'
  AND (e.tags @> ARRAY['boss'] OR NOT (e.tags @> ARRAY['mission']))
`;

export type BossSlotRequest = { character_id: string; requested: number };
type KindInput = Pick<EntryInput, "character_id" | "period_kind" | "tags">;

export function weeklyBossCharacter(entry: KindInput): string | null {
  if (entryKind(entry.tags ?? []) === "mission") return null;
  if (entry.character_id == null) throw new ValidationError("kind", "계정 단위에는 미션만 등록할 수 있습니다.");
  return entry.period_kind === "weekly" ? entry.character_id : null;
}

export function bossSlotRequests(entries: KindInput[]): BossSlotRequest[] {
  const requests = new Map<string, number>();
  for (const entry of entries) {
    const id = weeklyBossCharacter(entry);
    if (id !== null) requests.set(id, (requests.get(id) ?? 0) + 1);
  }
  return Array.from(requests, ([character_id, requested]) => ({ character_id, requested }));
}

export function bossLimitError(remaining?: number): ValidationError {
  const slots = remaining === undefined ? "" : ` (남은 칸 ${remaining})`;
  return new ValidationError("boss_limit", `보스는 캐릭터당 최대 ${MAX_WEEKLY_BOSSES_PER_CHARACTER}개입니다${slots}.`);
}

export function lockBossCharacters(tx: NeonQueryFunctionInTransaction<false, false>, ids: string[]) {
  // Use negative character IDs as lock keys. A batch always locks in numeric order.
  return tx`
    SELECT pg_advisory_xact_lock(-id)
    FROM (SELECT DISTINCT id FROM unnest(${ids}::bigint[]) AS character_ids(id) ORDER BY id) ordered
  `;
}

export const BOSS_OVERFLOW_SQL = `
  SELECT GREATEST($2::int - count(e.id)::int, 0) AS remaining
  FROM jsonb_to_recordset($1::jsonb) AS request(character_id bigint, requested int)
  LEFT JOIN entry e ON e.character_id = request.character_id AND (${CURRENT_WEEKLY_BOSS_SQL})
  GROUP BY request.character_id, request.requested
  HAVING count(e.id) + request.requested > $2::int
  ORDER BY remaining ASC
  LIMIT 1
`;

export async function checkBossSlots(sql: SqlClient, requests: BossSlotRequest[]): Promise<void> {
  const [overflow] = await sql.query(BOSS_OVERFLOW_SQL, [
    JSON.stringify(requests), MAX_WEEKLY_BOSSES_PER_CHARACTER,
  ]) as { remaining: number }[];
  if (overflow) throw bossLimitError(overflow.remaining);
}
