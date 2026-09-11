import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { joinRequestDoc } from "../lib/firestorePaths";

/** Whether this user already has an access request waiting on an admin. */
export function useMyJoinRequest(leagueId: string | null, uid: string | undefined) {
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId || !uid) {
      setPending(false);
      setLoading(false);
      return;
    }
    setLoading(true);

    return onSnapshot(
      joinRequestDoc(leagueId, uid),
      (snap) => {
        setPending(snap.exists());
        setLoading(false);
      },
      () => {
        setPending(false);
        setLoading(false);
      },
    );
  }, [leagueId, uid]);

  return { pending, loading };
}
