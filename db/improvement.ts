import type { SqlClient } from "./client";
import { ensureCurrentPlans, ensurePeriodPlan, generateTodos, getPlan, serializePlan, type Plan, type PlanRow } from "./plans";
import { listRetroHistory, type RetroHistoryRow } from "./retro";
import { serializeTodo, type Todo, type TodoRow, type TodoState, type TodoStateRow } from "./todos";
import { validateDate, validateId, validateImprovementText, ValidationError } from "../lib/validate";

export type SavedImprovement = { todo: Todo; target_plan: Plan };
export type Improvement = { todo: TodoState; target_plan: Pick<Plan, "id" | "title" | "starts_at"> };

async function ensureTarget(sql: SqlClient, source: Plan, now: Date): Promise<Plan> {
  if (source.period_kind === "event") {
    return (await ensureCurrentPlans(sql, now)).weekly;
  }
  const target = await ensurePeriodPlan(sql, source.period_kind, new Date(source.ends_at), "current");
  await generateTodos(sql, target.root_id);
  return target;
}

export async function saveImprovement(
  sql: SqlClient, planRootId: string, text: string, now: Date,
): Promise<SavedImprovement> {
  const root = validateId(planRootId, "plan_id");
  const title = validateImprovementText(text);
  const instant = validateDate(now, "now");
  const source = await getPlan(sql, root);
  if (!source) throw new ValidationError("plan_id", "Choose a current source plan.");
  const target = await ensureTarget(sql, source, instant);
  const [row] = await sql`
    INSERT INTO todo (plan_id, source_plan_id, title, tags, due_at, expected_minutes, target_count)
    SELECT target.root_id, source.root_id, ${title}, ${["improvement"]}, target.ends_at, 0, 1
    FROM plan source CROSS JOIN plan target
    WHERE source.root_id = ${root} AND source.use_yn = 'Y'
      AND target.root_id = ${target.root_id} AND target.use_yn = 'Y'
    ON CONFLICT (source_plan_id) WHERE source_plan_id IS NOT NULL AND use_yn = 'Y'
    DO UPDATE SET title = EXCLUDED.title
    RETURNING *
  ` as TodoRow[];
  if (!row) throw new ValidationError("plan_id", "Choose a current source and target plan.");

  // An event can be edited in a later week. Return the plan the upsert actually kept.
  const [linkedPlan] = await sql`
    SELECT * FROM plan WHERE root_id = ${row.plan_id} AND (use_yn = 'Y' OR id = root_id)
    ORDER BY (use_yn = 'Y') DESC
    LIMIT 1
  ` as PlanRow[];
  return { todo: serializeTodo(row), target_plan: serializePlan(linkedPlan) };
}

export async function getImprovement(sql: SqlClient, planRootId: string): Promise<Improvement | null> {
  const root = validateId(planRootId, "plan_id");
  const [row] = await sql`
    SELECT t.*, original.id AS target_id, COALESCE(p.title, original.title) AS target_title,
      COALESCE(p.starts_at, original.starts_at) AS target_start
    FROM todo_state t
    JOIN plan original ON original.id = t.plan_id
    LEFT JOIN plan p ON p.root_id = t.plan_id AND p.use_yn = 'Y'
    WHERE t.source_plan_id = ${root}
  ` as (TodoStateRow & { target_id: string; target_title: string; target_start: Date })[];
  if (!row) return null;
  const { target_id, target_title, target_start, ...todo } = row;
  return {
    todo: serializeTodo(todo),
    target_plan: { id: target_id, title: target_title, starts_at: target_start.toISOString() },
  };
}

export async function removeImprovement(sql: SqlClient, planRootId: string): Promise<boolean> {
  const root = validateId(planRootId, "plan_id");
  const rows = await sql`
    UPDATE todo SET use_yn = 'N' WHERE source_plan_id = ${root} AND use_yn = 'Y' RETURNING id
  `;
  return rows.length > 0;
}

export function listPlansNeedingRetro(sql: SqlClient, now: Date, limit = 10): Promise<RetroHistoryRow[]> {
  return listRetroHistory(sql, { limit, needsImprovement: true }, now);
}
