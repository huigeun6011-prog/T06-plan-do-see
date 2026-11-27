import { describe, expect, it } from "vitest";
import { createCharacter } from "../db/characters";
import { bossSlotRequests, checkBossSlots } from "../db/entry-limits";
import { createEntry, deleteEntry, editEntry, getEntryHistory, listEntries } from "../db/entries";
import { commitEntryLines } from "../db/register";
import { parseEntryLines } from "../lib/entry-lines";
import { entryKind, MAX_WEEKLY_BOSSES_PER_CHARACTER as max } from "../lib/limits";
import { type EntryInput, ValidationError } from "../lib/validate";
import { useTestDatabase } from "./helpers/db";

const now = new Date("2026-11-27T10:00:00Z");
const base: EntryInput = { title: "Boss", period_kind: "weekly", clear_minutes: 1, reward_meso: 0, party_size: 1 };
const limit = { field: "boss_limit", message: `보스는 캐릭터당 최대 ${max}개입니다.` };
const remaining = (slots: number) => ({
  field: "boss_limit", message: `보스는 캐릭터당 최대 ${max}개입니다 (남은 칸 ${slots}).`,
});
const account = { field: "kind", message: "계정 단위에는 미션만 등록할 수 있습니다." };

it.each([
  [[], "boss"], [["mission", "boss"], "boss"], [["mission"], "mission"],
  [["boss"], "boss"], [["unknown"], "boss"], [["mission", "unknown"], "mission"],
] as [string[], "boss" | "mission"][])("classifies %j as %s", (tags, kind) => {
  expect(entryKind(tags)).toBe(kind);
});

