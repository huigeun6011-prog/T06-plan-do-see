import { type SqlClient, violatesConstraint } from "./client";
import { ensureCurrentPlans, type Plan } from "./plans";
import { type TodoSort, validateTodoSort } from "../lib/todo-sort";
import {
  type TodoInput, type TodoPatch, validateDate, validateId, validateTodo, validateTodoPage,
  validateTodoPatch, validateTodoPriority, validateTodoTag, ValidationError,
} from "../lib/validate";

type TodoRow = Omit<ReturnType<typeof validateTodo>, "due_at"> & {
  id: string;
  plan_id: string;
  entry_id: string | null;
  source_plan_id: string | null;
  due_at: Date;
  miss_reason: string | null;
  use_yn: "Y" | "N";
  created_at: Date;
};
export type Todo = Omit<TodoRow, "due_at" | "created_at"> & { due_at: string; created_at: string };
type TodoProgress = { done_n: number; actual_minutes: number; blocked: boolean; is_done: boolean };
export type TodoStateRow = TodoRow & TodoProgress;
export type TodoState = Todo & TodoProgress;

export const TODO_SCOPE_PREDICATES = Object.freeze({
  all: "TRUE",
  open: "NOT is_done",
  done: "is_done",
  late: "NOT is_done AND due_at <= as_of",
  blocked: "blocked",
});

export type TodoScope = keyof typeof TODO_SCOPE_PREDICATES;
export type TodoQuery = {
  planRootId?: string;
  characterId?: string | null;
  tag?: string;
  priority?: number;
  scope?: TodoScope;
  q?: string;
  sort?: TodoSort;
  limit?: number;
  offset?: number;
};

type WeekPlan = { plan: Plan; todos: TodoState[] };
export type WeekView = { weekly: WeekPlan; monthly: WeekPlan };

export function serializeTodo<Row extends TodoRow>(row: Row) {
  const { due_at, created_at, ...fields } = row;
  return { ...fields, due_at: due_at.toISOString(), created_at: created_at.toISOString() };
}

function throwTodoError(error: unknown): never {
  if (violatesConstraint(error, "todo_character_id_fkey")) {
    throw new ValidationError("character_id", "Choose an existing character.");
  }
  throw error;
}

export async function createTodo(sql: SqlClient, planRootId: string, input: TodoInput): Promise<Todo> {
  const root = validateId(planRootId, "plan_id");
  const todo = validateTodo(input);
  try {
    const [row] = await sql`
      INSERT INTO todo (plan_id, title, note, character_id, due_at, priority, tags, expected_minutes, target_count)
      SELECT root_id, ${todo.title}, ${todo.note}, ${todo.character_id},
             COALESCE(${todo.due_at}::timestamptz, ends_at), ${todo.priority},
             ${todo.tags}, ${todo.expected_minutes}, ${todo.target_count}
      FROM plan WHERE root_id = ${root} AND use_yn = 'Y'
      RETURNING *
    ` as TodoRow[];
    if (!row) throw new ValidationError("plan_id", "Choose a current plan.");
    return serializeTodo(row);
  } catch (error) {
    throwTodoError(error);
  }
}

export async function getTodo(sql: SqlClient, id: string): Promise<TodoState | null> {
  const todoId = validateId(id, "id");
  const [row] = await sql`SELECT * FROM todo_state WHERE id = ${todoId}` as TodoStateRow[];
  return row ? serializeTodo(row) : null;
}

export async function updateTodo(sql: SqlClient, id: string, patch: TodoPatch): Promise<Todo | null> {
  const todoId = validateId(id, "id");
  const fields = validateTodoPatch(patch);
  const assignments = fields.map(([column], index) => `${column} = $${index + 2}`);
  try {
    const [row] = await sql.query(
      `UPDATE todo SET ${assignments.join(", ")} WHERE id = $1 AND use_yn = 'Y' RETURNING *`,
      [todoId, ...fields.map(([, value]) => value)],
    ) as TodoRow[];
    return row ? serializeTodo(row) : null;
  } catch (error) {
    throwTodoError(error);
  }
}

export async function deleteTodo(sql: SqlClient, id: string): Promise<boolean> {
  const todoId = validateId(id, "id");
  const rows = await sql`
    UPDATE todo SET use_yn = 'N' WHERE id = ${todoId} AND use_yn = 'Y' RETURNING id
  `;
  return rows.length > 0;
}

export async function listTodos(sql: SqlClient, query: TodoQuery, now: Date): Promise<TodoState[]> {
  const {
    planRootId, characterId, tag, priority, scope = "all", q = "",
    sort = { key: "due_at", direction: "asc" }, limit = 500, offset = 0,
  } = query;
  const order = validateTodoSort(sort);
  if (typeof scope !== "string" || !Object.hasOwn(TODO_SCOPE_PREDICATES, scope)) {
    throw new ValidationError("scope", "Choose a supported todo scope.");
  }
  if (typeof q !== "string" || q.includes("\0")) {
    throw new ValidationError("q", "Use a text search.");
  }
  const instant = validateDate(now, "now");
  const plan = planRootId === undefined ? null : validateId(planRootId, "plan_id");
  const character = characterId == null ? null : validateId(characterId, "character_id");
  const cleanTag = tag === undefined ? null : validateTodoTag(tag);
  const cleanPriority = priority === undefined ? null : validateTodoPriority(priority);
  const page = validateTodoPage(limit, offset);
  const direction = order.direction === "asc" ? "ASC" : "DESC";
  const rows = await sql.query(
    `SELECT t.* FROM todo_state t
     CROSS JOIN (SELECT $2::timestamptz AS as_of) AS clock
     WHERE ($1::bigint IS NULL OR plan_id = $1)
       AND ($3::boolean OR character_id IS NOT DISTINCT FROM $4::bigint)
       AND ($5::text IS NULL OR $5 = ANY(tags))
       AND ($6::smallint IS NULL OR priority = $6)
       AND ($7::text = '' OR strpos(lower(title), lower($7)) > 0 OR strpos(lower(note), lower($7)) > 0)
       AND (${TODO_SCOPE_PREDICATES[scope]})
     ORDER BY ${order.key} ${direction}, id ASC
     LIMIT $8::int OFFSET $9::bigint`,
    [plan, instant, characterId === undefined, character, cleanTag, cleanPriority, q, page.limit, page.offset],
  ) as TodoStateRow[];
  return rows.map(serializeTodo);
}

export async function listWeekView(sql: SqlClient, now: Date): Promise<WeekView> {
  const { weekly, monthly } = await ensureCurrentPlans(sql, now);
  const rows = await sql`
    SELECT t.* FROM todo_state t
    LEFT JOIN entry current_entry ON current_entry.root_id = t.entry_id AND current_entry.use_yn = 'Y'
    LEFT JOIN entry original_entry ON original_entry.id = t.entry_id
    WHERE t.plan_id IN (${weekly.root_id}, ${monthly.root_id})
    ORDER BY t.due_at ASC, COALESCE(current_entry.sort_order, original_entry.sort_order, 0) ASC, t.id ASC
  ` as TodoStateRow[];
  return {
    weekly: { plan: weekly, todos: rows.filter((row) => row.plan_id === weekly.root_id).map(serializeTodo) },
    monthly: { plan: monthly, todos: rows.filter((row) => row.plan_id === monthly.root_id).map(serializeTodo) },
  };
}
