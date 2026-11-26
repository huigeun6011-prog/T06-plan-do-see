import type { SqlClient } from "./client";
import { serializePlan, type Plan, type PlanRow } from "./plans";
import { TODO_SCOPE_PREDICATES } from "./todos";
import { type PlanKind, validateDate, validateId, validatePlanKind, validateRetroHistoryLimit, ValidationError } from "../lib/validate";

export type RetroTotals = {
  plan_count: number;
  done_count: number;
  late_count: number;
  blocked_count: number;
  expected_minutes: number;
  actual_minutes: number;
  diff_minutes: number;
};
export type RetroHistoryRow = RetroTotals & { plan: Plan };
export type Retro = RetroHistoryRow & { done_without_minutes: number; drill: typeof DRILL };
export type RetroGroupKind = "character" | "tag";
type CharacterGroup = { character_id: string | null; character_name: string | null };
export type RetroGroup = RetroTotals & { done_without_minutes: number } & (
  ({ group: "character" } & CharacterGroup) | { group: "tag"; tag: string }
);
export type OverviewRow = CharacterGroup & {
  total_todos: number;
  done_todos: number;
  remaining_todos: number;
  remaining_minutes: number;
};

type TotalsRow = Omit<RetroTotals, "expected_minutes" | "actual_minutes" | "diff_minutes"> & {
  todo_expected_minutes: string;
  actual_minutes: string;
  diff_minutes: string;
};
type MissingMinutes = { done_without_minutes: number };

const DRILL = Object.freeze({ all: "all", done: "done", late: "late", blocked: "blocked" } as const);
const scopes = TODO_SCOPE_PREDICATES;

// Counting IDs keeps the left-join row for an empty plan out of all counts.
const TOTALS_SQL = `
  count(t.id) FILTER (WHERE ${scopes.all})::int AS plan_count,
  count(t.id) FILTER (WHERE ${scopes.done})::int AS done_count,
  count(t.id) FILTER (WHERE ${scopes.late})::int AS late_count,
  count(t.id) FILTER (WHERE ${scopes.blocked})::int AS blocked_count,
  COALESCE(sum(t.expected_minutes), 0) AS todo_expected_minutes,
  COALESCE(sum(t.actual_minutes), 0) AS actual_minutes,
  COALESCE(sum(t.actual_minutes), 0) - COALESCE(sum(t.expected_minutes), 0) AS diff_minutes
`;

const DONE_WITHOUT_MINUTES_SQL = `
  count(t.id) FILTER (WHERE ${scopes.done} AND NOT EXISTS (
    SELECT 1 FROM run_record r
    WHERE r.todo_id = t.id AND r.use_yn = 'Y' AND r.done AND r.actual_minutes IS NOT NULL
  ))::int AS done_without_minutes
`;

function safeMinutes(value: string): number {
  const minutes = Number(value);
  if (!Number.isSafeInteger(minutes)) throw new RangeError("Minute total exceeds the supported integer range.");
  return minutes;
}

function totals(row: TotalsRow): RetroTotals {
  return {
    plan_count: row.plan_count,
    done_count: row.done_count,
    late_count: row.late_count,
    blocked_count: row.blocked_count,
    expected_minutes: safeMinutes(row.todo_expected_minutes),
    actual_minutes: safeMinutes(row.actual_minutes),
    diff_minutes: safeMinutes(row.diff_minutes),
  };
}

export async function getRetro(sql: SqlClient, planRootId: string, now: Date): Promise<Retro | null> {
  const root = validateId(planRootId, "plan_id");
  const instant = validateDate(now, "now");
  const [row] = await sql.query(
    `SELECT p.*, ${TOTALS_SQL}, ${DONE_WITHOUT_MINUTES_SQL}
     FROM plan p
     CROSS JOIN (SELECT $2::timestamptz AS as_of) AS clock
     LEFT JOIN todo_state t ON t.plan_id = p.root_id
     WHERE p.root_id = $1 AND p.use_yn = 'Y'
     GROUP BY p.id`,
    [root, instant],
  ) as (PlanRow & TotalsRow & MissingMinutes)[];
  return row ? { plan: serializePlan(row), ...totals(row), done_without_minutes: row.done_without_minutes, drill: DRILL } : null;
}

