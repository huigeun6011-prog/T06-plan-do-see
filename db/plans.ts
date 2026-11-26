import type { SqlClient } from "./client";
import { formatDeadline, nextPeriod, periodFor, todaySeoul } from "../lib/time";
import {
  type EventPlanInput, type PeriodKind, type PlanEditInput, type PlanFields, type PlanKind,
  validateDate, validateId, validatePeriodKind, validatePlanDates, validatePlanFields,
  validatePlanKind, ValidationError,
} from "../lib/validate";

type PlanRow = PlanFields & {
  id: string;
  root_id: string;
  period_kind: PlanKind;
  starts_at: Date;
  ends_at: Date;
  use_yn: "Y" | "N";
  created_at: Date;
};

export type Plan = Omit<PlanRow, "starts_at" | "ends_at" | "created_at"> & {
  starts_at: string;
  ends_at: string;
  created_at: string;
};
export type PeriodTarget = "current" | "next";
export type PlanEditResult = { id: string } | { conflict: true };

function serialize(row: PlanRow): Plan {
  return {
    ...row,
    starts_at: row.starts_at.toISOString(),
    ends_at: row.ends_at.toISOString(),
    created_at: row.created_at.toISOString(),
  };
}

function periodTitle(kind: PeriodKind, startsAt: Date, endsAt: Date): string {
  const [year, month, day] = todaySeoul(startsAt).split("-").map(Number);
  if (kind === "monthly") return `${year}년 ${month}월 월간`;
  // A midnight deadline is displayed on the last included Seoul day.
  const lastDay = formatDeadline(endsAt).split("(")[0];
  return `${month}/${day}~${lastDay} 주간`;
}

export async function ensurePeriodPlan(
  sql: SqlClient, kind: PeriodKind, now: Date, target: PeriodTarget = "current",
): Promise<Plan> {
  const periodKind = validatePeriodKind(kind);
  const instant = validateDate(now, "now");
  if (target !== "current" && target !== "next") {
    throw new ValidationError("target", "Choose current or next.");
  }
  const { startsAt, endsAt } = target === "current"
    ? periodFor(periodKind, instant)
    : nextPeriod(periodKind, instant);
  const title = periodTitle(periodKind, startsAt, endsAt);
  const successCriteria = "이번 기간의 모든 할 일 완료";

  // Create the first todos from the same registration snapshot as the initial minute total.
  const [inserted] = await sql`
    WITH registrations AS (
      SELECT *, clear_minutes * target_count AS expected_minutes
      FROM entry WHERE use_yn = 'Y' AND period_kind = ${periodKind}
    ), n AS (
      SELECT nextval(pg_get_serial_sequence('plan', 'id')) AS id
    ), new_plan AS (
      INSERT INTO plan (id, root_id, period_kind, title, starts_at, ends_at, success_criteria, expected_minutes)
      SELECT n.id, n.id, ${periodKind}, ${title}, ${startsAt}, ${endsAt}, ${successCriteria},
             (SELECT COALESCE(sum(expected_minutes), 0)::int FROM registrations)
      FROM n
      WHERE NOT EXISTS (
        SELECT 1 FROM plan WHERE period_kind = ${periodKind} AND starts_at = ${startsAt} AND use_yn = 'Y'
      )
      ON CONFLICT (period_kind, starts_at) WHERE use_yn = 'Y' AND period_kind <> 'event'
      DO NOTHING
      RETURNING *
    ), initial_todos AS (
      INSERT INTO todo (plan_id, entry_id, title, note, character_id, due_at, tags, expected_minutes, target_count)
      SELECT p.root_id, e.root_id, e.title, e.memo, e.character_id, p.ends_at, e.tags,
             e.expected_minutes, e.target_count
      FROM new_plan p CROSS JOIN registrations e
      ON CONFLICT (plan_id, entry_id) DO NOTHING
    )
    SELECT * FROM new_plan
  ` as PlanRow[];
  if (inserted) return serialize(inserted);

  // A separate statement sees a concurrent winner that was invisible to the insert's snapshot.
  const [current] = await sql`
    SELECT * FROM plan WHERE period_kind = ${periodKind} AND starts_at = ${startsAt} AND use_yn = 'Y'
  ` as PlanRow[];
  if (!current) throw new Error("Could not find the current period plan.");
  return serialize(current);
}

export async function generateTodos(sql: SqlClient, planRootId: string): Promise<void> {
  const root = validateId(planRootId, "plan_id");
  const [plan] = await sql`
    WITH current_plan AS (
      SELECT root_id, period_kind, ends_at FROM plan WHERE root_id = ${root} AND use_yn = 'Y'
    ), generated AS (
      INSERT INTO todo (plan_id, entry_id, title, note, character_id, due_at, tags, expected_minutes, target_count)
      SELECT p.root_id, e.root_id, e.title, e.memo, e.character_id, p.ends_at, e.tags,
             e.clear_minutes * e.target_count, e.target_count
      FROM current_plan p JOIN entry e ON e.period_kind = p.period_kind
      WHERE p.period_kind <> 'event' AND e.use_yn = 'Y'
      ON CONFLICT (plan_id, entry_id) DO NOTHING
    )
    SELECT period_kind FROM current_plan
  `;
  if (!plan) throw new ValidationError("plan_id", "Choose a current plan.");
  if (plan.period_kind === "event") {
    throw new ValidationError("plan_id", "Event plans do not generate todos.");
  }
}

