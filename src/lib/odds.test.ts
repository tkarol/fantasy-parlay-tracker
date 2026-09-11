import { describe, expect, it } from "vitest";
import {
  americanToDecimal,
  decimalToAmerican,
  formatAmerican,
  formatUsd,
  formatUsdSigned,
  impliedProbability,
  isValidAmerican,
  parseAmerican,
  round2,
} from "./odds";

describe("isValidAmerican", () => {
  it("accepts prices at or beyond the ±100 boundary", () => {
    expect(isValidAmerican(100)).toBe(true);
    expect(isValidAmerican(-100)).toBe(true);
    expect(isValidAmerican(-110)).toBe(true);
    expect(isValidAmerican(2500)).toBe(true);
  });

  it("rejects the impossible band between -100 and +100", () => {
    expect(isValidAmerican(0)).toBe(false);
    expect(isValidAmerican(50)).toBe(false);
    expect(isValidAmerican(-99)).toBe(false);
  });

  it("rejects empty and non-numeric input", () => {
    expect(isValidAmerican("")).toBe(false);
    expect(isValidAmerican(null)).toBe(false);
    expect(isValidAmerican(undefined)).toBe(false);
    expect(isValidAmerican("abc")).toBe(false);
    expect(isValidAmerican(NaN)).toBe(false);
  });
});

describe("parseAmerican", () => {
  it("handles form input including a leading plus", () => {
    expect(parseAmerican("+150")).toBe(150);
    expect(parseAmerican("-110")).toBe(-110);
    expect(parseAmerican(" 240 ")).toBe(240);
  });

  it("returns null for legacy empty-string odds", () => {
    expect(parseAmerican("")).toBeNull();
    expect(parseAmerican(null)).toBeNull();
    expect(parseAmerican("not odds")).toBeNull();
  });

  it("returns null rather than accepting an impossible price", () => {
    expect(parseAmerican("50")).toBeNull();
  });
});

describe("americanToDecimal", () => {
  it("converts underdogs and favourites", () => {
    expect(americanToDecimal(150)).toBeCloseTo(2.5, 10);
    expect(americanToDecimal(-200)).toBeCloseTo(1.5, 10);
    expect(americanToDecimal(-110)).toBeCloseTo(1.909090909, 8);
    expect(americanToDecimal(100)).toBeCloseTo(2, 10);
  });

  it("returns null for unusable odds instead of a silent 1.0", () => {
    // The original build returned decimal 1 here, which made an unpriced leg
    // look like a legitimate no-op multiplier in the parlay.
    expect(americanToDecimal("")).toBeNull();
    expect(americanToDecimal(null)).toBeNull();
    expect(americanToDecimal(0)).toBeNull();
  });
});

describe("decimalToAmerican", () => {
  it("round-trips with americanToDecimal", () => {
    for (const odds of [-500, -250, -110, 100, 150, 400, 1200]) {
      const dec = americanToDecimal(odds)!;
      expect(decimalToAmerican(dec)).toBe(odds);
    }
  });

  it("returns null at or below evens", () => {
    expect(decimalToAmerican(1)).toBeNull();
    expect(decimalToAmerican(0.5)).toBeNull();
  });
});

describe("impliedProbability", () => {
  it("prices a coin flip near 50%", () => {
    expect(impliedProbability(100)).toBeCloseTo(0.5, 10);
  });

  it("gives favourites a higher implied chance", () => {
    expect(impliedProbability(-200)).toBeCloseTo(0.6667, 3);
  });
});

describe("formatting", () => {
  it("signs american odds explicitly", () => {
    expect(formatAmerican(150)).toBe("+150");
    expect(formatAmerican(-110)).toBe("-110");
    expect(formatAmerican(null)).toBe("—");
  });

  it("formats money", () => {
    expect(formatUsd(12.3456)).toBe("$12.35");
    expect(formatUsd(-5)).toBe("-$5.00");
    expect(formatUsdSigned(12.5)).toBe("+$12.50");
    expect(formatUsdSigned(-12.5)).toBe("-$12.50");
    expect(formatUsdSigned(0)).toBe("$0.00");
  });

  it("rounds cents without float drift", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });
});