describe("registration limits", () => {
  const sql = useTestDatabase();
  function paste(character_id: string | null, number: number, prefix: string, kind: "mission" | "boss" = "boss") {
    const text = Array.from({ length: number }, (_, i) => `${prefix} ${i}/1`).join("\n");
    const { rows, errors } = parseEntryLines(text, { period_kind: "weekly", character_id, kind });
    expect(errors).toEqual([]);
    return rows;
  }

  async function seed(characterId: string, count: number) {
    const { entries, conflictingLines } = await commitEntryLines(sql, paste(characterId, count, "Seed"), now);
    expect(conflictingLines).toEqual([]);
    expect(entries).toHaveLength(count);
    return entries;
  }

  it("allows the final weekly boss slot and excludes monthly bosses and missions", async () => {
    const a = await createCharacter(sql, "First");
    const b = await createCharacter(sql, "Second");
    await seed(a.id, max - 1);
    // An untagged entry consumes a slot. A mission tag cannot override a boss tag.
    await expect(createEntry(sql, { ...base, character_id: a.id })).resolves.toMatchObject({ tags: [] });
    await expect(createEntry(sql, { ...base, character_id: a.id, title: "Both", tags: ["mission", "boss"] }))
      .rejects.toMatchObject(limit);
    await expect(createEntry(sql, { ...base, title: "Monthly", character_id: a.id, period_kind: "monthly" }))
      .resolves.toMatchObject({ period_kind: "monthly" });
    await expect(commitEntryLines(sql, paste(a.id, 30, "Mission", "mission"), now))
      .resolves.toMatchObject({ entries: expect.arrayContaining([expect.objectContaining({ title: "Mission 29" })]) });
    await expect(createEntry(sql, { ...base, character_id: b.id })).resolves.toMatchObject({ character_id: b.id });
    expect(await listEntries(sql, { character_id: a.id })).toHaveLength(max + 31);
  });

  it("counts each current root once, frees deleted slots and gates edits before retiring a version", async () => {
    const character = await createCharacter(sql, "First");
    const [original] = await seed(character.id, max);
    let version = original.id;
    for (const memo of ["One", "Two"]) {
      const result = await editEntry(sql, original.root_id, version, { ...original, memo });
      if (!("id" in result)) throw new Error("Expected the counted boss to stay editable.");
      version = result.id;
    }
    expect(await getEntryHistory(sql, original.root_id)).toHaveLength(3);
    const monthly = await createEntry(sql, { ...base, character_id: character.id, period_kind: "monthly" });
    const weekly = { ...monthly, period_kind: "weekly" as const };
    await expect(editEntry(sql, monthly.root_id, monthly.id, weekly)).rejects.toMatchObject(limit);
    await expect(getEntryHistory(sql, monthly.root_id)).resolves.toEqual([monthly]);
    await expect(deleteEntry(sql, original.root_id)).resolves.toBe(true);
    await expect(editEntry(sql, monthly.root_id, monthly.id, weekly)).resolves.toHaveProperty("id");
    await expect(createEntry(sql, { ...base, title: "Extra", character_id: character.id })).rejects.toMatchObject(limit);
  });

  it("requires missions at account level on creation, batch commit and edits", async () => {
    await expect(createEntry(sql, base)).rejects.toBeInstanceOf(ValidationError);
    await expect(createEntry(sql, { ...base, period_kind: "monthly", tags: ["unknown"] })).rejects.toMatchObject(account);
    await expect(commitEntryLines(sql, paste(null, 2, "Account boss"), now)).rejects.toMatchObject(account);
    const character = await createCharacter(sql, "First");
    const boss = await createEntry(sql, { ...base, character_id: character.id });
    await expect(editEntry(sql, boss.root_id, boss.id, { ...base, character_id: null })).rejects.toMatchObject(account);
    await expect(getEntryHistory(sql, boss.root_id)).resolves.toEqual([boss]);
    const mission = await createEntry(sql, { ...base, tags: ["mission"] });
    expect(mission.character_id).toBeNull();
    await expect(editEntry(sql, mission.root_id, mission.id, base)).rejects.toMatchObject(account);
    await expect(commitEntryLines(sql, paste(null, 1, "Account mission", "mission"), now))
      .resolves.toMatchObject({ entries: [{ character_id: null, tags: ["mission"] }] });
  });

  it("rejects an oversized mixed batch in full, reports remaining slots and accepts an exact fit", async () => {
    const character = await createCharacter(sql, "First");
    const before = await seed(character.id, max - 2);
    const tooMany = paste(character.id, 3, "Too many");
    const rows = [...tooMany, { ...paste(null, 1, "Account mission", "mission")[0], line: 4 }];
    await expect(checkBossSlots(sql, bossSlotRequests(rows.map(({ input }) => input))))
      .rejects.toMatchObject(remaining(2));
    await expect(commitEntryLines(sql, rows, now)).rejects.toMatchObject(remaining(2));
    await expect(listEntries(sql)).resolves.toEqual(before);
    await expect(commitEntryLines(sql, paste(character.id, 2, "Fit"), now))
      .resolves.toMatchObject({ entries: [{ title: "Fit 0" }, { title: "Fit 1" }], conflictingLines: [] });
  });

  it.each([[1, 2], [2, 5]])("with %s slots open, permits exactly that many of %s parallel adds", async (slots, attempts) => {
    const character = await createCharacter(sql, "First");
    await seed(character.id, max - slots);
    const results = await Promise.allSettled(Array.from({ length: attempts }, (_, index) =>
      createEntry(sql, { ...base, title: `Parallel ${index}`, character_id: character.id }),
    ));
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(slots);
    for (const result of results) {
      if (result.status === "rejected") expect(result.reason).toMatchObject(limit);
    }
    expect(await listEntries(sql, { character_id: character.id })).toHaveLength(max);
  });

  it("serializes single, bulk and edit writes competing for the same boss slot", async () => {
    const character = await createCharacter(sql, "First");
    await seed(character.id, max - 1);
    const monthly = await createEntry(sql, { ...base, character_id: character.id, period_kind: "monthly" });
    const results = await Promise.allSettled([
      createEntry(sql, { ...base, title: "Single", character_id: character.id }),
      commitEntryLines(sql, paste(character.id, 1, "Bulk"), now),
      editEntry(sql, monthly.root_id, monthly.id, { ...monthly, period_kind: "weekly" }),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    for (const result of results) {
      if (result.status === "rejected") expect(result.reason).toMatchObject({ field: "boss_limit" });
    }
    expect(await listEntries(sql, { character_id: character.id, period_kind: "weekly" })).toHaveLength(max);
  });
});