export async function ensureCurrentPlans(sql: SqlClient, now: Date): Promise<{ weekly: Plan; monthly: Plan }> {
  const [weekly, monthly] = await Promise.all([
    ensurePeriodPlan(sql, "weekly", now),
    ensurePeriodPlan(sql, "monthly", now),
  ]);
  await Promise.all([generateTodos(sql, weekly.root_id), generateTodos(sql, monthly.root_id)]);
  return { weekly, monthly };
}

export async function createEventPlan(sql: SqlClient, input: EventPlanInput): Promise<Plan> {
  const plan = validatePlanFields(input);
  const { starts_at, ends_at } = validatePlanDates(input.starts_at, input.ends_at);
  const [row] = await sql`
    WITH n AS (SELECT nextval(pg_get_serial_sequence('plan', 'id')) AS id)
    INSERT INTO plan (id, root_id, period_kind, title, starts_at, ends_at, priority, success_criteria, expected_minutes)
    SELECT n.id, n.id, 'event', ${plan.title}, ${starts_at}, ${ends_at},
           ${plan.priority}, ${plan.success_criteria}, ${plan.expected_minutes}
    FROM n
    RETURNING *
  ` as PlanRow[];
  return serialize(row);
}

export async function editPlan(
  sql: SqlClient, rootId: string, expectedVersionId: string, input: PlanEditInput,
): Promise<PlanEditResult> {
  const root = validateId(rootId, "root_id");
  const version = validateId(expectedVersionId, "id");
  const plan = validatePlanFields(input);
  const current = await getPlan(sql, root);
  if (!current || current.id !== version) return { conflict: true };

  const { starts_at, ends_at } = validatePlanDates(
    input.starts_at === undefined ? new Date(current.starts_at) : input.starts_at,
    input.ends_at === undefined ? new Date(current.ends_at) : input.ends_at,
  );
  if (current.period_kind !== "event") {
    if (starts_at.toISOString() !== current.starts_at) {
      throw new ValidationError("starts_at", "Keep the start of a recurring plan.");
    }
    if (ends_at.toISOString() !== current.ends_at) {
      throw new ValidationError("ends_at", "Keep the end of a recurring plan.");
    }
  }

  const [, inserted] = await sql.transaction((tx) => [
    tx`
      WITH retired AS (
        UPDATE plan SET use_yn = 'N'
        WHERE root_id = ${root} AND id = ${version} AND use_yn = 'Y'
        RETURNING id
      )
      SELECT set_config('pds.plan_retired', (SELECT count(*)::text FROM retired), true)
    `,
    tx`
      INSERT INTO plan (root_id, period_kind, title, starts_at, ends_at, priority, success_criteria, expected_minutes)
      SELECT ${root}, ${current.period_kind}, ${plan.title}, ${starts_at}, ${ends_at}, ${plan.priority},
             ${plan.success_criteria}, ${plan.expected_minutes}
      WHERE current_setting('pds.plan_retired', true) = '1'
        AND NOT EXISTS (SELECT 1 FROM plan WHERE root_id = ${root} AND use_yn = 'Y')
      RETURNING id
    `,
  ]);
  const [row] = inserted as { id: string }[];
  return row ? { id: row.id } : { conflict: true };
}

export async function getPlan(sql: SqlClient, rootId: string): Promise<Plan | null> {
  const root = validateId(rootId, "root_id");
  const [row] = await sql`SELECT * FROM plan WHERE root_id = ${root} AND use_yn = 'Y'` as PlanRow[];
  return row ? serialize(row) : null;
}

export async function getPlanHistory(sql: SqlClient, rootId: string): Promise<Plan[]> {
  const root = validateId(rootId, "root_id");
  const rows = await sql`SELECT * FROM plan WHERE root_id = ${root} ORDER BY id` as PlanRow[];
  return rows.map(serialize);
}

export async function listPlans(
  sql: SqlClient, filters: { kind?: PlanKind; endedBefore?: Date } = {},
): Promise<Plan[]> {
  const kind = filters.kind === undefined ? null : validatePlanKind(filters.kind);
  const endedBefore = filters.endedBefore === undefined ? null : validateDate(filters.endedBefore, "endedBefore");
  const rows = await sql`
    SELECT * FROM plan
    WHERE use_yn = 'Y'
      AND (${kind}::text IS NULL OR period_kind = ${kind})
      AND (${endedBefore}::timestamptz IS NULL OR ends_at < ${endedBefore})
    ORDER BY starts_at DESC, id
  ` as PlanRow[];
  return rows.map(serialize);
}
