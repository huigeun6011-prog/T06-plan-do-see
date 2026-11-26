import { describe, expect, it } from "vitest";
import { difficultyBadge } from "../lib/ui/difficulty";

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

  it("ignores the word in the middle", () => {
    expect(difficultyBadge("진 하드 모드")).toBeNull();
  });
});
