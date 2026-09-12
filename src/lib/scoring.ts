import { americanToDecimal, impliedProbability } from "./odds";
import { createOwnerResolver, type WeekTicket } from "./stats";
import { isVoidingResult, type Leg, type Member } from "../types/models";

/**
 * The side game.
 *
 * The parlay itself almost never cashes — eight legs at roughly even money is
 * about a 1-in-250 shot, and this league went 0 for 12 in 2025. So the thing
 * worth competing over is not the ticket, it is each other. Everything here is
 * derived from the legs members already submit and the grades an admin already
 * enters: there is nothing extra to run each week.
 */

export const SCORING = {
  /** Taken off for breaking an otherwise-winning ticket on your own. */
  soloBustPenalty: 25,
  /** Added for a winning leg on a ticket that actually cashed. */
  carryBonus: 50,
  /** A winning leg with no recorded price scores as even money. */
  unpricedWinPoints: 50,
  /** Odds at or beyond this earn the Longshot badge. */
  longshotOdds: 500,
} as const;

/**
 * What a winning leg is worth: harder picks pay more.
 *
 * Points are the market's own view of difficulty — a -400 favourite is scored
 * at 20 and a +500 dog at 83 — so a season is won by picking well rather than
 * by hiding behind chalk to protect a hit rate.
 */
export function legPoints(odds: number | null, result: Leg["result"]): number {
  if (result !== "Win") return 0;
  const probability = impliedProbability(odds);
  if (probability === null) return SCORING.unpricedWinPoints;
  return Math.round(100 * (1 - probability));
}

export interface StandingsRow {
  key: string;
  uid: string;
  name: string;
  /** legPoints + carryPoints - bustPoints. */
  points: number;
  legPoints: number;
  carryPoints: number;
  /** Positive number representing points lost. */
  bustPoints: number;
  legs: number;
  wins: number;
  losses: number;
  /** Best single leg of the season, for the standings subtitle. */
  bestLeg: { leg: Leg; points: number } | null;
  rank: number;
  /** Rank as of the previous settled week, for movement arrows. */
  previousRank: number | null;
}

function accumulate(
  tickets: readonly WeekTicket[],
  roster: readonly Member[],
): Map<string, Omit<StandingsRow, "rank" | "previousRank">> {
  const owner = createOwnerResolver(roster);
  const rows = new Map<string, Omit<StandingsRow, "rank" | "previousRank">>();

  const ensure = (key: string, name: string) => {
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        uid: owner.uidOf(key),
        name: owner.nameOf(key, name),
        points: 0,
        legPoints: 0,
        carryPoints: 0,
        bustPoints: 0,
        legs: 0,
        wins: 0,
        losses: 0,
        bestLeg: null,
      };
      rows.set(key, row);
    }
    return row;
  };

  // Roster members appear even before they score, so the table is the league.
  for (const member of roster) ensure(member.uid, member.displayName);

  for (const { week, legs, settlement } of tickets) {
    /*
     * Points count only once a week is closed.
     *
     * "Settled" alone is not enough: a week whose submitted legs all happen to
     * be graded reports as settled while it is still open, so standings would
     * shuffle every time a straggler adds a leg. Closing the week is the
     * admin's explicit "this one is final".
     */
    if (!week.closed || !settlement.settled) continue;

    for (const leg of legs) {
      const row = ensure(owner.keyOf(leg), leg.memberName);
      row.legs += 1;

      if (leg.result === "Win") {
        row.wins += 1;
        const points = legPoints(leg.odds, leg.result);
        row.legPoints += points;
        if (!row.bestLeg || points > row.bestLeg.points) row.bestLeg = { leg, points };
        if (settlement.status === "won") row.carryPoints += SCORING.carryBonus;
      } else if (leg.result === "Loss") {
        row.losses += 1;
      }
    }

    // Breaking an otherwise-clean ticket costs you.
    if (settlement.status === "lost" && settlement.pendingLegs === 0) {
      const counting = legs.filter((leg) => !isVoidingResult(leg.result));
      const losers = counting.filter((leg) => leg.result === "Loss");
      if (losers.length === 1) {
        const loser = losers[0]!;
        ensure(owner.keyOf(loser), loser.memberName).bustPoints += SCORING.soloBustPenalty;
      }
    }
  }

  for (const row of rows.values()) {
    row.points = row.legPoints + row.carryPoints - row.bustPoints;
  }

  return rows;
}

