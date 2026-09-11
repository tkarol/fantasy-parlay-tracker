import { americanToDecimal, impliedProbability, round2 } from "./odds";
import { combineDecimal, settleWeek, type ParlaySettlement } from "./parlay";
import { isVoidingResult, type Leg, type Member, type Week } from "../types/models";

/**
 * Season aggregation.
 *
 * Two different questions get two different answers here, because conflating
 * them is what made the original numbers misleading:
 *
 *   1. "What did the group actually win or lose?" — `SeasonSummary`. There is
 *      one shared ticket per week and one stake per week. This is real money.
 *
 *   2. "How good are this member's picks?" — `MemberStats`. Hit rate, streaks
 *      and a clearly-labelled *hypothetical* solo P&L (`soloProfit`), which is
 *      what they'd have made betting their legs individually. That number is
 *      not group money and is never summed into the season profit.
 */

export interface WeekTicket {
  week: Week;
  legs: Leg[];
  settlement: ParlaySettlement;
}

export interface Streak {
  type: "W" | "L" | null;
  length: number;
}

const NO_STREAK: Streak = { type: null, length: 0 };

/** Identity for grouping. Legacy admin-entered legs have no uid — fall back to name. */
export function legOwnerKey(leg: Leg): string {
  if (leg.uid) return leg.uid;
  const name = leg.memberName.trim().toLowerCase();
  return name ? `name:${name}` : `leg:${leg.id}`;
}

export function buildTickets(
  weeks: readonly Week[],
  legsByWeekId: Readonly<Record<string, Leg[]>>,
): WeekTicket[] {
  return weeks.map((week) => {
    const legs = legsByWeekId[week.id] ?? [];
    return { week, legs, settlement: settleWeek(week, legs) };
  });
}

/** Chronological order within a season. */
export function sortWeeks<T extends { season: number; week: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.season - b.season || a.week - b.week);
}

// ---------------------------------------------------------------------------
// Group truth
// ---------------------------------------------------------------------------

export interface SeasonSummary {
  weeksTotal: number;
  weeksSettled: number;
  ticketsWon: number;
  ticketsLost: number;
  ticketsPushed: number;
  /** Stake on decided tickets. Pushes are excluded — the stake came back. */
  totalStaked: number;
  totalReturned: number;
  profit: number;
  roi: number | null;
  hitRate: number | null;
  bestWeek: WeekTicket | null;
  worstWeek: WeekTicket | null;
  currentStreak: Streak;
  longestWinStreak: number;
  longestLossStreak: number;
  /** Cumulative profit after each settled week, for charting. */
  profitCurve: { weekId: string; week: number; season: number; cumulative: number }[];
}

export function summarizeSeason(tickets: readonly WeekTicket[]): SeasonSummary {
  const ordered = [...tickets].sort(
    (a, b) => a.week.season - b.week.season || a.week.week - b.week.week,
  );
  const settled = ordered.filter((t) => t.settlement.settled);

  let ticketsWon = 0;
  let ticketsLost = 0;
  let ticketsPushed = 0;
  let totalStaked = 0;
  let totalReturned = 0;
  let profit = 0;

  let best: WeekTicket | null = null;
  let worst: WeekTicket | null = null;

  const outcomes: ("W" | "L")[] = [];
  const profitCurve: SeasonSummary["profitCurve"] = [];

  for (const ticket of settled) {
    const { status, profit: weekProfit, stake } = ticket.settlement;

    if (status === "push") {
      ticketsPushed += 1;
    } else if (status === "won") {
      ticketsWon += 1;
      outcomes.push("W");
      totalStaked += stake;
      totalReturned += stake + (weekProfit ?? 0);
    } else if (status === "lost") {
      ticketsLost += 1;
      outcomes.push("L");
      totalStaked += stake;
    }

    if (weekProfit !== null) {
      profit += weekProfit;
      if (best === null || weekProfit > (best.settlement.profit ?? 0)) best = ticket;
      if (worst === null || weekProfit < (worst.settlement.profit ?? 0)) worst = ticket;
    }

    profitCurve.push({
      weekId: ticket.week.id,
      week: ticket.week.week,
      season: ticket.week.season,
      cumulative: round2(profit),
    });
  }

  const decided = ticketsWon + ticketsLost;

  return {
    weeksTotal: ordered.length,
    weeksSettled: settled.length,
    ticketsWon,
    ticketsLost,
    ticketsPushed,
    totalStaked: round2(totalStaked),
    totalReturned: round2(totalReturned),
    profit: round2(profit),
    roi: totalStaked > 0 ? profit / totalStaked : null,
    hitRate: decided > 0 ? ticketsWon / decided : null,
    bestWeek: best,
    worstWeek: worst,
    currentStreak: currentStreak(outcomes),
    longestWinStreak: longestRun(outcomes, "W"),
    longestLossStreak: longestRun(outcomes, "L"),
    profitCurve,
  };
}

