import { describe, expect, it } from "vitest";
import { chooseTheme } from "../lib/ui/theme";

describe("chooseTheme", () => {
  it("stored value beats system preference", () => {
    expect(chooseTheme("light", true)).toBe("light");
    expect(chooseTheme("dark", false)).toBe("dark");
  });
  it("falls back to system preference", () => {
    expect(chooseTheme(null, true)).toBe("dark");
    expect(chooseTheme(null, false)).toBe("light");
  });
  it("ignores junk stored values", () => {
    expect(chooseTheme("blue", true)).toBe("dark");
  });
});
