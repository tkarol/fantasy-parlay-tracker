import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";

export default function useUserLeagues(uid) {
  const [owned, setOwned] = useState([]);
  const [memberOf, setMemberOf] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setOwned([]); setMemberOf([]); setLoading(false);
      return;
    }

    const ownedQ = query(collection(db, "leagues"), where("ownerUid", "==", uid));
    const unsubOwned = onSnapshot(
      ownedQ,
      (snap) => setOwned(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setOwned([])
    );

    // leagues where I'm a member (via array-contains)
    const memberQ = query(collection(db, "leagues"), where("memberUids", "array-contains", uid));
    const unsubMember = onSnapshot(
      memberQ,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // exclude leagues I own to avoid dupes in UI
        setMemberOf(items.filter((l) => l.ownerUid !== uid));
        setLoading(false);
      },
      () => { setMemberOf([]); setLoading(false); }
    );

    return () => {
      unsubOwned && unsubOwned();
      unsubMember && unsubMember();
    };
  }, [uid]);

  return { owned, memberOf, loading };
}
