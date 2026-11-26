import { describe, expect, it, vi } from "vitest";
import { createEntry } from "../db/entries";
import {
  getImprovement, listPlansNeedingRetro, removeImprovement, saveImprovement,
} from "../db/improvement";
import { createEventPlan, editPlan, ensurePeriodPlan, listPlans } from "../db/plans";
import { getRetro, type Retro } from "../db/retro";
import { completeTodo } from "../db/runs";
import { createTodo, getTodo, listTodos } from "../db/todos";
import { useTestDatabase } from "./helpers/db";

const now = new Date("2026-12-17T12:00:00Z");
const nextWeek = new Date("2026-12-24T12:00:00Z");
const weekSourceInstant = new Date("2026-11-26T12:00:00Z");
const planFields = { title: "Event", success_criteria: "Finish", priority: 2, expected_minutes: 90 };
const entryFields = { clear_minutes: 10, reward_meso: 0, party_size: 1 };

function historyRow({ drill, done_without_minutes, ...row }: Retro) {
  return row;
}

describe("manual improvements", () => {
  const sql = useTestDatabase();
  const event = (starts_at = new Date("2026-12-01T00:00:00Z"), ends_at = now) =>
    createEventPlan(sql, { ...planFields, starts_at, ends_at });

  it("updates the same todo, preserves its target across weeks and creates a new row after removal", async () => {
    const source = await event();
    const script = "<script>alert('test')</script>";
    const first = await saveImprovement(sql, source.root_id, `  ${script}  `, now);
    expect(first.todo).toMatchObject({
      title: script, source_plan_id: source.root_id, plan_id: first.target_plan.root_id,
      tags: ["improvement"], due_at: first.target_plan.ends_at, expected_minutes: 0, target_count: 1,
    });
    expect(first.target_plan).toMatchObject({ period_kind: "weekly", starts_at: "2026-12-16T15:00:00.000Z" });
    await expect(saveImprovement(sql, source.root_id, script, now)).resolves.toEqual(first);
    const edited = await saveImprovement(sql, source.root_id, "Edited", nextWeek);
    expect(edited).toEqual({ ...first, todo: { ...first.todo, title: "Edited" } });
    expect(await listTodos(sql, { tag: "improvement" }, now)).toHaveLength(1);
    await expect(getRetro(sql, first.target_plan.root_id, now)).resolves.toMatchObject({ plan_count: 1 });

    const rename = await editPlan(sql, first.target_plan.root_id, first.target_plan.id, {
      ...planFields, title: "Renamed target",
    });
    expect(rename).toHaveProperty("id");
    await expect(getImprovement(sql, source.root_id)).resolves.toEqual({
      todo: await getTodo(sql, first.todo.id),
      target_plan: {
        id: first.target_plan.root_id, title: "Renamed target", starts_at: first.target_plan.starts_at,
      },
    });
    await expect(removeImprovement(sql, source.root_id)).resolves.toBe(true);
    await expect(removeImprovement(sql, source.root_id)).resolves.toBe(false);
    await expect(getImprovement(sql, source.root_id)).resolves.toBeNull();
    await expect(getTodo(sql, first.todo.id)).resolves.toBeNull();
    const replacement = await saveImprovement(sql, source.root_id, "New", nextWeek);
    expect(replacement.todo.id).not.toBe(first.todo.id);
    expect(replacement.target_plan.starts_at).toBe("2026-12-23T15:00:00.000Z");
    await expect(listTodos(sql, { tag: "improvement" }, now)).resolves.toMatchObject([{ id: replacement.todo.id }]);
  }, 30_000);

  it("targets the next source period and generates matching registrations exactly once", async () => {
    const weekly = await ensurePeriodPlan(sql, "weekly", weekSourceInstant);
    const monthly = await ensurePeriodPlan(sql, "monthly", weekSourceInstant);
    await createEntry(sql, { ...entryFields, title: "Weekly registration", period_kind: "weekly" });
    await createEntry(sql, { ...entryFields, title: "Monthly registration", period_kind: "monthly" });
    expect(await listPlans(sql)).toHaveLength(2);

    const january = new Date("2027-01-20T12:00:00Z");
    const week = await saveImprovement(sql, weekly.root_id, "Weekly improvement", january);
    const month = await saveImprovement(sql, monthly.root_id, "Monthly improvement", january);
    expect(week.target_plan).toMatchObject({
      period_kind: "weekly", starts_at: weekly.ends_at, ends_at: "2026-12-09T15:00:00.000Z",
    });
    expect(month.target_plan).toMatchObject({
      period_kind: "monthly", starts_at: monthly.ends_at, ends_at: "2026-12-31T15:00:00.000Z",
    });
    await expect(saveImprovement(sql, weekly.root_id, "Weekly improvement", january)).resolves.toEqual(week);
    await expect(saveImprovement(sql, monthly.root_id, "Monthly improvement", january)).resolves.toEqual(month);
    for (const [saved, title] of [[week, "Weekly registration"], [month, "Monthly registration"]] as const) {
      expect(saved.todo.due_at).toBe(saved.target_plan.ends_at);
      const rows = await listTodos(sql, { planRootId: saved.target_plan.root_id }, now);
      expect(rows).toHaveLength(2);
      expect(rows.map((todo) => todo.title)).toContain(title);
      await expect(getRetro(sql, saved.target_plan.root_id, now)).resolves.toMatchObject({
        plan_count: 2, expected_minutes: 10,
      });
    }
  }, 30_000);

  it("lets the partial unique index arbitrate five concurrent saves", async () => {
    const source = await event();
    await createEntry(sql, { ...entryFields, title: "Weekly", period_kind: "weekly" });
    const results = await Promise.all(Array.from({ length: 5 }, (_, index) =>
      saveImprovement(sql, source.root_id, `Improvement ${index}`, now),
    ));
    const { todo, target_plan } = results[0];
    expect(new Set(results.map((result) => result.todo.id))).toEqual(new Set([todo.id]));
    expect(new Set(results.map((result) => result.target_plan.root_id))).toEqual(new Set([target_plan.root_id]));
    const rows = await listTodos(sql, { planRootId: target_plan.root_id }, now);
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.source_plan_id === source.root_id)).toHaveLength(1);
    await expect(sql`
      INSERT INTO todo (plan_id, source_plan_id, title, due_at)
      VALUES (${target_plan.root_id}, ${source.root_id}, ${"Duplicate"}, ${target_plan.ends_at})
    `).rejects.toMatchObject({ code: "23505", constraint: "todo_one_improvement" });
  }, 30_000);

  it("validates text and rejects missing and inactive source plans before creating targets", async () => {
    const source = await event();
    for (const title of ["", "   ", "가".repeat(201)]) {
      await expect(saveImprovement(sql, source.root_id, title, now)).rejects.toMatchObject({ field: "text" });
    }
    await expect(saveImprovement(sql, "99999", "Text", now)).rejects.toMatchObject({ field: "plan_id" });
    await expect(listPlans(sql)).resolves.toEqual([source]);
    await expect(saveImprovement(sql, source.root_id, ` ${"가".repeat(200)} `, now))
      .resolves.toMatchObject({ todo: { title: "가".repeat(200) } });
    await sql`UPDATE plan SET use_yn = 'N' WHERE id = ${source.id}`;
    await expect(saveImprovement(sql, source.root_id, "Text", now)).rejects.toMatchObject({ field: "plan_id" });
  });

  it("lists ended plans without an improvement in one grouped query, including the exact boundary", async () => {
    const old = await event(new Date("2026-11-01T00:00:00Z"), new Date("2026-11-30T00:00:00Z"));
    const boundary = await event();
    const active = await event(new Date("2026-12-10T00:00:00Z"), new Date(now.getTime() + 1));
    const inactive = await event(new Date("2026-12-10T00:00:00Z"), now);
    await sql`UPDATE plan SET use_yn = 'N' WHERE id = ${inactive.id}`;
    const done = await createTodo(sql, old.root_id, { title: "Done", expected_minutes: 20 });
    await completeTodo(sql, done.id, now, { actual_minutes: 12 });
    const todo = await createTodo(sql, boundary.root_id, { title: "Late", expected_minutes: 30 });
    expect(todo.due_at).toBe(now.toISOString());

    const query = vi.spyOn(sql, "query");
    const rows = await listPlansNeedingRetro(sql, now);
    expect(query).toHaveBeenCalledTimes(1);
    query.mockRestore();
    expect(rows.map(({ plan }) => plan.root_id)).toEqual([boundary.root_id, old.root_id]);
    for (const row of rows) {
      const retro = await getRetro(sql, row.plan.root_id, now);
      if (!retro) throw new Error("Expected the plan's retro.");
      expect(row).toEqual(historyRow(retro));
    }
    await expect(listPlansNeedingRetro(sql, now, 1)).resolves.toEqual([rows[0]]);
    await expect(listPlansNeedingRetro(sql, now, 0)).rejects.toMatchObject({ field: "limit" });
    await saveImprovement(sql, boundary.root_id, "Improve", now);
    await expect(listPlansNeedingRetro(sql, now)).resolves.toEqual([rows[1]]);
    await removeImprovement(sql, boundary.root_id);
    await expect(listPlansNeedingRetro(sql, now)).resolves.toEqual(rows);
    expect(rows.some(({ plan }) => plan.root_id === active.root_id)).toBe(false);
  }, 30_000);
});
