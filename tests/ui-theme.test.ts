import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { THEME_SCRIPT, otherTheme, resolveTheme } from "../lib/ui/theme";

type Case = { stored?: string; throwing?: boolean; systemDark: boolean | "throws" };

// Runs the real inline script against fakes.
function runScript({ stored, throwing, systemDark }: Case) {
  const dataset: Record<string, string> = {};
  vm.runInNewContext(THEME_SCRIPT, {
    document: { currentScript: { parentElement: { dataset } } },
    localStorage: {
      getItem: () => {
        if (throwing) throw new Error("blocked");
        return stored ?? null;
      },
    },
    matchMedia: () => {
      if (systemDark === "throws") throw new Error("no matchMedia");
      return { matches: systemDark };
    },
  });
  return dataset.theme;
}

const mount = ({ stored, throwing, systemDark }: Case) =>
  resolveTheme(throwing ? null : (stored ?? null), systemDark === "throws" ? null : systemDark);

const cases: [string, Case][] = [
  ["saved light, system dark", { stored: "light", systemDark: true }],
  ["saved dark, system light", { stored: "dark", systemDark: false }],
  ["junk saved", { stored: "blue", systemDark: false }],
  ["nothing saved, system dark", { systemDark: true }],
  ["nothing saved, system light", { systemDark: false }],
  ["storage throws, system light", { throwing: true, systemDark: false }],
  ["storage throws, system dark", { throwing: true, systemDark: true }],
  ["matchMedia throws", { systemDark: "throws" }],
  ["both throw", { throwing: true, systemDark: "throws" }],
];

describe("theme script and mount path", () => {
  it.each(cases)("agree: %s", (_, c) => {
    expect(runScript(c)).toBe(mount(c));
  });
  it("expected values", () => {
    expect(mount({ stored: "light", systemDark: true })).toBe("light");
    expect(mount({ systemDark: false })).toBe("light");
    expect(mount({ throwing: true, systemDark: "throws" })).toBe("dark");
  });
  it("script has no characters that raw script text cannot carry", () => {
    expect(THEME_SCRIPT).not.toMatch(/[<>&]/);
  });
  it("toggles", () => {
    expect(otherTheme("dark")).toBe("light");
    expect(otherTheme("light")).toBe("dark");
  });
});
