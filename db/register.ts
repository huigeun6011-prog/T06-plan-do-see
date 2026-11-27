import { listCharacters, type Character } from "./characters";
import { type SqlClient, violatesConstraint } from "./client";
import { bossLimitError, bossSlotRequests, BOSS_OVERFLOW_SQL, lockBossCharacters } from "./entry-limits";
import { listEntries, serializeEntry, type Entry, type EntryRow } from "./entries";
import { MAX_ENTRY_LINES, type EntryLine } from "../lib/entry-lines";
import { MAX_WEEKLY_BOSSES_PER_CHARACTER } from "../lib/limits";
import { validateDate, validateEntry, validateId, ValidationError } from "../lib/validate";

export type RegistrationEntry = Entry & { version_id: string };
export type RegistrationCharacterGroup = { character: Character; entries: RegistrationEntry[] };
export type RegistrationData = {
  characters: RegistrationCharacterGroup[];
  account: { character: null; entries: RegistrationEntry[] };
};
export type CommitEntryLinesResult = { entries: Entry[]; conflictingLines: number[] };

export async function loadRegistration(sql: SqlClient): Promise<RegistrationData> {
  const [characters, entries] = await Promise.all([listCharacters(sql), listEntries(sql)]);
  const grouped = new Map<string | null, RegistrationEntry[]>();
  for (const entry of entries) {
    const group = grouped.get(entry.character_id) ?? [];
    group.push({ ...entry, version_id: entry.id });
    grouped.set(entry.character_id, group);
  }
  return {
    characters: characters.map((character) => ({ character, entries: grouped.get(character.id) ?? [] })),
    account: { character: null, entries: grouped.get(null) ?? [] },
  };
}

function validateOrder(ids: string[], field: string): string[] {
  if (!Array.isArray(ids)) throw new ValidationError(field, "Send an ordered list of IDs.");
  const clean = Array.from(ids, (id) => validateId(id, field));
  if (new Set(clean).size !== clean.length) throw new ValidationError(field, "Include each ID once.");
  return clean;
}

export async function reorderEntries(sql: SqlClient, orderedRootIds: string[]): Promise<number> {
  const ids = validateOrder(orderedRootIds, "root_id");
  if (!ids.length) return 0;
  const rows = await sql`
    UPDATE entry e SET sort_order = (ordered.position - 1)::int
    FROM unnest(${ids}::bigint[]) WITH ORDINALITY AS ordered(id, position)
    WHERE e.root_id = ordered.id AND e.use_yn = 'Y' AND e.sort_order IS DISTINCT FROM ordered.position - 1
    RETURNING e.id
  `;
  return rows.length;
}

export async function reorderCharacters(sql: SqlClient, orderedIds: string[]): Promise<number> {
  const ids = validateOrder(orderedIds, "id");
  if (!ids.length) return 0;
  const rows = await sql`
    UPDATE game_character c SET sort_order = (ordered.position - 1)::int
    FROM unnest(${ids}::bigint[]) WITH ORDINALITY AS ordered(id, position)
    WHERE c.id = ordered.id AND c.sort_order IS DISTINCT FROM ordered.position - 1
    RETURNING c.id
  `;
  return rows.length;
}

export async function commitEntryLines(sql: SqlClient, rows: EntryLine[], now: Date): Promise<CommitEntryLinesResult> {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_ENTRY_LINES) {
    throw new ValidationError("text", "Send 1 to 200 valid entry lines.");
  }
  const timestamp = validateDate(now, "now");
  const inputs = Array.from(rows, ({ line, input }) => {
    if (!Number.isInteger(line) || line < 1 || line > MAX_ENTRY_LINES) {
      throw new ValidationError("line", "Use original line numbers from 1 to 200.");
    }
    const entry = validateEntry(input);
    return { ...entry, line, sort_order: input.sort_order === undefined ? null : entry.sort_order };
  });
  if (new Set(inputs.map(({ line }) => line)).size !== inputs.length) {
    throw new ValidationError("line", "Include each line once.");
  }
  const requests = bossSlotRequests(inputs);

  try {
    // Take character locks before the table lock, matching the order used by single writes.
    const [, , results] = await sql.transaction((tx) => [
      lockBossCharacters(tx, requests.map(({ character_id }) => character_id)),
      tx`LOCK TABLE entry IN SHARE ROW EXCLUSIVE MODE`,
      tx.query(`
        WITH capacity AS (${BOSS_OVERFLOW_SQL}), inputs AS (
          SELECT * FROM jsonb_to_recordset($3::jsonb) AS input(
            line int, character_id bigint, title text, period_kind text, clear_minutes int,
            reward_meso bigint, party_size int, doping text, memo text, target_count int, tags text[], sort_order int
          )
        ), conflicts AS (
          SELECT i.line FROM inputs i JOIN entry e
            ON COALESCE(e.character_id, 0) = COALESCE(i.character_id, 0) AND e.title = i.title AND e.use_yn = 'Y'
          UNION
          SELECT i.line FROM inputs i JOIN inputs prior
            ON prior.line < i.line AND prior.character_id IS NOT DISTINCT FROM i.character_id AND prior.title = i.title
        ), numbered AS (
          SELECT nextval(pg_get_serial_sequence('entry', 'id')) AS id, i.*,
            COALESCE(i.sort_order, LEAST(
              COALESCE((
                SELECT max(e.sort_order)::bigint + 1 FROM entry e
                WHERE e.use_yn = 'Y' AND e.character_id IS NOT DISTINCT FROM i.character_id
              ), 0)
              + count(*) FILTER (WHERE i.sort_order IS NULL) OVER (PARTITION BY i.character_id ORDER BY i.line) - 1,
              2147483647
            )) AS new_sort_order
          FROM inputs i
          WHERE NOT EXISTS (SELECT 1 FROM conflicts) AND NOT EXISTS (SELECT 1 FROM capacity)
          ORDER BY i.line
        ), inserted AS (
          INSERT INTO entry (id, root_id, character_id, title, period_kind, clear_minutes, reward_meso,
                             party_size, doping, memo, target_count, tags, sort_order, created_at)
          SELECT id, id, character_id, title, period_kind, clear_minutes, reward_meso,
                 party_size, doping, memo, target_count, tags, new_sort_order, $4::timestamptz
          FROM numbered
          RETURNING *
        )
        SELECT conflicts.line AS conflict_line, capacity.remaining, inserted.*
        FROM inserted FULL JOIN conflicts ON false FULL JOIN capacity ON false
        ORDER BY inserted.id, conflicts.line
      `, [JSON.stringify(requests), MAX_WEEKLY_BOSSES_PER_CHARACTER, JSON.stringify(inputs), timestamp]),
    ], { isolationLevel: "ReadCommitted" });
    const entries: Entry[] = [];
    const conflictingLines: number[] = [];
    for (const { conflict_line, remaining, ...row } of results as
      (EntryRow & { conflict_line: number | null; remaining: number | null })[]) {
      if (remaining !== null) throw bossLimitError(remaining);
      if (conflict_line === null) entries.push(serializeEntry(row));
      else conflictingLines.push(conflict_line);
    }
    return { entries, conflictingLines };
  } catch (error) {
    if (violatesConstraint(error, "entry_character_id_fkey")) {
      throw new ValidationError("character_id", "Choose an existing character.");
    }
    throw error;
  }
}
