import { describe, expect, it } from "vitest";
import { difficultyBadge, displayName } from "../lib/ui/difficulty";

describe("difficultyBadge", () => {
  it.each([
    ["이지 힐라", "E", "gray"],
    ["노말 진힐라", "N", "teal"],
    ["하드 루시드", "H", "pink"],
    ["카오스 더스크", "C", "dark"],
    ["익스트림 스우", "X", "red"],
  ])("%s", (title, letter, tone) => {
    expect(difficultyBadge(title)).toEqual({ letter, tone });
  });

  it("returns null without a leading word", () => {
    expect(difficultyBadge("사냥")).toBeNull();
    expect(difficultyBadge("")).toBeNull();
  });

  it("ignores the word in the middle and inherited keys", () => {
    expect(difficultyBadge("진 하드 모드")).toBeNull();
    expect(difficultyBadge("constructor 진힐라")).toBeNull();
    expect(difficultyBadge("toString")).toBeNull();
  });
});

describe("displayName", () => {
  it("drops the leading difficulty word", () => {
    expect(displayName("  노말   진힐라 ")).toBe("진힐라");
  });
  it("keeps titles without a difficulty word", () => {
    expect(displayName("사냥")).toBe("사냥");
    expect(displayName("constructor 진힐라")).toBe("constructor 진힐라");
    expect(displayName("진 하드 모드")).toBe("진 하드 모드");
  });
  it("falls back to the full title", () => {
    expect(displayName("노말")).toBe("노말");
    expect(displayName("")).toBe("");
  });
});
