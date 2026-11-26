import { describe, expect, it } from "vitest";
import { nextCount, summarize } from "../lib/ui/summary";

describe("nextCount", () => {
  it("toggles a single tile", () => {
    expect(nextCount(1, 0)).toBe(1);
    expect(nextCount(1, 1)).toBe(0);
  });
  it("cycles a cumulative tile and wraps", () => {
    expect(nextCount(3, 0)).toBe(1);
    expect(nextCount(3, 2)).toBe(3);
    expect(nextCount(3, 3)).toBe(0);
  });
});

describe("summarize", () => {
  const a = { id: "a", minutes: 10 };
  const h = { id: "h", minutes: 5, target: 6 };
  it("handles an empty list", () => {
    expect(summarize([], {})).toEqual({ done: 0, minutes: 0 });
  });
  it("counts a finished single tile as 0 minutes", () => {
    expect(summarize([a], { a: 0 })).toEqual({ done: 0, minutes: 10 });
    expect(summarize([a], { a: 1 })).toEqual({ done: 1, minutes: 0 });
  });
  it("counts units left on a cumulative tile and restores on wrap", () => {
    expect(summarize([h], { h: 4 })).toEqual({ done: 0, minutes: 10 });
    expect(summarize([h], { h: 6 })).toEqual({ done: 1, minutes: 0 });
    expect(summarize([h], { h: nextCount(6, 6) })).toEqual({ done: 0, minutes: 30 });
  });
  it("mixes tiles", () => {
    expect(summarize([a, h], { a: 1, h: 3 })).toEqual({ done: 1, minutes: 15 });
  });
});
