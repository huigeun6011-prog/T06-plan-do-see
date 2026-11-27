import { describe, expect, it } from "vitest";
import { buildEntryInput, canRegister, isConflict, moveItem, reorderGroup, sameSnapshot, type EntryFields, type Snapshot } from "../lib/ui/register-logic";

describe("moveItem", () => {
  it("moves up and down", () => {
    expect(moveItem(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });
  it("first up, last down and unknown id change nothing", () => {
    expect(moveItem(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], "z", 1)).toEqual(["a", "b"]);
  });
  it("moves the first duplicate and never mutates", () => {
    const l = ["a", "b", "a"];
    expect(moveItem(l, "a", 1)).toEqual(["b", "a", "a"]);
    expect(l).toEqual(["a", "b", "a"]);
  });
  it("rapid moves compose from the latest list", () => {
    expect(moveItem(moveItem(["a", "b", "c"], "c", -1), "c", -1)).toEqual(["c", "a", "b"]);
  });
});

describe("reorderGroup", () => {
  const items = [
    { id: "m1", kind: "mission" as const }, { id: "b1", kind: "boss" as const },
    { id: "b2", kind: "boss" as const }, { id: "m2", kind: "mission" as const },
  ];
  it("lists bosses then missions and moves inside the kind only", () => {
    expect(reorderGroup(items, "b2", -1)).toEqual(["b2", "b1", "m1", "m2"]);
    expect(reorderGroup(items, "m2", -1)).toEqual(["b1", "b2", "m2", "m1"]);
  });
  it("edge moves keep the screen order", () => {
    expect(reorderGroup(items, "b1", -1)).toEqual(["b1", "b2", "m1", "m2"]);
    expect(reorderGroup(items, "zz", 1)).toEqual(["b1", "b2", "m1", "m2"]);
  });
});

describe("buildEntryInput", () => {
  const fields: EntryFields = { title: "노말 진힐라", minutes: "12", party: "1", target: "1", doping: "", memo: "m", period: "weekly" };
  const base = { kind: "boss" as const, characterId: "7", sortOrder: 9, reward: 0, fields };
  it("creation adds the kind tag", () => {
    expect(buildEntryInput(base).tags).toEqual(["boss"]);
    expect(buildEntryInput({ ...base, kind: "mission" }).tags).toEqual(["mission"]);
  });
  it.each([
    [["b", "a", "mission", "z"]],
    [["boss", "mission"]],
    [[]],
    [Array.from({ length: 10 }, (_, i) => `t${i}`)],
  ])("edit keeps tags exactly: %j", (tags) => {
    const out = buildEntryInput({ ...base, original: { tags, sort_order: 3 } });
    expect(out.tags).toEqual(tags);
    expect(out.tags).not.toBe(tags);
    expect(out.sort_order).toBe(3);
  });
  it("only the edited field changes", () => {
    const original = { tags: ["x"], sort_order: 3 };
    const a = buildEntryInput({ ...base, original });
    const b = buildEntryInput({ ...base, original, fields: { ...fields, memo: "changed" } });
    expect({ ...a, memo: "" }).toEqual({ ...b, memo: "" });
    expect(b.memo).toBe("changed");
  });
});

describe("conflict message", () => {
  it("is recognized", () => {
    expect(isConflict("다른 곳에서 먼저 수정되었습니다. 새로고침하세요.")).toBe(true);
    expect(isConflict("Use 1–100 characters.")).toBe(false);
  });
});

describe("paste snapshot", () => {
  const s: Snapshot = { text: "a / 1", kind: "boss", period: "weekly", characterId: "1" };
  const ok = { snap: s, rows: 1, errors: 0 };
  it("compares every field", () => {
    expect(sameSnapshot(s, { ...s })).toBe(true);
    expect(sameSnapshot(s, { ...s, text: "b" })).toBe(false);
    expect(sameSnapshot(s, { ...s, kind: "mission" })).toBe(false);
    expect(sameSnapshot(s, { ...s, period: "monthly" })).toBe(false);
    expect(sameSnapshot(s, { ...s, characterId: null })).toBe(false);
    expect(sameSnapshot(s, null)).toBe(false);
  });
  it("can register only a clean, current preview", () => {
    expect(canRegister(s, ok)).toBe(true);
    expect(canRegister({ ...s, text: "changed" }, ok)).toBe(false); // stale preview
    expect(canRegister({ ...s, kind: "mission" }, ok)).toBe(false);
    expect(canRegister({ ...s, period: "monthly" }, ok)).toBe(false);
    expect(canRegister({ ...s, characterId: "2" }, ok)).toBe(false);
    expect(canRegister(s, { ...ok, errors: 1 })).toBe(false);
    expect(canRegister(s, { ...ok, rows: 0 })).toBe(false);
    expect(canRegister(s, null)).toBe(false);
  });
});
