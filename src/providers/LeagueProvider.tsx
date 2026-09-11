import { useMemo, type ReactNode } from "react";
import { useCurrentLeague } from "../hooks/useCurrentLeague";
import { useWeeks } from "../hooks/useWeeks";
import { useMembers } from "../hooks/useMembers";
import { seasonsOf } from "../lib/stats";
import { LeagueContext, type LeagueContextValue } from "./leagueContext";

/**
 * Resolves the league once and shares its weeks and roster with every route,
 * rather than each page opening its own set of Firestore listeners.
 */
export function LeagueProvider({ children }: { children: ReactNode }) {
  const current = useCurrentLeague();
  const leagueId = current.isMember ? (current.leagueId ?? undefined) : undefined;

  const { weeks, loading: weeksLoading, error: weeksError } = useWeeks(leagueId);
  const { members, loading: membersLoading } = useMembers(leagueId);

  const value = useMemo<LeagueContextValue>(
    () => ({
      ...current,
      weeks,
      weeksLoading,
      weeksError,
      members,
      membersLoading,
      seasons: seasonsOf(weeks),
      latestWeek: weeks.length > 0 ? (weeks[weeks.length - 1] ?? null) : null,
    }),
    [current, weeks, weeksLoading, weeksError, members, membersLoading],
  );

  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}
