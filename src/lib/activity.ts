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
  at: Date;
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
}

/**
 * Newest first, and only what this member has not already been shown.
 *
 * Your own comments and reactions are filtered out — being told you reacted to
 * yourself is noise — as is anything with no timestamp, which is how reactions
 * written before they were stamped stay quietly in the past instead of
 * resurfacing as brand new.
 */
export function buildDigest({
  weeks,
  commentsByWeek,
  reactionsByWeek,
  myUid,
  since,
}: DigestInput): ActivityItem[] {
  if (!myUid) return [];
  const items: ActivityItem[] = [];

  for (const week of weeks) {
    const isNews = (legId: string, authorUid: string, at: Date | null): at is Date =>
      legId === myUid && authorUid !== myUid && at !== null && at.getTime() > since.getTime();

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

  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
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
