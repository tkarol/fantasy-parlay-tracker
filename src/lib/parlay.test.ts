import { describe, expect, it } from "vitest";
import {
  combineDecimal,
  formatOneIn,
  isWeekOpen,
  longshotComparison,
  settleParlay,
  settleWeek,
  ticketOdds,
} from "./parlay";
import { leg, makeWeek } from "./testing";

describe("combineDecimal", () => {
  it("multiplies decimal prices across legs", () => {
    // -110 (1.9091) x +150 (2.5) = 4.7727
    expect(combineDecimal([-110, 150])).toBeCloseTo(4.7727, 3);
  });

  it("returns null when any leg is unpriced, rather than skipping it", () => {
    expect(combineDecimal([-110, null])).toBeNull();
    expect(combineDecimal([])).toBeNull();
  });
});

describe("settleParlay", () => {
  it("reports an empty ticket", () => {
    const s = settleParlay([], 5);
    expect(s.status).toBe("empty");
    expect(s.settled).toBe(false);
  });

  it("is building while any leg lacks a price", () => {
    const s = settleParlay([leg("a", -110), leg("b", null)], 5);
    expect(s.status).toBe("building");
    expect(s.allPriced).toBe(false);
    expect(s.potentialProfit).toBeNull();
  });

  it("is live once fully priced with legs outstanding", () => {
    const s = settleParlay([leg("a", -110, "Win"), leg("b", 150)], 5);
    expect(s.status).toBe("live");
    expect(s.settled).toBe(false);
    expect(s.potentialProfit).toBeCloseTo(18.86, 2);
  });

  it("pays out when every leg wins", () => {
    const s = settleParlay([leg("a", -110, "Win"), leg("b", 150, "Win")], 5);
    expect(s.status).toBe("won");
    expect(s.settled).toBe(true);
    // 5 x 4.7727 = 23.86 returned, 18.86 profit
    expect(s.profit).toBeCloseTo(18.86, 2);
    expect(s.toReturn).toBeCloseTo(23.86, 2);
  });

  it("loses the stake as soon as one leg loses", () => {
    const s = settleParlay([leg("a", -110, "Win"), leg("b", 150, "Loss")], 5);
    expect(s.status).toBe("lost");
    expect(s.profit).toBe(-5);
    expect(s.settled).toBe(true);
  });

  it("loses immediately even with legs still pending", () => {
    const s = settleParlay([leg("a", -110, "Loss"), leg("b", 150)], 5);
    expect(s.status).toBe("lost");
    expect(s.profit).toBe(-5);
  });

  describe("pushes", () => {
    // This is the behaviour the original build got wrong: it left a pushed
    // leg in the odds product and reported the whole ticket as a push.
    it("removes a pushed leg from the price instead of keeping it", () => {
      const withPush = settleParlay(
        [leg("a", -110, "Win"), leg("b", 150, "Push"), leg("c", 200, "Win")],
        5,
      );
      const withoutPushedLeg = settleParlay([leg("a", -110, "Win"), leg("c", 200, "Win")], 5);

      expect(withPush.status).toBe("won");
      expect(withPush.countingLegs).toBe(2);
      expect(withPush.voidedLegs).toBe(1);
      // Price matches the two-leg parlay exactly — the +150 leg is gone.
      expect(withPush.combinedDecimal).toBeCloseTo(withoutPushedLeg.combinedDecimal!, 10);
      expect(withPush.profit).toBeCloseTo(withoutPushedLeg.profit!, 10);
    });

    it("treats Void the same as Push", () => {
      const pushed = settleParlay([leg("a", -110, "Win"), leg("b", 150, "Push")], 5);
      const voided = settleParlay([leg("a", -110, "Win"), leg("b", 150, "Void")], 5);
      expect(voided.profit).toBeCloseTo(pushed.profit!, 10);
      expect(voided.status).toBe(pushed.status);
    });

    it("is a push only when every leg pushes", () => {
      const s = settleParlay([leg("a", -110, "Push"), leg("b", 150, "Void")], 5);
      expect(s.status).toBe("push");
      expect(s.profit).toBe(0);
      expect(s.countingLegs).toBe(0);
      expect(s.settled).toBe(true);
    });

    it("still loses when a live leg loses alongside a push", () => {
      const s = settleParlay([leg("a", -110, "Loss"), leg("b", 150, "Push")], 5);
      expect(s.status).toBe("lost");
      expect(s.profit).toBe(-5);
    });

    it("stays live when a push leaves a pending leg behind", () => {
      const s = settleParlay([leg("a", -110, "Push"), leg("b", 150)], 5);
      expect(s.status).toBe("live");
      expect(s.countingLegs).toBe(1);
    });
  });

  it("honours a recorded payout over the computed price", () => {
    const legs = [leg("a", -110, "Win"), leg("b", 150, "Win")];
    const computed = settleParlay(legs, 5);
    const boosted = settleParlay(legs, 5, { payoutOverride: 30 });

    expect(computed.profit).toBeCloseTo(18.86, 2);
    expect(boosted.profit).toBe(25); // 30 returned - 5 stake
    expect(boosted.status).toBe("won");
  });

  it("cannot price a win whose legs were never priced", () => {
    const s = settleParlay([leg("a", null, "Win")], 5);
    expect(s.status).toBe("won");
    expect(s.profit).toBeNull();
    expect(s.allPriced).toBe(false);
  });
});

