import { describe, expect, it } from "vitest";
import { buildDigest, describeDigest, type WeekScope } from "./activity";
import type { Comment, Reaction } from "../types/models";

const ME = "me-uid";
const THEM = "them-uid";
const SINCE = new Date("2026-09-20T12:00:00Z");
const after = (minutes: number) => new Date(SINCE.getTime() + minutes * 60_000);
const before = (minutes: number) => new Date(SINCE.getTime() - minutes * 60_000);

const WEEKS: WeekScope[] = [{ id: "2026-3", season: 2026, week: 3 }];

function comment(over: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    legId: ME,
    uid: THEM,
    name: "Dave Okafor",
    text: "Awful pick",
    createdAt: after(5),
    ...over,
  };
}

function reaction(over: Partial<Reaction> = {}): Reaction {
  return { legId: ME, uid: THEM, name: "Ann Alvarez", emoji: "💀", createdAt: after(9), ...over };
}

function digest(comments: Comment[] = [], reactions: Reaction[] = [], myUid = ME) {
  return buildDigest({
    weeks: WEEKS,
    commentsByWeek: { "2026-3": comments },
    reactionsByWeek: { "2026-3": reactions },
    myUid,
    since: SINCE,
  });
}

describe("buildDigest", () => {
  it("picks up a new comment on my leg", () => {
    const items = digest([comment()]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "comment", who: "Dave Okafor", text: "Awful pick", week: 3 });
  });

  it("picks up a new reaction on my leg", () => {
    const items = digest([], [reaction()]);
    expect(items[0]).toMatchObject({ kind: "reaction", emoji: "💀", who: "Ann Alvarez" });
  });

  it("ignores activity on someone else's leg", () => {
    expect(digest([comment({ legId: THEM })], [reaction({ legId: THEM })])).toEqual([]);
  });

  // Being told you reacted to yourself is noise.
  it("ignores my own comments and reactions", () => {
    expect(digest([comment({ uid: ME })], [reaction({ uid: ME })])).toEqual([]);
  });

  it("ignores anything at or before the last-seen mark", () => {
    expect(digest([comment({ createdAt: before(1) })])).toEqual([]);
    expect(digest([comment({ createdAt: SINCE })])).toEqual([]);
  });

  // Reactions written before they were timestamped must stay in the past
  // rather than resurfacing as brand new.
  it("ignores an item with no timestamp", () => {
    expect(digest([], [reaction({ createdAt: null })])).toEqual([]);
  });

  it("returns newest first across both kinds", () => {
    const items = digest(
      [comment({ id: "old", createdAt: after(1) }), comment({ id: "new", createdAt: after(30) })],
      [reaction({ createdAt: after(10) })],
    );
    expect(items.map((i) => i.at.getTime())).toEqual([
      after(30).getTime(),
      after(10).getTime(),
      after(1).getTime(),
    ]);
  });

  it("gives every item a distinct id, so two reactions never collide", () => {
    const items = digest(
      [],
      [reaction({ uid: "a", name: "A" }), reaction({ uid: "b", name: "B" })],
    );
    expect(new Set(items.map((i) => i.id)).size).toBe(2);
  });

  it("is empty when nobody is signed in", () => {
    expect(digest([comment()], [reaction()], "")).toEqual([]);
  });

  it("skips weeks it was not given data for", () => {
    const items = buildDigest({
      weeks: [...WEEKS, { id: "2026-4", season: 2026, week: 4 }],
      commentsByWeek: { "2026-3": [comment()] },
      reactionsByWeek: {},
      myUid: ME,
      since: SINCE,
    });
    expect(items).toHaveLength(1);
  });
});

describe("describeDigest", () => {
  it("counts each kind, singular and plural", () => {
    expect(describeDigest(digest([comment()]))).toBe("1 comment");
    expect(describeDigest(digest([], [reaction()]))).toBe("1 reaction");
  });

  it("joins both kinds", () => {
    const items = digest([comment({ id: "a" }), comment({ id: "b" })], [reaction()]);
    expect(describeDigest(items)).toBe("2 comments and 1 reaction");
  });

  it("is empty for nothing", () => {
    expect(describeDigest([])).toBe("");
  });
});
