import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { commentsCol } from "../lib/firestorePaths";
import { commentConverter } from "../lib/converters";
import type { Comment } from "../types/models";

/**
 * Every comment on a week, grouped by the leg it sits under.
 *
 * One listener for the week rather than one per leg, the same way reactions
 * work — a ticket's legs are read together and change together.
 */
export function useComments(leagueId: string | undefined, weekId: string | undefined) {
  const [byLeg, setByLeg] = useState<Record<string, Comment[]>>({});

  useEffect(() => {
    if (!leagueId || !weekId) {
      setByLeg({});
      return;
    }

    return onSnapshot(
      commentsCol(leagueId, weekId).withConverter(commentConverter),
      (snap) => {
        const next: Record<string, Comment[]> = {};
        for (const docSnap of snap.docs) {
          const comment = docSnap.data();
          if (!comment.legId) continue;
          (next[comment.legId] ??= []).push(comment);
        }
        // Oldest first: a thread reads top to bottom. A comment still waiting
        // on its server timestamp sorts last, which is where it was just typed.
        for (const list of Object.values(next)) {
          list.sort((a, b) => (a.createdAt?.getTime() ?? Infinity) - (b.createdAt?.getTime() ?? Infinity));
        }
        setByLeg(next);
      },
      () => setByLeg({}),
    );
  }, [leagueId, weekId]);

  return byLeg;
}
