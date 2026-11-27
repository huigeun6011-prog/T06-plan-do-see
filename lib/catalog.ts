// Boss catalog: parsed from data/boss-catalog.csv (the CSV stays the source). Pure; reading the file is the caller's job.
export type CatalogRow = {
  boss: string;
  difficulty: string;
  cycle: "weekly" | "monthly";
  maxParty: number;
  price: number;
  bronze: number;
  silver: number;
  gold: number;
};
export type CatalogBoss = { boss: string; rows: CatalogRow[] };

const HEADER = "boss_name,difficulty,cycle,max_party,crystal_price,bronze,silver,gold";

export function parseCatalog(text: string): CatalogRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== HEADER) throw new Error("catalog: unexpected header");
  const rows: CatalogRow[] = [];
  lines.slice(1).forEach((raw, i) => {
    if (!raw.trim()) return;
    const f = raw.split(",").map((x) => x.trim());
    const [boss, difficulty, cycle] = f;
    const n = f.slice(3).map((x) => (/^\d+$/.test(x) ? Number(x) : NaN));
    if (f.length !== 8 || !boss || !difficulty || (cycle !== "weekly" && cycle !== "monthly") || n.some((x) => !Number.isSafeInteger(x)) || n[0] < 1) {
      throw new Error(`catalog: bad row at line ${i + 2}`);
    }
    rows.push({ boss, difficulty, cycle, maxParty: n[0], price: n[1], bronze: n[2], silver: n[3], gold: n[4] });
  });
  return rows;
}

// Group by boss name, keeping file order (of bosses and of difficulties).
export function groupCatalog(rows: CatalogRow[]): CatalogBoss[] {
  const map = new Map<string, CatalogBoss>();
  for (const r of rows) {
    const g = map.get(r.boss) ?? { boss: r.boss, rows: [] };
    g.rows.push(r);
    map.set(r.boss, g);
  }
  return [...map.values()];
}

export const catalogTitle = (r: Pick<CatalogRow, "difficulty" | "boss">): string => `${r.difficulty} ${r.boss}`;

export const findCatalogRow = (rows: CatalogRow[], title: string): CatalogRow | undefined =>
  rows.find((r) => catalogTitle(r) === title.trim());

// ASSUMPTION: the in-game crystal price is split among the party.
export function rewardFor(price: number, party: number): number {
  return Math.floor(price / Math.max(1, Math.floor(party) || 1));
}
