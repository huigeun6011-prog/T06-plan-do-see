import { describe, expect, it } from "vitest";
import { createEntry, getEntryHistory } from "../db/entries";
import { createEventPlan, ensureCurrentPlans, getPlan } from "../db/plans";
import { completeTodo, deleteRun, listRuns, setMissReason, setRunDetails, uncompleteTodo, type CompletionResult } from "../db/runs";
import { createTodo, deleteTodo, getTodo, listTodos } from "../db/todos";
import { useTestDatabase } from "./helpers/db";

const dayOne = new Date("2026-11-25T15:00:00Z");
const runDate = "2026-11-26";
const day = (offset: number) => new Date(dayOne.getTime() + offset * 86_400_000);
const started = new Date("2026-11-25T16:00:00Z");
const ended = new Date("2026-11-25T16:12:00Z");

function saved(result: CompletionResult) {
  if ("alreadyDone" in result) throw new Error("Expected to save a run.");
  return result;
}

describe("run records", () => {
  const sql = useTestDatabase();
  const event = () => createEventPlan(sql, {
    title: "Event", starts_at: dayOne, ends_at: day(10), priority: 2,
    success_criteria: "Finish", expected_minutes: 60,
  });
  async function makeTodo(target_count = 1) {
    const plan = await event();
    return createTodo(sql, plan.root_id, { title: "Task", expected_minutes: 40, target_count });
  }

  it("coalesces parallel and sequential completion into one row on the Seoul date", async () => {
    const todo = await makeTodo();
    const [first, second] = await Promise.all([
      completeTodo(sql, todo.id, dayOne), completeTodo(sql, todo.id, dayOne),
    ]);
    const result = saved(first);
    expect(second).toEqual(result);
    expect(result.run).toMatchObject({
      id: expect.any(String), todo_id: todo.id, run_date: runDate, units: 1,
      actual_minutes: null, started_at: null, ended_at: null, done: true,
    });
    expect(new Date(result.run.created_at).toISOString()).toBe(result.run.created_at);
    expect(result.todo).toMatchObject({ done_n: 1, actual_minutes: 0, is_done: true });
    await expect(completeTodo(sql, todo.id, dayOne)).resolves.toEqual(result);
    await expect(listRuns(sql, todo.id)).resolves.toEqual([result.run]);
  });

  it("accumulates six distinct days before completing the target and allows overshoot", async () => {
    const todo = await makeTodo(6);
    for (let offset = 0; offset < 6; offset++) {
      const result = saved(await completeTodo(sql, todo.id, day(offset)));
      expect(result.todo).toMatchObject({ done_n: offset + 1, is_done: offset === 5 });
      if (offset === 0) await expect(completeTodo(sql, todo.id, day(offset))).resolves.toEqual(result);
    }
    const runs = await listRuns(sql, todo.id);
    expect(runs.map(({ run_date }) => run_date)).toEqual([
      "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01",
    ]);
    const result = saved(await completeTodo(sql, todo.id, day(6), { units: 3 }));
    expect(result.todo).toMatchObject({ done_n: 9, is_done: true });
  });

  it("sets units for the day and uses the new value on a repeat", async () => {
    const todo = await makeTodo(6);
    const first = await completeTodo(sql, todo.id, dayOne, { units: 3 });
    expect(saved(first).todo).toMatchObject({ done_n: 3, is_done: false });
    await expect(completeTodo(sql, todo.id, dayOne, { units: 3 })).resolves.toEqual(first);
    await expect(completeTodo(sql, todo.id, dayOne)).resolves.toEqual(first);
    const bigger = saved(await completeTodo(sql, todo.id, dayOne, { units: 1000 }));
    expect(bigger.todo).toMatchObject({ done_n: 1000, is_done: true });
    expect(bigger.run.id).toBe(saved(first).run.id);
    const added = saved(await completeTodo(sql, todo.id, day(1)));
    expect(added.run.units).toBe(1);
    expect(added.todo.done_n).toBe(1001);
  });

  it("preserves minutes and times on re-completion and supports editing or clearing details", async () => {
    const todo = await makeTodo();
    const result = saved(await completeTodo(sql, todo.id, dayOne, {
      actual_minutes: 12, started_at: started, ended_at: ended,
    }));
    expect(result.run).toMatchObject({
      actual_minutes: 12, started_at: started.toISOString(), ended_at: ended.toISOString(),
    });
    await expect(uncompleteTodo(sql, todo.id, runDate)).resolves.toBe(true);
    await expect(uncompleteTodo(sql, todo.id, runDate)).resolves.toBe(false);
    await expect(listRuns(sql, todo.id)).resolves.toEqual([{ ...result.run, done: false }]);
    await expect(getTodo(sql, todo.id)).resolves.toMatchObject({ done_n: 0, actual_minutes: 0, is_done: false });
    const actualTotal = () => sql`
      SELECT COALESCE(sum(actual_minutes), 0)::int AS actual_minutes
      FROM todo_state WHERE plan_id = ${todo.plan_id}
    `;
    await expect(actualTotal()).resolves.toEqual([{ actual_minutes: 0 }]);
    await expect(completeTodo(sql, todo.id, dayOne)).resolves.toEqual(result);
    await expect(actualTotal()).resolves.toEqual([{ actual_minutes: 12 }]);
    const updated = saved(await completeTodo(sql, todo.id, dayOne, { actual_minutes: 0, ended_at: null }));
    expect(updated.run).toEqual({ ...result.run, actual_minutes: 0 });
    await expect(completeTodo(sql, todo.id, dayOne, { started_at: day(1) }))
      .rejects.toMatchObject({ field: "ended_at" });
    await expect(listRuns(sql, todo.id)).resolves.toEqual([updated.run]);

    await expect(setRunDetails(sql, todo.id, runDate, {
      actual_minutes: 10000, started_at: ended, ended_at: ended,
    })).resolves.toMatchObject({ actual_minutes: 10000, started_at: ended.toISOString(), done: true });
    const clear = { actual_minutes: null, started_at: null, ended_at: null };
    await expect(setRunDetails(sql, todo.id, runDate, clear)).resolves.toMatchObject({
      ...clear, id: result.run.id, done: true,
    });
    await expect(setRunDetails(sql, todo.id, "2028-02-29", clear)).resolves.toBeNull();
    await expect(getTodo(sql, todo.id)).resolves.toMatchObject({ done_n: 1, actual_minutes: 0 });
  });

  it("rejects invalid run details and dates", async () => {
    const todo = await makeTodo(6);
    for (const units of [0, 1001, 1.5]) {
      await expect(completeTodo(sql, todo.id, dayOne, { units })).rejects.toMatchObject({ field: "units" });
    }
    for (const actual_minutes of [-1, 10001, 1.5]) {
      await expect(completeTodo(sql, todo.id, dayOne, { actual_minutes }))
        .rejects.toMatchObject({ field: "actual_minutes" });
    }
    await expect(completeTodo(sql, todo.id, new Date(NaN))).rejects.toMatchObject({ field: "now" });
    await expect(completeTodo(sql, todo.id, dayOne, { started_at: new Date(NaN) }))
      .rejects.toMatchObject({ field: "started_at" });
    await expect(completeTodo(sql, todo.id, dayOne, { started_at: ended, ended_at: started }))
      .rejects.toMatchObject({ field: "ended_at" });
    await expect(setRunDetails(sql, todo.id, runDate, { actual_minutes: null, started_at: ended, ended_at: started }))
      .rejects.toMatchObject({ field: "ended_at" });
    await expect(deleteRun(sql, todo.id, "2026-02-29")).rejects.toMatchObject({ field: "run_date" });
    await expect(uncompleteTodo(sql, todo.id, "2026-1-1")).rejects.toMatchObject({ field: "run_date" });
    await expect(listRuns(sql, todo.id)).resolves.toEqual([]);
  });

  it("allows only one completed day for target one, even with concurrent requests on different dates", async () => {
    const todo = await makeTodo();
    await expect(completeTodo(sql, todo.id, dayOne, { units: 2 })).rejects.toMatchObject({ field: "units" });
    const first = saved(await completeTodo(sql, todo.id, dayOne));
    await expect(completeTodo(sql, todo.id, day(1), { actual_minutes: 30 })).resolves.toEqual({ alreadyDone: true });
    await expect(listRuns(sql, todo.id)).resolves.toEqual([first.run]);

    const parallel = await makeTodo();
    const results = await Promise.all([
      completeTodo(sql, parallel.id, dayOne), completeTodo(sql, parallel.id, day(1)),
    ]);
    expect(results.filter((result) => "alreadyDone" in result)).toEqual([{ alreadyDone: true }]);
    const runs = await listRuns(sql, parallel.id);
    expect(runs).toHaveLength(1);
    expect(results).toContainEqual(expect.objectContaining({ run: runs[0] }));
  });

  it("soft-deletes a run, frees the day and rejects completion for an inactive todo", async () => {
    const todo = await makeTodo();
    const original = saved(await completeTodo(sql, todo.id, dayOne));
    await expect(deleteRun(sql, todo.id, runDate)).resolves.toBe(true);
    await expect(deleteRun(sql, todo.id, runDate)).resolves.toBe(false);
    await expect(listRuns(sql, todo.id)).resolves.toEqual([]);
    await expect(getTodo(sql, todo.id)).resolves.toMatchObject({ done_n: 0, is_done: false });
    const fresh = saved(await completeTodo(sql, todo.id, dayOne));
    expect(fresh.run.id).not.toBe(original.run.id);
    await deleteTodo(sql, todo.id);
    await expect(completeTodo(sql, todo.id, day(1))).rejects.toMatchObject({ field: "todo_id" });
    await expect(completeTodo(sql, "99999", dayOne)).rejects.toMatchObject({ field: "todo_id" });
    await expect(listRuns(sql, todo.id)).resolves.toEqual([fresh.run]);
  });

  it("leaves plan values, the generated todo snapshot and the registration intact", async () => {
    const entry = await createEntry(sql, {
      title: "Snapshot", period_kind: "weekly", clear_minutes: 10, reward_meso: 0, party_size: 1, target_count: 3,
      tags: ["mission"],
    });
    const { weekly } = await ensureCurrentPlans(sql, dayOne);
    const [todo] = await listTodos(sql, { planRootId: weekly.root_id }, dayOne);
    await completeTodo(sql, todo.id, dayOne, { units: 3, actual_minutes: 22 });
    await uncompleteTodo(sql, todo.id, runDate);
    await setRunDetails(sql, todo.id, runDate, { actual_minutes: 30, started_at: started, ended_at: ended });
    await deleteRun(sql, todo.id, runDate);
    await expect(getTodo(sql, todo.id)).resolves.toEqual(todo);
    await expect(getPlan(sql, weekly.root_id)).resolves.toEqual(weekly);
    await expect(getEntryHistory(sql, entry.root_id)).resolves.toEqual([entry]);
  });

  it("trims, clears and preserves plain-text miss reasons, matching the blocked count", async () => {
    const todo = await makeTodo();
    const reason = "<script>alert('test')</script>";
    await expect(setMissReason(sql, todo.id, `  ${reason}  `)).resolves.toMatchObject({
      miss_reason: reason, blocked: true,
    });
    await expect(getTodo(sql, todo.id)).resolves.toMatchObject({ miss_reason: reason });
    await expect(setMissReason(sql, todo.id, "   ")).resolves.toMatchObject({ miss_reason: null, blocked: false });
    await expect(setMissReason(sql, todo.id, null)).resolves.toMatchObject({ miss_reason: null, blocked: false });
    await expect(setMissReason(sql, todo.id, ` ${"가".repeat(200)} `)).resolves.toMatchObject({ blocked: true });
    await expect(setMissReason(sql, todo.id, "가".repeat(201))).rejects.toMatchObject({ field: "miss_reason" });
    await expect(setMissReason(sql, "99999", "missing")).resolves.toBeNull();
    const inactive = await makeTodo();
    await setMissReason(sql, inactive.id, reason);
    await deleteTodo(sql, inactive.id);
    await expect(setMissReason(sql, inactive.id, null)).resolves.toBeNull();
    const [aggregate] = await sql`SELECT count(*)::int AS count FROM todo_state WHERE blocked`;
    const blocked = await listTodos(sql, { scope: "blocked" }, dayOne);
    expect(blocked).toHaveLength(aggregate.count);
    expect(blocked.map(({ id }) => id)).toEqual([todo.id]);
  });

  it("matches separate done, open and late counts after run changes", async () => {
    const plan = await event();
    const add = (title: string, due_at = dayOne) =>
      createTodo(sql, plan.root_id, { title, due_at, expected_minutes: 0 });
    const done = await add("Done");
    const undone = await add("Undone");
    const removed = await add("Removed", day(1));
    const countDone = async () => {
      const [row] = await sql`SELECT count(*)::int AS count FROM todo_state WHERE plan_id = ${plan.root_id} AND is_done`;
      return row.count;
    };
    const before = await countDone();
    await completeTodo(sql, done.id, dayOne);
    await completeTodo(sql, done.id, dayOne);
    expect(await countDone()).toBe(before + 1);
    await completeTodo(sql, undone.id, dayOne);
    await uncompleteTodo(sql, undone.id, runDate);
    await completeTodo(sql, removed.id, dayOne);
    await deleteRun(sql, removed.id, runDate);
    const [counts] = await sql`
      SELECT count(*) FILTER (WHERE is_done)::int AS done,
        count(*) FILTER (WHERE NOT is_done)::int AS open,
        count(*) FILTER (WHERE NOT is_done AND due_at <= ${dayOne})::int AS late
      FROM todo_state WHERE plan_id = ${plan.root_id}
    `;
    const expected = { done: [done.id], open: [undone.id, removed.id], late: [undone.id] };
    for (const scope of ["done", "open", "late"] as const) {
      const result = await listTodos(sql, { planRootId: plan.root_id, scope }, dayOne);
      expect(result).toHaveLength(counts[scope]);
      expect(result.map(({ id }) => id)).toEqual(expected[scope]);
    }
  });
});
