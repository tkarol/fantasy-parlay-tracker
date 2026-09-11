import { useEffect, useState } from "react";
import { collection, onSnapshot, type FirestoreError } from "firebase/firestore";
import { db } from "../firebase";
import { joinRequestConverter, memberConverter } from "../lib/converters";
import type { JoinRequest, Member } from "../types/models";

export function useMembers(leagueId: string | undefined) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!leagueId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    return onSnapshot(
      collection(db, "leagues", leagueId, "members").withConverter(memberConverter),
      (snap) => {
        const rows = snap.docs.map((d) => d.data());
        // Admins first, then alphabetical.
        rows.sort(
          (a, b) =>
            Number(b.role === "admin") - Number(a.role === "admin") ||
            a.displayName.localeCompare(b.displayName),
        );
        setMembers(rows);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setMembers([]);
        setLoading(false);
      },
    );
  }, [leagueId]);

  return { members, loading, error };
}

/** Pending join requests. Only readable by admins, so `enabled` gates it. */
export function useJoinRequests(leagueId: string | undefined, enabled: boolean) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!leagueId || !enabled) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    return onSnapshot(
      collection(db, "leagues", leagueId, "joinRequests").withConverter(joinRequestConverter),
      (snap) => {
        setRequests(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      () => {
        setRequests([]);
        setLoading(false);
      },
    );
  }, [leagueId, enabled]);

  return { requests, loading };
}
