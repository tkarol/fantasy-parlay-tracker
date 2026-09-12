import { americanToDecimal, decimalToAmerican, round2 } from "./odds";
import { isVoidingResult, type Leg, type Week } from "../types/models";

/**
 * Parlay settlement.
 *
 * The rule that matters and that the original build got wrong: a **Push or
 * Void removes its leg from the ticket entirely** and the remaining legs are
 * re-priced. It is not a neutral leg that still multiplies in at its original
 * odds, and it does not make the whole ticket a push unless every leg voids.
 */

export type TicketStatus =
  /** No legs submitted yet. */
  | "empty"
  /** Still collecting legs / prices before the deadline. */
  | "building"
  /** Fully priced, legs graded in part, no loss yet. */
  | "live"
  | "won"
  | "lost"
  /** Every leg pushed or voided — stake returned. */
  | "push";

export interface ParlaySettlement {
  status: TicketStatus;
  /** Legs that still affect the price (everything except pushes and voids). */
  countingLegs: number;
  voidedLegs: number;
  pendingLegs: number;
  winningLegs: number;
  losingLegs: number;
  /** Product of the counting legs' decimal odds; null if any is unpriced. */
  combinedDecimal: number | null;
  combinedAmerican: number | null;
  /** True when every counting leg has usable odds. */
  allPriced: boolean;
  stake: number;
  /** Stake + profit if the ticket comes in. Null when not fully priced. */
  toReturn: number | null;
  potentialProfit: number | null;
  /**
   * Realised profit. Null while the ticket is unsettled, or when it won but
   * cannot be priced. Negative stake for a loss; 0 for an all-void push.
   */
  profit: number | null;
  /** True once the outcome can no longer change. */
  settled: boolean;
}

export interface SettleOptions {
  /**
   * Actual total returned by the book, when recorded. Overrides the computed
   * price so boosts, promos and manual corrections stay truthful.
   */
  payoutOverride?: number | null;
}

/** Multiply decimal odds across legs. Null if any leg is unpriced. */
export function combineDecimal(oddsList: readonly (number | null)[]): number | null {
  if (oddsList.length === 0) return null;
  let product = 1;
  for (const odds of oddsList) {
    const dec = americanToDecimal(odds);
    if (dec === null) return null;
    product *= dec;
  }
  return product;
}

export function settleParlay(
  legs: readonly Leg[],
  stake: number,
  options: SettleOptions = {},
): ParlaySettlement {
  const counting = legs.filter((leg) => !isVoidingResult(leg.result));
  const voidedLegs = legs.length - counting.length;
  const pendingLegs = counting.filter((leg) => leg.result === "Pending").length;
  const winningLegs = counting.filter((leg) => leg.result === "Win").length;
  const losingLegs = counting.filter((leg) => leg.result === "Loss").length;

  const combinedDecimal = combineDecimal(counting.map((leg) => leg.odds));
  const allPriced = combinedDecimal !== null;
  const combinedAmerican = combinedDecimal === null ? null : decimalToAmerican(combinedDecimal);

  const potentialProfit =
    combinedDecimal === null ? null : round2(stake * (combinedDecimal - 1));
  const toReturn = combinedDecimal === null ? null : round2(stake * combinedDecimal);

  const base = {
    countingLegs: counting.length,
    voidedLegs,
    pendingLegs,
    winningLegs,
    losingLegs,
    combinedDecimal,
    combinedAmerican,
    allPriced,
    stake,
    toReturn,
    potentialProfit,
  };

  // A recorded payout is the source of truth for a winning ticket.
  const override = options.payoutOverride;
  const hasOverride = typeof override === "number" && Number.isFinite(override);

  if (legs.length === 0) {
    return { ...base, status: "empty", profit: null, settled: false };
  }

  // One loss kills the ticket, regardless of what else is outstanding.
  if (losingLegs > 0) {
    return { ...base, status: "lost", profit: round2(-stake), settled: true };
  }

  // Every leg pushed or voided: stake back, no action.
  if (counting.length === 0) {
    return { ...base, status: "push", profit: 0, settled: true };
  }

  if (pendingLegs > 0) {
    return {
      ...base,
      status: allPriced ? "live" : "building",
      profit: null,
      settled: false,
    };
  }

  // All counting legs won.
  const profit = hasOverride
    ? round2(override - stake)
    : combinedDecimal === null
      ? null
      : round2(stake * (combinedDecimal - 1));

  return { ...base, status: "won", profit, settled: true };
}

