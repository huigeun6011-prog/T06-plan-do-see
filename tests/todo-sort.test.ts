import { expect, it } from "vitest";
import { describeSort } from "../lib/todo-sort";

it.each([
  ["due_at", "asc", "마감 빠른 순"], ["due_at", "desc", "마감 늦은 순"],
  ["priority", "asc", "우선순위 높은 순"], ["priority", "desc", "우선순위 낮은 순"],
  ["title", "asc", "제목 오름차순"], ["title", "desc", "제목 내림차순"],
  ["created_at", "asc", "등록 오래된 순"], ["created_at", "desc", "등록 최근 순"],
  ["expected_minutes", "asc", "예상 시간 짧은 순"], ["expected_minutes", "desc", "예상 시간 긴 순"],
] as const)("describes %s %s", (key, direction, text) => {
  expect(describeSort({ key, direction })).toBe(`${text}, 같으면 등록순`);
});
