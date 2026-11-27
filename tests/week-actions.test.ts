import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { loadWeekAction, setCountAction, setDoneAction, setMinutesAction } from "../app/week/actions";
import { connectDatabase } from "../db/client";
import { ensureCurrentPlans } from "../db/plans";
import { completeTodo, listRuns, setRunMinutes, uncompleteTodo } from "../db/runs";
import { createTodo, getTodo } from "../db/todos";
import { useTestDatabase } from "./helpers/db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db/client")>()),
  connectDatabase: vi.fn(),
}));

const now = new Date("2026-11-27T15:00:00.000Z");
const yesterday = new Date(now.getTime() - 1);
const today = "2026-11-28";

describe("week actions", () => {
  const sql = useTestDatabase();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(connectDatabase).mockReturnValue(sql);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  async function makeTodo(target_count = 1) {
    const { weekly } = await ensureCurrentPlans(sql, now);
    return createTodo(sql, weekly.root_id, { title: "Task", expected_minutes: 10, target_count });
  }

  it("is idempotent on both states, preserving today's run and minutes on undo", async () => {
    const todo = await makeTodo();
    const first = await setDoneAction(todo.id, true);
    expect(first).toMatchObject({ ok: true, run: { run_date: today, units: 1 } });
    await expect(setDoneAction(todo.id, true)).resolves.toEqual(first);
    await expect(listRuns(sql, todo.id)).resolves.toHaveLength(1);
    await setRunMinutes(sql, todo.id, today, 12);
    vi.mocked(revalidatePath).mockClear();
    await expect(setDoneAction(todo.id, false)).resolves.toEqual({ ok: true, run: null });
    await expect(setDoneAction(todo.id, false)).resolves.toEqual({ ok: true, run: null });
    await expect(listRuns(sql, todo.id)).resolves.toMatchObject([{ done: false, actual_minutes: 12 }]);
    await expect(getTodo(sql, todo.id)).resolves.toMatchObject({ done_n: 0, actual_minutes: 0 });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/");
    await expect(loadWeekAction()).resolves.toMatchObject({ ok: true, data: { today } });
  });

  it("undoes an earlier plain completion and creates a new run when completed today", async () => {
    const todo = await makeTodo();
    vi.setSystemTime(yesterday);
    const first = await setDoneAction(todo.id, true);
    expect(first).toMatchObject({ ok: true, run: { run_date: "2026-11-27", done: true } });
    await setRunMinutes(sql, todo.id, "2026-11-27", 12);
    const [previous] = await listRuns(sql, todo.id);

    vi.setSystemTime(now);
    await expect(uncompleteTodo(sql, todo.id, today, "plain")).resolves.toBe(false);
    vi.mocked(revalidatePath).mockClear();
    for (let repeat = 0; repeat < 2; repeat++) {
      await expect(setDoneAction(todo.id, false)).resolves.toEqual({ ok: true, run: null });
    }
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/");
    await expect(listRuns(sql, todo.id)).resolves.toEqual([{ ...previous, done: false }]);
    await expect(getTodo(sql, todo.id)).resolves.toMatchObject({ done_n: 0, is_done: false });
    await expect(loadWeekAction()).resolves.toMatchObject({
      ok: true, data: { today, weekly: { groups: [{ others: [{ id: todo.id, done_n: 0, is_done: false }] }] } },
    });

    await expect(setDoneAction(todo.id, true)).resolves.toMatchObject({ ok: true, run: { run_date: today, done: true } });
    const runs = await listRuns(sql, todo.id);
    expect(runs).toHaveLength(2);
    expect(runs[0]).toEqual({ ...previous, done: false });
    expect(runs[1].id).not.toBe(previous.id);
    await expect(getTodo(sql, todo.id)).resolves.toMatchObject({ done_n: 1, is_done: true });
  }, 30_000);

  it("sets today's count and undoes only today while retaining the stored units", async () => {
    const todo = await makeTodo(6);
    await completeTodo(sql, todo.id, yesterday, { units: 1 });
    await expect(setCountAction(todo.id, 3)).resolves.toMatchObject({ ok: true, run: { units: 3 } });
    await expect(setCountAction(todo.id, 3)).resolves.toMatchObject({ ok: true, run: { units: 3 } });
    await expect(getTodo(sql, todo.id)).resolves.toMatchObject({ done_n: 4 });
    await expect(setCountAction(todo.id, 0)).resolves.toEqual({ ok: true, run: null });
    await expect(getTodo(sql, todo.id)).resolves.toMatchObject({ done_n: 1 });
    await expect(listRuns(sql, todo.id)).resolves.toMatchObject([
      { run_date: "2026-11-27", done: true, units: 1 },
      { run_date: today, done: false, units: 3 },
    ]);
  });

  it("rejects actions for the wrong type and reports a completion on another day", async () => {
    const cumulative = await makeTodo(6);
    for (const done of [true, false]) {
      await expect(setDoneAction(cumulative.id, done)).resolves.toEqual({
        ok: false, field: "todo_id", message: "횟수를 정해서 확정하세요.",
      });
    }
    const { weekly } = await ensureCurrentPlans(sql, now);
    const plain = await createTodo(sql, weekly.root_id, { title: "Plain", expected_minutes: 10 });
    for (const units of [0, 1]) {
      await expect(setCountAction(plain.id, units)).resolves.toEqual({
        ok: false, field: "todo_id", message: "횟수형 할 일만 수정할 수 있습니다.",
      });
    }
    await completeTodo(sql, plain.id, yesterday);
    await expect(setDoneAction(plain.id, true)).resolves.toEqual({ ok: false, message: "이미 다른 날 완료했습니다." });
    expect(revalidatePath).not.toHaveBeenCalled();
    await expect(listRuns(sql, cumulative.id)).resolves.toEqual([]);
    await expect(listRuns(sql, plain.id)).resolves.toMatchObject([{ run_date: "2026-11-27" }]);
  });

  it("writes or clears only the minutes of an existing run", async () => {
    const todo = await makeTodo();
    const start = new Date(now.getTime() + 60_000);
    const end = new Date(now.getTime() + 120_000);
    await expect(setMinutesAction(todo.id, today, 12)).resolves.toEqual({ ok: true, run: null });
    expect(revalidatePath).not.toHaveBeenCalled();
    await completeTodo(sql, todo.id, now, { started_at: start, ended_at: end });
    await expect(setMinutesAction(todo.id, today, 10000)).resolves.toMatchObject({
      ok: true, run: { actual_minutes: 10000, started_at: start.toISOString(), ended_at: end.toISOString() },
    });
    await expect(setMinutesAction(todo.id, today, null)).resolves.toMatchObject({
      ok: true, run: { actual_minutes: null, started_at: start.toISOString(), ended_at: end.toISOString() },
    });
    expect(revalidatePath).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenLastCalledWith("/");
  });

  it("validates public action inputs and returns a generic reply for unexpected errors", async () => {
    await expect(setDoneAction("bad", true)).resolves.toMatchObject({ ok: false, field: "todo_id" });
    await expect(setDoneAction("1", "true" as unknown as boolean)).resolves.toMatchObject({ ok: false, field: "done" });
    await expect(setCountAction("bad", 1)).resolves.toMatchObject({ ok: false, field: "todo_id" });
    await expect(setCountAction("1", 1001)).resolves.toMatchObject({ ok: false, field: "units" });
    await expect(setMinutesAction("bad", today, 1)).resolves.toMatchObject({ ok: false, field: "todo_id" });
    await expect(setMinutesAction("1", "2026-02-29", 1)).resolves.toMatchObject({ ok: false, field: "run_date" });
    await expect(setMinutesAction("1", today, -1)).resolves.toMatchObject({ ok: false, field: "actual_minutes" });
    vi.mocked(connectDatabase).mockImplementationOnce(() => {
      throw new Error("postgres://example.invalid SELECT * FROM todo");
    });
    await expect(loadWeekAction()).resolves.toEqual({ ok: false, message: "요청을 처리하지 못했습니다. 다시 시도하세요." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
