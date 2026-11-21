import { describe, expect, it } from "vitest";
import { csvField } from "./csv";

describe("csvField", () => {
  // Regression: a profile name such as `=1+1` was exported as "=1+1",
  // which a spreadsheet evaluated. Formula-leading values become literal.
  it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"])(
    "neutralizes %j",
    (value) => {
      expect(csvField(value)).toBe(`"'${value}"`);
    },
  );

  it("quotes ordinary values and doubles their quotes", () => {
    expect(csvField("Ada")).toBe('"Ada"');
    expect(csvField('a "b", c')).toBe('"a ""b"", c"');
    expect(csvField('="x"')).toBe('"\'=""x"""');
  });
});
