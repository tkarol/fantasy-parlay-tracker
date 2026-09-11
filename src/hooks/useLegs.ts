import { useEffect, useState } from "react";
import { collection, onSnapshot, type FirestoreError } from "firebase/firestore";
import { db } from "../firebase";
import { legConverter } from "../lib/converters";
import type { Leg } from "../types/models";

function sortLegs(legs: Leg[]): Leg[] {
  // Submission order, with a name fallback so legacy legs without timestamps
  // still land in a stable order rather than shuffling between renders.
  return [...legs].sort((a, b) => {
    const at = a.createdAt?.getTime() ?? 0;
    const bt = b.createdAt?.getTime() ?? 0;
    if (at !== bt) return at - bt;
    return a.memberName.localeCompare(b.memberName);
  });
}

/** Live legs for one week. */
export function useLegs(leagueId: string | undefined, weekId: string | undefined) {
  const [legs, setLegs] = useState<Leg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!leagueId || !weekId) {
      setLegs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    return onSnapshot(
      collection(db, "leagues", leagueId, "weeks", weekId, "legs").withConverter(legConverter),
      (snap) => {
        setLegs(sortLegs(snap.docs.map((d) => d.data())));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLegs([]);
        setLoading(false);
      },
    );
  }, [leagueId, weekId]);

  return { legs, loading, error };
}

/**
 * Legs for many weeks at once, for season-wide stats.
 *
 * One listener per week. A league season is at most ~20 weeks and these are
 * small documents, so the simplicity is worth more than the batching would be.
 */
export function useLegsByWeek(leagueId: string | undefined, weekIds: readonly string[]) {
  const [legsByWeek, setLegsByWeek] = useState<Record<string, Leg[]>>({});
  const [loading, setLoading] = useState(true);

  // Depend on the joined ids so a re-render with an equal array doesn't tear
  // down and rebuild every listener.
  const key = weekIds.join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (!leagueId || ids.length === 0) {
      setLegsByWeek({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const seen = new Set<string>();

    const unsubs = ids.map((weekId) =>
      onSnapshot(
        collection(db, "leagues", leagueId, "weeks", weekId, "legs").withConverter(legConverter),
        (snap) => {
          setLegsByWeek((current) => ({
            ...current,
            [weekId]: sortLegs(snap.docs.map((d) => d.data())),
          }));
          seen.add(weekId);
          if (seen.size === ids.length) setLoading(false);
        },
        () => {
          setLegsByWeek((current) => ({ ...current, [weekId]: [] }));
          seen.add(weekId);
          if (seen.size === ids.length) setLoading(false);
        },
      ),
    );

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [leagueId, key]);

  return { legsByWeek, loading };
}