// ---------------------------------------------------------------------------
// Per-member
// ---------------------------------------------------------------------------

export interface MemberStats {
  key: string;
  uid: string;
  name: string;
  legs: number;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  /** Wins + losses. Pushes and pending never count against a hit rate. */
  decided: number;
  hitRate: number | null;
  streak: Streak;
  longestWinStreak: number;
  /** Mean decimal price of their priced legs — how much chalk they take. */
  avgDecimal: number | null;
  avgAmerican: number | null;
  /** Wins the market implied they'd get, summed over decided priced legs. */
  expectedWins: number | null;
  /** Actual wins minus expected. Positive means beating the price. */
  winsAboveExpected: number | null;
  /** Hypothetical: each leg as its own bet at the week's stake. Not group money. */
  soloProfit: number;
  soloRoi: number | null;
  /** Winning legs that rode on a ticket that cashed. */
  carries: number;
  /** Tickets this member alone killed. */
  soloBusts: number;
  /** Profit the group forfeited to those solo busts. */
  bustCost: number;
  /** Tickets they lost alongside at least one other loser. */
  sharedBusts: number;
  /** Settled weeks where they submitted nothing. */
  missedWeeks: number;
}

export interface BustEvent {
  weekId: string;
  season: number;
  week: number;
  /** The member who alone broke an otherwise-winning ticket. */
  key: string;
  name: string;
  leg: string;
  odds: number | null;
  /** What the ticket would have profited had this leg landed. */
  cost: number | null;
}

export interface LeaderboardResult {
  members: MemberStats[];
  busts: BustEvent[];
}

/**
 * Build per-member stats across the given tickets.
 * `roster` supplies display names and catches members who never submitted.
 */
