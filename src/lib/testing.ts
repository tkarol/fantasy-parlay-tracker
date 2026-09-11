import type { Leg, LegResult, Week } from "../types/models";

/** Test fixtures. Kept beside the domain so tests stay terse and readable. */

export function makeLeg(overrides: Partial<Leg> & { uid: string }): Leg {
  return {
    id: overrides.id ?? overrides.uid,
    uid: overrides.uid,
    memberName: overrides.memberName ?? overrides.uid,
    leg: overrides.leg ?? "Some team -3.5",
    odds: overrides.odds ?? null,
    result: overrides.result ?? "Pending",
    season: overrides.season ?? 2025,
    week: overrides.week ?? 1,
    createdAt: overrides.createdAt ?? null,
    updatedAt: overrides.updatedAt ?? null,
    gradedByUid: overrides.gradedByUid ?? null,
    gradedAt: overrides.gradedAt ?? null,
  };
}

/** Shorthand: `leg("ann", -110, "Win")`. */
export function leg(uid: string, odds: number | null, result: LegResult = "Pending"): Leg {
  return makeLeg({ uid, odds, result });
}

export function makeWeek(overrides: Partial<Week> = {}): Week {
  const season = overrides.season ?? 2025;
  const week = overrides.week ?? 1;
  return {
    id: overrides.id ?? `${season}-${week}`,
    season,
    week,
    stake: overrides.stake ?? 5,
    deadline: overrides.deadline ?? null,
    closed: overrides.closed ?? false,
    closedAt: overrides.closedAt ?? null,
    createdAt: overrides.createdAt ?? null,
    note: overrides.note ?? "",
    ticketImage: overrides.ticketImage ?? null,
    payoutOverride: overrides.payoutOverride ?? null,
  };
}
