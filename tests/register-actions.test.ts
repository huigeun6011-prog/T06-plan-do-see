import { beforeEach, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { commitEntryLinesAction, previewEntryLinesAction, saveEntryAction } from "../app/register/actions";
import { withRegistrationResult } from "../app/register/action-result";
import type { EntryInput, EntryLineDefaults } from "../app/register/types";
import { connectDatabase, type SqlClient } from "../db/client";
import { editEntry } from "../db/entries";
import { MAX_WEEKLY_BOSSES_PER_CHARACTER } from "../lib/limits";
import { ValidationError } from "../lib/validate";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../db/client", () => ({ connectDatabase: vi.fn() }));
vi.mock("../db/entries", () => ({ editEntry: vi.fn() }));

const defaults: EntryLineDefaults = { period_kind: "weekly", kind: "mission", character_id: null };
const input: EntryInput = { title: "Boss", period_kind: "weekly", clear_minutes: 1, party_size: 1, reward_meso: 0 };

beforeEach(() => vi.resetAllMocks());

it("maps a stale edit to the requested conflict message and revalidates only a successful edit", async () => {
  const edit = vi.mocked(editEntry);
  edit.mockResolvedValueOnce({ conflict: true }).mockResolvedValueOnce({ id: "8" });
  await expect(saveEntryAction("1", "7", input)).resolves.toEqual({
    ok: false, message: "다른 곳에서 먼저 수정되었습니다. 새로고침하세요.",
  });
  expect(edit.mock.calls[0].slice(1)).toEqual(["1", "7", input]);
  expect(revalidatePath).not.toHaveBeenCalled();
  await expect(saveEntryAction("1", "7", input)).resolves.toEqual({ ok: true, id: "8" });
  expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/register");
});

it("returns typed validation messages and sanitizes unexpected errors", async () => {
  await expect(withRegistrationResult(() => { throw new ValidationError("title", "Enter a title."); }))
    .resolves.toEqual({ ok: false, field: "title", message: "Enter a title." });
  vi.mocked(editEntry).mockRejectedValue(new Error("postgres://fake:fake@fake.example.invalid SELECT * FROM entry"));
  await expect(saveEntryAction("1", "7", input)).resolves.toEqual({
    ok: false, message: "요청을 처리하지 못했습니다. 다시 시도하세요.",
  });
});

it("previews without connecting and rejects oversized or partially invalid pastes before SQL", async () => {
  await expect(previewEntryLinesAction("Valid / 2\nInvalid / zero", defaults)).resolves.toMatchObject({
    ok: true, rows: [{ line: 1 }], errors: [{ line: 2, field: "clear_minutes" }],
  });
  await expect(commitEntryLinesAction("Valid / 2\nInvalid / zero", defaults)).resolves.toMatchObject({
    ok: false, errors: [{ line: 2, field: "clear_minutes" }],
  });
  for (const text of ["x".repeat(20_001), "# comment\n".repeat(201)]) {
    await expect(commitEntryLinesAction(text, defaults)).resolves.toMatchObject({
      ok: false, field: "text", errors: [{ line: 0 }],
    });
  }
  expect(connectDatabase).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

it("reports weekly boss overflow and account-level bosses as line-zero preview errors", async () => {
  const query = vi.fn<SqlClient["query"]>().mockResolvedValue([{ remaining: 2 }]);
  vi.mocked(connectDatabase).mockReturnValue(Object.assign(vi.fn<SqlClient>(), {
    query, transaction: vi.fn<SqlClient["transaction"]>(),
  }));
  await expect(previewEntryLinesAction("One/1\nTwo/1\nThree/1", {
    ...defaults, kind: "boss", character_id: "1",
  })).resolves.toMatchObject({
    ok: true, errors: [{
      line: 0, field: "boss_limit", message: `보스는 캐릭터당 최대 ${MAX_WEEKLY_BOSSES_PER_CHARACTER}개입니다 (남은 칸 2).`,
    }],
  });
  expect(query).toHaveBeenCalledExactlyOnceWith(expect.any(String), [
    JSON.stringify([{ character_id: "1", requested: 3 }]), MAX_WEEKLY_BOSSES_PER_CHARACTER,
  ]);
  await expect(previewEntryLinesAction("Boss/1", { ...defaults, kind: "boss" })).resolves.toMatchObject({
    ok: true, errors: [{ line: 0, field: "kind", message: "계정 단위에는 미션만 등록할 수 있습니다." }],
  });
  expect(query).toHaveBeenCalledTimes(1);
});
