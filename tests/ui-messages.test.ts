import { describe, expect, it } from "vitest";
import { koMessage } from "../lib/ui/messages";

describe("koMessage", () => {
  it("maps known fields to Korean hints", () => {
    for (const f of ["title", "clear_minutes", "party_size", "reward_meso", "doping", "memo", "target_count", "tags", "name", "line", "text", "character_id", "root_id"]) {
      const m = koMessage(f, "Use an integer from 1 to 10.");
      expect(m).toMatch(/[가-힣]/);
      expect(m).not.toMatch(/[A-Za-z]/);
    }
  });
  it("keeps a Korean server message", () => {
    expect(koMessage("text", "등록할 줄을 입력하세요.")).toBe("등록할 줄을 입력하세요.");
  });
  it("recognizes duplicate titles", () => {
    expect(koMessage("title", "This title already exists for the selected character or account.")).toBe("이미 있는 제목입니다");
    expect(koMessage("title", "This title appears on an earlier line.")).toBe("이미 있는 제목입니다");
  });
  it("falls back to one generic sentence, never raw English", () => {
    for (const f of [undefined, "", "unknown", "constructor", "toString"]) {
      expect(koMessage(f, "Something broke")).toBe("입력을 확인하세요");
    }
  });
});
