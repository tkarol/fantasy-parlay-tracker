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

        // Never seen before: start the clock now rather than opening with a
        // season's worth of history the moment someone joins.
        if (lastSeen === null) {
          await markActivitySeen(leagueId, uid);
          return;
        }

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
        setItems(
          buildDigest({ weeks: scope, commentsByWeek, reactionsByWeek, myUid: uid, since: lastSeen }),
        );
      } catch {
        // A digest is a nicety; a league that cannot read it still works.
        if (!cancelled) setItems([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [leagueId, uid, scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback(() => {
    setItems([]);
    if (leagueId && uid) void markActivitySeen(leagueId, uid);
  }, [leagueId, uid]);

  return { items, dismiss };
}
