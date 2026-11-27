import type { NeonQueryFunctionInTransaction } from "@neondatabase/serverless";
import { type SqlClient, violatesConstraint } from "./client";
import { serializeTodo, type TodoState, type TodoStateRow } from "./todos";
import { todaySeoul } from "../lib/time";
import {
  type CompleteTodoInput, type RunDetails, validateCompletion, validateDate, validateId, validateMissReason,
  validateRunDate, validateRunDetails, validateRunMinutes, ValidationError,
} from "../lib/validate";

type RunRow = RunDetails & {
  id: string;
  todo_id: string;
  run_date: string;
  units: number;
  done: boolean;
  use_yn: "Y" | "N";
  created_at: Date;
};

export type Run = Omit<RunRow, "started_at" | "ended_at" | "created_at"> & {
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};
export type CompletionResult = { run: Run; todo: TodoState } | { alreadyDone: true };
export type TodoRunMode = "plain" | "cumulative";

const RUN_MODE_SQL = `
  CASE current_setting('pds.run_target_count', true)
    WHEN '' THEN 'missing'
    WHEN '1' THEN 'plain'
    ELSE 'cumulative'
  END
`;

function lockTodoRunTarget(tx: NeonQueryFunctionInTransaction<false, false>, id: string) {
  return tx`
    SELECT set_config('pds.run_target_count', COALESCE((
      SELECT target_count::text FROM todo WHERE id = ${id} AND use_yn = 'Y' FOR UPDATE
    ), ''), true) AS target_count
  `;
}

function checkRunMode(target: unknown, mode: TodoRunMode | undefined) {
  if (target === "") throw new ValidationError("todo_id", "Choose an active todo.");
  if (mode === "plain" && target !== "1") throw new ValidationError("todo_id", "횟수를 정해서 확정하세요.");
  if (mode === "cumulative" && target === "1") throw new ValidationError("todo_id", "횟수형 할 일만 수정할 수 있습니다.");
}

function serializeRun(row: RunRow): Run {
  return {
    ...row,
    started_at: row.started_at?.toISOString() ?? null,
    ended_at: row.ended_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
  };
}

export async function completeTodo(
  sql: SqlClient, todoId: string, now: Date, input?: CompleteTodoInput, mode?: TodoRunMode,
): Promise<CompletionResult> {
  const id = validateId(todoId, "todo_id");
  const runDate = todaySeoul(validateDate(now, "now"));
  const details = validateCompletion(input);
  try {
    // A separate lock statement gives the upsert a fresh snapshot after a concurrent completion.
    const [[target], [run], [todo]] = await sql.transaction((tx) => [
      lockTodoRunTarget(tx, id),
      tx`
        INSERT INTO run_record (todo_id, run_date, units, actual_minutes, started_at, ended_at)
        SELECT ${id}, ${runDate}, COALESCE(${details.units}::int, 1),
          ${details.actual_minutes}, ${details.started_at}, ${details.ended_at}
        WHERE current_setting('pds.run_target_count', true) <> ''
          AND (${mode ?? null}::text IS NULL OR ${tx.unsafe(RUN_MODE_SQL)} = ${mode ?? null})
          AND (current_setting('pds.run_target_count', true) <> '1' OR (
            COALESCE(${details.units}::int, 1) = 1 AND NOT EXISTS (
              SELECT 1 FROM run_record
              WHERE todo_id = ${id} AND run_date <> ${runDate} AND use_yn = 'Y' AND done
            )
          ))
        ON CONFLICT (todo_id, run_date) WHERE use_yn = 'Y'
        DO UPDATE SET done = true, units = COALESCE(${details.units}::int, run_record.units),
          actual_minutes = COALESCE(EXCLUDED.actual_minutes, run_record.actual_minutes),
          started_at = COALESCE(EXCLUDED.started_at, run_record.started_at),
          ended_at = COALESCE(EXCLUDED.ended_at, run_record.ended_at)
        RETURNING id, todo_id, run_date::text, units, actual_minutes, started_at, ended_at, done, use_yn, created_at
      `,
      tx`SELECT * FROM todo_state WHERE id = ${id}`,
    ], { isolationLevel: "ReadCommitted" });
    checkRunMode(target.target_count, mode);
    if (target.target_count === "1" && details.units !== null && details.units !== 1) {
      throw new ValidationError("units", "Use one unit for this todo.");
    }
    if (!run) return { alreadyDone: true };
    return { run: serializeRun(run as RunRow), todo: serializeTodo(todo as TodoStateRow) };
  } catch (error) {
    if (violatesConstraint(error, "run_record_check")) {
      throw new ValidationError("ended_at", "End must be at or after start.");
    }
    throw error;
  }
}

