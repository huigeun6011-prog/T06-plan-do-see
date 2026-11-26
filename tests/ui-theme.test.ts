import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { THEME_SCRIPT } from "../lib/ui/theme";

// Runs the real inline script against fakes.
function run({ stored, systemDark, throwing = false }: { stored?: string; systemDark: boolean; throwing?: boolean }) {
  const dataset: Record<string, string> = {};
  vm.runInNewContext(THEME_SCRIPT, {
    document: { currentScript: { parentElement: { dataset } } },
    localStorage: {
      getItem: () => {
        if (throwing) throw new Error("blocked");
        return stored ?? null;
      },
    },
    matchMedia: () => ({ matches: systemDark }),
  });
  return dataset.theme;
}

describe("THEME_SCRIPT", () => {
  it("saved value wins over the system", () => {
    expect(run({ stored: "light", systemDark: true })).toBe("light");
    expect(run({ stored: "dark", systemDark: false })).toBe("dark");
  });
  it("follows the system when nothing or junk is saved", () => {
    expect(run({ systemDark: true })).toBe("dark");
    expect(run({ systemDark: false })).toBe("light");
    expect(run({ stored: "blue", systemDark: false })).toBe("light");
  });
  it("still follows the system when storage throws", () => {
    expect(run({ throwing: true, systemDark: false })).toBe("light");
    expect(run({ throwing: true, systemDark: true })).toBe("dark");
  });
  it("has no characters that raw script text cannot carry", () => {
    expect(THEME_SCRIPT).not.toMatch(/[<>&]/);
  });
});
