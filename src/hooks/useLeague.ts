import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { leagueConverter, memberConverter } from "../lib/converters";
import type { League, Member, MemberRole } from "../types/models";
import { initialState, type QueryState } from "./firestoreState";

export interface LeagueAccess {
  league: League | null;
  member: Member | null;
  role: MemberRole | null;
  isAdmin: boolean;
  isMember: boolean;
  isOwner: boolean;
  loading: boolean;
  error: QueryState<unknown>["error"];
  /** The league exists but this user cannot see it. */
  forbidden: boolean;
}

export function useLeague(leagueId: string | undefined, uid: string | undefined): LeagueAccess {
  const [leagueState, setLeagueState] = useState<QueryState<League | null>>(() =>
    initialState<League | null>(null),
  );
  const [memberState, setMemberState] = useState<QueryState<Member | null>>(() =>
    initialState<Member | null>(null),
  );

  useEffect(() => {
    if (!leagueId) {
      setLeagueState({ data: null, loading: false, error: null });
      return;
    }
    setLeagueState(initialState<League | null>(null));

    return onSnapshot(
      doc(db, "leagues", leagueId).withConverter(leagueConverter),
      (snap) => setLeagueState({ data: snap.exists() ? snap.data() : null, loading: false, error: null }),
      (error) => setLeagueState({ data: null, loading: false, error }),
    );
  }, [leagueId]);

  useEffect(() => {
    if (!leagueId || !uid) {
      setMemberState({ data: null, loading: false, error: null });
      return;
    }
    setMemberState(initialState<Member | null>(null));

    return onSnapshot(
      doc(db, "leagues", leagueId, "members", uid).withConverter(memberConverter),
      (snap) => setMemberState({ data: snap.exists() ? snap.data() : null, loading: false, error: null }),
      (error) => setMemberState({ data: null, loading: false, error }),
    );
  }, [leagueId, uid]);

  const league = leagueState.data;
  const member = memberState.data;
  const isOwner = !!league && !!uid && league.ownerUid === uid;
  // The owner is always an admin, even if their members document is missing —
  // this is the bootstrap path right after a league is created.
  const role: MemberRole | null = member?.role ?? (isOwner ? "admin" : null);

  return {
    league,
    member,
    role,
    isAdmin: role === "admin",
    isMember: role !== null,
    isOwner,
    loading: leagueState.loading || memberState.loading,
    error: leagueState.error ?? memberState.error,
    forbidden: leagueState.error?.code === "permission-denied",
  };
}

export default useLeague;