/** Settle a week using its own stake and recorded payout. */
export function settleWeek(week: Week, legs: readonly Leg[]): ParlaySettlement {
  return settleParlay(legs, week.stake, { payoutOverride: week.payoutOverride });
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  empty: "No legs yet",
  building: "Building",
  live: "Live",
  won: "Won",
  lost: "Lost",
  push: "Push",
};

export function ticketStatusLabel(status: TicketStatus): string {
  return STATUS_LABELS[status];
}

export type StatusTone = "neutral" | "good" | "bad" | "warn" | "info";

export function ticketStatusTone(status: TicketStatus): StatusTone {
  switch (status) {
    case "won":
      return "good";
    case "lost":
      return "bad";
    case "push":
      return "warn";
    case "live":
      return "info";
    default:
      return "neutral";
  }
}

/**
 * Whether a week still accepts member submissions.
 * `now` is passed in so the caller controls the clock (and tests can too).
 */
export function isWeekOpen(week: Week | null | undefined, now: Date): boolean {
  if (!week) return false;
  if (week.closed) return false;
  if (week.deadline && now.getTime() >= week.deadline.getTime()) return false;
  return true;
}

export function millisUntilDeadline(week: Week | null | undefined, now: Date): number | null {
  if (!week?.deadline) return null;
  return week.deadline.getTime() - now.getTime();
}

// ---------------------------------------------------------------------------
// How likely is this, really
// ---------------------------------------------------------------------------

export interface TicketOdds {
  /** Break-even probability implied by the combined price, 0..1. */
  probability: number;
  /** The same, as the N in "1 in N". */
  oneIn: number;
}

/**
 * What the market says this ticket's chances are.
 *
 * An eight-leg parlay is a lottery ticket and the price says so plainly, which
 * is worth showing: a league that never wins is easier to enjoy when everyone
 * can see it was never going to.
 */
export function ticketOdds(combinedDecimal: number | null): TicketOdds | null {
  if (combinedDecimal === null || combinedDecimal <= 1) return null;
  const probability = 1 / combinedDecimal;
  return { probability, oneIn: 1 / probability };
}

export interface LongshotComparison {
  /** The leg carrying the longest price — the one costing the most chance. */
  leg: Leg;
  /** The ticket's odds with every other counting leg. */
  without: TicketOdds;
  /** The ticket's odds as it stands. */
  with: TicketOdds;
}

/**
 * The ticket without its longest leg, for the "drop that one and it's 1 in 40"
 * comparison. Null unless there are at least two priced legs to compare.
 */
export function longshotComparison(legs: readonly Leg[]): LongshotComparison | null {
  const counting = legs.filter((leg) => !isVoidingResult(leg.result) && leg.odds !== null);
  if (counting.length < 2) return null;

  const full = combineDecimal(counting.map((leg) => leg.odds));
  if (full === null) return null;

  let longest = counting[0]!;
  for (const leg of counting) {
    const current = americanToDecimal(leg.odds) ?? 0;
    const best = americanToDecimal(longest.odds) ?? 0;
    if (current > best) longest = leg;
  }

  const rest = counting.filter((leg) => leg.id !== longest.id);
  const without = combineDecimal(rest.map((leg) => leg.odds));

  const withOdds = ticketOdds(full);
  const withoutOdds = ticketOdds(without);
  if (!withOdds || !withoutOdds) return null;

  return { leg: longest, with: withOdds, without: withoutOdds };
}

/** `1 in 340`, or `1 in 1.2M` once the numbers stop meaning anything. */
export function formatOneIn(oneIn: number): string {
  if (!Number.isFinite(oneIn) || oneIn <= 1) return "even money";
  if (oneIn >= 1_000_000) return `1 in ${(oneIn / 1_000_000).toFixed(1)}M`;
  if (oneIn >= 10_000) return `1 in ${Math.round(oneIn / 1000)}k`;
  if (oneIn >= 100) return `1 in ${Math.round(oneIn)}`;
  return `1 in ${oneIn.toFixed(1)}`;
}
