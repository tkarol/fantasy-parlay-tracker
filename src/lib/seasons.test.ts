import { describe, expect, it } from "vitest";
import {
  buildAllTimeRecord,
  buildSeasonRecord,
  buildTickets,
  compareSeasons,
  defaultSeason,
  nextSeasonNumber,
  seasonsOf,
} from "./stats";
import { leg, makeWeek } from "./testing";
import type { Leg, Member, Week } from "../types/models";

function member(uid: string, displayName: string): Member {
  return { uid, role: "member", displayName, email: `${uid}@x.test`, photoURL: null, joinedAt: null };
}

function tickets(spec: [Week, Leg[]][]) {
  const byId: Record<string, Leg[]> = {};
  for (const [week, legs] of spec) byId[week.id] = legs;
  return buildTickets(spec.map(([week]) => week), byId);
}

/**
 * The league's real shape: a 2025 season that stopped partway through, and a
 * 2026 season picking back up.
 */
const ROSTER = [member("a", "Ann"), member("b", "Bo")];

function twoSeasons() {
  const spec: [Week, Leg[]][] = [];

  // 2025: 3 weeks played, then they stopped. Two wins, one loss.
  for (const [week, annResult, boResult] of [
    [1, "Win", "Win"],
    [2, "Win", "Win"],
    [3, "Win", "Loss"],
  ] as const) {
    spec.push([
      makeWeek({ season: 2025, week, closed: true, stake: 5 }),
      [leg("a", 100, annResult), leg("b", 100, boResult)],
    ]);
  }

  // 2026: 2 weeks so far, one win and one loss.
  for (const [week, annResult, boResult] of [
    [1, "Win", "Win"],
    [2, "Loss", "Win"],
  ] as const) {
    spec.push([
      makeWeek({ season: 2026, week, closed: true, stake: 10 }),
      [leg("a", 100, annResult), leg("b", 100, boResult)],
    ]);
  }

  return tickets(spec);
}

describe("seasonsOf", () => {
  it("lists seasons newest first, without duplicates", () => {
    expect(seasonsOf([{ season: 2025 }, { season: 2026 }, { season: 2025 }])).toEqual([2026, 2025]);
  });

  it("is empty for no data", () => {
    expect(seasonsOf([])).toEqual([]);
  });
});

describe("buildSeasonRecord", () => {
  it("scopes everything to one season", () => {
    const all = twoSeasons();
    const record2025 = buildSeasonRecord(all, 2025, ROSTER);
    const record2026 = buildSeasonRecord(all, 2026, ROSTER);

    expect(record2025.tickets).toHaveLength(3);
    expect(record2026.tickets).toHaveLength(2);

    // 2025: W1 +15 (5 x 2 x 2 - 5), W2 +15, W3 lost -5  => +25
    expect(record2025.summary.profit).toBe(25);
    // 2026: W1 +30 (10 x 2 x 2 - 10), W2 lost -10 => +20
    expect(record2026.summary.profit).toBe(20);
  });

  it("keeps each season's leaderboard separate", () => {
    const all = twoSeasons();
    const ann2025 = buildSeasonRecord(all, 2025, ROSTER).members.find((m) => m.key === "a")!;
    const ann2026 = buildSeasonRecord(all, 2026, ROSTER).members.find((m) => m.key === "a")!;

    expect(ann2025.wins).toBe(3);
    expect(ann2025.losses).toBe(0);
    expect(ann2026.wins).toBe(1);
    expect(ann2026.losses).toBe(1);
  });
});

describe("compareSeasons", () => {
  it("reports the change between two seasons", () => {
    const comparison = compareSeasons(twoSeasons(), 2026, 2025, ROSTER);

    expect(comparison.current.season).toBe(2026);
    expect(comparison.previous?.season).toBe(2025);
    expect(comparison.profit.current).toBe(20);
    expect(comparison.profit.previous).toBe(25);
    expect(comparison.profit.change).toBe(-5);
    expect(comparison.weeksSettled.change).toBe(-1);
  });

  it("handles having no previous season", () => {
    const comparison = compareSeasons(twoSeasons(), 2025, null, ROSTER);
    expect(comparison.previous).toBeNull();
    expect(comparison.profit.previous).toBeNull();
    expect(comparison.profit.change).toBeNull();
  });

  it("compares each member across both seasons", () => {
    const comparison = compareSeasons(twoSeasons(), 2026, 2025, ROSTER);
    const ann = comparison.members.find((m) => m.key === "a")!;

    expect(ann.previous?.hitRate).toBe(1); // 3-0 in 2025
    expect(ann.current?.hitRate).toBe(0.5); // 1-1 in 2026
    expect(ann.hitRate.change).toBe(-0.5);
  });

  it("keeps a member who played last season but not this one", () => {
    const spec: [Week, Leg[]][] = [
      [makeWeek({ season: 2025, week: 1, closed: true }), [leg("a", 100, "Win"), leg("gone", 100, "Win")]],
      [makeWeek({ season: 2026, week: 1, closed: true }), [leg("a", 100, "Win")]],
    ];
    const comparison = compareSeasons(tickets(spec), 2026, 2025);

    const departed = comparison.members.find((m) => m.key === "gone")!;
    expect(departed.current).toBeNull();
    expect(departed.previous?.legs).toBe(1);
    expect(departed.hitRate.change).toBeNull();
  });

  it("keeps a member who is new this season", () => {
    const spec: [Week, Leg[]][] = [
      [makeWeek({ season: 2025, week: 1, closed: true }), [leg("a", 100, "Win")]],
      [makeWeek({ season: 2026, week: 1, closed: true }), [leg("a", 100, "Win"), leg("new", 100, "Loss")]],
    ];
    const comparison = compareSeasons(tickets(spec), 2026, 2025);

    const rookie = comparison.members.find((m) => m.key === "new")!;
    expect(rookie.previous).toBeNull();
    expect(rookie.current?.legs).toBe(1);
  });
});

describe("buildAllTimeRecord", () => {
  it("totals across every season", () => {
    const record = buildAllTimeRecord(twoSeasons(), ROSTER);

    expect(record.seasons).toEqual([2026, 2025]);
    expect(record.summary.profit).toBe(45); // 25 + 20
    expect(record.bySeasonProfit).toEqual([
      { season: 2025, profit: 25, weeks: 3 },
      { season: 2026, profit: 20, weeks: 2 },
    ]);
  });

  it("merges a member's record across seasons", () => {
    const ann = buildAllTimeRecord(twoSeasons(), ROSTER).members.find((m) => m.key === "a")!;
    expect(ann.legs).toBe(5);
    expect(ann.wins).toBe(4);
    expect(ann.losses).toBe(1);
  });
});

describe("season selection", () => {
  it("defaults to the newest season with weeks", () => {
    expect(defaultSeason([{ season: 2025 }, { season: 2026 }])).toBe(2026);
    expect(defaultSeason([])).toBeNull();
  });

  it("offers the year after the latest season", () => {
    expect(nextSeasonNumber([{ season: 2030 }])).toBe(2031);
  });

  it("never offers a season in the past", () => {
    // A league last played in 2025 starting up today should open the current
    // year, not 2026-because-2025-plus-one.
    const thisYear = new Date().getFullYear();
    expect(nextSeasonNumber([{ season: 2019 }])).toBe(thisYear);
  });

  it("falls back to the current year with no data", () => {
    expect(nextSeasonNumber([])).toBe(new Date().getFullYear());
  });
});
