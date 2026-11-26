import { describe, expect, it } from "vitest";
import { MAX_NOTE_LENGTH, parseNote } from "../app/note";

describe("parseNote", () => {
  it("trims and accepts a note at the limit", () => {
    const note = "a".repeat(MAX_NOTE_LENGTH);
    expect(parseNote(` ${note} `)).toBe(note);
  });

  it.each([null, "", " \t ", "a".repeat(MAX_NOTE_LENGTH + 1)])(
    "rejects invalid input %j",
    (value) => {
      expect(parseNote(value)).toBeNull();
    },
  );

  it("rejects file uploads", () => {
    expect(parseNote(new File(["note"], "note.txt"))).toBeNull();
  });
});