describe("settleWeek", () => {
  it("uses the week's own stake", () => {
    const week = makeWeek({ stake: 20 });
    const s = settleWeek(week, [leg("a", 100, "Win")]);
    expect(s.stake).toBe(20);
    expect(s.profit).toBe(20);
  });
});

describe("isWeekOpen", () => {
  const now = new Date("2025-09-11T12:00:00Z");

  it("is open before the deadline", () => {
    expect(isWeekOpen(makeWeek({ deadline: new Date("2025-09-11T18:00:00Z") }), now)).toBe(true);
  });

  it("closes at the deadline", () => {
    expect(isWeekOpen(makeWeek({ deadline: new Date("2025-09-11T12:00:00Z") }), now)).toBe(false);
    expect(isWeekOpen(makeWeek({ deadline: new Date("2025-09-11T06:00:00Z") }), now)).toBe(false);
  });

  it("is closed once locked regardless of deadline", () => {
    const week = makeWeek({ closed: true, deadline: new Date("2025-12-01T00:00:00Z") });
    expect(isWeekOpen(week, now)).toBe(false);
  });

  it("treats a missing deadline as open", () => {
    expect(isWeekOpen(makeWeek({ deadline: null }), now)).toBe(true);
  });
});

describe("ticketOdds", () => {
  it("turns a price into a plain chance", () => {
    // A +100 double is 4.0 decimal — one in four.
    const odds = ticketOdds(4);
    expect(odds?.probability).toBeCloseTo(0.25, 6);
    expect(odds?.oneIn).toBeCloseTo(4, 6);
  });

  it("is null when the ticket cannot be priced", () => {
    expect(ticketOdds(null)).toBeNull();
    expect(ticketOdds(1)).toBeNull();
  });
});

describe("formatOneIn", () => {
  it("scales the wording with the number", () => {
    expect(formatOneIn(4)).toBe("1 in 4.0");
    expect(formatOneIn(340)).toBe("1 in 340");
    expect(formatOneIn(24_000)).toBe("1 in 24k");
    expect(formatOneIn(1_250_000)).toBe("1 in 1.3M");
  });

  it("does not pretend a coin flip is a longshot", () => {
    expect(formatOneIn(1)).toBe("even money");
  });
});

describe("longshotComparison", () => {
  it("finds the leg costing the most and prices the ticket without it", () => {
    const comparison = longshotComparison([
      leg("a", -110, "Pending"),
      leg("b", -110, "Pending"),
      leg("c", 900, "Pending"), // the longshot
    ]);

    expect(comparison?.leg.uid).toBe("c");
    // Dropping a 10.0 leg must make the ticket roughly ten times likelier.
    expect(comparison!.without.oneIn).toBeCloseTo(comparison!.with.oneIn / 10, 4);
    expect(comparison!.without.oneIn).toBeLessThan(comparison!.with.oneIn);
  });

  it("ignores legs that pushed, since they are off the ticket", () => {
    const comparison = longshotComparison([
      leg("a", -110, "Pending"),
      leg("b", -110, "Pending"),
      leg("c", 5000, "Push"),
    ]);
    expect(comparison?.leg.uid).not.toBe("c");
  });

  it("needs at least two priced legs to say anything", () => {
    expect(longshotComparison([leg("a", -110)])).toBeNull();
    expect(longshotComparison([leg("a", -110), leg("b", null)])).toBeNull();
  });
});