export function buildLeaderboard(
  tickets: readonly WeekTicket[],
  roster: readonly Member[] = [],
): LeaderboardResult {
  const ordered = [...tickets].sort(
    (a, b) => a.week.season - b.week.season || a.week.week - b.week.week,
  );

  const names = new Map<string, string>();
  const uids = new Map<string, string>();
  for (const member of roster) {
    names.set(member.uid, member.displayName || member.email || member.uid);
    uids.set(member.uid, member.uid);
  }

  const acc = new Map<
    string,
    {
      legs: number;
      wins: number;
      losses: number;
      pushes: number;
      pending: number;
      decimals: number[];
      expected: number;
      expectedCount: number;
      soloProfit: number;
      soloStaked: number;
      carries: number;
      soloBusts: number;
      bustCost: number;
      sharedBusts: number;
      history: ("W" | "L")[];
      weeksEntered: Set<string>;
    }
  >();

  const ensure = (key: string) => {
    let row = acc.get(key);
    if (!row) {
      row = {
        legs: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        pending: 0,
        decimals: [],
        expected: 0,
        expectedCount: 0,
        soloProfit: 0,
        soloStaked: 0,
        carries: 0,
        soloBusts: 0,
        bustCost: 0,
        sharedBusts: 0,
        history: [],
        weeksEntered: new Set<string>(),
      };
      acc.set(key, row);
    }
    return row;
  };

  // Seed the roster so members with zero legs still appear.
  for (const member of roster) ensure(member.uid);

  const busts: BustEvent[] = [];
  const settledWeekIds: string[] = [];

  for (const ticket of ordered) {
    const { week, legs, settlement } = ticket;
    if (settlement.settled) settledWeekIds.push(week.id);

    for (const leg of legs) {
      const key = legOwnerKey(leg);
      const row = ensure(key);
      if (!names.has(key)) names.set(key, leg.memberName || key);
      if (leg.uid && !uids.has(key)) uids.set(key, leg.uid);

      row.legs += 1;
      row.weeksEntered.add(week.id);

      const dec = americanToDecimal(leg.odds);
      if (dec !== null) row.decimals.push(dec);

      if (leg.result === "Win") {
        row.wins += 1;
        row.history.push("W");
        row.soloStaked += week.stake;
        if (dec !== null) row.soloProfit += week.stake * (dec - 1);
        if (settlement.status === "won") row.carries += 1;
      } else if (leg.result === "Loss") {
        row.losses += 1;
        row.history.push("L");
        row.soloStaked += week.stake;
        row.soloProfit -= week.stake;
      } else if (isVoidingResult(leg.result)) {
        row.pushes += 1;
      } else {
        row.pending += 1;
      }

      if (leg.result === "Win" || leg.result === "Loss") {
        const p = impliedProbability(leg.odds);
        if (p !== null) {
          row.expected += p;
          row.expectedCount += 1;
        }
      }
    }

    // Blame attribution, only on fully graded losing tickets.
    if (settlement.status === "lost" && settlement.pendingLegs === 0) {
      const counting = legs.filter((leg) => !isVoidingResult(leg.result));
      const losers = counting.filter((leg) => leg.result === "Loss");

      if (losers.length === 1) {
        const loser = losers[0]!;
        const key = legOwnerKey(loser);
        const row = ensure(key);
        row.soloBusts += 1;

        // What the ticket would have paid had this one leg landed.
        const fullDecimal = combineDecimal(counting.map((leg) => leg.odds));
        const cost = fullDecimal === null ? null : round2(week.stake * (fullDecimal - 1));
        if (cost !== null) row.bustCost += cost;

        busts.push({
          weekId: week.id,
          season: week.season,
          week: week.week,
          key,
          name: names.get(key) ?? loser.memberName,
          leg: loser.leg,
          odds: loser.odds,
          cost,
        });
      } else if (losers.length > 1) {
        for (const loser of losers) ensure(legOwnerKey(loser)).sharedBusts += 1;
      }
    }
  }

  const members: MemberStats[] = [...acc.entries()].map(([key, row]) => {
    const decided = row.wins + row.losses;
    const avgDecimal =
      row.decimals.length > 0
        ? row.decimals.reduce((sum, d) => sum + d, 0) / row.decimals.length
        : null;

    return {
      key,
      uid: uids.get(key) ?? "",
      name: names.get(key) ?? key,
      legs: row.legs,
      wins: row.wins,
      losses: row.losses,
      pushes: row.pushes,
      pending: row.pending,
      decided,
      hitRate: decided > 0 ? row.wins / decided : null,
      streak: currentStreak(row.history),
      longestWinStreak: longestRun(row.history, "W"),
      avgDecimal,
      avgAmerican: avgDecimal === null ? null : decimalFromMeanToAmerican(avgDecimal),
      expectedWins: row.expectedCount > 0 ? round2(row.expected) : null,
      winsAboveExpected: row.expectedCount > 0 ? round2(row.wins - row.expected) : null,
      soloProfit: round2(row.soloProfit),
      soloRoi: row.soloStaked > 0 ? row.soloProfit / row.soloStaked : null,
      carries: row.carries,
      soloBusts: row.soloBusts,
      bustCost: round2(row.bustCost),
      sharedBusts: row.sharedBusts,
      missedWeeks: settledWeekIds.filter((id) => !row.weeksEntered.has(id)).length,
    };
  });

  return { members: sortLeaderboard(members), busts };
}

