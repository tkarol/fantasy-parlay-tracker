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
