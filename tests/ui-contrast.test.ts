import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast } from "../lib/ui/contrast";

const css = readFileSync("app/preview/preview.css", "utf8");

function vars(selector: string): Record<string, string> {
  const block = css.match(new RegExp(`${selector.replace(/[.[\]"=]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

const light = vars(".pd");
const dark = { ...light, ...vars('.pd[data-theme="dark"]') };
const badges = [...css.matchAll(/\.pd-badge\[data-tone="(\w+)"\] \{ background: (#[0-9a-f]{6})/gi)];
const mark = css.match(/\.pd-mark \{[^}]*?background: (#[0-9a-f]{6})/)?.[1];

describe("contrast", () => {
  it("finds what it checks", () => {
    expect(badges).toHaveLength(5);
    expect(mark).toBeTruthy();
    expect(light["--fg"]).toBeTruthy();
    expect(dark["--bg"]).not.toBe(light["--bg"]);
  });

  it.each(badges.map((m) => [m[1], m[2]]))("white on %s badge", (_, bg) => {
    expect(contrast("#ffffff", bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("white on the marker", () => {
    expect(contrast("#ffffff", mark!)).toBeGreaterThanOrEqual(4.5);
  });

  describe.each([["light", light], ["dark", dark]])("%s theme", (_, t) => {
    it.each(["--bg", "--card", "--tile"])("text on %s", (surface) => {
      expect(contrast(t["--fg"], t[surface])).toBeGreaterThanOrEqual(7);
      expect(contrast(t["--dim"], t[surface])).toBeGreaterThanOrEqual(4.5);
    });
  });
});