const GROUP_SQL = {
  character: {
    columns: "t.character_id, c.name AS character_name",
    join: "LEFT JOIN game_character c ON c.id = t.character_id",
    keys: "t.character_id, c.name, c.sort_order",
    order: "c.sort_order ASC NULLS LAST, t.character_id ASC",
  },
  tag: {
    columns: "tags.tag",
    join: "CROSS JOIN LATERAL (SELECT DISTINCT tag FROM unnest(t.tags) AS item(tag) WHERE tag IS NOT NULL) tags",
    keys: "tags.tag",
    order: "tags.tag ASC",
  },
} as const;

export async function getRetroByGroup(
  sql: SqlClient, planRootId: string, now: Date, group: RetroGroupKind,
): Promise<RetroGroup[]> {
  const root = validateId(planRootId, "plan_id");
  const instant = validateDate(now, "now");
  if (group !== "character" && group !== "tag") {
    throw new ValidationError("group", "Choose character or tag.");
  }
  const { columns, join, keys, order } = GROUP_SQL[group];
  const rows = await sql.query(
    `SELECT ${columns}, ${TOTALS_SQL}, ${DONE_WITHOUT_MINUTES_SQL}
     FROM todo_state t
     JOIN plan p ON p.root_id = t.plan_id AND p.use_yn = 'Y'
     CROSS JOIN (SELECT $2::timestamptz AS as_of) AS clock
     ${join}
     WHERE t.plan_id = $1
     GROUP BY ${keys}
     ORDER BY ${order}`,
    [root, instant],
  );
  if (group === "character") {
    return (rows as (CharacterGroup & TotalsRow & MissingMinutes)[]).map((row) => ({
      group, character_id: row.character_id, character_name: row.character_name,
      ...totals(row), done_without_minutes: row.done_without_minutes,
    }));
  }
  return (rows as ({ tag: string } & TotalsRow & MissingMinutes)[]).map((row) => ({
    group, tag: row.tag, ...totals(row), done_without_minutes: row.done_without_minutes,
  }));
}

export async function listRetroHistory(
  sql: SqlClient,
  { kind, limit = 52, needsImprovement = false }: { kind?: PlanKind; limit?: number; needsImprovement?: boolean },
  now: Date,
): Promise<RetroHistoryRow[]> {
  const period = kind === undefined ? null : validatePlanKind(kind);
  const pageSize = validateRetroHistoryLimit(limit);
  const instant = validateDate(now, "now");
  const rows = await sql.query(
    `SELECT p.*, ${TOTALS_SQL}
     FROM plan p
     CROSS JOIN (SELECT $2::timestamptz AS as_of) AS clock
     LEFT JOIN todo_state t ON t.plan_id = p.root_id
     WHERE p.use_yn = 'Y' AND ($1::text IS NULL OR p.period_kind = $1)
       AND (NOT $4::boolean OR (
         p.ends_at <= as_of AND NOT EXISTS (
           SELECT 1 FROM todo improvement WHERE improvement.source_plan_id = p.root_id AND improvement.use_yn = 'Y'
         )
       ))
     GROUP BY p.id
     ORDER BY p.starts_at DESC, p.id ASC
     LIMIT $3::bigint`,
    [period, instant, pageSize, needsImprovement],
  ) as (PlanRow & TotalsRow)[];
  return rows.map((row) => ({ plan: serializePlan(row), ...totals(row) }));
}

export async function getOverview(sql: SqlClient, planRootIds: string[], now: Date): Promise<OverviewRow[]> {
  validateDate(now, "now");
  const roots = planRootIds.map((id) => validateId(id, "plan_id"));
  const rows = await sql.query(
    `SELECT t.character_id, c.name AS character_name,
       count(*) FILTER (WHERE ${scopes.all})::int AS total_todos,
       count(*) FILTER (WHERE ${scopes.done})::int AS done_todos,
       count(*) FILTER (WHERE ${scopes.open})::int AS remaining_todos,
       COALESCE(sum(
         GREATEST(t.target_count - t.done_n, 0)::bigint *
         round(t.expected_minutes::numeric / t.target_count)::bigint
       ) FILTER (WHERE ${scopes.open}), 0)::bigint AS remaining_minutes
     FROM todo_state t
     JOIN plan p ON p.root_id = t.plan_id AND p.use_yn = 'Y'
     LEFT JOIN game_character c ON c.id = t.character_id
     WHERE t.plan_id = ANY($1::bigint[])
     GROUP BY t.character_id, c.name, c.sort_order
     ORDER BY c.sort_order ASC NULLS LAST, t.character_id ASC`,
    [roots],
  ) as (Omit<OverviewRow, "remaining_minutes"> & { remaining_minutes: string })[];
  return rows.map((row) => ({ ...row, remaining_minutes: safeMinutes(row.remaining_minutes) }));
}
