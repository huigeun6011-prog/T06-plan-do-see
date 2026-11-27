import { describe, expect, it, vi } from "vitest";
import { createCharacter, setCharacterOrder } from "../db/characters";
import type { SqlClient } from "../db/client";
import { createEntry, deleteEntry, editEntry } from "../db/entries";
import { saveImprovement } from "../db/improvement";
import { createEventPlan, ensureCurrentPlans } from "../db/plans";
import { completeTodo, deleteRun, uncompleteTodo } from "../db/runs";
import { createTodo, listTodos } from "../db/todos";
import { loadWeek } from "../db/week";
import { useTestDatabase } from "./helpers/db";

const before = new Date("2026-11-27T14:59:59.000Z");
const now = new Date("2026-11-27T15:00:00.000Z");
const next = new Date("2026-11-28T15:00:00.000Z");
const weeklyEntry = { period_kind: "weekly" as const, clear_minutes: 5, reward_meso: 0, party_size: 1 };

describe("week data", () => {
  const sql = useTestDatabase();

  it("groups both current periods and preserves registration ordering, metadata and Seoul run days", async () => {
    const a = await createCharacter(sql, "A");
    const b = await createCharacter(sql, "B");
    await setCharacterOrder(sql, a.id, 4);
    const moved = await createEntry(sql, { ...weeklyEntry, title: "Moved", character_id: b.id, sort_order: 5 });
    const deleted = await createEntry(sql, { ...weeklyEntry, title: "Deleted registration", character_id: b.id, sort_order: 0 });
    await createEntry(sql, { ...weeklyEntry, title: "Later boss", character_id: b.id, sort_order: 4 });
    await createEntry(sql, {
      ...weeklyEntry, title: "Hunt", character_id: b.id, tags: ["mission"], target_count: 6, sort_order: 3,
    });
    await createEntry(sql, { ...weeklyEntry, title: "Other character", character_id: a.id });
    await createEntry(sql, { ...weeklyEntry, title: "Monthly boss", character_id: a.id, period_kind: "monthly" });
    await createEntry(sql, { ...weeklyEntry, title: "Monthly account", period_kind: "monthly", tags: ["mission"] });
    const { weekly, monthly } = await ensureCurrentPlans(sql, before);
    const hand = await createTodo(sql, weekly.root_id, { title: "Hand-made", note: "Todo note", expected_minutes: 4 });
    const event = await createEventPlan(sql, {
      title: "Event", success_criteria: "Done", priority: 1, expected_minutes: 0,
      starts_at: new Date("2026-11-01T15:00:00.000Z"), ends_at: before,
    });
    const { todo: improvement } = await saveImprovement(sql, event.root_id, "Improve", before);
    await expect(editEntry(sql, moved.root_id, moved.id, { ...moved, sort_order: -3, memo: "New memo", party_size: 3 }))
      .resolves.toHaveProperty("id");
    await deleteEntry(sql, deleted.root_id);
    const hunt = (await listTodos(sql, { planRootId: weekly.root_id, q: "Hunt" }, now))[0];
    await completeTodo(sql, hunt.id, before, { units: 3, actual_minutes: 5 });
    await completeTodo(sql, hunt.id, now, { units: 2, actual_minutes: 6 });
    await uncompleteTodo(sql, hunt.id, "2026-11-28");
    await completeTodo(sql, hunt.id, next, { units: 1, actual_minutes: 7 });
    await deleteRun(sql, hunt.id, "2026-11-29");

    const old = await loadWeek(sql, before);
    expect(old.today).toBe("2026-11-27");
    expect(old.weekly.groups[0].missions[0]).toMatchObject({ today_units: 3, today_done: true, other_days_units: 0 });
    const data = await loadWeek(sql, now);
    expect(data.today).toBe("2026-11-28");
    expect(data.weekly.plan.root_id).toBe(weekly.root_id);
    expect(data.monthly.plan.root_id).toBe(monthly.root_id);
    expect(data.weekly.groups.map(({ character }) => character?.id ?? null)).toEqual([b.id, a.id, null]);
    expect(data.monthly.groups.map(({ character }) => character?.id ?? null)).toEqual([a.id, null]);
    const [group, , account] = data.weekly.groups;
    expect(group.bosses.map(({ title }) => title)).toEqual(["Moved", "Deleted registration", "Later boss"]);
    expect(group.bosses[0]).toMatchObject({ party_size: 3, memo: "New memo", due_at: weekly.ends_at });
    expect(group.bosses[1].party_size).toBe(1);
    expect(group.missions).toMatchObject([{
      id: hunt.id, kind: "mission", today_units: 2, today_done: false, other_days_units: 3,
      last_run_date: "2026-11-28", last_run_minutes: 6, actual_minutes: 5, done_n: 3, is_done: false,
    }]);
    expect(account.others.map(({ id }) => id)).toEqual([hand.id, improvement.id]);
    expect(account.others[0]).toMatchObject({ kind: "other", party_size: null, memo: "Todo note", last_run_date: null });
    expect(data.monthly.groups[0].bosses[0].title).toBe("Monthly boss");
    expect(data.monthly.groups[1].missions[0].title).toBe("Monthly account");
    expect(group.totals).toEqual({ total_todos: 4, done_todos: 0, remaining_todos: 4, remaining_minutes: 30 });
    expect(data.totals).toEqual({ total_todos: 9, done_todos: 0, remaining_todos: 9, remaining_minutes: 49 });
  }, 30_000);

  it("runs the same number of statements as the todo count grows", async () => {
    const { weekly } = await ensureCurrentPlans(sql, now);
    const tagged = vi.fn(sql);
    const query = vi.fn(sql.query);
    let batchStatements = 0;
    const counted: SqlClient = Object.assign(tagged, {
      query,
      transaction: vi.fn<SqlClient["transaction"]>((build, options) => sql.transaction((tx) => {
        const statements = build(tx);
        batchStatements += statements.length;
        return statements;
      }, options)),
    });
    const first = await loadWeek(counted, now);
    expect(first.totals.total_todos).toBe(0);
    const counts = [tagged.mock.calls.length, query.mock.calls.length, batchStatements];
    expect(counts).toEqual([6, 0, 2]);
    await sql`
      INSERT INTO todo (plan_id, title, due_at)
      SELECT ${weekly.root_id}, 'Todo ' || n, ${now} FROM generate_series(1, 30) n
    `;
    tagged.mockClear();
    query.mockClear();
    batchStatements = 0;
    const expanded = await loadWeek(counted, now);
    expect(expanded.totals.total_todos).toBe(30);
    expect([tagged.mock.calls.length, query.mock.calls.length, batchStatements]).toEqual(counts);
  });
});
