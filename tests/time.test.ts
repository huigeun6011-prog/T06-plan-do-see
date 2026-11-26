import { describe, expect, it } from "vitest";
import { formatDeadline, nextPeriod, parseDeadlineInput, periodFor, todaySeoul } from "../lib/time";

describe("Seoul periods", () => {
  it("uses Thursday at midnight as the weekly boundary", () => {
    const before = new Date("2026-11-25T14:59:59.000Z");
    const boundary = new Date("2026-11-25T15:00:00.000Z");
    expect(periodFor("weekly", before)).toEqual({
      startsAt: new Date("2026-11-18T15:00:00.000Z"),
      endsAt: boundary,
    });
    expect(periodFor("weekly", boundary)).toEqual({
      startsAt: boundary,
      endsAt: new Date("2026-12-02T15:00:00.000Z"),
    });
    expect(nextPeriod("weekly", before)).toEqual(periodFor("weekly", boundary));
  });

  it("returns Thursday on the preceding UTC evening", () => {
    const now = new Date("2026-11-25T18:00:00.000Z");
    expect(todaySeoul(now)).toBe("2026-11-26");
    expect(periodFor("weekly", now).startsAt).toEqual(new Date("2026-11-25T15:00:00.000Z"));
  });

  it.each([
    ["2026-01-31", "2026-02-28", "2026-03-31"],
    ["2028-01-31", "2028-02-29", "2028-03-31"],
    ["2026-03-31", "2026-04-30", "2026-05-31"],
    ["2026-06-30", "2026-07-31", "2026-08-31"],
    ["2026-11-30", "2026-12-31", "2027-01-31"],
  ])("uses the month boundaries at %s, %s and %s (UTC dates)", (start, end, nextEnd) => {
    const startsAt = new Date(`${start}T15:00:00.000Z`);
    const endsAt = new Date(`${end}T15:00:00.000Z`);
    const before = new Date(endsAt.getTime() - 1);
    expect(periodFor("monthly", before)).toEqual({ startsAt, endsAt });
    expect(nextPeriod("monthly", before)).toEqual({
      startsAt: endsAt,
      endsAt: new Date(`${nextEnd}T15:00:00.000Z`),
    });
    expect(periodFor("monthly", endsAt)).toEqual(nextPeriod("monthly", before));
  });
});

describe("Seoul deadlines", () => {
  it.each([
    ["2026-11-25T15:00:00.000Z", "11/25(수) 24:00"],
    ["2026-11-25T15:00:00.001Z", "11/26(목) 00:00"],
    ["2025-12-19T17:00:00.000Z", "12/20(토) 02:00"],
    ["2026-12-31T15:00:00.000Z", "12/31(목) 24:00"],
  ])("formats %s as %s", (instant, label) => {
    expect(formatDeadline(new Date(instant))).toBe(label);
  });

  it.each([
    ["2026-11-25", "24:00", "2026-11-25T15:00:00.000Z"],
    ["2026-11-26", "00:00", "2026-11-25T15:00:00.000Z"],
    ["2025-12-20", "02:00", "2025-12-19T17:00:00.000Z"],
    ["2026-12-31", "24:00", "2026-12-31T15:00:00.000Z"],
  ])("parses %s %s as %s", (date, time, instant) => {
    expect(parseDeadlineInput({ date, time })).toEqual(new Date(instant));
  });

  it.each([
    ["2026-02-29", "12:00"],
    ["2026-12-20", "24:01"],
    ["2026-12-20", "23:60"],
    ["2026-2-01", "09:00"],
  ])("rejects invalid input %s %s", (date, time) => {
    expect(() => parseDeadlineInput({ date, time })).toThrow(RangeError);
  });
});
