import { describe, expect, it, vi } from "vitest";
import contract from "../contracts/pds-schema-v2.json";
import { createCharacter } from "../db/characters";
import type { SqlClient } from "../db/client";
import { createEntry, editEntry } from "../db/entries";
import { buildExport, buildResponse, type ExportSnapshot } from "../db/export";
import { saveImprovement } from "../db/improvement";
import { createEventPlan, editPlan, ensurePeriodPlan } from "../db/plans";
import { getRetro } from "../db/retro";
import { completeTodo, deleteRun, setMissReason, uncompleteTodo } from "../db/runs";
import { createTodo, deleteTodo, listTodos } from "../db/todos";
import { useTestDatabase } from "./helpers/db";

const now = new Date("2026-12-09T15:00:00.000Z");
const fields = { title: "Event", priority: 2, success_criteria: "Finish", expected_minutes: 20 };
const big = "9007199254740993";
const midnightBefore = new Date(now.getTime() - 1);
const timestampColumns = new Set(["created_at", "starts_at", "ends_at", "due_at", "started_at", "ended_at"]);
const dateWithOffset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function normalizeTimestamps(rows: Record<string, unknown>[]) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key, timestampColumns.has(key) && (value instanceof Date || typeof value === "string")
      ? new Date(value).toISOString()
      : value,
  ])));
}

