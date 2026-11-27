import { describe, expect, it } from "vitest";
import { createCharacter, listCharacters, renameCharacter, setCharacterOrder } from "../db/characters";
import { createEntry, deleteEntry, editEntry, getEntryHistory, listEntries } from "../db/entries";
import { type EntryInput, ValidationError } from "../lib/validate";
import { useTestDatabase } from "./helpers/db";

const base: EntryInput = {
  title: "Boss",
  period_kind: "weekly",
  clear_minutes: 5,
  reward_meso: "9007199254740991",
  party_size: 1,
  tags: ["mission", "with, commas"],
};

describe("characters and registrations", () => {
  const sql = useTestDatabase();

  it("creates, renames and reorders characters with deterministic ties", async () => {
    const first = await createCharacter(sql, "  아크  ");
    const second = await createCharacter(sql, "팔라딘");
    const third = await createCharacter(sql, "Job 'quote'");
    expect(first).toEqual({
      id: expect.any(String), name: "아크", sort_order: 0, created_at: expect.any(String),
    });
    expect(new Date(first.created_at).toISOString()).toBe(first.created_at);
    await expect(createCharacter(sql, " 아크 ")).rejects.toMatchObject({ field: "name" });
    await expect(renameCharacter(sql, second.id, "아크")).rejects.toMatchObject({ field: "name" });
    await expect(renameCharacter(sql, second.id, "  듀얼블레이드 ")).resolves.toMatchObject({
      id: second.id, name: "듀얼블레이드",
    });
    await expect(setCharacterOrder(sql, third.id, -1)).resolves.toMatchObject({
      id: third.id, sort_order: -1,
    });
    expect((await listCharacters(sql)).map(({ id }) => id)).toEqual([third.id, first.id, second.id]);
  });

  it("keeps the original and two edits under the same root in version order", async () => {
    const original = await createEntry(sql, base);
    expect(original).toMatchObject({
      id: expect.any(String), reward_meso: base.reward_meso, tags: base.tags, use_yn: "Y",
    });
    expect(original.id).toBe(original.root_id);
    expect(new Date(original.created_at).toISOString()).toBe(original.created_at);

    const first = await editEntry(sql, original.root_id, original.id, { ...base, clear_minutes: 8 });
    if (!("id" in first)) throw new Error("First edit unexpectedly conflicted.");
    const second = await editEntry(sql, original.root_id, first.id, { ...base, title: "New", memo: "edit two" });
    if (!("id" in second)) throw new Error("Second edit unexpectedly conflicted.");
    const history = await getEntryHistory(sql, original.root_id);
    expect(history).toEqual([
      { ...original, use_yn: "N" },
      { ...original, id: first.id, use_yn: "N", clear_minutes: 8, created_at: expect.any(String) },
      { ...original, id: second.id, title: "New", memo: "edit two", created_at: expect.any(String) },
    ]);
  });

  it("enforces current title uniqueness per character and for account-level entries", async () => {
    const first = await createCharacter(sql, "First");
    const second = await createCharacter(sql, "Second");
    const entry = await createEntry(sql, { ...base, character_id: first.id });
    await expect(createEntry(sql, { ...base, character_id: first.id })).rejects.toMatchObject({ field: "title" });
    await expect(createEntry(sql, { ...base, character_id: second.id })).resolves.toMatchObject({ title: base.title });
    await expect(deleteEntry(sql, entry.root_id)).resolves.toBe(true);
    await expect(createEntry(sql, { ...base, character_id: first.id })).resolves.toMatchObject({ title: base.title });
    await expect(createEntry(sql, base)).resolves.toMatchObject({ character_id: null });
    await expect(createEntry(sql, { ...base, character_id: null })).rejects.toMatchObject({ field: "title" });
  });

  it("requires an existing character when a character ID is supplied", async () => {
    const input = { ...base, character_id: "9223372036854775807" };
    await expect(createEntry(sql, input)).rejects.toBeInstanceOf(ValidationError);
    await expect(createEntry(sql, input)).rejects.toMatchObject({ field: "character_id" });
  });

  it("saves exactly one of five parallel edits of the same version", async () => {
    const original = await createEntry(sql, base);
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((attempt) =>
        editEntry(sql, original.root_id, original.id, { ...base, memo: String(attempt) }),
      ),
    );
    const history = await getEntryHistory(sql, original.root_id);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ ...original, use_yn: "N" });
    expect(history[1]).toMatchObject({ root_id: original.root_id, use_yn: "Y" });
    expect(results.filter((result) => "conflict" in result)).toEqual(Array(4).fill({ conflict: true }));
    expect(results.filter((result) => "id" in result)).toEqual([{ id: history[1].id }]);
    expect(history[1].memo).toBe(String(results.findIndex((result) => "id" in result) + 1));
  });

  it("returns a conflict after deletion and never resurrects the entry", async () => {
    const original = await createEntry(sql, base);
    await expect(deleteEntry(sql, original.root_id)).resolves.toBe(true);
    await expect(editEntry(sql, original.root_id, original.id, base)).resolves.toEqual({ conflict: true });
    await expect(deleteEntry(sql, original.root_id)).resolves.toBe(false);
    await expect(getEntryHistory(sql, original.root_id)).resolves.toEqual([{ ...original, use_yn: "N" }]);
  });

  it("keeps the old row current when PostgreSQL rejects the replacement", async () => {
    const original = await createEntry(sql, base);
    await createEntry(sql, { ...base, title: "Taken" });
    await expect(editEntry(sql, original.root_id, original.id, { ...base, title: "Taken" }))
      .rejects.toMatchObject({ field: "title" });
    await expect(getEntryHistory(sql, original.root_id)).resolves.toEqual([original]);
  });

  it("lists current entries ordered by sort order and ID, with both filters", async () => {
    const character = await createCharacter(sql, "Character");
    const original = await createEntry(sql, { ...base, character_id: character.id });
    const monthly = await createEntry(sql, { ...base, title: "Monthly", period_kind: "monthly", sort_order: -1 });
    const weekly = await createEntry(sql, { ...base, title: "Weekly" });
    const deleted = await createEntry(sql, { ...base, title: "Deleted" });
    await deleteEntry(sql, deleted.root_id);
    const edited = await editEntry(sql, original.root_id, original.id, { ...base, character_id: character.id });
    if (!("id" in edited)) throw new Error("Edit unexpectedly conflicted.");

    const ids = async (filters?: Parameters<typeof listEntries>[1]) =>
      (await listEntries(sql, filters)).map(({ id }) => id);
    await expect(ids()).resolves.toEqual([monthly.id, weekly.id, edited.id]);
    await expect(ids({ period_kind: "weekly" })).resolves.toEqual([weekly.id, edited.id]);
    await expect(ids({ character_id: character.id })).resolves.toEqual([edited.id]);
    await expect(ids({ character_id: null })).resolves.toEqual([monthly.id, weekly.id]);
    await expect(ids({ character_id: character.id, period_kind: "monthly" })).resolves.toEqual([]);
    await expect(ids({ character_id: null, period_kind: "monthly" })).resolves.toEqual([monthly.id]);
  });
});
