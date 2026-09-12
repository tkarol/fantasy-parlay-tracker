import { describe, expect, it } from "vitest";
import { matchScore, parsePick, parseSlip } from "./slip";

describe("parsePick", () => {
  it("takes the price out of a bracketed line", () => {
    expect(parsePick("Buffalo Bills -3.5 (-110)")).toEqual({
      leg: "Buffalo Bills -3.5",
      odds: -110,
    });
  });

  it("takes a trailing price without brackets", () => {
    expect(parsePick("Bills -3.5 -110")).toEqual({ leg: "Bills -3.5", odds: -110 });
    expect(parsePick("Chiefs ML +145")).toEqual({ leg: "Chiefs ML", odds: 145 });
  });

  // The whole difficulty: a pick line is full of numbers that are not prices.
  it("does not mistake a spread for a price", () => {
    expect(parsePick("49ers -6")).toEqual({ leg: "49ers -6", odds: null });
    expect(parsePick("Lions +2.5")).toEqual({ leg: "Lions +2.5", odds: null });
  });

  it("does not mistake a total for a price", () => {
    expect(parsePick("Over 47.5")).toEqual({ leg: "Over 47.5", odds: null });
    expect(parsePick("Team total over 24.5")).toEqual({ leg: "Team total over 24.5", odds: null });
  });

  it("does not mistake a prop line for a price", () => {
    expect(parsePick("Lamar Jackson over 250.5 passing yards -115")).toEqual({
      leg: "Lamar Jackson over 250.5 passing yards",
      odds: -115,
    });
  });

  it("keeps a three-digit total out of it", () => {
    // 100.5 is a line, not a price — the decimal gives it away.
    expect(parsePick("Over 100.5 receiving yards -120")).toEqual({
      leg: "Over 100.5 receiving yards",
      odds: -120,
    });
  });

  it("ignores an unsigned bare number", () => {
    expect(parsePick("Chiefs/Bills over 48")).toEqual({ leg: "Chiefs/Bills over 48", odds: null });
  });

  it("handles the unicode minus books paste", () => {
    expect(parsePick("Ravens ML −450")).toEqual({ leg: "Ravens ML", odds: -450 });
  });

  it("prefers the bracketed price when the line has both", () => {
    expect(parsePick("Bills -3.5 (-110)")).toEqual({ leg: "Bills -3.5", odds: -110 });
  });

  it("takes the last price when several are unbracketed", () => {
    expect(parsePick("Alt line +250 boosted +300").odds).toBe(300);
  });

  it("leaves a line with no price alone", () => {
    expect(parsePick("Ravens -7.5")).toEqual({ leg: "Ravens -7.5", odds: null });
  });

  it("copes with empty input", () => {
    expect(parsePick("   ")).toEqual({ leg: "", odds: null });
  });

  it("tidies separators left behind by the price", () => {
    expect(parsePick("Bills ML, -150")).toEqual({ leg: "Bills ML", odds: -150 });
    expect(parsePick("Bills ML @ +150")).toEqual({ leg: "Bills ML", odds: 150 });
  });
});

describe("parseSlip", () => {
  it("splits a pasted multi-leg slip", () => {
    const slip = `
      Buffalo Bills -3.5 (-110)
      Kansas City Chiefs ML (-140)
      Over 47.5 (-105)
    `;
    expect(parseSlip(slip)).toEqual([
      { raw: "Buffalo Bills -3.5 (-110)", leg: "Buffalo Bills -3.5", odds: -110 },
      { raw: "Kansas City Chiefs ML (-140)", leg: "Kansas City Chiefs ML", odds: -140 },
      { raw: "Over 47.5 (-105)", leg: "Over 47.5", odds: -105 },
    ]);
  });

  it("drops the boilerplate a book wraps around the legs", () => {
    const slip = `4 Leg Parlay
Bills -3.5 (-110)
Chiefs ML (-140)
Total Wager $10.00
To Win $42.95`;
    expect(parseSlip(slip).map((line) => line.leg)).toEqual(["Bills -3.5", "Chiefs ML"]);
  });

  it("ignores blank lines", () => {
    expect(parseSlip("\n\nBills -3.5 (-110)\n\n")).toHaveLength(1);
  });

  it("returns nothing for empty input", () => {
    expect(parseSlip("")).toEqual([]);
  });
});

describe("matchScore", () => {
  it("scores an exact line highest", () => {
    expect(matchScore("Buffalo Bills -3.5", "Buffalo Bills -3.5")).toBe(1);
  });

  it("still matches a shortened version of the same pick", () => {
    expect(matchScore("Buffalo Bills -3.5", "Bills -3.5")).toBeGreaterThan(0.4);
  });

  it("scores an unrelated pick near zero", () => {
    expect(matchScore("Buffalo Bills -3.5", "Over 47.5 total points")).toBeLessThan(0.2);
  });

  it("is safe on empty input", () => {
    expect(matchScore("", "Bills")).toBe(0);
  });
});
