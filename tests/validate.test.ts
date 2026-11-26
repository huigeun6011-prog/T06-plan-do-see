import { describe, expect, it } from "vitest";
import {
  validateEntry, validateId, validateName, validatePlanDates, validatePlanFields, validateTodo, ValidationError,
} from "../lib/validate";

const base = {
  title: "Boss",
  period_kind: "weekly",
  clear_minutes: 1,
  reward_meso: 0,
  party_size: 1,
} as const;

function expectInvalid(parse: () => unknown, field: string) {
  expect(parse).toThrow(ValidationError);
  expect(parse).toThrow(expect.objectContaining({ field }));
}

describe("character validation", () => {
  it("trims names and accepts 1 to 30 characters", () => {
    expect(validateName("  직  ")).toBe("직");
    const longest = "🧙".repeat(30);
    expect(validateName(` ${longest} `)).toBe(longest);
  });

  it.each(["", "   ", "a".repeat(31), "job\0", 1])("rejects invalid name %j", (value) => {
    expectInvalid(() => validateName(value), "name");
  });
});

describe("registration validation", () => {
  it("accepts the lower boundaries and fills defaults", () => {
    expect(validateEntry(base)).toEqual({
      ...base, reward_meso: "0", doping: "base", memo: "", target_count: 1,
      tags: [], sort_order: 0, character_id: null,
    });
    expect(validateEntry({ ...base, title: " a ", doping: " x ", character_id: null }))
      .toMatchObject({ title: "a", doping: "x", character_id: null });
  });

  it("accepts the upper boundaries and trims tags", () => {
    const tags = Array.from({ length: 10 }, (_, index) => `${"a".repeat(29)}${index}`);
    const input = {
      title: "t".repeat(100),
      period_kind: "monthly",
      clear_minutes: 10000,
      reward_meso: Number.MAX_SAFE_INTEGER,
      party_size: 99,
      doping: "d".repeat(100),
      memo: " ".repeat(500),
      target_count: 1000,
      tags: tags.map((tag) => ` ${tag} `),
      sort_order: 2147483647,
      character_id: "9223372036854775807",
    } as const;
    expect(validateEntry(input)).toEqual({ ...input, reward_meso: "9007199254740991", tags });
    expect(validateEntry({ ...base, reward_meso: "9007199254740991", sort_order: -2147483648 }))
      .toMatchObject({ reward_meso: "9007199254740991", sort_order: -2147483648 });
    expect(validateId("1", "id")).toBe("1");
  });

  it.each([
    ["title", ["", "  ", "t".repeat(101), 1]],
    ["period_kind", ["event", "Weekly", "", null]],
    ["clear_minutes", [0, 1.5, 10001, "5"]],
    ["reward_meso", [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, "9007199254740992", "1e3", "1.5"]],
    ["party_size", [0, 1.5, 100, "1"]],
    ["doping", ["", "  ", "d".repeat(101), null]],
    ["memo", ["m".repeat(501), null]],
    ["target_count", [0, 1.5, 1001, "1"]],
    ["tags", [Array(11).fill("tag"), [" "], ["t".repeat(31)], ["tag", " tag "], [1], "tag", null]],
    ["sort_order", [-2147483649, 0.5, 2147483648, "0"]],
    ["character_id", ["0", "-1", "1.5", "abc", "9223372036854775808", 1]],
  ])("rejects invalid %s", (field, values) => {
    for (const value of values) {
      expectInvalid(() => validateEntry({ ...base, [field]: value }), field);
    }
  });
});

describe("plan validation", () => {
  const fields = { title: "t", priority: 1, success_criteria: "s", expected_minutes: 0 };
  const start = new Date("2026-11-25T15:00:00Z");
  const end = new Date(start.getTime() + 1);

  it("accepts the minimum and maximum field values and an exclusive end", () => {
    expect(validatePlanFields(fields)).toEqual(fields);
    const max = { title: "t".repeat(100), priority: 3, success_criteria: "s".repeat(500), expected_minutes: 2147483647 };
    expect(validatePlanFields(max)).toEqual(max);
    expect(validatePlanDates(start, end)).toEqual({ starts_at: start, ends_at: end });
  });

  it.each([
    ["title", [" ", "t".repeat(101)]],
    ["priority", [0, 4, 1.5]],
    ["success_criteria", [" ", "s".repeat(501)]],
    ["expected_minutes", [-1, 0.5, 2147483648]],
  ])("rejects invalid %s", (field, values) => {
    for (const value of values) expectInvalid(() => validatePlanFields({ ...fields, [field]: value }), field);
  });

  it("rejects invalid dates and ends that do not follow the start", () => {
    expectInvalid(() => validatePlanDates(start.toISOString(), end), "starts_at");
    expectInvalid(() => validatePlanDates(start, new Date(NaN)), "ends_at");
    expectInvalid(() => validatePlanDates(start, start), "ends_at");
    expectInvalid(() => validatePlanDates(end, start), "ends_at");
  });
});

describe("todo validation", () => {
  const fields = { title: "t", expected_minutes: 0 };

  it("accepts the field boundaries and supplies the defaults", () => {
    expect(validateTodo(fields)).toEqual({
      ...fields, note: "", character_id: null, due_at: null, priority: 2, tags: [], target_count: 1,
    });
    const tags = [" x ", ...Array(9).fill("x".repeat(30))];
    const due_at = new Date("2026-11-25T15:00:00Z");
    const max = {
      title: "t".repeat(200), note: "n".repeat(1000), character_id: "1", due_at, priority: 3,
      tags, expected_minutes: 2147483647, target_count: 1000,
    };
    expect(validateTodo(max)).toEqual({ ...max, tags: tags.map((tag) => tag.trim()) });
  });

  it.each([
    ["title", [" ", "t".repeat(201)]],
    ["note", ["n".repeat(1001), null]],
    ["character_id", ["0", 1]],
    ["due_at", [new Date(NaN), "2026-11-26", null]],
    ["priority", [0, 4, 1.5]],
    ["tags", [Array(11).fill("tag"), [""], ["x".repeat(31)]]],
    ["expected_minutes", [-1, 0.5, 2147483648]],
    ["target_count", [0, 1001, 1.5]],
  ])("rejects invalid %s", (field, values) => {
    for (const value of values) expectInvalid(() => validateTodo({ ...fields, [field]: value }), field);
  });
});