function rank(
  rows: Iterable<Omit<StandingsRow, "rank" | "previousRank">>,
): Map<string, number> {
  const sorted = [...rows].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name),
  );
  const ranks = new Map<string, number>();
  sorted.forEach((row, index) => {
    // Equal points share a rank.
    const previous = sorted[index - 1];
    const sameAsPrevious = previous && previous.points === row.points;
    ranks.set(row.key, sameAsPrevious ? (ranks.get(previous.key) ?? index + 1) : index + 1);
  });
  return ranks;
}

/** The season table, with movement against the week before. */
export function buildStandings(
  tickets: readonly WeekTicket[],
  roster: readonly Member[] = [],
): StandingsRow[] {
  const settled = [...tickets]
    .filter((ticket) => ticket.week.closed && ticket.settlement.settled)
    .sort((a, b) => a.week.season - b.week.season || a.week.week - b.week.week);

  const rows = accumulate(tickets, roster);
  const currentRanks = rank(rows.values());

  // Rank movement needs the table as it stood before the latest settled week.
  const previousRanks =
    settled.length > 1
      ? rank(accumulate(settled.slice(0, -1), roster).values())
      : new Map<string, number>();

  return [...rows.values()]
    .map((row) => ({
      ...row,
      rank: currentRanks.get(row.key) ?? 0,
      previousRank: previousRanks.get(row.key) ?? null,
    }))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
}

/** Places gained since last week. Positive is up the table. */
export function rankMovement(row: StandingsRow): number | null {
  if (row.previousRank === null) return null;
  return row.previousRank - row.rank;
}

// ---------------------------------------------------------------------------
// Weekly awards
// ---------------------------------------------------------------------------

export type AwardKind = "dog" | "lock" | "killer" | "perfect";

export interface WeeklyAward {
  kind: AwardKind;
  emoji: string;
  title: string;
  /** Who it belongs to. Empty for a whole-team award. */
  name: string;
  detail: string;
}

/**
 * What happened this week, worked out from the grades alone.
 *
 * A losing season still produces stories, and these are the ones worth
 * telling: the dog that came in, the lock that did not, and who broke it.
 */
