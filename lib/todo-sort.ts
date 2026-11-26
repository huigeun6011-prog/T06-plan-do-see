import { ValidationError } from "./validate";

const labels = {
  due_at: { asc: "마감 빠른 순", desc: "마감 늦은 순" },
  priority: { asc: "우선순위 높은 순", desc: "우선순위 낮은 순" },
  title: { asc: "제목 오름차순", desc: "제목 내림차순" },
  created_at: { asc: "등록 오래된 순", desc: "등록 최근 순" },
  expected_minutes: { asc: "예상 시간 짧은 순", desc: "예상 시간 긴 순" },
};

export type TodoSort = { key: keyof typeof labels; direction: "asc" | "desc" };

export function validateTodoSort(sort: TodoSort): TodoSort {
  const { key, direction } = sort ?? {};
  if (typeof key !== "string" || !Object.hasOwn(labels, key)) {
    throw new ValidationError("sort", "Choose a supported sort key.");
  }
  if (direction !== "asc" && direction !== "desc") {
    throw new ValidationError("direction", "Choose asc or desc.");
  }
  return { key, direction };
}

export function describeSort(sort: TodoSort): string {
  const { key, direction } = validateTodoSort(sort);
  return `${labels[key][direction]}, 같으면 등록순`;
}
