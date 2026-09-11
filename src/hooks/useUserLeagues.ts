import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { leagueConverter } from "../lib/converters";
import type { League } from "../types/models";

export interface UserLeague extends League {
  relation: "owner" | "member";
}

/**
 * Leagues the signed-in user can open. Two queries are needed because a league
 * the user owns may pre-date the `memberUids` array.
 */
export function useUserLeagues(uid: string | undefined) {
  const [owned, setOwned] = useState<League[]>([]);
  const [joined, setJoined] = useState<League[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(true);
  const [joinedLoading, setJoinedLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid) {
      setOwned([]);
      setJoined([]);
      setOwnedLoading(false);
      setJoinedLoading(false);
      return;
    }

    setOwnedLoading(true);
    setJoinedLoading(true);
    const leagues = collection(db, "leagues").withConverter(leagueConverter);

    const unsubOwned = onSnapshot(
      query(leagues, where("ownerUid", "==", uid)),
      (snap) => {
        setOwned(snap.docs.map((d) => d.data()));
        setOwnedLoading(false);
      },
      (err) => {
        setError(err);
        setOwnedLoading(false);
      },
    );

    const unsubJoined = onSnapshot(
      query(leagues, where("memberUids", "array-contains", uid)),
      (snap) => {
        setJoined(snap.docs.map((d) => d.data()));
        setJoinedLoading(false);
      },
      (err) => {
        setError(err);
        setJoinedLoading(false);
      },
    );

    return () => {
      unsubOwned();
      unsubJoined();
    };
  }, [uid]);

  const byId = new Map<string, UserLeague>();
  for (const league of joined) byId.set(league.id, { ...league, relation: "member" });
  for (const league of owned) byId.set(league.id, { ...league, relation: "owner" });

  const leagues = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));

  return { leagues, loading: ownedLoading || joinedLoading, error };
}

export default useUserLeagues;
