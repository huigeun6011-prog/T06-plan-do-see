import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast } from "../lib/ui/contrast";

const css = readFileSync("app/preview/preview.css", "utf8");
const HEX = /^#[0-9a-f]{6}$/i;

function hex(value: string | undefined, what: string): string {
  if (!value || !HEX.test(value)) throw new Error(`${what}: expected a 6-digit hex color, got ${value}`);
  return value;
}

function rule(selector: string): string {
  const esc = selector.replace(/[.[\]"=]/g, "\\$&");
  return css.match(new RegExp(`${esc} \\{([^}]*)\\}`))?.[1] ?? "";
}

function decl(body: string, prop: string): string | undefined {
  return body.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+)`))?.[1].trim();
}

function vars(selector: string): Record<string, string> {
  return Object.fromEntries([...rule(selector).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const light = vars(".pd");
const dark = { ...light, ...vars('.pd[data-theme="dark"]') };

const badgeFg = hex(decl(rule(".pd-badge"), "color"), ".pd-badge color");
const badges = ["gray", "teal", "pink", "dark", "red"].map((tone) => {
  const bg = decl(rule(`.pd-badge[data-tone="${tone}"]`), "background");
  return [tone, hex(bg, `badge ${tone} background`)] as const;
});
const markBody = rule(".pd-mark");
const markFg = hex(decl(markBody, "color"), ".pd-mark color");
const markBg = hex(decl(markBody, "background"), ".pd-mark background");

describe("contrast", () => {
  it.each(badges)("badge text on %s", (_, bg) => {
    expect(contrast(badgeFg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("marker text", () => {
    expect(contrast(markFg, markBg)).toBeGreaterThanOrEqual(4.5);
  });

  describe.each([["light", light], ["dark", dark]])("%s theme", (_, t) => {
    it.each(["--bg", "--card", "--tile"])("on %s", (surface) => {
      const s = hex(t[surface], surface);
      expect(contrast(hex(t["--fg"], "--fg"), s)).toBeGreaterThanOrEqual(7);
      expect(contrast(hex(t["--dim"], "--dim"), s)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(hex(t["--done"], "--done"), s)).toBeGreaterThanOrEqual(3);
    });
  });
});
