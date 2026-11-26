import { describe, expect, it, vi } from "vitest";
import { createCharacter, setCharacterOrder } from "../db/characters";
import { createEventPlan, editPlan, ensurePeriodPlan } from "../db/plans";
import {
  getOverview, getRetro, getRetroByGroup, listRetroHistory,
  type Retro, type RetroGroupKind, type RetroTotals,
} from "../db/retro";
import { completeTodo, deleteRun, setMissReason, uncompleteTodo } from "../db/runs";
import { createTodo, deleteTodo, listTodos } from "../db/todos";
import type { TodoInput } from "../lib/validate";
import { useTestDatabase } from "./helpers/db";

const now = new Date("2026-11-26T12:00:00Z");
const nextDay = new Date("2026-11-27T12:00:00Z");
const past = new Date(now.getTime() - 1);
const future = new Date(now.getTime() + 1);
const planFields = { title: "Event", priority: 2, success_criteria: "Finish", expected_minutes: 999 };
const zero: RetroTotals = {
  plan_count: 0, done_count: 0, late_count: 0, blocked_count: 0,
  expected_minutes: 0, actual_minutes: 0, diff_minutes: 0,
};

function historyRow({ drill, done_without_minutes, ...row }: Retro) {
  return row;
}

describe("retro and overview", () => {
  const sql = useTestDatabase();
  const event = () => createEventPlan(sql, {
    ...planFields, starts_at: new Date("2026-11-05T15:00:00Z"), ends_at: now,
  });

  it("matches drill-downs and hand-calculated totals across plans, characters and tags", async () => {
    const weekly = await ensurePeriodPlan(sql, "weekly", now);
    const monthly = await ensurePeriodPlan(sql, "monthly", now);
    await expect(editPlan(sql, monthly.root_id, monthly.id, { ...planFields, title: "Edited monthly" }))
      .resolves.toHaveProperty("id");
    const empty = await event();
    const inactive = await event();
    await sql`UPDATE plan SET use_yn = 'N' WHERE id = ${inactive.id}`;
    const beta = await createCharacter(sql, "Beta");
    const alpha = await createCharacter(sql, "Alpha");
    await setCharacterOrder(sql, alpha.id, -1);

    const add = (input: TodoInput) => createTodo(sql, weekly.root_id, input);
    const finished = await add({
      title: "Finished", due_at: past, expected_minutes: 30, character_id: alpha.id, tags: ["boss", "boss", "weekly"],
    });
    const partial = await add({
      title: "Partial", due_at: now, expected_minutes: 22, target_count: 6, character_id: alpha.id, tags: ["hunt"],
    });
    const untimed = await add({
      title: "Untimed", due_at: past, expected_minutes: 10, target_count: 2, character_id: beta.id, tags: ["boss"],
    });
    const account = await add({ title: "Account", due_at: future, expected_minutes: 9, tags: ["hunt"] });
    const undone = await add({
      title: "Undone", due_at: past, expected_minutes: 16, character_id: beta.id, tags: ["boss"],
    });
    const deleted = await add({
      title: "Deleted", due_at: past, expected_minutes: 100, character_id: beta.id, tags: ["excluded"],
    });
    await completeTodo(sql, finished.id, now, { actual_minutes: 12 });
    await completeTodo(sql, partial.id, now, { units: 2, actual_minutes: 5 });
    await completeTodo(sql, untimed.id, now, { units: 2 });
    await completeTodo(sql, untimed.id, nextDay, { units: 1, actual_minutes: 80 });
    await uncompleteTodo(sql, untimed.id, "2026-11-27");
    await completeTodo(sql, undone.id, now, { actual_minutes: 12 });
    await uncompleteTodo(sql, undone.id, "2026-11-26");
    await completeTodo(sql, deleted.id, now, { actual_minutes: 99 });
    await setMissReason(sql, deleted.id, "Excluded");
    await deleteTodo(sql, deleted.id);
    await completeTodo(sql, partial.id, nextDay, { units: 20, actual_minutes: 99 });
    await deleteRun(sql, partial.id, "2026-11-27");
    await setMissReason(sql, finished.id, "Reason on a done todo");
    await setMissReason(sql, account.id, "Account reason");

    const monthlyTodo = await createTodo(sql, monthly.root_id, { title: "Monthly", expected_minutes: 6 });
    await completeTodo(sql, monthlyTodo.id, now, { actual_minutes: 0 });
    const weeklyRetro = await getRetro(sql, weekly.root_id, now);
    const monthlyRetro = await getRetro(sql, monthly.root_id, now);
    const emptyRetro = await getRetro(sql, empty.root_id, now);
    if (!weeklyRetro || !monthlyRetro || !emptyRetro) throw new Error("Expected retros for all current plans.");
    const expected = {
      plan_count: 5, done_count: 2, late_count: 2, blocked_count: 2,
      expected_minutes: 87, actual_minutes: 17, diff_minutes: -70, done_without_minutes: 1,
    };
    expect(weeklyRetro).toEqual({
      ...expected, plan: weekly, drill: { all: "all", done: "done", late: "late", blocked: "blocked" },
    });
    expect(monthlyRetro).toMatchObject({
      plan: { root_id: monthly.root_id, title: "Edited monthly", expected_minutes: 999 },
      plan_count: 1, done_count: 1, actual_minutes: 0, expected_minutes: 6, done_without_minutes: 0,
    });
    expect(emptyRetro).toMatchObject({ plan: empty, ...zero, done_without_minutes: 0 });
    await expect(getRetro(sql, inactive.root_id, now)).resolves.toBeNull();
    await expect(getRetro(sql, "99999", now)).resolves.toBeNull();
    const list = (scope: keyof Retro["drill"]) =>
      listTodos(sql, { planRootId: weekly.root_id, scope: weeklyRetro.drill[scope] }, now);
    for (const [scope, count] of [
      ["all", weeklyRetro.plan_count], ["done", weeklyRetro.done_count],
      ["late", weeklyRetro.late_count], ["blocked", weeklyRetro.blocked_count],
    ] as const) {
      await expect(list(scope)).resolves.toHaveLength(count);
    }
    expect((await list("late")).map(({ id }) => id)).toEqual([undone.id, partial.id]);

    const characters = await getRetroByGroup(sql, weekly.root_id, now, "character");
    expect(characters).toEqual([
      {
        group: "character", character_id: alpha.id, character_name: "Alpha", plan_count: 2, done_count: 1,
        late_count: 1, blocked_count: 1, expected_minutes: 52, actual_minutes: 17, diff_minutes: -35, done_without_minutes: 0,
      },
      {
        group: "character", character_id: beta.id, character_name: "Beta", plan_count: 2, done_count: 1,
        late_count: 1, blocked_count: 0, expected_minutes: 26, actual_minutes: 0, diff_minutes: -26, done_without_minutes: 1,
      },
      {
        group: "character", character_id: null, character_name: null, plan_count: 1, done_count: 0,
        late_count: 0, blocked_count: 1, expected_minutes: 9, actual_minutes: 0, diff_minutes: -9, done_without_minutes: 0,
      },
    ]);
    const tags = await getRetroByGroup(sql, weekly.root_id, now, "tag");
    expect(tags).toEqual([
      {
        group: "tag", tag: "boss", plan_count: 3, done_count: 2, late_count: 1, blocked_count: 1,
        expected_minutes: 56, actual_minutes: 12, diff_minutes: -44, done_without_minutes: 1,
      },
      {
        group: "tag", tag: "hunt", plan_count: 2, done_count: 0, late_count: 1, blocked_count: 1,
        expected_minutes: 31, actual_minutes: 5, diff_minutes: -26, done_without_minutes: 0,
      },
      {
        group: "tag", tag: "weekly", plan_count: 1, done_count: 1, late_count: 0, blocked_count: 1,
        expected_minutes: 30, actual_minutes: 12, diff_minutes: -18, done_without_minutes: 0,
      },
    ]);
    for (const field of Object.keys(expected) as (keyof typeof expected)[]) {
      expect(characters.reduce((sum, group) => sum + group[field], 0)).toBe(expected[field]);
      expect(tags.reduce((sum, group) => sum + group[field], 0)).toBe(expected[field] + tags[2][field]);
    }

    const query = vi.spyOn(sql, "query");
    const history = await listRetroHistory(sql, {}, now);
    expect(query).toHaveBeenCalledTimes(1);
    query.mockRestore();
    const chronological = [weeklyRetro, emptyRetro, monthlyRetro].map(historyRow);
    expect(history).toEqual(chronological);
    await expect(listRetroHistory(sql, { kind: "monthly", limit: 1 }, now)).resolves.toEqual([historyRow(monthlyRetro)]);
    await expect(listRetroHistory(sql, { limit: 2 }, now)).resolves.toEqual(chronological.slice(0, 2));

    await expect(getOverview(sql, [weekly.root_id, monthly.root_id, empty.root_id, weekly.root_id], now))
      .resolves.toEqual([
        { character_id: alpha.id, character_name: "Alpha", total_todos: 2, done_todos: 1, remaining_todos: 1, remaining_minutes: 16 },
        { character_id: beta.id, character_name: "Beta", total_todos: 2, done_todos: 1, remaining_todos: 1, remaining_minutes: 16 },
        { character_id: null, character_name: null, total_todos: 2, done_todos: 1, remaining_todos: 1, remaining_minutes: 9 },
      ]);
    await expect(getOverview(sql, [empty.root_id], now)).resolves.toEqual([]);
    await expect(getOverview(sql, [], now)).resolves.toEqual([]);
  }, 30_000);

  it("adds one done todo per double click and drops minutes until the run is re-completed", async () => {
    const plan = await event();
    const todo = await createTodo(sql, plan.root_id, { title: "Tick", expected_minutes: 30 });
    await expect(getRetro(sql, plan.root_id, now)).resolves.toMatchObject({ done_count: 0, late_count: 1, actual_minutes: 0 });
    await Promise.all([
      completeTodo(sql, todo.id, now, { actual_minutes: 12 }), completeTodo(sql, todo.id, now),
    ]);
    await expect(getRetro(sql, plan.root_id, now)).resolves.toMatchObject({
      done_count: 1, late_count: 0, actual_minutes: 12, diff_minutes: -18, done_without_minutes: 0,
    });
    await uncompleteTodo(sql, todo.id, "2026-11-26");
    await expect(getRetro(sql, plan.root_id, now)).resolves.toMatchObject({
      done_count: 0, late_count: 1, actual_minutes: 0, diff_minutes: -30,
    });
    await completeTodo(sql, todo.id, now);
    await expect(getRetro(sql, plan.root_id, now)).resolves.toMatchObject({ done_count: 1, actual_minutes: 12 });
  });

  it("aggregates minute totals beyond a single int column and leaves untagged todos out of tag groups", async () => {
    const plan = await event();
    for (const title of ["One", "Two"]) {
      await createTodo(sql, plan.root_id, { title, expected_minutes: 2147483647 });
    }
    await expect(getRetro(sql, plan.root_id, now)).resolves.toMatchObject({
      plan_count: 2, expected_minutes: 4294967294, diff_minutes: -4294967294,
    });
    await expect(getOverview(sql, [plan.root_id], now)).resolves.toMatchObject([
      { character_id: null, remaining_todos: 2, remaining_minutes: 4294967294 },
    ]);
    await expect(getRetroByGroup(sql, plan.root_id, now, "tag")).resolves.toEqual([]);
    await expect(getRetroByGroup(sql, plan.root_id, now, "invalid" as RetroGroupKind))
      .rejects.toMatchObject({ field: "group" });
    await expect(listRetroHistory(sql, { limit: 0 }, now)).rejects.toMatchObject({ field: "limit" });
  });
});
