import { useCallback, useEffect, useRef, useState } from "react";
import { getDocs, query, where } from "firebase/firestore";
import { commentsCol, reactionsCol } from "../lib/firestorePaths";
import { commentConverter } from "../lib/converters";
import { getLastSeenActivity, markActivitySeen } from "../lib/api";
import { toDate } from "../lib/dates";
import { buildDigest, type ActivityItem, type WeekScope } from "../lib/activity";
import { isReactionEmoji, type Comment, type Reaction } from "../types/models";

/** How far back to look. Nobody is still arguing about week 1 in December. */
const WEEKS_SCANNED = 2;

/**
 * What landed on your leg since you last looked.
 *
 * Read once on mount rather than subscribed: this is a "while you were away"
 * summary, so it wants the state at arrival, and a live listener per week per
 * collection would be four more open streams for something nobody watches
 * change. Each query is narrowed to `legId == me`, so it reads your own
 * activity rather than the whole ticket's.
 */
export function useActivityDigest(
  leagueId: string | undefined,
  weeks: readonly WeekScope[],
  uid: string | undefined,
) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [firstRun, setFirstRun] = useState(false);
  // The scan runs once per sign-in; `weeks` arrives empty and then fills, and
  // re-running on every change would re-show a digest already dismissed.
  const ranFor = useRef<string | null>(null);

  const scope = weeks.slice(-WEEKS_SCANNED);
  const scopeKey = scope.map((week) => week.id).join(",");

  useEffect(() => {
    if (!leagueId || !uid || scope.length === 0) return;
    const key = `${leagueId}:${uid}:${scopeKey}`;
    if (ranFor.current === key) return;
    ranFor.current = key;

    let cancelled = false;

    void (async () => {
      try {
        const lastSeen = await getLastSeenActivity(leagueId, uid);

        /*
         * No mark yet — which is everyone the first time they open the app
         * after this ships. Show the backlog rather than starting the clock
         * silently, or the feature would launch by telling the whole league
         * nothing.
         *
         * Safe to reach back: the window is still only the last couple of
         * weeks, and anything written before reactions carried a timestamp is
         * dropped for having none, so this surfaces real activity rather than
         * replaying the archive.
         */
        const since = lastSeen ?? new Date(0);
        if (!cancelled) setFirstRun(lastSeen === null);

        const commentsByWeek: Record<string, Comment[]> = {};
        const reactionsByWeek: Record<string, Reaction[]> = {};

        await Promise.all(
          scope.map(async (week) => {
            const [commentSnap, reactionSnap] = await Promise.all([
              getDocs(
                query(
                  commentsCol(leagueId, week.id).withConverter(commentConverter),
                  where("legId", "==", uid),
                ),
              ),
              getDocs(query(reactionsCol(leagueId, week.id), where("legId", "==", uid))),
            ]);

            commentsByWeek[week.id] = commentSnap.docs.map((d) => d.data());
            reactionsByWeek[week.id] = reactionSnap.docs.flatMap((d) => {
              const data = d.data();
              if (!isReactionEmoji(data.emoji)) return [];
              return [
                {
                  legId: typeof data.legId === "string" ? data.legId : "",
                  uid: typeof data.uid === "string" ? data.uid : "",
                  name: typeof data.name === "string" ? data.name : "",
                  emoji: data.emoji,
                  createdAt: toDate(data.createdAt),
                } satisfies Reaction,
              ];
            });
          }),
        );

        if (cancelled) return;
        const digest = buildDigest({
          weeks: scope,
          commentsByWeek,
          reactionsByWeek,
          myUid: uid,
          since,
          // A first run is a catch-up, so it counts reactions left before they
          // carried a timestamp. Every one on the league predates this feature,
          // and dropping them is what made the first deploy land silently.
          includeUndated: lastSeen === null,
        });
        setItems(digest);

        // A first run with nothing to report still starts the clock, so the
        // backlog scan does not repeat on every sign-in forever.
        if (lastSeen === null && digest.length === 0) {
          await markActivitySeen(leagueId, uid);
          if (!cancelled) setFirstRun(false);
        }
      } catch {
        // A digest is a nicety; a league that cannot read it still works.
        if (!cancelled) setItems([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [leagueId, uid, scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * The mark is written on dismissal, not on arrival. Someone who closes the
   * tab mid-read gets the same catch-up next time instead of losing it to a
   * page they never looked at.
   */
  const dismiss = useCallback(() => {
    setItems([]);
    setFirstRun(false);
    if (leagueId && uid) void markActivitySeen(leagueId, uid);
  }, [leagueId, uid]);

  return { items, firstRun, dismiss };
}
