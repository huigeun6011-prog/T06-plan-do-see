import { type SqlClient, violatesConstraint } from "./client";
import { type EntryInput, type PeriodKind, validateEntry, validateId, validatePeriodKind, validateSortOrder, ValidationError } from "../lib/validate";

export type EntryRow = ReturnType<typeof validateEntry> & {
  id: string;
  root_id: string;
  use_yn: "Y" | "N";
  created_at: Date;
};

export type Entry = Omit<EntryRow, "created_at"> & { created_at: string };
export type EntryEditResult = { id: string } | { conflict: true };

export function serializeEntry(row: EntryRow): Entry {
  return { ...row, created_at: row.created_at.toISOString() };
}

function throwEntryError(error: unknown): never {
  if (violatesConstraint(error, "entry_one_per_title")) {
    throw new ValidationError("title", "This title already exists for the selected character or account.");
  }
  if (violatesConstraint(error, "entry_character_id_fkey")) {
    throw new ValidationError("character_id", "Choose an existing character.");
  }
  throw error;
}

export async function createEntry(sql: SqlClient, input: EntryInput): Promise<Entry> {
  const entry = validateEntry(input);
  try {
    const [row] = await sql`
      WITH n AS (SELECT nextval(pg_get_serial_sequence('entry', 'id')) AS id)
      INSERT INTO entry (id, root_id, character_id, title, period_kind, clear_minutes,
                         reward_meso, party_size, doping, memo, target_count, tags, sort_order)
      SELECT n.id, n.id, ${entry.character_id}, ${entry.title}, ${entry.period_kind},
             ${entry.clear_minutes}, ${entry.reward_meso}, ${entry.party_size}, ${entry.doping},
             ${entry.memo}, ${entry.target_count}, ${entry.tags},
             COALESCE(${input.sort_order === undefined ? null : entry.sort_order}::int, (
               SELECT LEAST(COALESCE(max(sort_order)::bigint + 1, 0), 2147483647)
               FROM entry WHERE use_yn = 'Y' AND character_id IS NOT DISTINCT FROM ${entry.character_id}::bigint
             ))
      FROM n
      RETURNING *
    ` as EntryRow[];
    return serializeEntry(row);
  } catch (error) {
    throwEntryError(error);
  }
}

export async function editEntry(
  sql: SqlClient,
  rootId: string,
  expectedVersionId: string,
  input: EntryInput,
): Promise<EntryEditResult> {
  const root = validateId(rootId, "root_id");
  const version = validateId(expectedVersionId, "id");
  const entry = validateEntry(input);

  try {
    // The HTTP batch cannot branch in JS. Pass the UPDATE result within this transaction.
    const [, inserted] = await sql.transaction((tx) => [
      tx`
        WITH retired AS (
          UPDATE entry SET use_yn = 'N'
          WHERE root_id = ${root} AND id = ${version} AND use_yn = 'Y'
          RETURNING id
        )
        SELECT set_config('pds.entry_retired', (SELECT count(*)::text FROM retired), true)
      `,
      tx`
        INSERT INTO entry (root_id, character_id, title, period_kind, clear_minutes,
                           reward_meso, party_size, doping, memo, target_count, tags, sort_order)
        SELECT ${root}, ${entry.character_id}, ${entry.title}, ${entry.period_kind},
               ${entry.clear_minutes}, ${entry.reward_meso}, ${entry.party_size}, ${entry.doping},
               ${entry.memo}, ${entry.target_count}, ${entry.tags}, ${entry.sort_order}
        WHERE current_setting('pds.entry_retired', true) = '1'
          AND NOT EXISTS (SELECT 1 FROM entry WHERE root_id = ${root} AND use_yn = 'Y')
        RETURNING id
      `,
    ]);
    const [row] = inserted as { id: string }[];
    return row ? { id: row.id } : { conflict: true };
  } catch (error) {
    throwEntryError(error);
  }
}

export async function deleteEntry(sql: SqlClient, rootId: string): Promise<boolean> {
  const root = validateId(rootId, "root_id");
  const rows = await sql`
    UPDATE entry SET use_yn = 'N' WHERE root_id = ${root} AND use_yn = 'Y'
    RETURNING id
  `;
  return rows.length > 0;
}

export async function setEntryOrder(sql: SqlClient, rootId: string, order: number): Promise<boolean> {
  const root = validateId(rootId, "root_id");
  const sortOrder = validateSortOrder(order);
  const rows = await sql`
    UPDATE entry SET sort_order = ${sortOrder} WHERE root_id = ${root} AND use_yn = 'Y'
    RETURNING id
  `;
  return rows.length > 0;
}

export async function listEntries(
  sql: SqlClient,
  filters: { period_kind?: PeriodKind; character_id?: string | null } = {},
): Promise<Entry[]> {
  const period = filters.period_kind === undefined ? null : validatePeriodKind(filters.period_kind);
  const character = filters.character_id == null ? null : validateId(filters.character_id, "character_id");
  const rows = await sql`
    SELECT * FROM entry
    WHERE use_yn = 'Y'
      AND (${period}::text IS NULL OR period_kind = ${period})
      AND (${filters.character_id === undefined} OR character_id IS NOT DISTINCT FROM ${character}::bigint)
    ORDER BY sort_order, id
  ` as EntryRow[];
  return rows.map(serializeEntry);
}

export async function getEntryHistory(sql: SqlClient, rootId: string): Promise<Entry[]> {
  const root = validateId(rootId, "root_id");
  const rows = await sql`SELECT * FROM entry WHERE root_id = ${root} ORDER BY id` as EntryRow[];
  return rows.map(serializeEntry);
}
