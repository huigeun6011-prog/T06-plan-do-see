import { describe, expect, it, vi } from "vitest";
import { createCharacter } from "../db/characters";
import type { SqlClient } from "../db/client";
import { createEntry, deleteEntry, editEntry, getEntryHistory, setEntryOrder } from "../db/entries";
import { createEventPlan, ensureCurrentPlans } from "../db/plans";
import { createTodo, deleteTodo, getTodo, listTodos, listWeekView, updateTodo, type TodoScope } from "../db/todos";
import type { TodoSort } from "../lib/todo-sort";
import type { TodoPatch } from "../lib/validate";
import { useTestDatabase } from "./helpers/db";

const now = new Date("2026-11-26T12:00:00Z");
const soon = new Date(now.getTime() + 1_000);
const past = new Date(now.getTime() - 1_000);
const runDate = "2026-11-26";
const entry = { period_kind: "weekly" as const, clear_minutes: 1, reward_meso: 0, party_size: 1, tags: ["mission"] };

describe("todo data access", () => {
  const sql = useTestDatabase();

  const event = () => createEventPlan(sql, {
    title: "Event", starts_at: past, ends_at: soon, priority: 2, success_criteria: "Finish", expected_minutes: 0,
  });
  const markDone = (todoId: string, units: number, minutes: number) => sql`
    INSERT INTO run_record (todo_id, run_date, units, actual_minutes, done)
    VALUES (${todoId}, ${runDate}, ${units}, ${minutes}, true)
  `;

  it("searches title and note literally and excludes deleted todos", async () => {
    const plan = await event();
    const percent = await createTodo(sql, plan.root_id, { title: "100% CLEAR", expected_minutes: 0 });
    const underscore = await createTodo(sql, plan.root_id, {
      title: "Clear", note: "보스_이야기", expected_minutes: 0,
    });
    await createTodo(sql, plan.root_id, { title: "100X", note: "보스X이야기", expected_minutes: 0 });
    const deleted = await createTodo(sql, plan.root_id, { title: "%_보스 clear", expected_minutes: 0 });
    await deleteTodo(sql, deleted.id);
    const script = "<script>alert('test')</script>";
    const sqlLooking = "'; DROP TABLE todo; --";
    const literal = await createTodo(sql, plan.root_id, { title: script, note: sqlLooking, expected_minutes: 0 });

    const search = async (q: string) => (await listTodos(sql, { q }, now)).map((todo) => todo.id);
    await expect(search("%")).resolves.toEqual([percent.id]);
    await expect(search("_")).resolves.toEqual([underscore.id]);
    await expect(search("cLeAr")).resolves.toEqual([percent.id, underscore.id]);
    await expect(search("보스_이야기")).resolves.toEqual([underscore.id]);
    await expect(search(sqlLooking)).resolves.toEqual([literal.id]);
    await expect(search("%_보스")).resolves.toEqual([]);
    await expect(listTodos(sql, { q: "<script>" }, now)).resolves.toMatchObject([{ title: script }]);
    await expect(getTodo(sql, literal.id)).resolves.toMatchObject({ title: script, note: sqlLooking });
    await expect(getTodo(sql, deleted.id)).resolves.toBeNull();
  });

  it("sorts all keys both ways, retaining ascending IDs for ties and pagination", async () => {
    const plan = await event();
    const { id: a } = await createTodo(sql, plan.root_id, { title: "M", priority: 1, due_at: now, expected_minutes: 3 });
    const { id: b } = await createTodo(sql, plan.root_id, { title: "A", priority: 3, due_at: soon, expected_minutes: 1 });
    const { id: c } = await createTodo(sql, plan.root_id, { title: "Z", priority: 2, due_at: past, expected_minutes: 2 });
    const { id: d } = await createTodo(sql, plan.root_id, { title: "M", priority: 1, due_at: now, expected_minutes: 3 });
    await sql`UPDATE todo SET created_at = ${past} WHERE id IN (${a}, ${d})`;
    await sql`UPDATE todo SET created_at = ${now} WHERE id = ${b}`;
    await sql`UPDATE todo SET created_at = ${soon} WHERE id = ${c}`;

    const expected = {
      due_at: { asc: [c, a, d, b], desc: [b, a, d, c] },
      priority: { asc: [a, d, c, b], desc: [b, c, a, d] },
      title: { asc: [b, a, d, c], desc: [c, a, d, b] },
      created_at: { asc: [a, d, b, c], desc: [c, b, a, d] },
      expected_minutes: { asc: [b, c, a, d], desc: [a, d, c, b] },
    };
    for (const key of Object.keys(expected) as TodoSort["key"][]) {
      for (const direction of ["asc", "desc"] as const) {
        const rows = await listTodos(sql, { sort: { key, direction } }, now);
        expect(rows.map(({ id }) => id)).toEqual(expected[key][direction]);
      }
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const rows = await listTodos(sql, { sort: { key: "title", direction: "desc" }, limit: 2, offset: 1 }, now);
      expect(rows.map(({ id }) => id)).toEqual([a, d]);
    }
  });

  it("rejects invalid sort, scope and paging before calling SQL", async () => {
    const query = vi.fn<SqlClient["query"]>();
    const unused = Object.assign(vi.fn<SqlClient>(), { query, transaction: vi.fn<SqlClient["transaction"]>() });
    const key = "due_at";
    await expect(listTodos(unused, { sort: { key: "constructor" as TodoSort["key"], direction: "asc" } }, now))
      .rejects.toMatchObject({ field: "sort" });
    await expect(listTodos(unused, { sort: { key, direction: "ASC" as TodoSort["direction"] } }, now))
      .rejects.toMatchObject({ field: "direction" });
    await expect(listTodos(unused, { scope: "toString" as TodoScope }, now)).rejects.toMatchObject({ field: "scope" });
    await expect(listTodos(unused, { limit: 1001 }, now)).rejects.toMatchObject({ field: "limit" });
    await expect(listTodos(unused, { offset: -1 }, now)).rejects.toMatchObject({ field: "offset" });
    expect(query).not.toHaveBeenCalled();
    expect(unused).not.toHaveBeenCalled();
  });

  it("filters character, tag, priority and every status consistently with separate counts", async () => {
    const [plan, other] = await Promise.all([event(), event()]);
    const character = await createCharacter(sql, "Hero");
    const done = await createTodo(sql, plan.root_id, {
      title: "Done", due_at: past, target_count: 3, expected_minutes: 0, character_id: character.id,
      priority: 1, tags: ["match"],
    });
    const late = await createTodo(sql, plan.root_id, { title: "Late", due_at: past, expected_minutes: 0 });
    const boundary = await createTodo(sql, plan.root_id, {
      title: "Boundary", due_at: now, expected_minutes: 0, character_id: character.id, tags: ["match-extra"],
    });
    const open = await createTodo(sql, plan.root_id, {
      title: "Open", due_at: soon, priority: 1, expected_minutes: 0, tags: ["match"],
    });
    const excluded = await createTodo(sql, plan.root_id, { title: "Deleted", expected_minutes: 0 });
    await createTodo(sql, other.root_id, { title: "Other plan", expected_minutes: 0 });
    await deleteTodo(sql, excluded.id);
    await markDone(done.id, done.target_count, 12);
    await sql`UPDATE todo SET miss_reason = ${"Reason"} WHERE id IN (${done.id}, ${boundary.id})`;

    const [counts] = await sql`
      SELECT count(*)::int AS all, count(*) FILTER (WHERE NOT is_done)::int AS open,
             count(*) FILTER (WHERE is_done)::int AS done,
             count(*) FILTER (WHERE NOT is_done AND due_at <= ${now}::timestamptz)::int AS late,
             count(*) FILTER (WHERE blocked)::int AS blocked
      FROM todo_state WHERE plan_id = ${plan.root_id}
    `;
    const scopes = {
      all: [done.id, late.id, boundary.id, open.id],
      open: [late.id, boundary.id, open.id],
      done: [done.id],
      late: [late.id, boundary.id],
      blocked: [done.id, boundary.id],
    } as const;
    for (const scope of Object.keys(scopes) as TodoScope[]) {
      const rows = await listTodos(sql, { planRootId: plan.root_id, scope }, now);
      expect(rows.map(({ id }) => id)).toEqual(scopes[scope]);
      expect(rows).toHaveLength(counts[scope]);
    }
    const filtered = async (query: Parameters<typeof listTodos>[1]) =>
      (await listTodos(sql, { planRootId: plan.root_id, ...query }, now)).map(({ id }) => id);
    await expect(filtered({ characterId: character.id })).resolves.toEqual([done.id, boundary.id]);
    await expect(filtered({ characterId: null })).resolves.toEqual([late.id, open.id]);
    await expect(filtered({ tag: "match" })).resolves.toEqual([done.id, open.id]);
    await expect(filtered({ priority: 1 })).resolves.toEqual([done.id, open.id]);
    await expect(filtered({ characterId: null, tag: "match", priority: 1, scope: "open" })).resolves.toEqual([open.id]);
    await expect(getTodo(sql, done.id)).resolves.toMatchObject({
      done_n: 3, actual_minutes: 12, blocked: true, is_done: true, due_at: past.toISOString(),
    });
    await expect(getTodo(sql, "99999")).resolves.toBeNull();
  });

  it("patches only supplied fields and preserves links and soft deletion", async () => {
    const character = await createCharacter(sql, "Hero");
    const original = await createEntry(sql, { ...entry, title: "Generated", character_id: character.id });
    const { weekly } = await ensureCurrentPlans(sql, now);
    const [todo] = await listTodos(sql, { planRootId: weekly.root_id }, now);
    await expect(updateTodo(sql, todo.id, { note: "changed", character_id: null })).resolves.toMatchObject({
      id: todo.id, plan_id: weekly.root_id, entry_id: original.root_id, title: todo.title,
      due_at: todo.due_at, priority: todo.priority, tags: todo.tags, character_id: null, note: "changed",
    });
    expect(await getTodo(sql, todo.id)).toEqual({ ...todo, note: "changed", character_id: null });
    const max = {
      title: "t".repeat(200), note: "n".repeat(1000), due_at: soon, priority: 3,
      tags: [" x ", ...Array(9).fill("x".repeat(30))], expected_minutes: 2147483647, target_count: 1000,
    };
    await expect(updateTodo(sql, todo.id, max)).resolves.toMatchObject({
      ...max, due_at: soon.toISOString(), tags: max.tags.map((tag) => tag.trim()),
    });
    const invalid: [TodoPatch, string][] = [
      [{ title: "" }, "title"], [{ title: "x".repeat(201) }, "title"],
      [{ note: "n".repeat(1001) }, "note"], [{ target_count: 1001 }, "target_count"],
      [{ due_at: new Date(NaN) }, "due_at"], [{ priority: 0 }, "priority"],
      [{ expected_minutes: -1 }, "expected_minutes"], [{ tags: Array(11).fill("tag") }, "tags"],
      [{ character_id: "99999" }, "character_id"], [{}, "patch"],
    ];
    for (const [patch, field] of invalid) {
      await expect(updateTodo(sql, todo.id, patch)).rejects.toMatchObject({ field });
    }
    for (const field of ["plan_id", "entry_id", "source_plan_id", "use_yn"]) {
      await expect(updateTodo(sql, todo.id, { title: "changed", [field]: "1" })).rejects.toMatchObject({ field });
    }
    await expect(getTodo(sql, todo.id)).resolves.toMatchObject({
      title: max.title, plan_id: weekly.root_id, entry_id: original.root_id, source_plan_id: null, use_yn: "Y",
    });
    await expect(updateTodo(sql, "99999", { title: "unknown" })).resolves.toBeNull();
    await expect(deleteTodo(sql, todo.id)).resolves.toBe(true);
    await expect(deleteTodo(sql, todo.id)).resolves.toBe(false);
    await expect(updateTodo(sql, todo.id, { title: "deleted" })).resolves.toBeNull();
    await expect(listTodos(sql, {}, now)).resolves.toEqual([]);
  });

  it("returns both current plans with completed todos and stable source ordering", async () => {
    await createEntry(sql, { ...entry, title: "Later sort", sort_order: 9 });
    await createEntry(sql, { ...entry, title: "First sort", sort_order: -2 });
    await createEntry(sql, { ...entry, title: "Same sort", sort_order: -2 });
    await createEntry(sql, { ...entry, title: "Monthly", period_kind: "monthly" });
    const initial = await listWeekView(sql, now);
    expect(initial.weekly.todos.map(({ title }) => title)).toEqual(["First sort", "Same sort", "Later sort"]);
    expect(initial.monthly.todos.map(({ title }) => title)).toEqual(["Monthly"]);
    const [first] = initial.weekly.todos;
    const manual = await createTodo(sql, initial.weekly.plan.root_id, {
      title: "Earlier deadline", expected_minutes: 0, due_at: past,
    });
    await markDone(first.id, 1, 20);
    const result = await listWeekView(sql, now);
    expect(result.weekly.plan).toEqual(initial.weekly.plan);
    expect(result.weekly.todos.map(({ id }) => id)).toEqual([manual.id, ...initial.weekly.todos.map(({ id }) => id)]);
    expect(result.weekly.todos[1]).toMatchObject({ id: first.id, is_done: true, actual_minutes: 20 });
    expect(result.monthly).toEqual(initial.monthly);
    await expect(listWeekView(sql, now)).resolves.toEqual(result);
  });

  it("paginates general lists and returns every todo in week view", async () => {
    const { weekly } = await ensureCurrentPlans(sql, now);
    await sql`
      INSERT INTO todo (plan_id, title, due_at)
      SELECT ${weekly.root_id}, 'Todo ' || n, ${now}
      FROM generate_series(1, 1001) AS n
    `;
    await expect(listTodos(sql, {}, now)).resolves.toHaveLength(500);
    await expect(listTodos(sql, { limit: 1000 }, now)).resolves.toHaveLength(1000);
    await expect(listTodos(sql, { offset: 1000 }, now)).resolves.toHaveLength(1);
    const view = await listWeekView(sql, now);
    expect(view.weekly.todos).toHaveLength(1001);
    expect(view.monthly.todos).toEqual([]);
  });

  it("uses the current registration order and falls back to the root order after deletion", async () => {
    const first = await createEntry(sql, { ...entry, title: "First", sort_order: 1 });
    await createEntry(sql, { ...entry, title: "Second", sort_order: 2 });
    const titles = async () => (await listWeekView(sql, now)).weekly.todos.map(({ title }) => title);
    await expect(titles()).resolves.toEqual(["First", "Second"]);

    await expect(editEntry(sql, first.root_id, first.id, { ...entry, title: "First", sort_order: 3 }))
      .resolves.toHaveProperty("id");
    await expect(titles()).resolves.toEqual(["Second", "First"]);
    const before = await getEntryHistory(sql, first.root_id);
    expect(before).toHaveLength(2);

    await expect(setEntryOrder(sql, first.root_id, 0)).resolves.toBe(true);
    await expect(titles()).resolves.toEqual(["First", "Second"]);
    await expect(getEntryHistory(sql, first.root_id)).resolves.toEqual([before[0], { ...before[1], sort_order: 0 }]);

    await expect(setEntryOrder(sql, first.root_id, 4)).resolves.toBe(true);
    await expect(titles()).resolves.toEqual(["Second", "First"]);
    await deleteEntry(sql, first.root_id);
    await expect(titles()).resolves.toEqual(["First", "Second"]);
    const after = await listWeekView(sql, now);
    await expect(listWeekView(sql, now)).resolves.toEqual(after);
    await expect(setEntryOrder(sql, first.root_id, 5)).resolves.toBe(false);
    await expect(setEntryOrder(sql, "99999", 5)).resolves.toBe(false);
  });
});
