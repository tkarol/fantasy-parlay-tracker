import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { reactionsCol } from "../lib/firestorePaths";
import { isReactionEmoji, type Reaction } from "../types/models";

/**
 * Every reaction on a week, grouped by leg.
 *
 * One listener for the whole week rather than one per leg — a ticket has eight
 * or so legs and they all change together.
 */
export function useReactions(leagueId: string | undefined, weekId: string | undefined) {
  const [byLeg, setByLeg] = useState<Record<string, Reaction[]>>({});

  useEffect(() => {
    if (!leagueId || !weekId) {
      setByLeg({});
      return;
    }

    return onSnapshot(
      reactionsCol(leagueId, weekId),
      (snap) => {
        const next: Record<string, Reaction[]> = {};
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const emoji = data.emoji;
          const legId = typeof data.legId === "string" ? data.legId : "";
          const uid = typeof data.uid === "string" ? data.uid : "";
          if (!legId || !uid || !isReactionEmoji(emoji)) continue;

          const reaction: Reaction = {
            legId,
            uid,
            name: typeof data.name === "string" ? data.name : "",
            emoji,
          };
          (next[legId] ??= []).push(reaction);
        }
        setByLeg(next);
      },
      () => setByLeg({}),
    );
  }, [leagueId, weekId]);

  return byLeg;
}
