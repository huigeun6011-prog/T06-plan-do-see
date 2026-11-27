"use server";

import { revalidatePath } from "next/cache";
import { connectDatabase } from "../../db/client";
import { completeTodo, setRunMinutes, uncompleteTodo, type TodoRunMode } from "../../db/runs";
import { loadWeek } from "../../db/week";
import { todaySeoul } from "../../lib/time";
import { validateUnitsToday, ValidationError } from "../../lib/validate";
import { withRegistrationResult } from "../register/action-result";
import type { Run, WeekActionResult, WeekData } from "./types";

export async function loadWeekAction(): Promise<WeekActionResult<{ data: WeekData }>> {
  return withRegistrationResult(async () => ({ ok: true, data: await loadWeek(connectDatabase(), new Date()) }));
}

async function setProgress(
  todoId: string, mode: TodoRunMode, done: boolean, units?: number,
): Promise<WeekActionResult<{ run: Run | null }>> {
  const sql = connectDatabase();
  const now = new Date();
  if (!done) {
    if (await uncompleteTodo(sql, todoId, todaySeoul(now), mode)) revalidatePath("/");
    return { ok: true, run: null };
  }
  const result = await completeTodo(sql, todoId, now, units === undefined ? undefined : { units }, mode);
  if ("alreadyDone" in result) return { ok: false, message: "이미 다른 날 완료했습니다." };
  revalidatePath("/");
  return { ok: true, run: result.run };
}

export async function setDoneAction(todoId: string, done: boolean): Promise<WeekActionResult<{ run: Run | null }>> {
  return withRegistrationResult<{ run: Run | null }>(() => {
    if (typeof done !== "boolean") throw new ValidationError("done", "완료 여부를 선택하세요.");
    return setProgress(todoId, "plain", done);
  });
}

export async function setCountAction(todoId: string, unitsToday: number): Promise<WeekActionResult<{ run: Run | null }>> {
  return withRegistrationResult<{ run: Run | null }>(() => {
    const units = validateUnitsToday(unitsToday);
    return setProgress(todoId, "cumulative", units > 0, units);
  });
}

export async function setMinutesAction(
  todoId: string, runDate: string, minutes: number | null,
): Promise<WeekActionResult<{ run: Run | null }>> {
  return withRegistrationResult(async () => {
    const run = await setRunMinutes(connectDatabase(), todoId, runDate, minutes);
    if (run) revalidatePath("/");
    return { ok: true, run };
  });
}
