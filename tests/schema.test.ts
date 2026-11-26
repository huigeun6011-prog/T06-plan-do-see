import { describe, expect, it } from "vitest";
import { useTestDatabase } from "./helpers/db";

const START = "2026-11-25T15:00:00.000Z";
const END = "2026-12-02T15:00:00.000Z";
const RUN_DATE = "2026-11-26";

describe("core schema on the test branch", () => {
  const sql = useTestDatabase();

  async function insertEntry(clearMinutes = 5, tags: string[] = []) {
    const [entry] = await sql`
      WITH n AS (SELECT nextval(pg_get_serial_sequence('entry', 'id')) AS id)
      INSERT INTO entry (id, root_id, title, period_kind, clear_minutes, tags)
      SELECT n.id, n.id, ${"Registration"}, 'weekly', ${clearMinutes}, ${tags}::text[]
      FROM n
      RETURNING id, root_id, tags
    `;
    return entry;
  }

  async function insertPlan(kind: "weekly" | "event" = "event") {
    const [plan] = await sql`
      WITH n AS (SELECT nextval(pg_get_serial_sequence('plan', 'id')) AS id)
      INSERT INTO plan (id, root_id, period_kind, starts_at, ends_at, success_criteria)
      SELECT n.id, n.id, ${kind}, ${START}::timestamptz, ${END}::timestamptz, ${"Finish"}
      FROM n
      RETURNING id, root_id, starts_at
    `;
    return plan;
  }

  async function insertTodo() {
    const plan = await insertPlan();
    const [todo] = await sql`
      INSERT INTO todo (plan_id, title, due_at, target_count, miss_reason)
      VALUES (${plan.id}, ${"Hunt"}, ${END}, ${3}, ${"Missed a day"})
      RETURNING id
    `;
    return todo;
  }

  it("accepts self-referencing roots in one insert for plans and entries", async () => {
    const plan = await insertPlan();
    const entry = await insertEntry();
    expect(typeof plan.id).toBe("string");
    expect(typeof entry.id).toBe("string");
    expect(plan.root_id).toBe(plan.id);
    expect(entry.root_id).toBe(entry.id);
  });

  it("rejects zero clear minutes", async () => {
    await expect(insertEntry(0)).rejects.toMatchObject({ code: "23514" });
  });

  it("rejects two current versions of the same registration", async () => {
    const { id } = await insertEntry();
    await expect(sql`
      INSERT INTO entry (root_id, title, period_kind, clear_minutes)
      VALUES (${id}, ${"Edited registration"}, 'weekly', ${10})
    `).rejects.toMatchObject({ code: "23505", constraint: "entry_one_current" });
  });

  it("rejects two current versions of the same plan", async () => {
    const { id } = await insertPlan();
    await expect(sql`
      INSERT INTO plan (root_id, period_kind, starts_at, ends_at, success_criteria)
      VALUES (${id}, 'event', ${START}, ${END}, ${"Edited criteria"})
    `).rejects.toMatchObject({ code: "23505", constraint: "plan_one_current" });
  });

  it("enforces one weekly plan per start and permits overlapping events", async () => {
    await insertPlan("weekly");
    await expect(insertPlan("weekly")).rejects.toMatchObject({
      code: "23505",
      constraint: "plan_one_per_period",
    });
    const first = await insertPlan();
    const second = await insertPlan();
    expect(first.id).not.toBe(second.id);
    expect(first.starts_at).toEqual(second.starts_at);
  });

  it("supports DO NOTHING using the recurring plan index", async () => {
    await insertPlan("weekly");
    await expect(sql`
      WITH n AS (SELECT nextval(pg_get_serial_sequence('plan', 'id')) AS id)
      INSERT INTO plan (id, root_id, period_kind, starts_at, ends_at, success_criteria)
      SELECT n.id, n.id, 'weekly', ${START}::timestamptz, ${END}::timestamptz, ${"Finish"}
      FROM n
      ON CONFLICT (period_kind, starts_at) WHERE use_yn = 'Y' AND period_kind <> 'event'
      DO NOTHING
      RETURNING id
    `).resolves.toEqual([]);
  });

  it("blocks a second current run for the day and permits one after soft deletion", async () => {
    const todo = await insertTodo();
    const insert = () => sql`
      INSERT INTO run_record (todo_id, run_date)
      VALUES (${todo.id}, ${RUN_DATE})
      RETURNING id
    `;
    const [first] = await insert();
    await expect(insert()).rejects.toMatchObject({ code: "23505", constraint: "run_one_per_day" });
    await sql`UPDATE run_record SET use_yn = 'N' WHERE id = ${first.id}`;
    const [second] = await insert();
    expect(second.id).not.toBe(first.id);
  });

  it("sets units on conflict, keeps minutes and derives todo state from current runs", async () => {
    const todo = await insertTodo();
    const [original] = await sql`
      INSERT INTO run_record (todo_id, run_date, units, actual_minutes, done)
      VALUES (${todo.id}, ${RUN_DATE}, ${2}, ${15}, false)
      RETURNING id
    `;
    await sql`
      INSERT INTO run_record (todo_id, run_date, units, actual_minutes, use_yn)
      VALUES (${todo.id}, ${RUN_DATE}, ${8}, ${90}, 'N')
    `;
    const readState = () => sql`
      SELECT done_n, actual_minutes, blocked, is_done FROM todo_state WHERE id = ${todo.id}
    `;
    await expect(readState()).resolves.toEqual([
      { done_n: 0, actual_minutes: 0, blocked: true, is_done: false },
    ]);
    const complete = () => sql`
      INSERT INTO run_record (todo_id, run_date, units)
      VALUES (${todo.id}, ${RUN_DATE}, ${3})
      ON CONFLICT (todo_id, run_date) WHERE use_yn = 'Y'
      DO UPDATE SET done = true, units = EXCLUDED.units
      RETURNING id, units, actual_minutes, done
    `;
    const saved = [{ id: original.id, units: 3, actual_minutes: 15, done: true }];
    await expect(complete()).resolves.toEqual(saved);
    await expect(complete()).resolves.toEqual(saved);
    await expect(readState()).resolves.toEqual([
      { done_n: 3, actual_minutes: 15, blocked: true, is_done: true },
    ]);
    await sql`UPDATE todo SET use_yn = 'N' WHERE id = ${todo.id}`;
    await expect(readState()).resolves.toEqual([]);
  });

  it("round-trips text arrays, timestamps and Seoul calendar dates", async () => {
    const tags = ["보스", "with, comma", 'with "quotes"', ""];
    const entry = await insertEntry(5, tags);
    expect(entry.tags).toEqual(tags);

    const todo = await insertTodo();
    const instant = new Date(START);
    const [run] = await sql`
      INSERT INTO run_record (todo_id, run_date, started_at)
      VALUES (${todo.id}, ${RUN_DATE}, ${instant})
      RETURNING started_at, run_date, run_date::text AS run_date_text
    `;
    expect(run.started_at).toBeInstanceOf(Date);
    expect(run.started_at).toEqual(instant);
    expect(run.run_date).toBeInstanceOf(Date);
    // The driver's date parser uses local midnight. Cast to text for a calendar date.
    expect(run.run_date).toEqual(new Date(2026, 10, 26));
    expect(run.run_date_text).toBe(RUN_DATE);
  });
});
