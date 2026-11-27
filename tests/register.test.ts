import { describe, expect, it, vi } from "vitest";
import { createCharacter } from "../db/characters";
import { createEntry, deleteEntry, editEntry, getEntryHistory, listEntries } from "../db/entries";
import { commitEntryLines, loadRegistration, reorderCharacters, reorderEntries } from "../db/register";
import { parseEntryLines } from "../lib/entry-lines";
import { useTestDatabase } from "./helpers/db";

const now = new Date("2026-11-27T10:00:00Z");
const input = { title: "Boss", period_kind: "weekly" as const, clear_minutes: 2, reward_meso: 0, party_size: 1, tags: ["mission"] };

describe("registration services", () => {
  const sql = useTestDatabase();
  const paste = (text: string, character_id: string | null = null) => {
    const { rows, errors } = parseEntryLines(text, { period_kind: "weekly", kind: "mission", character_id });
    expect(errors).toEqual([]);
    return rows;
  };

  it("groups ordered current registrations, including account-level and empty character groups", async () => {
    const first = await createCharacter(sql, "First");
    const second = await createCharacter(sql, "Second");
    const original = await createEntry(sql, { ...input, character_id: first.id, sort_order: 4 });
    const leading = await createEntry(sql, { ...input, title: "Earlier", character_id: first.id, sort_order: -1 });
    const tied = await createEntry(sql, { ...input, title: "Tie", character_id: first.id, sort_order: -1 });
    const revised = await editEntry(sql, original.root_id, original.id, {
      ...input, title: "Version two", character_id: first.id, sort_order: 4,
    });
    const accountEntry = await createEntry(sql, input);
    const deleted = await createEntry(sql, { ...input, title: "Deleted" });
    await deleteEntry(sql, deleted.root_id);
    await reorderCharacters(sql, [second.id, first.id]);
    const loaded = await loadRegistration(sql);
    expect(loaded.characters).toMatchObject([
      { character: { id: second.id }, entries: [] },
      { character: { id: first.id }, entries: [
        { id: leading.id, version_id: leading.id }, { id: tied.id },
        { root_id: original.root_id, version_id: "id" in revised ? revised.id : null, title: "Version two" },
      ] },
    ]);
    expect(loaded.account).toEqual({ character: null, entries: [{ ...accountEntry, version_id: accountEntry.id }] });
  });

  it("reorders entries and characters in a single statement each without adding versions", async () => {
    const first = await createCharacter(sql, "First");
    const second = await createCharacter(sql, "Second");
    const a = await createEntry(sql, { ...input, character_id: first.id });
    const b = await createEntry(sql, { ...input, title: "Second", character_id: first.id, sort_order: 1 });
    const edited = await editEntry(sql, b.root_id, b.id, { ...input, title: "Changed", character_id: first.id, sort_order: 1 });
    if (!("id" in edited)) throw new Error("Expected an edit.");
    const deleted = await createEntry(sql, { ...input, title: "Deleted" });
    await deleteEntry(sql, deleted.root_id);
    const connection = vi.fn(sql);
    const counted = Object.assign(connection, { query: vi.fn(sql.query), transaction: vi.fn(sql.transaction) });

    await expect(reorderEntries(counted, [b.root_id, a.root_id, deleted.root_id, "99999", edited.id])).resolves.toBe(2);
    expect(connection).toHaveBeenCalledTimes(1);
    expect(counted.query).not.toHaveBeenCalled();
    expect(counted.transaction).not.toHaveBeenCalled();
    await expect(reorderEntries(sql, [b.root_id, a.root_id])).resolves.toBe(0);
    await expect(getEntryHistory(sql, b.root_id)).resolves.toMatchObject([
      { id: b.id, sort_order: 1, use_yn: "N" }, { id: edited.id, sort_order: 0, use_yn: "Y" },
    ]);
    await expect(getEntryHistory(sql, deleted.root_id)).resolves.toMatchObject([{ sort_order: 0, use_yn: "N" }]);
    expect((await listEntries(sql, { character_id: first.id })).map(({ root_id }) => root_id)).toEqual([b.root_id, a.root_id]);
    await expect(reorderEntries(sql, [a.root_id, "bad"])).rejects.toMatchObject({ field: "root_id" });
    expect((await listEntries(sql, { character_id: first.id })).map(({ root_id }) => root_id)).toEqual([b.root_id, a.root_id]);

    connection.mockClear();
    await expect(reorderCharacters(counted, [second.id, first.id, "99999"])).resolves.toBe(1);
    expect(connection).toHaveBeenCalledTimes(1);
    expect((await loadRegistration(sql)).characters.map(({ character }) => character.id)).toEqual([second.id, first.id]);
  });

  it("reports every conflicting line and writes no part of the paste", async () => {
    const character = await createCharacter(sql, "First");
    await createEntry(sql, { ...input, title: "Existing", tags: ["boss"], character_id: character.id });
    await createEntry(sql, { ...input, title: "Other", tags: ["mission"], character_id: character.id });
    const before = await listEntries(sql);
    const rows = paste("# comment\nExisting / 1\nFresh / 2\nOther / 3", character.id);
    await expect(commitEntryLines(sql, rows, now)).resolves.toEqual({ entries: [], conflictingLines: [2, 4] });
    await expect(listEntries(sql)).resolves.toEqual(before);
    await expect(commitEntryLines(sql, paste("Fresh / 1\nSecond / 1", "99999"), now))
      .rejects.toMatchObject({ field: "character_id" });
    await expect(listEntries(sql)).resolves.toEqual(before);
  });

  it("creates each pasted row once, preserving kind, script text and the supplied timestamp", async () => {
    const script = "<script>alert('test')</script>";
    const rows = paste(`${script}\t3\t2\t${script}\n지하수로/12분`);
    const result = await commitEntryLines(sql, rows, now);
    expect(result.conflictingLines).toEqual([]);
    expect(result.entries.map(({ id, root_id, created_at, title, memo, tags }) => ({ id, root_id, created_at, title, memo, tags })))
      .toEqual([
        { id: result.entries[0].id, root_id: result.entries[0].id, created_at: now.toISOString(), title: script, memo: script, tags: ["mission"] },
        { id: result.entries[1].id, root_id: result.entries[1].id, created_at: now.toISOString(), title: "지하수로", memo: "", tags: ["mission"] },
      ]);
    await expect(listEntries(sql)).resolves.toEqual(result.entries);
  });

  it("serializes conflicting pastes so the losing batch writes nothing", async () => {
    const results = await Promise.all([
      commitEntryLines(sql, paste("Shared/1\nFirst only/1"), now),
      commitEntryLines(sql, paste("Shared/1\nSecond only/1"), now),
    ]);
    const winners = results.filter(({ conflictingLines }) => !conflictingLines.length);
    expect(winners).toHaveLength(1);
    expect(results.filter(({ conflictingLines }) => conflictingLines.length))
      .toEqual([{ conflictingLines: [1], entries: [] }]);
    await expect(listEntries(sql)).resolves.toEqual(winners[0].entries);
  });

  it("appends single and pasted entries after a reorder and keeps an edited entry in place", async () => {
    const first = await createEntry(sql, { ...input, title: "First" });
    const second = await createEntry(sql, { ...input, title: "Second" });
    const third = await createEntry(sql, { ...input, title: "Third" });
    await reorderEntries(sql, [third.root_id, first.root_id, second.root_id]);

    const single = await createEntry(sql, { ...input, title: "Single" });
    expect(single.sort_order).toBe(3);
    const batch = await commitEntryLines(sql, paste("Zulu/1\nAlpha/1\nMiddle/1").reverse(), now);
    expect(batch.entries.map(({ title, sort_order }) => [title, sort_order]))
      .toEqual([["Zulu", 4], ["Alpha", 5], ["Middle", 6]]);

    await expect(editEntry(sql, second.root_id, second.id, { ...input, title: "Edited", sort_order: 2 }))
      .resolves.toHaveProperty("id");
    expect((await listEntries(sql)).map(({ title, sort_order }) => [title, sort_order])).toEqual([
      ["Third", 0], ["First", 1], ["Edited", 2], ["Single", 3],
      ["Zulu", 4], ["Alpha", 5], ["Middle", 6],
    ]);
  });

  it("appends by group and excludes deleted orders while preserving explicit values", async () => {
    const a = await createCharacter(sql, "First");
    const b = await createCharacter(sql, "Second");
    const retired = await createEntry(sql, { ...input, title: "Old", character_id: a.id, sort_order: 100 });
    await deleteEntry(sql, retired.root_id);
    await createEntry(sql, { ...input, sort_order: 9 });
    await createEntry(sql, { ...input, character_id: a.id, sort_order: 4 });
    await expect(createEntry(sql, { ...input, character_id: b.id })).resolves.toMatchObject({ sort_order: 0 });

    const batch = await commitEntryLines(sql, [
      paste("Account/1")[0],
      { ...paste("Next A/1", a.id)[0], line: 2 },
      { ...paste("Next B/1", b.id)[0], line: 3 },
      { line: 4, input: { ...input, title: "Explicit", character_id: a.id, sort_order: -4 } },
      { ...paste("Another A/1", a.id)[0], line: 5 },
    ], now);
    expect(batch.entries.map(({ sort_order }) => sort_order)).toEqual([10, 5, 1, -4, 6]);
  });

  it("keeps concurrent adds after existing entries with a stable order by position and ID", async () => {
    const existing = await createEntry(sql, { ...input, sort_order: 7 });
    const added = await Promise.all([
      createEntry(sql, { ...input, title: "Parallel A" }),
      createEntry(sql, { ...input, title: "Parallel B" }),
    ]);
    expect(added.every(({ sort_order }) => sort_order > existing.sort_order)).toBe(true);
    const ordered = added.sort((a, b) => a.sort_order - b.sort_order || Number(a.id) - Number(b.id));
    await expect(listEntries(sql)).resolves.toEqual([existing, ...ordered]);
  });

  it("still appends by ID when the highest order is already the integer limit", async () => {
    const max = 2147483647;
    const existing = await createEntry(sql, { ...input, sort_order: max });
    const single = await createEntry(sql, { ...input, title: "Single" });
    const batch = await commitEntryLines(sql, paste("First/1\nSecond/1"), now);
    const expected = [existing, single, ...batch.entries];
    expect(expected.map(({ sort_order }) => sort_order)).toEqual([max, max, max, max]);
    await expect(listEntries(sql)).resolves.toEqual(expected);
  });
});