export async function uncompleteTodo(sql: SqlClient, todoId: string, runDate: string, mode?: TodoRunMode): Promise<boolean> {
  const id = validateId(todoId, "todo_id");
  const day = validateRunDate(runDate);
  if (mode !== undefined) {
    const [[target], rows] = await sql.transaction((tx) => [
      lockTodoRunTarget(tx, id),
      tx`
        UPDATE run_record SET done = false
        WHERE todo_id = ${id} AND run_date = ${day} AND use_yn = 'Y' AND done
          AND ${tx.unsafe(RUN_MODE_SQL)} = ${mode}
        RETURNING id
      `,
    ], { isolationLevel: "ReadCommitted" });
    checkRunMode(target.target_count, mode);
    return rows.length > 0;
  }
  const rows = await sql`
    UPDATE run_record SET done = false
    WHERE todo_id = ${id} AND run_date = ${day} AND use_yn = 'Y' AND done
    RETURNING id
  `;
  return rows.length > 0;
}

export async function setRunMinutes(
  sql: SqlClient, todoId: string, runDate: string, minutes: number | null,
): Promise<Run | null> {
  const id = validateId(todoId, "todo_id");
  const day = validateRunDate(runDate);
  const actualMinutes = validateRunMinutes(minutes);
  const [row] = await sql`
    UPDATE run_record SET actual_minutes = ${actualMinutes}
    WHERE todo_id = ${id} AND run_date = ${day} AND use_yn = 'Y'
    RETURNING id, todo_id, run_date::text, units, actual_minutes, started_at, ended_at, done, use_yn, created_at
  ` as RunRow[];
  return row ? serializeRun(row) : null;
}

export async function setRunDetails(
  sql: SqlClient, todoId: string, runDate: string, input: RunDetails,
): Promise<Run | null> {
  const id = validateId(todoId, "todo_id");
  const day = validateRunDate(runDate);
  const details = validateRunDetails(input);
  const [row] = await sql`
    UPDATE run_record SET actual_minutes = ${details.actual_minutes},
      started_at = ${details.started_at}, ended_at = ${details.ended_at}
    WHERE todo_id = ${id} AND run_date = ${day} AND use_yn = 'Y'
    RETURNING id, todo_id, run_date::text, units, actual_minutes, started_at, ended_at, done, use_yn, created_at
  ` as RunRow[];
  return row ? serializeRun(row) : null;
}

export async function deleteRun(sql: SqlClient, todoId: string, runDate: string): Promise<boolean> {
  const id = validateId(todoId, "todo_id");
  const day = validateRunDate(runDate);
  const rows = await sql`
    UPDATE run_record SET use_yn = 'N'
    WHERE todo_id = ${id} AND run_date = ${day} AND use_yn = 'Y'
    RETURNING id
  `;
  return rows.length > 0;
}

export async function listRuns(sql: SqlClient, todoId: string): Promise<Run[]> {
  const id = validateId(todoId, "todo_id");
  const rows = await sql`
    SELECT id, todo_id, run_date::text, units, actual_minutes, started_at, ended_at, done, use_yn, created_at
    FROM run_record WHERE todo_id = ${id} AND use_yn = 'Y' ORDER BY run_date
  ` as RunRow[];
  return rows.map(serializeRun);
}

export async function setMissReason(sql: SqlClient, todoId: string, reason: string | null): Promise<TodoState | null> {
  const id = validateId(todoId, "todo_id");
  const clean = validateMissReason(reason);
  const [[updated], [state]] = await sql.transaction((tx) => [
    tx`UPDATE todo SET miss_reason = ${clean} WHERE id = ${id} AND use_yn = 'Y' RETURNING id`,
    tx`SELECT * FROM todo_state WHERE id = ${id}`,
  ]);
  return updated && state ? serializeTodo(state as TodoStateRow) : null;
}
