import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast } from "../lib/ui/contrast";

const preview = readFileSync("app/preview/preview.css", "utf8");
const register = readFileSync("app/register/register.css", "utf8");

function block(css: string, selector: string): string {
  const esc = selector.replace(/[.[\]"=]/g, "\\$&");
  return css.match(new RegExp(`${esc} \\{([^}]*)\\}`))?.[1] ?? "";
}

function color(body: string, name: string): string {
  const v = body.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${name}: expected a 6-digit hex color, got ${v}`);
  return v;
}

describe("register error color", () => {
  const light = block(preview, ".pd");
  const dark = block(preview, '.pd[data-theme="dark"]');
  it.each([
    ["light", color(block(register, ".pd"), "--err"), light],
    ["dark", color(block(register, '.pd[data-theme="dark"]'), "--err"), dark],
  ])("%s: --err on every surface", (_, err, surfaces) => {
    for (const s of ["--bg", "--card", "--tile"]) expect(contrast(err, color(surfaces, s))).toBeGreaterThanOrEqual(4.5);
  });
});
