import { describe, expect, it } from "vitest";
import { formatMeso, parseMeso } from "../lib/ui/meso";

describe("formatMeso", () => {
  it.each([
    [0, "0"], [1, "1"], [9999, "9999"], [10000, "1만"], [3500 * 10000, "3500만"],
    [62 * 100000000, "62억"], [120000000, "1억 2000만"], [12345, "1만 2345"], [100000001, "1억 1"],
  ])("%s", (n, s) => expect(formatMeso(n)).toBe(s));
  it("handles strings and junk", () => {
    expect(formatMeso("6200000000")).toBe("62억");
    expect(formatMeso(-5)).toBe("0");
    expect(formatMeso("abc")).toBe("0");
    expect(formatMeso(1e300)).toBe("0");
  });
});

describe("parseMeso", () => {
  it.each([
    ["6200000000", 6200000000], ["62억", 6200000000], ["62억 5000만", 6250000000], ["3500만", 35000000],
    [" 3,500 만 ", 35000000], ["1억 2000만", 120000000], ["0", 0], ["1만 2345", 12345], ["62,0000,0000", 6200000000],
  ])("%s", (t, n) => expect(parseMeso(t)).toBe(n));
  it.each(["1 2억", "1,23", "1,,000", "3,50만", ",500", "62억  5000만", "1 000", "1".repeat(41), "1,000".repeat(10)])("rejects bad separators or length %j", (t) => {
    expect(parseMeso(t)).toBeNull();
  });
  it("accepts proper comma groups and one space", () => {
    expect(parseMeso("3,500")).toBe(3500);
    expect(parseMeso("62억 5,000만")).toBe(6250000000);
    expect(parseMeso("62억5000만")).toBe(6250000000);
  });
  it.each(["", "  ", "abc", "-5", "1.5", "만", "억", "1만 2억", "62억 12345", "1e5", "6억원"])("rejects %j", (t) => {
    expect(parseMeso(t)).toBeNull();
  });
  it("rejects values above MAX_SAFE_INTEGER", () => {
    expect(parseMeso(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseMeso("9007199254740992")).toBeNull();
    expect(parseMeso("9".repeat(40))).toBeNull();
    expect(parseMeso("99999999999억")).toBeNull();
  });
  it("round-trips", () => {
    for (const n of [0, 5, 10000, 123456789, 6200000000]) expect(parseMeso(formatMeso(n))).toBe(n);
  });
});
