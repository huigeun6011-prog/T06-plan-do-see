import { entryKind } from "./limits";

export type WeekTodoKind = "boss" | "mission" | "other";
export type WeekProgress = {
  target_count: number;
  done_n: number;
  expected_minutes: number;
  is_done: boolean;
};
export type WeekTotals = {
  total_todos: number;
  done_todos: number;
  remaining_todos: number;
  remaining_minutes: number;
};

export function classifyWeekTodo(todo: { entry_id: string | null; tags: string[] }): WeekTodoKind {
  return todo.entry_id === null ? "other" : entryKind(todo.tags);
}

export function remainingUnits(todo: Pick<WeekProgress, "target_count" | "done_n">): number {
  return Math.max(todo.target_count - todo.done_n, 0);
}

export function remainingMinutes(todo: Omit<WeekProgress, "is_done">): number {
  return remainingUnits(todo) * Math.round(todo.expected_minutes / todo.target_count);
}

export function weekTotals(todos: readonly WeekProgress[]): WeekTotals {
  const totals = { total_todos: todos.length, done_todos: 0, remaining_todos: 0, remaining_minutes: 0 };
  for (const todo of todos) {
    if (todo.is_done) totals.done_todos++;
    else {
      totals.remaining_todos++;
      totals.remaining_minutes += remainingMinutes(todo);
    }
  }
  return totals;
}
