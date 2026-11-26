import { describe, expect, it } from "vitest";
import { validateEntry, validateId, validateName, ValidationError } from "../lib/validate";

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
