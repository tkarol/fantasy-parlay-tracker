import { describe, expect, it } from "vitest";
import {
  SCORING,
  buildBadges,
  buildStandings,
  legPoints,
  rankMovement,
  survivorState,
  weeklyAwards,
} from "./scoring";
import { buildTickets } from "./stats";
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

const ROSTER = [member("a", "Ann"), member("b", "Bo"), member("c", "Cy")];

describe("legPoints", () => {
  it("pays more for a harder pick", () => {
    // -400 is 80% implied, so 20 points; +500 is ~16.7%, so 83.
    expect(legPoints(-400, "Win")).toBe(20);
    expect(legPoints(100, "Win")).toBe(50);
    expect(legPoints(500, "Win")).toBe(83);
  });

  it("is the whole point: chalk cannot out-earn a longshot", () => {
    expect(legPoints(500, "Win")).toBeGreaterThan(legPoints(-400, "Win") * 4);
  });

  it("pays nothing for anything but a win", () => {
    for (const result of ["Loss", "Push", "Void", "Pending"] as const) {
      expect(legPoints(500, result)).toBe(0);
    }
  });

  it("treats an unpriced win as even money rather than guessing", () => {
    expect(legPoints(null, "Win")).toBe(SCORING.unpricedWinPoints);
  });
});

