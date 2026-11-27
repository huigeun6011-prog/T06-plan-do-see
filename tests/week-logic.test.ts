import { expect, it } from "vitest";
import { classifyWeekTodo, remainingMinutes, remainingUnits, weekTotals } from "../lib/week-logic";

it("classifies generated todos by their tags and hand-made todos separately", () => {
  expect(classifyWeekTodo({ entry_id: null, tags: ["improvement", "boss"] })).toBe("other");
  expect(classifyWeekTodo({ entry_id: "1", tags: ["boss", "mission"] })).toBe("boss");
  expect(classifyWeekTodo({ entry_id: "2", tags: ["mission"] })).toBe("mission");
  expect(classifyWeekTodo({ entry_id: "3", tags: [] })).toBe("boss");
});

it("totals by is_done, rounds the per-unit estimate and clamps excess completed units", () => {
  const partial = { target_count: 6, done_n: 2, expected_minutes: 15, is_done: false };
  const finished = { ...partial, done_n: 8, is_done: true };
  expect(remainingUnits(partial)).toBe(4);
  expect(remainingMinutes(partial)).toBe(12);
  expect(remainingUnits(finished)).toBe(0);
  expect(remainingMinutes(finished)).toBe(0);
  expect(weekTotals([partial, finished])).toEqual({
    total_todos: 2, done_todos: 1, remaining_todos: 1, remaining_minutes: 12,
  });
  expect(weekTotals([])).toEqual({ total_todos: 0, done_todos: 0, remaining_todos: 0, remaining_minutes: 0 });
});
