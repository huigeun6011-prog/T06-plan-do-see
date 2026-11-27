import type { RegistrationActionResult } from "../register/types";

export type { WeekCharacter, WeekData, WeekGroup, WeekPeriod, WeekTodo } from "../../db/week";
export type { WeekProgress, WeekTodoKind, WeekTotals } from "../../lib/week-logic";
export type { Plan } from "../../db/plans";
export type { Run } from "../../db/runs";
export type WeekActionResult<T extends object> = RegistrationActionResult<T>;
