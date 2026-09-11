import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, type FirestoreError } from "firebase/firestore";
import { db } from "../firebase";
import { weekConverter } from "../lib/converters";
import type { Week } from "../types/models";

/** All weeks in a league, oldest first. */
export function useWeeks(leagueId: string | undefined) {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!leagueId) {
      setWeeks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    return onSnapshot(
      query(
        collection(db, "leagues", leagueId, "weeks").withConverter(weekConverter),
        orderBy("season"),
        orderBy("week"),
      ),
      (snap) => {
        setWeeks(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setWeeks([]);
        setLoading(false);
      },
    );
  }, [leagueId]);

  const seasons = useMemo(
    () => [...new Set(weeks.map((w) => w.season))].sort((a, b) => b - a),
    [weeks],
  );

  return { weeks, seasons, loading, error };
}

export default useWeeks;
