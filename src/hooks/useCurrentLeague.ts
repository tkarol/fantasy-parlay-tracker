import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { useLeague } from "./useLeague";
import { useUserLeagues } from "./useUserLeagues";
import { useMyJoinRequest } from "./useJoinRequest";
import { getAppLeague, setAppLeague, type AppLeague } from "../lib/api";
import type { League, Member } from "../types/models";

/**
 * This app serves one league.
 *
 * Which one is resolved in order:
 *   1. VITE_LEAGUE_ID, for a deployment that wants it pinned explicitly.
 *   2. the `appConfig/league` document, readable by any signed-in user so that
 *      someone who is not a member yet can still find the league to ask to join.
 *   3. the league this user belongs to — which covers an admin's very first
 *      visit, before step 2 has been written.
 *
 * An admin arriving with step 2 unwritten fills it in automatically, so the
 * app needs no build-time configuration at all.
 */

const ENV_LEAGUE_ID = (import.meta.env.VITE_LEAGUE_ID ?? "").trim();

export type LeagueAccessState =
  | "loading"
  | "signed-out"
  /** No league exists yet — an admin needs to create one. */
  | "no-league"
  /** The league is known but this user isn't in it. */
  | "not-member"
  /** They've asked to join and are waiting on an admin. */
  | "pending"
  | "ready";

export interface CurrentLeague {
  state: LeagueAccessState;
  leagueId: string | null;
  league: League | null;
  member: Member | null;
  /** Known even when the user can't read the league document itself. */
  leagueName: string;
  isAdmin: boolean;
  isMember: boolean;
  isOwner: boolean;
}

export function useCurrentLeague(): CurrentLeague {
  const { user, loading: authLoading } = useAuth();

  const [config, setConfig] = useState<AppLeague | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setConfig(null);
      setConfigLoaded(true);
      return;
    }
    let cancelled = false;
    setConfigLoaded(false);

    getAppLeague()
      .then((value) => {
        if (!cancelled) {
          setConfig(value);
          setConfigLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setConfigLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const { leagues, loading: leaguesLoading } = useUserLeagues(user?.uid);

  const leagueId =
    ENV_LEAGUE_ID || config?.leagueId || leagues[0]?.id || null;

  const access = useLeague(leagueId ?? undefined, user?.uid);
  const { pending, loading: requestLoading } = useMyJoinRequest(
    access.isMember ? null : leagueId,
    user?.uid,
  );

  // First admin visit: record which league this deployment serves.
  const leagueName = access.league?.name ?? config?.leagueName ?? "";
  useEffect(() => {
    if (!access.isAdmin || !leagueId || !access.league) return;
    if (config?.leagueId === leagueId) return;

    void setAppLeague(leagueId, access.league.name)
      .then(() => setConfig({ leagueId, leagueName: access.league!.name }))
      .catch(() => {
        // Non-fatal: resolution falls back to the admin's own membership.
      });
  }, [access.isAdmin, access.league, leagueId, config?.leagueId]);

  const state: LeagueAccessState = (() => {
    if (authLoading) return "loading";
    if (!user) return "signed-out";
    if (!configLoaded || leaguesLoading) return "loading";
    if (!leagueId) return "no-league";
    if (access.loading) return "loading";
    if (access.isMember) return "ready";
    if (requestLoading) return "loading";
    return pending ? "pending" : "not-member";
  })();

  return {
    state,
    leagueId,
    league: access.league,
    member: access.member,
    leagueName,
    isAdmin: access.isAdmin,
    isMember: access.isMember,
    isOwner: access.isOwner,
  };
}
