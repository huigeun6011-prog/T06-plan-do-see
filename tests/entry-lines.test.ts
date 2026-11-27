import { describe, expect, it } from "vitest";
import { parseEntryLines, type EntryLineDefaults } from "../lib/entry-lines";

const defaults: EntryLineDefaults = { period_kind: "weekly", kind: "boss", character_id: "17" };

describe("pasted entry lines", () => {
  it("reads slash and tab lines, keeps their line numbers and supplies defaults", () => {
    const result = parseEntryLines(`  # 주간 목록\r\n\r\n  노말 진힐라 / 12 분 / 2 / 메모 / 추가\r\n지하수로\t 3분\t\t기록 / 메모\r\n단독/1\r\n`, defaults);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { line: 3, input: expect.objectContaining({ title: "노말 진힐라", clear_minutes: 12, party_size: 2, memo: "메모 / 추가" }) },
      { line: 4, input: expect.objectContaining({ title: "지하수로", clear_minutes: 3, party_size: 1, memo: "기록 / 메모" }) },
      { line: 5, input: {
        title: "단독", clear_minutes: 1, party_size: 1, memo: "", tags: ["boss"], period_kind: "weekly",
        character_id: "17", reward_meso: "0", doping: "base", target_count: 1,
      } },
    ]);
  });

  it("keeps markup as text and puts the chosen kind in the tags", () => {
    const script = "<script>alert('test')</script>";
    const preview = parseEntryLines(` ${script} \t1\t\t ${script} `, {
      period_kind: "monthly", kind: "mission", character_id: null,
    });
    expect(preview.errors).toEqual([]);
    expect(preview.rows[0].input).toMatchObject({
      title: script, memo: script, period_kind: "monthly", character_id: null, tags: ["mission"],
    });
  });

  it("reports bad fields and later duplicates without dropping valid lines", () => {
    const result = parseEntryLines([
      "/1", "Missing", "Zero/0", "Decimal/1.5", "Word/one", "Exponent/1e2", "Bound/10001",
      "Bad party/2/1분", "Big party/2/100", "Good/10000분/99", " Good / 2 ",
      "Other/1", "Negative/2/-1",
    ].join("\n"), defaults);
    expect(result.rows.map(({ line }) => line)).toEqual([10, 12]);
    expect(result.errors.map(({ line, field }) => [line, field])).toEqual([
      [1, "title"], [2, "clear_minutes"], [3, "clear_minutes"], [4, "clear_minutes"],
      [5, "clear_minutes"], [6, "clear_minutes"], [7, "clear_minutes"], [8, "party_size"],
      [9, "party_size"], [11, "title"], [13, "party_size"],
    ]);
  });

  it("validates title and memo length and returns request-level errors for invalid defaults", () => {
    expect(parseEntryLines(`${"가".repeat(101)}/1\nOkay/1//${"가".repeat(501)}`, defaults).errors)
      .toMatchObject([{ line: 1, field: "title" }, { line: 2, field: "memo" }]);
    expect(parseEntryLines("Entry/1", { ...defaults, character_id: "bad" }).errors)
      .toMatchObject([{ line: 0, field: "character_id" }]);
    expect(parseEntryLines("Entry/1", { ...defaults, kind: "other" as EntryLineDefaults["kind"] }).errors)
      .toMatchObject([{ line: 0, field: "kind" }]);
    expect(parseEntryLines("Entry/1", { ...defaults, period_kind: "event" as EntryLineDefaults["period_kind"] }).errors)
      .toMatchObject([{ line: 0, field: "period_kind" }]);
  });

  it("accepts the size boundaries and rejects oversized pastes with one error", () => {
    const text = `#${"🧙".repeat(19_999)}`;
    expect(parseEntryLines(text, defaults)).toEqual({ rows: [], errors: [] });
    expect(parseEntryLines(`${text}가`, defaults)).toEqual({
      rows: [], errors: [{ line: 0, field: "text", message: "Paste text up to 20,000 characters." }],
    });
    const comments = "# comment\n".repeat(199);
    expect(parseEntryLines(`${comments}Entry/1\n`, defaults).rows).toMatchObject([{ line: 200 }]);
    expect(parseEntryLines(`${comments}Entry/1\nExtra/1`, defaults)).toEqual({
      rows: [], errors: [{ line: 0, field: "text", message: "Paste at most 200 lines." }],
    });
  });
});
