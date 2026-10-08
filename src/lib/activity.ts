import type { Comment, Reaction } from "../types/models";

/**
 * What happened on your leg while you were gone.
 *
 * A leg's document id is its author's uid, so "on my leg" is just
 * `legId === myUid` — no join, and the same test works for a comment and a
 * reaction alike.
 */

export interface ActivityItem {
  kind: "comment" | "reaction";
  /** Stable across renders: the source document's id. */
  id: string;
  weekId: string;
  season: number;
  week: number;
  who: string;
  /**
   * Null for a reaction left before reactions were timestamped. Those are
   * older than anything dated, so they sort last and read as "earlier".
   */
  at: Date | null;
  /** Set on a comment. */
  text?: string;
  /** Set on a reaction. */
  emoji?: string;
}

export interface WeekScope {
  id: string;
  season: number;
  week: number;
}

export interface DigestInput {
  /** The weeks being scanned, so an item can say which week it belongs to. */
  weeks: readonly WeekScope[];
  commentsByWeek: Readonly<Record<string, readonly Comment[]>>;
  reactionsByWeek: Readonly<Record<string, readonly Reaction[]>>;
  myUid: string;
  /** Only things after this count as new. */
  since: Date;
  /**
   * Include items with no timestamp.
   *
   * Only ever true on a first run. Every reaction left before they were
   * stamped has no date, so excluding them is right for a "since you last
   * looked" digest and wrong for a "here is what you missed" one — without
   * this, a league that has been reacting for months opens to an empty card.
   */
  includeUndated?: boolean;
}

/**
 * Newest first, and only what this member has not already been shown.
 *
 * Your own comments and reactions are filtered out — being told you reacted to
 * yourself is noise. Undated items are dropped too unless `includeUndated`
 * says otherwise, which keeps pre-timestamp reactions out of a routine digest
 * while still letting a first run show them.
 */
export function buildDigest({
  weeks,
  commentsByWeek,
  reactionsByWeek,
  myUid,
  since,
  includeUndated = false,
}: DigestInput): ActivityItem[] {
  if (!myUid) return [];
  const items: ActivityItem[] = [];

  for (const week of weeks) {
    const isNews = (legId: string, authorUid: string, at: Date | null): boolean => {
      if (legId !== myUid || authorUid === myUid) return false;
      if (at === null) return includeUndated;
      return at.getTime() > since.getTime();
    };

    for (const comment of commentsByWeek[week.id] ?? []) {
      if (!isNews(comment.legId, comment.uid, comment.createdAt)) continue;
      items.push({
        kind: "comment",
        id: comment.id,
        weekId: week.id,
        season: week.season,
        week: week.week,
        who: comment.name,
        at: comment.createdAt,
        text: comment.text,
      });
    }

    for (const reaction of reactionsByWeek[week.id] ?? []) {
      if (!isNews(reaction.legId, reaction.uid, reaction.createdAt)) continue;
      items.push({
        kind: "reaction",
        // Reaction ids encode leg and author, which is unique per week.
        id: `${week.id}:${reaction.legId}:${reaction.uid}`,
        weekId: week.id,
        season: week.season,
        week: week.week,
        who: reaction.name,
        at: reaction.createdAt,
        emoji: reaction.emoji,
      });
    }
  }

  // Newest first, with the undated — which are the oldest there are — last.
  return items.sort((a, b) => {
    if (a.at === null) return b.at === null ? 0 : 1;
    if (b.at === null) return -1;
    return b.at.getTime() - a.at.getTime();
  });
}

/** "3 comments and 2 reactions" — the digest's own headline. */
export function describeDigest(items: readonly ActivityItem[]): string {
  const comments = items.filter((item) => item.kind === "comment").length;
  const reactions = items.length - comments;
  const parts: string[] = [];
  if (comments > 0) parts.push(`${comments} comment${comments === 1 ? "" : "s"}`);
  if (reactions > 0) parts.push(`${reactions} reaction${reactions === 1 ? "" : "s"}`);
  return parts.join(" and ");
}