export function weeklyAwards(ticket: WeekTicket): WeeklyAward[] {
  const { legs, settlement } = ticket;
  if (!settlement.settled) return [];

  const counting = legs.filter((leg) => !isVoidingResult(leg.result));
  const priced = counting.filter((leg) => leg.odds !== null);
  const awards: WeeklyAward[] = [];

  // Longest price that actually landed.
  const winners = priced.filter((leg) => leg.result === "Win");
  if (winners.length > 0) {
    const dog = winners.reduce((best, leg) =>
      (americanToDecimal(leg.odds) ?? 0) > (americanToDecimal(best.odds) ?? 0) ? leg : best,
    );
    if ((dog.odds ?? 0) > 0) {
      awards.push({
        kind: "dog",
        emoji: "🎯",
        title: "Dog of the week",
        name: dog.memberName,
        detail: `${dog.leg} at ${dog.odds! > 0 ? "+" : ""}${dog.odds}`,
      });
    }
  }

  // Shortest price that did not.
  const losers = priced.filter((leg) => leg.result === "Loss");
  if (losers.length > 0) {
    const lock = losers.reduce((worst, leg) =>
      (americanToDecimal(leg.odds) ?? Infinity) < (americanToDecimal(worst.odds) ?? Infinity)
        ? leg
        : worst,
    );
    if ((lock.odds ?? 0) < 0) {
      awards.push({
        kind: "lock",
        emoji: "🐐",
        title: "Lock of the week",
        name: lock.memberName,
        detail: `${lock.leg} at ${lock.odds} — and it lost`,
      });
    }
  }

  // One person, one broken ticket.
  if (settlement.status === "lost" && settlement.pendingLegs === 0) {
    const allLosers = counting.filter((leg) => leg.result === "Loss");
    if (allLosers.length === 1) {
      awards.push({
        kind: "killer",
        emoji: "💀",
        title: "Ticket killer",
        name: allLosers[0]!.memberName,
        detail: "Everyone else was in",
      });
    }
  }

  if (settlement.status === "won") {
    awards.push({
      kind: "perfect",
      emoji: "🔥",
      title: "Perfect week",
      name: "",
      detail: `All ${counting.length} legs landed`,
    });
  }

  return awards;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export type BadgeId = "heater" | "cooler" | "longshot" | "villain" | "ironman" | "chalk";

export interface Badge {
  id: BadgeId;
  emoji: string;
  label: string;
  description: string;
}

/** Season-long badges, earned from the record rather than awarded by anyone. */
export function buildBadges(
  tickets: readonly WeekTicket[],
  roster: readonly Member[] = [],
): Map<string, Badge[]> {
  const owner = createOwnerResolver(roster);
  const settled = [...tickets]
    .filter((ticket) => ticket.week.closed && ticket.settlement.settled)
    .sort((a, b) => a.week.season - b.week.season || a.week.week - b.week.week);

  interface Tally {
    history: ("W" | "L")[];
    bestWinOdds: number | null;
    soloBusts: number;
    weeksEntered: Set<string>;
    decimals: number[];
  }

  const tallies = new Map<string, Tally>();
  const ensure = (key: string) => {
    let tally = tallies.get(key);
    if (!tally) {
      tally = { history: [], bestWinOdds: null, soloBusts: 0, weeksEntered: new Set(), decimals: [] };
      tallies.set(key, tally);
    }
    return tally;
  };
  for (const member of roster) ensure(member.uid);

  for (const { week, legs, settlement } of settled) {
    for (const leg of legs) {
      const tally = ensure(owner.keyOf(leg));
      tally.weeksEntered.add(week.id);

      const decimal = americanToDecimal(leg.odds);
      if (decimal !== null) tally.decimals.push(decimal);

      if (leg.result === "Win") {
        tally.history.push("W");
        if (leg.odds !== null && (tally.bestWinOdds === null || leg.odds > tally.bestWinOdds)) {
          tally.bestWinOdds = leg.odds;
        }
      } else if (leg.result === "Loss") {
        tally.history.push("L");
      }
    }

    if (settlement.status === "lost" && settlement.pendingLegs === 0) {
      const losers = legs.filter((leg) => !isVoidingResult(leg.result) && leg.result === "Loss");
      if (losers.length === 1) ensure(owner.keyOf(losers[0]!)).soloBusts += 1;
    }
  }

  const longestRun = (history: ("W" | "L")[], target: "W" | "L") => {
    let best = 0;
    let run = 0;
    for (const item of history) {
      run = item === target ? run + 1 : 0;
      if (run > best) best = run;
    }
    return best;
  };

  const badges = new Map<string, Badge[]>();

  for (const [key, tally] of tallies) {
    const earned: Badge[] = [];
    const wins = longestRun(tally.history, "W");
    const losses = longestRun(tally.history, "L");

    if (wins >= 3) {
      earned.push({
        id: "heater",
        emoji: "🔥",
        label: "Heater",
        description: `${wins} winning legs in a row`,
      });
    }
    if (losses >= 5) {
      earned.push({
        id: "cooler",
        emoji: "🧊",
        label: "Cooler",
        description: `${losses} losing legs in a row`,
      });
    }
    if (tally.bestWinOdds !== null && tally.bestWinOdds >= SCORING.longshotOdds) {
      earned.push({
        id: "longshot",
        emoji: "🎰",
        label: "Longshot",
        description: `Landed one at +${tally.bestWinOdds}`,
      });
    }
    if (tally.soloBusts >= 3) {
      earned.push({
        id: "villain",
        emoji: "😈",
        label: "Villain",
        description: `Broke ${tally.soloBusts} tickets single-handedly`,
      });
    }
    if (settled.length >= 4 && tally.weeksEntered.size === settled.length) {
      earned.push({
        id: "ironman",
        emoji: "🛡",
        label: "Ironman",
        description: "Never missed a week",
      });
    }
    if (tally.decimals.length >= 4) {
      const mean = tally.decimals.reduce((sum, d) => sum + d, 0) / tally.decimals.length;
      // Mean decimal below 1.5 is roughly -200 on average.
      if (mean < 1.5) {
        earned.push({
          id: "chalk",
          emoji: "🥱",
          label: "Chalk",
          description: "Takes the short price nearly every week",
        });
      }
    }

    badges.set(key, earned);
  }

  return badges;
}

// ---------------------------------------------------------------------------
// Survivor
// ---------------------------------------------------------------------------

export interface SurvivorEntrant {
  key: string;
  name: string;
  alive: boolean;
  /** The week that knocked them out. */
  eliminatedWeek: { season: number; week: number } | null;
  eliminatedBy: string;
  /** Weeks survived before going out, or so far if still alive. */
  survived: number;
}

export interface SurvivorState {
  entrants: SurvivorEntrant[];
  alive: number;
  /** Set once one entrant is left standing and everyone else is out. */
  champion: SurvivorEntrant | null;
  /**
   * Who lasted longest once everybody is out. Over a full season everyone
   * eventually loses a leg, so without this the board ends on "nobody left"
   * and nobody wins — which is not how a survivor pool settles.
   */
  furthest: SurvivorEntrant[];
}

/**
 * Last one standing.
 *
 * A losing leg knocks you out; a push or void does not, and neither does
 * missing a week — this league's attendance is patchy and eliminating people
 * for being busy would empty the board by October.
 */
export function survivorState(
  tickets: readonly WeekTicket[],
  roster: readonly Member[] = [],
): SurvivorState {
  const owner = createOwnerResolver(roster);
  const settled = [...tickets]
    .filter((ticket) => ticket.week.closed && ticket.settlement.settled)
    .sort((a, b) => a.week.season - b.week.season || a.week.week - b.week.week);

  const entrants = new Map<string, SurvivorEntrant>();
  const ensure = (key: string, name: string) => {
    let entrant = entrants.get(key);
    if (!entrant) {
      entrant = {
        key,
        name: owner.nameOf(key, name),
        alive: true,
        eliminatedWeek: null,
        eliminatedBy: "",
        survived: 0,
      };
      entrants.set(key, entrant);
    }
    return entrant;
  };
  for (const member of roster) ensure(member.uid, member.displayName);

  for (const { week, legs } of settled) {
    for (const leg of legs) {
      const entrant = ensure(owner.keyOf(leg), leg.memberName);
      if (!entrant.alive) continue;

      if (leg.result === "Loss") {
        entrant.alive = false;
        entrant.eliminatedWeek = { season: week.season, week: week.week };
        entrant.eliminatedBy = leg.leg;
      } else {
        entrant.survived += 1;
      }
    }
  }

  const list = [...entrants.values()].sort(
    (a, b) =>
      Number(b.alive) - Number(a.alive) || b.survived - a.survived || a.name.localeCompare(b.name),
  );
  const alive = list.filter((entrant) => entrant.alive);

  // Only people who actually played can win it.
  const played = list.filter((entrant) => entrant.survived > 0 || !entrant.alive);
  const best = played.reduce((max, entrant) => Math.max(max, entrant.survived), 0);
  const furthest =
    alive.length === 0 && best > 0 ? played.filter((entrant) => entrant.survived === best) : [];

  return {
    entrants: list,
    alive: alive.length,
    champion:
      alive.length === 1 && list.length > 1
        ? alive[0]!
        : furthest.length === 1
          ? furthest[0]!
          : null,
    furthest,
  };
}
