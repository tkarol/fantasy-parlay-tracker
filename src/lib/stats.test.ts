import { describe, expect, it } from "vitest";
import {
  buildLeaderboard,
  buildTickets,
  currentStreak,
  formatStreak,
  headToHead,
  longestRun,
  sortLeaderboard,
  summarizeSeason,
} from "./stats";
import { leg, makeWeek } from "./testing";
import type { Leg, LegResult, Member, Week } from "../types/models";

function member(uid: string, displayName: string): Member {
  return { uid, role: "member", displayName, email: `${uid}@x.test`, photoURL: null, joinedAt: null };
}

/** Build tickets from a compact [week, legs] description. */
function tickets(spec: [Week, Leg[]][]) {
  const weeks = spec.map(([w]) => w);
  const byId: Record<string, Leg[]> = {};
  for (const [w, legs] of spec) byId[w.id] = legs;
  return buildTickets(weeks, byId);
}

describe("summarizeSeason", () => {
  it("sums real group P&L across weeks", () => {
    const t = tickets([
      // Week 1: won. 5 x (1.9091 x 2.5) = 23.86 -> +18.86
      [makeWeek({ week: 1, closed: true, stake: 5 }), [leg("a", -110, "Win"), leg("b", 150, "Win")]],
      // Week 2: lost -> -5
      [makeWeek({ week: 2, closed: true, stake: 5 }), [leg("a", -110, "Loss"), leg("b", 150, "Win")]],
      // Week 3: lost -> -5
      [makeWeek({ week: 3, closed: true, stake: 5 }), [leg("a", -110, "Loss"), leg("b", 150, "Win")]],
    ]);

    const s = summarizeSeason(t);
    expect(s.ticketsWon).toBe(1);
    expect(s.ticketsLost).toBe(2);
    expect(s.profit).toBeCloseTo(8.86, 2);
    expect(s.totalStaked).toBe(15);
    expect(s.hitRate).toBeCloseTo(1 / 3, 6);
    expect(s.roi).toBeCloseTo(8.86 / 15, 4);
  });

  it("excludes an all-push week from staked and ROI", () => {
    const s = summarizeSeason(
      tickets([
        [makeWeek({ week: 1, closed: true }), [leg("a", -110, "Push")]],
        [makeWeek({ week: 2, closed: true }), [leg("a", 100, "Win")]],
      ]),
    );
    expect(s.ticketsPushed).toBe(1);
    expect(s.totalStaked).toBe(5); // only the decided week
    expect(s.profit).toBe(5);
  });

  it("ignores unsettled weeks", () => {
    const s = summarizeSeason(
      tickets([[makeWeek({ week: 1 }), [leg("a", -110), leg("b", 150)]]]),
    );
    expect(s.weeksSettled).toBe(0);
    expect(s.profit).toBe(0);
    expect(s.roi).toBeNull();
  });

  it("tracks streaks and the profit curve", () => {
    const s = summarizeSeason(
      tickets([
        [makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win")]],
        [makeWeek({ week: 2, closed: true }), [leg("a", 100, "Win")]],
        [makeWeek({ week: 3, closed: true }), [leg("a", 100, "Loss")]],
      ]),
    );
    expect(s.currentStreak).toEqual({ type: "L", length: 1 });
    expect(s.longestWinStreak).toBe(2);
    expect(s.profitCurve.map((p) => p.cumulative)).toEqual([5, 10, 5]);
  });

  it("names the best and worst weeks", () => {
    const s = summarizeSeason(
      tickets([
        [makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win")]],
        [makeWeek({ week: 2, closed: true }), [leg("a", 900, "Win")]],
        [makeWeek({ week: 3, closed: true }), [leg("a", 100, "Loss")]],
      ]),
    );
    expect(s.bestWeek?.week.week).toBe(2);
    expect(s.worstWeek?.week.week).toBe(3);
  });
});

describe("buildLeaderboard", () => {
  it("tracks per-member records without counting pushes against hit rate", () => {
    const { members } = buildLeaderboard(
      tickets([
        [makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Loss")]],
        [makeWeek({ week: 2, closed: true }), [leg("a", 100, "Push"), leg("b", 100, "Win")]],
      ]),
      [member("a", "Ann"), member("b", "Bo")],
    );

    const ann = members.find((m) => m.key === "a")!;
    expect(ann.legs).toBe(2);
    expect(ann.wins).toBe(1);
    expect(ann.pushes).toBe(1);
    expect(ann.decided).toBe(1);
    expect(ann.hitRate).toBe(1);
    expect(ann.name).toBe("Ann");
  });

  it("includes roster members who never submitted a leg", () => {
    const { members } = buildLeaderboard(
      tickets([[makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win")]]]),
      [member("a", "Ann"), member("c", "Cy")],
    );
    const cy = members.find((m) => m.key === "c")!;
    expect(cy.legs).toBe(0);
    expect(cy.hitRate).toBeNull();
    expect(cy.missedWeeks).toBe(1);
  });

  it("counts a carry only when the whole ticket cashed", () => {
    const { members } = buildLeaderboard(
      tickets([
        // Ann wins on a ticket that cashes.
        [makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Win")]],
        // Ann wins but the ticket dies.
        [makeWeek({ week: 2, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Loss")]],
      ]),
      [member("a", "Ann"), member("b", "Bo")],
    );
    expect(members.find((m) => m.key === "a")!.carries).toBe(1);
    expect(members.find((m) => m.key === "a")!.wins).toBe(2);
  });

  describe("blame", () => {
    it("pins a solo bust and prices what it cost", () => {
      const { members, busts } = buildLeaderboard(
        tickets([
          [
            makeWeek({ week: 1, closed: true, stake: 10 }),
            [leg("a", 100, "Win"), leg("b", 100, "Win"), leg("c", 100, "Loss")],
          ],
        ]),
        [member("a", "Ann"), member("b", "Bo"), member("c", "Cy")],
      );

      const cy = members.find((m) => m.key === "c")!;
      expect(cy.soloBusts).toBe(1);
      // Had Cy's leg landed: 10 x 2 x 2 x 2 = 80 back, 70 profit.
      expect(cy.bustCost).toBe(70);

      expect(busts).toHaveLength(1);
      expect(busts[0]!.name).toBe("Cy");
      expect(busts[0]!.cost).toBe(70);
    });

    it("splits blame when more than one leg lost", () => {
      const { members, busts } = buildLeaderboard(
        tickets([
          [
            makeWeek({ week: 1, closed: true }),
            [leg("a", 100, "Win"), leg("b", 100, "Loss"), leg("c", 100, "Loss")],
          ],
        ]),
        [member("a", "Ann"), member("b", "Bo"), member("c", "Cy")],
      );
      expect(members.find((m) => m.key === "b")!.sharedBusts).toBe(1);
      expect(members.find((m) => m.key === "c")!.sharedBusts).toBe(1);
      expect(members.find((m) => m.key === "b")!.soloBusts).toBe(0);
      expect(busts).toHaveLength(0);
    });

    it("does not assign blame while legs are still ungraded", () => {
      const { members, busts } = buildLeaderboard(
        tickets([
          [makeWeek({ week: 1, closed: true }), [leg("a", 100, "Loss"), leg("b", 100)]],
        ]),
        [member("a", "Ann"), member("b", "Bo")],
      );
      expect(members.find((m) => m.key === "a")!.soloBusts).toBe(0);
      expect(busts).toHaveLength(0);
    });

    it("ignores pushed legs when deciding who is to blame", () => {
      const { members } = buildLeaderboard(
        tickets([
          [
            makeWeek({ week: 1, closed: true }),
            [leg("a", 100, "Win"), leg("b", 100, "Push"), leg("c", 100, "Loss")],
          ],
        ]),
        [member("a", "Ann"), member("b", "Bo"), member("c", "Cy")],
      );
      expect(members.find((m) => m.key === "c")!.soloBusts).toBe(1);
      expect(members.find((m) => m.key === "b")!.soloBusts).toBe(0);
      // Cost is priced on the counting legs only: 5 x 2 x 2 = 20 -> 15 profit.
      expect(members.find((m) => m.key === "c")!.bustCost).toBe(15);
    });
  });

  it("keeps hypothetical solo P&L separate from group money", () => {
    const t = tickets([
      [makeWeek({ week: 1, closed: true, stake: 5 }), [leg("a", 100, "Win"), leg("b", 100, "Loss")]],
    ]);
    const { members } = buildLeaderboard(t, [member("a", "Ann"), member("b", "Bo")]);
    const season = summarizeSeason(t);

    // Ann's leg won, so her hypothetical single profits $5...
    expect(members.find((m) => m.key === "a")!.soloProfit).toBe(5);
    // ...but the group's shared ticket still lost its stake.
    expect(season.profit).toBe(-5);
  });

  it("measures wins against the price implied by the odds", () => {
    const { members } = buildLeaderboard(
      tickets([
        // Two -200 favourites (66.7% implied) both won: ~0.67 wins above expected.
        [makeWeek({ week: 1, closed: true }), [leg("a", -200, "Win")]],
        [makeWeek({ week: 2, closed: true }), [leg("a", -200, "Win")]],
      ]),
      [member("a", "Ann")],
    );
    const ann = members.find((m) => m.key === "a")!;
    expect(ann.expectedWins).toBeCloseTo(1.33, 2);
    expect(ann.winsAboveExpected).toBeCloseTo(0.67, 2);
  });

  it("groups legacy legs that have no uid by member name", () => {
    const legacy: Leg[] = [
      { ...leg("", 100, "Win"), id: "auto1", uid: "", memberName: "Dave" },
      { ...leg("", 100, "Loss"), id: "auto2", uid: "", memberName: "Dave" },
    ];
    const week = makeWeek({ week: 1, closed: true });
    const { members } = buildLeaderboard(buildTickets([week], { [week.id]: legacy }));
    const dave = members.find((m) => m.name === "Dave")!;
    expect(dave.legs).toBe(2);
    expect(dave.wins).toBe(1);
  });
});

describe("sortLeaderboard", () => {
  const t = tickets([
    [makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Loss")]],
    [makeWeek({ week: 2, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Win")]],
  ]);
  const { members } = buildLeaderboard(t, [member("a", "Ann"), member("b", "Bo")]);

  it("defaults to best hit rate first", () => {
    expect(members[0]!.name).toBe("Ann");
  });

  it("sorts by an explicit column and direction", () => {
    expect(sortLeaderboard(members, "losses", "desc")[0]!.name).toBe("Bo");
    expect(sortLeaderboard(members, "name", "asc")[0]!.name).toBe("Ann");
  });
});

describe("headToHead", () => {
  it("counts only weeks where both members have a graded leg", () => {
    const h = headToHead(
      tickets([
        [makeWeek({ week: 1, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Loss")]],
        [makeWeek({ week: 2, closed: true }), [leg("a", 100, "Win"), leg("b", 100, "Win")]],
        [makeWeek({ week: 3, closed: true }), [leg("a", 100, "Win")]], // b absent
        [makeWeek({ week: 4, closed: true }), [leg("a", 100), leg("b", 100, "Win")]], // a pending
      ]),
      "a",
      "b",
      [member("a", "a"), member("b", "b")],
    );
    expect(h.weeksTogether).toBe(2);
    expect(h.aWins).toBe(1);
    expect(h.bothWon).toBe(1);
    expect(h.bWins).toBe(0);
  });
});

describe("streak helpers", () => {
  it("reads the trailing run", () => {
    expect(currentStreak(["W", "L", "L", "L"])).toEqual({ type: "L", length: 3 });
    expect(currentStreak(["W"])).toEqual({ type: "W", length: 1 });
    expect(currentStreak([])).toEqual({ type: null, length: 0 });
  });

  it("finds the longest run", () => {
    expect(longestRun(["W", "W", "L", "W", "W", "W"], "W")).toBe(3);
    expect(longestRun(["W", "W", "L"], "L")).toBe(1);
  });

  it("formats for display", () => {
    expect(formatStreak({ type: "W", length: 3 })).toBe("W3");
    expect(formatStreak({ type: null, length: 0 })).toBe("—");
  });
});

describe("one row per person", () => {
  /*
   * The original app wrote a member's own legs at legs/{uid}, but legs an admin
   * entered for them at an auto id with the *admin's* uid in createdBy — so
   * those arrive with no uid. Keyed naively that splits one person into two
   * leaderboard rows, which is what this league saw on real data.
   */
  function selfSubmitted(uid: string, name: string, result: LegResult): Leg {
    return { ...leg(uid, 100, result), memberName: name };
  }
  function adminEntered(name: string, result: LegResult, id: string): Leg {
    return { ...leg("", 100, result), id, uid: "", memberName: name };
  }

  const roster = [member("u1", "Esteban Umana"), member("u2", "Chris M")];

  it("merges admin-entered legs into the member who owns them", () => {
    const week1 = makeWeek({ week: 1, closed: true });
    const week2 = makeWeek({ week: 2, closed: true });
    const { members } = buildLeaderboard(
      buildTickets([week1, week2], {
        [week1.id]: [selfSubmitted("u1", "Esteban Umana", "Win")],
        [week2.id]: [adminEntered("Esteban Umana", "Loss", "auto1")],
      }),
      roster,
    );

    const esteban = members.filter((m) => m.name === "Esteban Umana");
    expect(esteban).toHaveLength(1);
    expect(esteban[0]!.legs).toBe(2);
    expect(esteban[0]!.wins).toBe(1);
    expect(esteban[0]!.losses).toBe(1);
  });

  it("matches names regardless of case and spacing", () => {
    const week = makeWeek({ week: 1, closed: true });
    const { members } = buildLeaderboard(
      buildTickets([week], {
        [week.id]: [
          selfSubmitted("u2", "Chris M", "Win"),
          adminEntered("  chris   m ", "Loss", "auto2"),
        ],
      }),
      roster,
    );
    expect(members.filter((m) => m.name === "Chris M")).toHaveLength(1);
    expect(members.find((m) => m.name === "Chris M")!.legs).toBe(2);
  });

  it("uses the roster's spelling of the name", () => {
    const week = makeWeek({ week: 1, closed: true });
    const { members } = buildLeaderboard(
      buildTickets([week], { [week.id]: [adminEntered("esteban umana", "Win", "auto3")] }),
      roster,
    );
    expect(members.find((m) => m.legs === 1)!.name).toBe("Esteban Umana");
  });

  it("keeps a streak in chronological order across both kinds of leg", () => {
    const weeks = [1, 2, 3].map((week) => makeWeek({ week, closed: true }));
    const { members } = buildLeaderboard(
      buildTickets(weeks, {
        [weeks[0]!.id]: [selfSubmitted("u1", "Esteban Umana", "Loss")],
        [weeks[1]!.id]: [adminEntered("Esteban Umana", "Win", "auto4")],
        [weeks[2]!.id]: [selfSubmitted("u1", "Esteban Umana", "Win")],
      }),
      roster,
    );
    // Merging must not concatenate two separate histories — the run is W2.
    expect(members.find((m) => m.name === "Esteban Umana")!.streak).toEqual({ type: "W", length: 2 });
  });

  it("never merges two different people who share a name", () => {
    const week = makeWeek({ week: 1, closed: true });
    const twins = [member("x1", "Chris M"), member("x2", "Chris M")];
    const { members } = buildLeaderboard(
      buildTickets([week], {
        [week.id]: [selfSubmitted("x1", "Chris M", "Win"), selfSubmitted("x2", "Chris M", "Loss")],
      }),
      twins,
    );
    expect(members.filter((m) => m.name === "Chris M")).toHaveLength(2);
  });

  it("still groups a departed member's own legs together", () => {
    // Not on the roster any more, but their two kinds of leg are still one person.
    const week1 = makeWeek({ week: 1, closed: true });
    const week2 = makeWeek({ week: 2, closed: true });
    const { members } = buildLeaderboard(
      buildTickets([week1, week2], {
        [week1.id]: [selfSubmitted("old", "Old Teammate", "Win")],
        [week2.id]: [adminEntered("Old Teammate", "Loss", "auto5")],
      }),
      roster,
    );
    const departed = members.filter((m) => m.name === "Old Teammate");
    expect(departed).toHaveLength(1);
    expect(departed[0]!.legs).toBe(2);
  });
});
