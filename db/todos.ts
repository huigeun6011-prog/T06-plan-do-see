import { type SqlClient, violatesConstraint } from "./client";
import { type TodoInput, validateId, validateTodo, ValidationError } from "../lib/validate";

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
    return { ...row, due_at: row.due_at.toISOString(), created_at: row.created_at.toISOString() };
  } catch (error) {
    if (violatesConstraint(error, "todo_character_id_fkey")) {
      throw new ValidationError("character_id", "Choose an existing character.");
    }
    throw error;
  }
}
