import { describe, expect, it } from "vitest";
import {
  displayWeight,
  formatHeight,
  formatWeight,
  inputWeightToKg,
  kgToLb,
  lbToKg,
  weightUnit,
} from "./units";

describe("weight conversion", () => {
  it("round-trips kg ↔ lb", () => {
    expect(lbToKg(kgToLb(72.5))).toBeCloseTo(72.5);
  });

  it("displays in the chosen unit at 1 decimal", () => {
    expect(displayWeight(80, "metric")).toBe(80);
    expect(displayWeight(80, "imperial")).toBe(176.4);
    expect(formatWeight(80, "imperial")).toBe("176.4 lb");
    expect(weightUnit("imperial")).toBe("lb");
  });

  it("converts typed imperial input back to storage kg", () => {
    expect(inputWeightToKg(176.4, "imperial")).toBeCloseTo(80, 1);
    expect(inputWeightToKg(80, "metric")).toBe(80);
  });
});

describe("formatHeight", () => {
  it("keeps metric in cm", () => {
    expect(formatHeight(178, "metric")).toBe("178 cm");
  });

  it("converts to whole feet and inches", () => {
    expect(formatHeight(178, "imperial")).toBe("5 ft 10 in");
    expect(formatHeight(183, "imperial")).toBe("6 ft 0 in");
  });
});
