import { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { leagueDoc, memberDoc } from "../lib/firestorePaths";

export default function useLeague(leagueId, uid) {
  const [league, setLeague] = useState(null);
  const [myMember, setMyMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) return;
    const unsub1 = onSnapshot(leagueDoc(leagueId), (snap) => {
      setLeague(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    });
    let unsub2 = () => {};
    if (uid) {
      unsub2 = onSnapshot(memberDoc(leagueId, uid), (snap) => {
        setMyMember(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      });
    } else {
      setMyMember(null);
    }
    return () => {
      unsub1 && unsub1();
      unsub2 && unsub2();
    };
  }, [leagueId, uid]);

  return { league, myMember, loading };
}
