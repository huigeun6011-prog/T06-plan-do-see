import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogTitle, findCatalogRow, groupCatalog, parseCatalog, rewardFor } from "../lib/catalog";
import { difficultyBadge, displayName } from "../lib/ui/difficulty";

const H = "boss_name,difficulty,cycle,max_party,crystal_price,bronze,silver,gold\n";

describe("parseCatalog", () => {
  it("parses Korean text and numbers, CRLF and BOM", () => {
    const rows = parseCatalog(`﻿${H.trim()}\r\n자쿰,카오스,weekly,6,4040000,0,0,0\r\n\r\n`);
    expect(rows).toEqual([{ boss: "자쿰", difficulty: "카오스", cycle: "weekly", maxParty: 6, price: 4040000, bronze: 0, silver: 0, gold: 0 }]);
  });
  it.each([
    ["wrong header", "x\n"],
    ["bad cycle", `${H}자쿰,카오스,daily,6,1,0,0,0\n`],
    ["bad number", `${H}자쿰,카오스,weekly,six,1,0,0,0\n`],
    ["zero party", `${H}자쿰,카오스,weekly,0,1,0,0,0\n`],
    ["missing column", `${H}자쿰,카오스,weekly,6,1\n`],
    ["empty name", `${H},카오스,weekly,6,1,0,0,0\n`],
  ])("throws with a clear message: %s", (_, text) => {
    expect(() => parseCatalog(text)).toThrow(/catalog/);
  });
  it("reads the real file: 56 rows, every title gets a badge", () => {
    const rows = parseCatalog(readFileSync("data/boss-catalog.csv", "utf8"));
    expect(rows).toHaveLength(56);
    for (const r of rows) {
      expect(difficultyBadge(catalogTitle(r))).not.toBeNull();
      expect(displayName(catalogTitle(r))).toBe(r.boss);
    }
  });
});

describe("groupCatalog", () => {
  it("groups by boss in file order", () => {
    const rows = parseCatalog(`${H}a,이지,weekly,1,1,0,0,0\nb,하드,weekly,1,1,0,0,0\na,노멀,weekly,1,1,0,0,0\n`);
    const g = groupCatalog(rows);
    expect(g.map((x) => x.boss)).toEqual(["a", "b"]);
    expect(g[0].rows.map((r) => r.difficulty)).toEqual(["이지", "노멀"]);
  });
});

describe("lookup and reward", () => {
  const rows = parseCatalog(`${H}스우,하드,weekly,6,1000003,0,0,0\n`);
  it("finds by title", () => {
    expect(findCatalogRow(rows, " 하드 스우 ")?.price).toBe(1000003);
    expect(findCatalogRow(rows, "노말 스우")).toBeUndefined();
  });
  it("rewardFor floors the split", () => {
    expect(rewardFor(1000003, 1)).toBe(1000003);
    expect(rewardFor(1000003, 3)).toBe(333334);
    expect(rewardFor(10, 0)).toBe(10);
    expect(rewardFor(10, NaN)).toBe(10);
  });
});
