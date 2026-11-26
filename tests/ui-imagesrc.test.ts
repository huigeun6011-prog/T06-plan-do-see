import { describe, expect, it } from "vitest";
import { httpsSrc } from "../lib/ui/imageSrc";

describe("httpsSrc", () => {
  it("accepts https, any case, and normalizes", () => {
    expect(httpsSrc("HTTPS://x.com/a.png")).toBe("https://x.com/a.png");
  });
  it("rejects everything else", () => {
    for (const s of [undefined, "", "https://", "http://x.com/a.png", "javascript:alert(1)", "data:image/png;base64,AA", "//x.com/a.png", "not a url"]) {
      expect(httpsSrc(s)).toBeNull();
    }
  });
});