describe("diary export", () => {
  const sql = useTestDatabase();
  const event = () => createEventPlan(sql, { ...fields, starts_at: new Date("2026-12-02T15:00:00Z"), ends_at: now });

  it("takes one snapshot of every row and the current-plan retros", async () => {
    await createCharacter(sql, "Archer");
    await sql`
      INSERT INTO game_character (id, name) OVERRIDING SYSTEM VALUE
      VALUES (${big}, ${"Mage"})
    `;
    const registration = {
      title: "Hunt", period_kind: "weekly", clear_minutes: 5, party_size: 1,
      reward_meso: "0", character_id: big, tags: ["weekly", "보스"], target_count: 3,
    } as const;
    const input = { ...registration, tags: [...registration.tags] };
    const first = await createEntry(sql, input);
    const second = await editEntry(sql, first.root_id, first.id, { ...input, memo: "second" });
    if (!("id" in second)) throw new Error("Expected registration edit.");
    await expect(editEntry(sql, first.root_id, second.id, { ...input, memo: "third" })).resolves.toHaveProperty("id");
    await sql`UPDATE entry SET reward_meso = ${big} WHERE id = ${first.id}`;
    const weekly = await ensurePeriodPlan(sql, "weekly", now);
    const [generated] = await listTodos(sql, { planRootId: weekly.root_id }, now);
    const source = await event();
    await expect(editPlan(sql, source.root_id, source.id, { ...fields, title: "Edited event" }))
      .resolves.toHaveProperty("id");
    const manual = await createTodo(sql, source.root_id, { title: "Hand-made", expected_minutes: 30 });
    const removed = await createTodo(sql, source.root_id, { title: "Removed", expected_minutes: 30 });
    await deleteTodo(sql, removed.id);
    const improvement = await saveImprovement(sql, source.root_id, "Take notes", now);
    expect(improvement.todo.plan_id).toBe(weekly.root_id);
    await setMissReason(sql, manual.id, "Reason");
    await completeTodo(sql, generated.id, now, { units: 3, actual_minutes: 12 });
    await sql`UPDATE run_record SET started_at = ${"2026-12-09T15:00:01.123456Z"} WHERE todo_id = ${generated.id}`;
    await completeTodo(sql, manual.id, now, { actual_minutes: 5 });
    await uncompleteTodo(sql, manual.id, "2026-12-10");
    await completeTodo(sql, improvement.todo.id, now, { actual_minutes: 40 });
    await deleteRun(sql, improvement.todo.id, "2026-12-10");

    const query = vi.spyOn(sql, "query");
    const snapshot = await buildExport(sql, now);
    expect(query).toHaveBeenCalledTimes(1);
    query.mockRestore();
    expect(Object.keys(snapshot).sort()).toEqual(["exported_at", "retro", "schema", "tables", "timezone"]);
    expect(snapshot).toMatchObject({
      schema: contract.version, timezone: contract.timezone, exported_at: now.toISOString(),
    });
    expect(Object.keys(snapshot.tables).sort()).toEqual(Object.entries(contract.tables)
      .filter(([, table]) => table.kind === "table").map(([name]) => name).sort());

    const expected = {
      game_character: await sql`SELECT * FROM game_character ORDER BY id`,
      entry: await sql`SELECT * FROM entry ORDER BY id`,
      plan: await sql`SELECT * FROM plan ORDER BY id`,
      todo: await sql`SELECT * FROM todo ORDER BY id`,
      run_record: await sql`
        SELECT id, todo_id, run_date::text, units, started_at, ended_at, actual_minutes, done, use_yn, created_at
        FROM run_record ORDER BY id
      `,
    };
    const [counts] = await sql`
      SELECT (SELECT count(*)::int FROM game_character) AS game_character,
        (SELECT count(*)::int FROM entry) AS entry, (SELECT count(*)::int FROM plan) AS plan,
        (SELECT count(*)::int FROM todo) AS todo, (SELECT count(*)::int FROM run_record) AS run_record
    `;
    for (const table of Object.keys(expected) as (keyof typeof expected)[]) {
      const rows = snapshot.tables[table];
      expect(rows).toHaveLength(counts[table]);
      expect(normalizeTimestamps(rows)).toEqual(normalizeTimestamps(expected[table]));
      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual(Object.keys(contract.tables[table].columns).sort());
        for (const [key, value] of Object.entries(row)) {
          if (timestampColumns.has(key) && value !== null) expect(value).toMatch(dateWithOffset);
        }
      }
    }
    expect(snapshot.tables.game_character[1].id).toBe(big);
    expect(snapshot.tables.entry[0]).toMatchObject({ id: first.id, character_id: big, reward_meso: big, use_yn: "N" });
    expect(snapshot.tables.entry.filter((row) => row.root_id === first.root_id)).toHaveLength(3);
    expect(snapshot.tables.plan.find(({ id }) => id === source.id)).toMatchObject({ use_yn: "N" });
    expect(snapshot.tables.todo).toContainEqual(expect.objectContaining({ id: removed.id, use_yn: "N" }));
    expect(snapshot.tables.run_record).toEqual(expect.arrayContaining([
      expect.objectContaining({ todo_id: generated.id, started_at: expect.stringMatching(/\.123456/), units: 3, actual_minutes: 12 }),
      expect.objectContaining({ todo_id: manual.id, run_date: "2026-12-10", done: false, actual_minutes: 5 }),
      expect.objectContaining({ todo_id: improvement.todo.id, use_yn: "N", actual_minutes: 40 }),
    ]));
    const currentPlans = expected.plan.filter(({ use_yn }) => use_yn === "Y");
    expect(snapshot.retro).toHaveLength(currentPlans.length);
    for (const [index, current] of currentPlans.entries()) {
      const retro = await getRetro(sql, current.root_id, now);
      if (!retro) throw new Error("Expected the retro for a current plan.");
      const { plan, drill, done_without_minutes, ...totals } = retro;
      expect(snapshot.retro[index]).toEqual({ plan_root_id: plan.root_id, derived: true, ...totals });
    }
  }, 30_000);

  it("downloads escaped JSON with the four headers and names it by the Seoul calendar date", async () => {
    const plan = await event();
    const script = "<script>alert('test')</script>";
    await createTodo(sql, plan.root_id, { title: script, expected_minutes: 5 });
    for (const [instant, date] of [[midnightBefore, "2026-12-09"], [now, "2026-12-10"]] as const) {
      const response = await buildResponse(sql, instant);
      expect(response.status).toBe(200);
      expect(Object.fromEntries(response.headers)).toEqual({
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="pds-export-${date}.json"`,
        "x-content-type-options": "nosniff",
        "cache-control": "no-store",
      });
      const body = await response.text();
      expect(body).not.toContain("<script>");
      expect(body).toContain("\\u003cscript>");
      const parsed = JSON.parse(body) as ExportSnapshot;
      expect(parsed.tables.todo[0].title).toBe(script);
      expect(parsed.exported_at).toBe(instant.toISOString());
    }
  });
});

it("returns a generic 500 without driver, connection or SQL details", async () => {
  const fakeDetail = "postgres://fake:fake@export.example.invalid/db SELECT * FROM todo Error: stack";
  const sql = Object.assign(vi.fn<SqlClient>(), {
    query: vi.fn<SqlClient["query"]>().mockRejectedValue(new Error(fakeDetail)),
    transaction: vi.fn<SqlClient["transaction"]>(),
  });
  const response = await buildResponse(sql, now);
  expect(response.status).toBe(500);
  expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  expect(await response.text()).toBe("Could not export the diary.");
});