function decimalFromMeanToAmerican(dec: number): number | null {
  if (dec <= 1) return null;
  const profit = dec - 1;
  return profit >= 1 ? Math.round(profit * 100) : Math.round(-100 / profit);
}

export type LeaderboardSortKey =
  | "name"
  | "hitRate"
  | "legs"
  | "wins"
  | "losses"
  | "streak"
  | "soloProfit"
  | "carries"
  | "soloBusts"
  | "bustCost"
  | "winsAboveExpected";

export function streakScore(streak: Streak): number {
  if (!streak.type) return 0;
  return streak.type === "W" ? streak.length : -streak.length;
}

/** Default order: best hit rate, then hotter streak, then more legs, then name. */
export function sortLeaderboard(
  members: readonly MemberStats[],
  key: LeaderboardSortKey = "hitRate",
  direction: "asc" | "desc" = "desc",
): MemberStats[] {
  const dir = direction === "asc" ? 1 : -1;

  const value = (m: MemberStats): number | string => {
    switch (key) {
      case "name":
        return m.name.toLowerCase();
      case "hitRate":
        return m.hitRate ?? -1;
      case "legs":
        return m.legs;
      case "wins":
        return m.wins;
      case "losses":
        return m.losses;
      case "streak":
        return streakScore(m.streak);
      case "soloProfit":
        return m.soloProfit;
      case "carries":
        return m.carries;
      case "soloBusts":
        return m.soloBusts;
      case "bustCost":
        return m.bustCost;
      case "winsAboveExpected":
        return m.winsAboveExpected ?? -999;
    }
  };

  return [...members].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (typeof av === "string" || typeof bv === "string") {
      return String(av).localeCompare(String(bv)) * dir;
    }
    if (av !== bv) return (av - bv) * dir;
    // Stable, meaningful tiebreakers.
    if (a.legs !== b.legs) return b.legs - a.legs;
    return a.name.localeCompare(b.name);
  });
}

// ---------------------------------------------------------------------------
// Head to head
// ---------------------------------------------------------------------------

export interface HeadToHead {
  weeksTogether: number;
  aWins: number;
  bWins: number;
  bothWon: number;
  bothLost: number;
}

/** Compare two members across weeks where both submitted a graded leg. */
export function headToHead(
  tickets: readonly WeekTicket[],
  keyA: string,
  keyB: string,
): HeadToHead {
  let weeksTogether = 0;
  let aWins = 0;
  let bWins = 0;
  let bothWon = 0;
  let bothLost = 0;

  for (const { legs } of tickets) {
    const a = legs.find((leg) => legOwnerKey(leg) === keyA);
    const b = legs.find((leg) => legOwnerKey(leg) === keyB);
    if (!a || !b) continue;

    const aDecided = a.result === "Win" || a.result === "Loss";
    const bDecided = b.result === "Win" || b.result === "Loss";
    if (!aDecided || !bDecided) continue;

    weeksTogether += 1;
    if (a.result === "Win" && b.result === "Win") bothWon += 1;
    else if (a.result === "Loss" && b.result === "Loss") bothLost += 1;
    else if (a.result === "Win") aWins += 1;
    else bWins += 1;
  }

  return { weeksTogether, aWins, bWins, bothWon, bothLost };
}

// ---------------------------------------------------------------------------
// Streak helpers
// ---------------------------------------------------------------------------

export function currentStreak(history: readonly ("W" | "L")[]): Streak {
  if (history.length === 0) return NO_STREAK;
  const last = history[history.length - 1]!;
  let length = 0;
  for (let i = history.length - 1; i >= 0 && history[i] === last; i -= 1) length += 1;
  return { type: last, length };
}

export function longestRun(history: readonly ("W" | "L")[], target: "W" | "L"): number {
  let best = 0;
  let run = 0;
  for (const item of history) {
    run = item === target ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

export function formatStreak(streak: Streak): string {
  if (!streak.type || streak.length === 0) return "—";
  return `${streak.type}${streak.length}`;
}
