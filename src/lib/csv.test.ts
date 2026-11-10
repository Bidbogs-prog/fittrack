import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";

/** CSV export cells — formula injection (audit #8) and quoting. */
describe("csvCell", () => {
  it.each([
    ["=HYPERLINK(\"http://x\",\"click\")", "\"'=HYPERLINK(\"\"http://x\"\",\"\"click\"\")\""],
    ["+1+1", "'+1+1"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tcmd", "'\tcmd"],
  ])("neutralises formula-like text %s", (input, expected) => expect(csvCell(input)).toBe(expected));

  it("leaves negative numbers and plain text alone", () => {
    expect(csvCell(-1.5)).toBe("-1.5");
    expect(csvCell("Chicken breast")).toBe("Chicken breast");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("Oats, rolled")).toBe("\"Oats, rolled\"");
    expect(csvCell("a\nb")).toBe("\"a\nb\"");
  });

  it("empty for null", () => expect(csvCell(null)).toBe(""));
});
