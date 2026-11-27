import type { EntryEditResult } from "../../db/entries";
import { ValidationError } from "../../lib/validate";
import type { RegistrationActionResult } from "./types";

export async function withRegistrationResult<T extends object>(
  work: () => RegistrationActionResult<T> | Promise<RegistrationActionResult<T>>,
): Promise<RegistrationActionResult<T>> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, field: error.field, message: error.message };
    return { ok: false, message: "요청을 처리하지 못했습니다. 다시 시도하세요." };
  }
}

export function entryEditActionResult(result: EntryEditResult): RegistrationActionResult<{ id: string }> {
  if ("conflict" in result) return { ok: false, message: "다른 곳에서 먼저 수정되었습니다. 새로고침하세요." };
  return { ok: true, id: result.id };
}
