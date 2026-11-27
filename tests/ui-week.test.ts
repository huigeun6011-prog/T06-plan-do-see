import { describe, expect, it } from "vitest";
import { boxStates, formatMinutes, groupHasVisible, hasAnyTodos, nextTodayCount, parseMinutesInput, visibleTodos } from "../lib/ui/week-ui";

describe("formatMinutes", () => {
  it.each([[37, "37분"], [60, "1시간"], [80, "1시간 20분"], [120, "2시간"], [0, "0분"], [-5, "0분"], [NaN, "0분"], [59, "59분"]])("%s", (n, s) => {
    expect(formatMinutes(n)).toBe(s);
  });
});

describe("visibility", () => {
  const t = (is_done: boolean) => ({ is_done });
  it("filters done tiles only when asked", () => {
    expect(visibleTodos([t(true), t(false)], false)).toHaveLength(2);
    expect(visibleTodos([t(true), t(false)], true)).toHaveLength(1);
  });
  it("hides groups with nothing visible", () => {
    const g = { bosses: [t(true)], missions: [t(true)], others: [] };
    expect(groupHasVisible(g, true)).toBe(false);
    expect(groupHasVisible(g, false)).toBe(true);
    expect(groupHasVisible({ ...g, others: [t(false)] }, true)).toBe(true);
    expect(groupHasVisible({ bosses: [], missions: [], others: [] }, false)).toBe(false);
  });
  it("detects an empty week", () => {
    expect(hasAnyTodos([{ groups: [] }, { groups: [{ bosses: [], missions: [], others: [] }] }])).toBe(false);
    expect(hasAnyTodos([{ groups: [{ bosses: [t(true)], missions: [], others: [] }] }])).toBe(true);
  });
});

describe("boxStates", () => {
  it("locked, filled, empty", () => {
    expect(boxStates(6, 2, 1)).toEqual(["locked", "locked", "filled", "empty", "empty", "empty"]);
  });
  it("caps by the target", () => {
    expect(boxStates(3, 5, 2)).toEqual(["locked", "locked", "locked"]);
    expect(boxStates(3, 1, 9)).toEqual(["locked", "filled", "filled"]);
    expect(boxStates(0, 0, 0)).toEqual([]);
  });
});

describe("nextTodayCount", () => {
  it("clicking inside the locked area does nothing", () => {
    expect(nextTodayCount(1, 0, 2, 6)).toBe(1);
    expect(nextTodayCount(1, 1, 2, 6)).toBe(1);
  });
  it("clicking beyond fills up to it", () => {
    expect(nextTodayCount(0, 4, 2, 6)).toBe(3);
    expect(nextTodayCount(1, 5, 2, 6)).toBe(4);
  });
  it("clicking the last filled box reduces by one", () => {
    expect(nextTodayCount(3, 4, 2, 6)).toBe(2);
    expect(nextTodayCount(1, 2, 2, 6)).toBe(0);
  });
  it("clicking an earlier filled box sets the count to it", () => {
    expect(nextTodayCount(3, 2, 2, 6)).toBe(1);
  });
  it("never goes above target or below zero", () => {
    expect(nextTodayCount(0, 99, 2, 6)).toBe(0);
    expect(nextTodayCount(9, 5, 2, 6)).toBe(3);
    expect(nextTodayCount(0, 5, 0, 6)).toBe(6);
    expect(nextTodayCount(-3, 0, 0, 6)).toBe(1);
  });
});

describe("parseMinutesInput", () => {
  it("accepts digits, empty means null", () => {
    expect(parseMinutesInput("12")).toEqual({ ok: true, value: 12 });
    expect(parseMinutesInput(" 0 ")).toEqual({ ok: true, value: 0 });
    expect(parseMinutesInput("")).toEqual({ ok: true, value: null });
    expect(parseMinutesInput("10000")).toEqual({ ok: true, value: 10000 });
  });
  it.each(["10001", "-1", "1.5", "abc", "1e3", "999999", "1 2"])("rejects %j", (t) => {
    expect(parseMinutesInput(t)).toEqual({ ok: false });
  });
});