describe("buildStandings", () => {
  it("ranks by points, not by hit rate", () => {
    const standings = buildStandings(
      tickets([
        // Ann takes heavy chalk and wins; Bo takes a dog and wins.
        [makeWeek({ week: 1, closed: true }), [leg("a", -400, "Win"), leg("b", 500, "Win")]],
      ]),
      ROSTER,
    );
    expect(standings[0]!.name).toBe("Bo");
    expect(standings[0]!.points).toBeGreaterThan(standings[1]!.points);
  });

  it("adds the carry bonus only when the ticket actually cashed", () => {
    const cashed = buildStandings(
      tickets([[makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Win")]]]),
      ROSTER,
    );
    const died = buildStandings(
      tickets([[makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Loss")]]]),
      ROSTER,
    );
    expect(cashed.find((r) => r.name === "Ann")!.carryPoints).toBe(SCORING.carryBonus);
    expect(died.find((r) => r.name === "Ann")!.carryPoints).toBe(0);
  });

  it("docks the member who broke an otherwise-clean ticket", () => {
    const standings = buildStandings(
      tickets([
        [
          makeWeek({ week: 1, closed: true }),
          [leg("a", 100, "Win"), leg("b", 100, "Win"), leg("c", 100, "Loss")],
        ],
      ]),
      ROSTER,
    );
    const cy = standings.find((r) => r.name === "Cy")!;
    expect(cy.bustPoints).toBe(SCORING.soloBustPenalty);
    expect(cy.points).toBe(-SCORING.soloBustPenalty);
  });

  it("does not dock anyone when several legs lost", () => {
    const standings = buildStandings(
      tickets([
        [
          makeWeek({ week: 1, closed: true }),
          [leg("a", 100, "Win"), leg("b", 100, "Loss"), leg("c", 100, "Loss")],
        ],
      ]),
      ROSTER,
    );
    expect(standings.every((row) => row.bustPoints === 0)).toBe(true);
  });

  it("ignores a week with legs still pending", () => {
    const standings = buildStandings(
      tickets([[makeWeek({ week: 1, closed: false }), [leg("a", 100, "Pending")]]]),
      ROSTER,
    );
    expect(standings.every((row) => row.points === 0)).toBe(true);
  });

  it("ignores an open week even when every submitted leg is graded", () => {
    // Otherwise the table shuffles each time a straggler adds a leg: a lone
    // graded win makes the ticket look decided while the week is still open.
    const standings = buildStandings(
      tickets([[makeWeek({ week: 1, closed: false }), [leg("a", 100, "Win")]]]),
      ROSTER,
    );
    expect(standings.every((row) => row.points === 0)).toBe(true);
  });

  it("counts the week once it is closed", () => {
    const standings = buildStandings(
      tickets([[makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win")]]]),
      ROSTER,
    );
    expect(standings.find((row) => row.name === "Ann")!.points).toBeGreaterThan(0);
  });

  it("lists roster members who have not scored yet", () => {
    const standings = buildStandings(
      tickets([[makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win")]]]),
      ROSTER,
    );
    expect(standings).toHaveLength(3);
    expect(standings.find((r) => r.name === "Cy")!.points).toBe(0);
  });

  it("gives equal points the same rank", () => {
    const standings = buildStandings(
      tickets([[makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Win")]]]),
      [member("a", "Ann"), member("b", "Bo")],
    );
    expect(standings[0]!.rank).toBe(1);
    expect(standings[1]!.rank).toBe(1);
  });

  it("reports movement against the week before", () => {
    const standings = buildStandings(
      tickets([
        // Ann leads after week 1...
        [makeWeek({ week: 1, closed: true }), [leg("a", 500, "Win"), leg("b", 100, "Loss")]],
        // ...then Bo overhauls her in week 2.
        [makeWeek({ week: 2, closed: true }), [leg("a", 100, "Loss"), leg("b", 900, "Win")]],
      ]),
      [member("a", "Ann"), member("b", "Bo")],
    );
    const bo = standings.find((r) => r.name === "Bo")!;
    expect(bo.rank).toBe(1);
    expect(rankMovement(bo)).toBe(1); // climbed one place
  });

  it("has no movement to report in the first week", () => {
    const standings = buildStandings(
      tickets([[makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win")]]]),
      ROSTER,
    );
    expect(rankMovement(standings[0]!)).toBeNull();
  });
});

describe("weeklyAwards", () => {
  it("names the longest price that landed and the shortest that did not", () => {
    const [ticket] = tickets([
      [
        makeWeek({ week: 1, closed: true }),
        [leg("a", 600, "Win"), leg("b", -450, "Loss"), leg("c", -110, "Win")],
      ],
    ]);
    const awards = weeklyAwards(ticket!);
    expect(awards.find((a) => a.kind === "dog")?.detail).toContain("+600");
    expect(awards.find((a) => a.kind === "lock")?.detail).toContain("-450");
  });

  it("calls out a solo bust", () => {
    const [ticket] = tickets([
      [makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Loss")]],
    ]);
    expect(weeklyAwards(ticket!).find((a) => a.kind === "killer")?.name).toBe("b");
  });

  it("celebrates a clean sweep", () => {
    const [ticket] = tickets([
      [makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Win")]],
    ]);
    expect(weeklyAwards(ticket!).some((a) => a.kind === "perfect")).toBe(true);
  });

  it("says nothing about a week still in play", () => {
    const [ticket] = tickets([[makeWeek({ week: 1 }), [leg("a", 100, "Pending")]]]);
    expect(weeklyAwards(ticket!)).toEqual([]);
  });
});

describe("buildBadges", () => {
  const weeksFrom = (results: ("Win" | "Loss")[]) =>
    tickets(
      results.map((result, index) => [
        makeWeek({ week: index + 1, closed: true }),
        [leg("a", 100, result)],
      ]),
    );

  it("awards a heater for three in a row", () => {
    const badges = buildBadges(weeksFrom(["Win", "Win", "Win"]), [member("a", "Ann")]);
    expect(badges.get("a")!.map((b) => b.id)).toContain("heater");
  });

  it("awards a cooler for five losses in a row", () => {
    const badges = buildBadges(weeksFrom(["Loss", "Loss", "Loss", "Loss", "Loss"]), [
      member("a", "Ann"),
    ]);
    expect(badges.get("a")!.map((b) => b.id)).toContain("cooler");
  });

  it("awards a longshot for landing a big price", () => {
    const badges = buildBadges(
      tickets([[makeWeek({ week: 1, closed: true }), [leg("a", 700, "Win")]]]),
      [member("a", "Ann")],
    );
    expect(badges.get("a")!.map((b) => b.id)).toContain("longshot");
  });

  it("marks the chalk-eater", () => {
    const chalk = tickets(
      [1, 2, 3, 4].map((week) => [makeWeek({ week, closed: true }), [leg("a", -400, "Win")]]),
    );
    expect(buildBadges(chalk, [member("a", "Ann")]).get("a")!.map((b) => b.id)).toContain("chalk");
  });

  it("gives nothing away for a thin record", () => {
    const badges = buildBadges(weeksFrom(["Win"]), [member("a", "Ann")]);
    expect(badges.get("a")).toEqual([]);
  });
});

describe("survivorState", () => {
  it("knocks someone out the first week their leg loses", () => {
    const state = survivorState(
      tickets([
        [makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Loss")]],
        [makeWeek({ week: 2, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Win")]],
      ]),
      [member("a", "Ann"), member("b", "Bo")],
    );
    const bo = state.entrants.find((e) => e.name === "Bo")!;
    expect(bo.alive).toBe(false);
    expect(bo.eliminatedWeek).toEqual({ season: 2025, week: 1 });
    // A later win cannot bring them back.
    expect(state.alive).toBe(1);
  });

  it("survives a push", () => {
    const state = survivorState(
      tickets([[makeWeek({ week: 1, closed: true }), [leg("a", 100, "Push")]]]),
      [member("a", "Ann")],
    );
    expect(state.entrants[0]!.alive).toBe(true);
  });

  it("survives missing a week, since attendance is patchy", () => {
    const state = survivorState(
      tickets([
        [makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win")]],
        [makeWeek({ week: 2, closed: true }), [leg("a", 100, "Win")]],
      ]),
      [member("a", "Ann"), member("b", "Bo")],
    );
    expect(state.entrants.find((e) => e.name === "Bo")!.alive).toBe(true);
  });

  it("crowns a champion once one is left", () => {
    const state = survivorState(
      tickets([
        [makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Loss")]],
      ]),
      [member("a", "Ann"), member("b", "Bo")],
    );
    expect(state.champion?.name).toBe("Ann");
  });

  it("crowns whoever lasted longest once everyone is out", () => {
    // Over a full season everybody eventually loses a leg; the pool still has
    // a winner.
    const state = survivorState(
      tickets([
        [makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Loss")]],
        [makeWeek({ week: 2, closed: true }), [leg("a", 100, "Loss"), leg("b", 100, "Win")]],
      ]),
      [member("a", "Ann"), member("b", "Bo")],
    );
    expect(state.alive).toBe(0);
    expect(state.champion?.name).toBe("Ann");
    expect(state.furthest.map((e) => e.name)).toEqual(["Ann"]);
  });

  it("reports a tie rather than picking one", () => {
    const state = survivorState(
      tickets([[makeWeek({ week: 1, closed: true }), [leg("a", 100, "Loss"), leg("b", 100, "Loss")]]]),
      [member("a", "Ann"), member("b", "Bo")],
    );
    expect(state.champion).toBeNull();
    expect(state.furthest).toEqual([]);
  });

  it("has no champion while several are still in", () => {
    const state = survivorState(
      tickets([[makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Win")]]]),
      [member("a", "Ann"), member("b", "Bo")],
    );
    expect(state.champion).toBeNull();
    expect(state.alive).toBe(2);
  });
});
