import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * Security rules tests.
 *
 * These assert the invariants the app's trust model depends on — above all
 * that a member cannot grade their own leg. Requires the Firestore emulator:
 *
 *   npm run emulators        # in another terminal
 *   npx vitest run --config vitest.rules.config.ts
 */

const LEAGUE = "test-league";
const OPEN_WEEK = "2025-1";
const CLOSED_WEEK = "2025-2";

const ADMIN = "admin-uid";
const MEMBER = "member-uid";
const OTHER = "other-uid";
const OUTSIDER = "outsider-uid";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();

  // Seed past the rules so tests start from a known, valid world.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "leagues", LEAGUE), {
      name: "Test League",
      ownerUid: ADMIN,
      inviteCode: "TEST01",
      memberUids: [ADMIN, MEMBER, OTHER],
      defaultStake: 5,
    });
    await setDoc(doc(db, "leagues", LEAGUE, "members", ADMIN), { uid: ADMIN, role: "admin" });
    await setDoc(doc(db, "leagues", LEAGUE, "members", MEMBER), { uid: MEMBER, role: "member" });
    await setDoc(doc(db, "leagues", LEAGUE, "members", OTHER), { uid: OTHER, role: "member" });

    await setDoc(doc(db, "leagues", LEAGUE, "weeks", OPEN_WEEK), {
      season: 2025,
      week: 1,
      stake: 5,
      closed: false,
      deadline: new Date(Date.now() + 86_400_000),
    });
    await setDoc(doc(db, "leagues", LEAGUE, "weeks", CLOSED_WEEK), {
      season: 2025,
      week: 2,
      stake: 5,
      closed: true,
      deadline: new Date(Date.now() - 86_400_000),
    });

    await setDoc(doc(db, "leagues", LEAGUE, "weeks", OPEN_WEEK, "legs", MEMBER), {
      uid: MEMBER,
      memberName: "Member",
      leg: "Bills -3",
      odds: -110,
      result: "Pending",
    });
  });
});

const as = (uid: string | null) =>
  uid === null ? env.unauthenticatedContext().firestore() : env.authenticatedContext(uid).firestore();

const legPath = (week: string, uid: string) =>
  ["leagues", LEAGUE, "weeks", week, "legs", uid] as const;

describe("league visibility", () => {
  it("lets a member read the league", async () => {
    await assertSucceeds(getDoc(doc(as(MEMBER), "leagues", LEAGUE)));
  });

  it("denies a non-member", async () => {
    await assertFails(getDoc(doc(as(OUTSIDER), "leagues", LEAGUE)));
  });

  it("denies an anonymous visitor", async () => {
    await assertFails(getDoc(doc(as(null), "leagues", LEAGUE)));
  });

  it("denies a non-member reading legs", async () => {
    await assertFails(getDoc(doc(as(OUTSIDER), ...legPath(OPEN_WEEK, MEMBER))));
  });
});

describe("a member's own leg", () => {
  it("can be created on an open week", async () => {
    await assertSucceeds(
      setDoc(doc(as(OTHER), ...legPath(OPEN_WEEK, OTHER)), {
        uid: OTHER,
        memberName: "Other",
        leg: "Chiefs ML",
        odds: -140,
        result: "Pending",
      }),
    );
  });

  it("can be edited before the deadline", async () => {
    await assertSucceeds(
      setDoc(doc(as(MEMBER), ...legPath(OPEN_WEEK, MEMBER)), {
        uid: MEMBER,
        memberName: "Member",
        leg: "Bills -3.5",
        odds: -120,
        result: "Pending",
      }),
    );
  });

  it("cannot be created on a closed week", async () => {
    await assertFails(
      setDoc(doc(as(MEMBER), ...legPath(CLOSED_WEEK, MEMBER)), {
        uid: MEMBER,
        memberName: "Member",
        leg: "Late entry",
        odds: -110,
        result: "Pending",
      }),
    );
  });

  it("cannot claim a win for itself on creation", async () => {
    await assertFails(
      setDoc(doc(as(OTHER), ...legPath(OPEN_WEEK, OTHER)), {
        uid: OTHER,
        memberName: "Other",
        leg: "Chiefs ML",
        odds: -140,
        result: "Win",
      }),
    );
  });

  // The invariant the whole trust model rests on.
  it("cannot be graded by its own author", async () => {
    await assertFails(
      updateDoc(doc(as(MEMBER), ...legPath(OPEN_WEEK, MEMBER)), { result: "Win" }),
    );
  });

  it("cannot be re-pointed at another member", async () => {
    await assertFails(
      updateDoc(doc(as(MEMBER), ...legPath(OPEN_WEEK, MEMBER)), { uid: OTHER }),
    );
  });
});

describe("another member's leg", () => {
  it("cannot be written", async () => {
    await assertFails(
      setDoc(doc(as(OTHER), ...legPath(OPEN_WEEK, MEMBER)), {
        uid: MEMBER,
        memberName: "Member",
        leg: "Sabotage",
        odds: -110,
        result: "Pending",
      }),
    );
  });

  it("cannot be deleted", async () => {
    await assertFails(deleteDoc(doc(as(OTHER), ...legPath(OPEN_WEEK, MEMBER))));
  });
});

describe("admins", () => {
  it("can grade any leg", async () => {
    await assertSucceeds(
      updateDoc(doc(as(ADMIN), ...legPath(OPEN_WEEK, MEMBER)), {
        result: "Win",
        memberName: "Member",
        leg: "Bills -3",
        odds: -110,
      }),
    );
  });

  it("can grade after the deadline has passed", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), ...legPath(CLOSED_WEEK, MEMBER)), {
        uid: MEMBER,
        memberName: "Member",
        leg: "Old leg",
        odds: -110,
        result: "Pending",
      });
    });
    await assertSucceeds(
      updateDoc(doc(as(ADMIN), ...legPath(CLOSED_WEEK, MEMBER)), {
        result: "Loss",
        memberName: "Member",
        leg: "Old leg",
        odds: -110,
      }),
    );
  });

  it("can close a week", async () => {
    await assertSucceeds(
      updateDoc(doc(as(ADMIN), "leagues", LEAGUE, "weeks", OPEN_WEEK), {
        closed: true,
        season: 2025,
        week: 1,
        stake: 5,
      }),
    );
  });

  it("are the only ones who can close a week", async () => {
    await assertFails(
      updateDoc(doc(as(MEMBER), "leagues", LEAGUE, "weeks", OPEN_WEEK), {
        closed: true,
        season: 2025,
        week: 1,
        stake: 5,
      }),
    );
  });
});

describe("the owner", () => {
  it("cannot be demoted by another admin", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "leagues", LEAGUE, "members", OTHER), {
        uid: OTHER,
        role: "admin",
      });
    });
    await assertFails(
      updateDoc(doc(as(OTHER), "leagues", LEAGUE, "members", ADMIN), { role: "member" }),
    );
  });

  it("cannot be removed", async () => {
    await assertFails(deleteDoc(doc(as(ADMIN), "leagues", LEAGUE, "members", ADMIN)));
  });
});

describe("members", () => {
  it("can remove themselves", async () => {
    await assertSucceeds(deleteDoc(doc(as(MEMBER), "leagues", LEAGUE, "members", MEMBER)));
  });

  it("cannot promote themselves to admin", async () => {
    await assertFails(
      updateDoc(doc(as(MEMBER), "leagues", LEAGUE, "members", MEMBER), { role: "admin" }),
    );
  });
});

describe("join requests", () => {
  it("can be filed by an outsider for themselves", async () => {
    await assertSucceeds(
      setDoc(doc(as(OUTSIDER), "leagues", LEAGUE, "joinRequests", OUTSIDER), {
        requesterUid: OUTSIDER,
        displayName: "Outsider",
        email: "out@x.test",
        providedCode: "TEST01",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("cannot be filed on someone else's behalf", async () => {
    await assertFails(
      setDoc(doc(as(OUTSIDER), "leagues", LEAGUE, "joinRequests", OTHER), {
        requesterUid: OTHER,
        displayName: "Spoofed",
        email: "x@x.test",
        providedCode: "TEST01",
        createdAt: serverTimestamp(),
      }),
    );
  });
});

describe("invite codes", () => {
  it("are readable by any signed-in user", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "inviteCodes", "TEST01"), {
        code: "TEST01",
        leagueId: LEAGUE,
        leagueName: "Test League",
        active: true,
      });
    });
    await assertSucceeds(getDoc(doc(as(OUTSIDER), "inviteCodes", "TEST01")));
  });

  it("cannot be pointed at a league the writer does not administer", async () => {
    await assertFails(
      setDoc(doc(as(OUTSIDER), "inviteCodes", "HIJACK"), {
        code: "HIJACK",
        leagueId: LEAGUE,
        leagueName: "Test League",
        active: true,
      }),
    );
  });
});

describe("single-league config", () => {
  it("is readable by any signed-in user, so a non-member can find the league", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "appConfig", "league"), {
        leagueId: LEAGUE,
        leagueName: "Test League",
      });
    });
    await assertSucceeds(getDoc(doc(as(OUTSIDER), "appConfig", "league")));
  });

  it("is not readable anonymously", async () => {
    await assertFails(getDoc(doc(as(null), "appConfig", "league")));
  });

  it("can be written by an admin of the league it names", async () => {
    await assertSucceeds(
      setDoc(doc(as(ADMIN), "appConfig", "league"), {
        leagueId: LEAGUE,
        leagueName: "Test League",
      }),
    );
  });

  // Otherwise anyone could redirect the whole deployment at a league of theirs.
  it("cannot be pointed at a league the writer does not administer", async () => {
    await assertFails(
      setDoc(doc(as(MEMBER), "appConfig", "league"), {
        leagueId: LEAGUE,
        leagueName: "Test League",
      }),
    );
    await assertFails(
      setDoc(doc(as(OUTSIDER), "appConfig", "league"), {
        leagueId: LEAGUE,
        leagueName: "Hijacked",
      }),
    );
  });
});

describe("ticket screenshot", () => {
  const imagePath = (week: string) =>
    ["leagues", LEAGUE, "weeks", week, "media", "ticket"] as const;

  const image = (src = "data:image/jpeg;base64,abc123") => ({
    src,
    width: 800,
    height: 1200,
    bytes: src.length,
    uploadedByUid: ADMIN,
    uploadedByName: "Admin",
  });

  it("can be set by an admin", async () => {
    await assertSucceeds(setDoc(doc(as(ADMIN), ...imagePath(OPEN_WEEK)), image()));
  });

  // This is the check Cloud Storage rules could not perform at all.
  it("cannot be set by an ordinary member", async () => {
    await assertFails(setDoc(doc(as(MEMBER), ...imagePath(OPEN_WEEK)), image()));
  });

  it("cannot be set by a non-member", async () => {
    await assertFails(setDoc(doc(as(OUTSIDER), ...imagePath(OPEN_WEEK)), image()));
  });

  it("is readable by members but not outsiders", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), ...imagePath(OPEN_WEEK)), image());
    });
    await assertSucceeds(getDoc(doc(as(MEMBER), ...imagePath(OPEN_WEEK))));
    await assertFails(getDoc(doc(as(OUTSIDER), ...imagePath(OPEN_WEEK))));
  });

  it("refuses an image close to the document limit", async () => {
    const huge = `data:image/jpeg;base64,${"a".repeat(950_000)}`;
    await assertFails(setDoc(doc(as(ADMIN), ...imagePath(OPEN_WEEK)), image(huge)));
  });

  it("refuses a src that is not an image", async () => {
    await assertFails(
      setDoc(doc(as(ADMIN), ...imagePath(OPEN_WEEK)), image("javascript:alert(1)")),
    );
    await assertFails(
      setDoc(doc(as(ADMIN), ...imagePath(OPEN_WEEK)), image("data:text/html,<script>")),
    );
  });

  it("only accepts the ticket document id", async () => {
    await assertFails(
      setDoc(doc(as(ADMIN), "leagues", LEAGUE, "weeks", OPEN_WEEK, "media", "other"), image()),
    );
  });

  it("can be removed by an admin but not a member", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), ...imagePath(OPEN_WEEK)), image());
    });
    await assertFails(deleteDoc(doc(as(MEMBER), ...imagePath(OPEN_WEEK))));
    await assertSucceeds(deleteDoc(doc(as(ADMIN), ...imagePath(OPEN_WEEK))));
  });
});

describe("reactions", () => {
  const path = (legUid: string, byUid: string) =>
    ["leagues", LEAGUE, "weeks", OPEN_WEEK, "reactions", `${legUid}__${byUid}`] as const;

  const body = (legUid: string, byUid: string, emoji = "\u{1F525}") => ({
    legId: legUid,
    uid: byUid,
    name: "Someone",
    emoji,
  });

  it("lets a member react to someone else's leg", async () => {
    await assertSucceeds(setDoc(doc(as(OTHER), ...path(MEMBER, OTHER)), body(MEMBER, OTHER)));
  });

  it("is readable across the league", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), ...path(MEMBER, OTHER)), body(MEMBER, OTHER));
    });
    await assertSucceeds(getDoc(doc(as(ADMIN), ...path(MEMBER, OTHER))));
    await assertFails(getDoc(doc(as(OUTSIDER), ...path(MEMBER, OTHER))));
  });

  // The document id encodes the author, which is what makes this checkable.
  it("cannot be posted in someone else's name", async () => {
    await assertFails(setDoc(doc(as(OTHER), ...path(MEMBER, ADMIN)), body(MEMBER, ADMIN)));
  });

  it("cannot claim an id that disagrees with its uid", async () => {
    await assertFails(setDoc(doc(as(OTHER), ...path(MEMBER, OTHER)), body(MEMBER, ADMIN)));
  });

  it("cannot be left by a non-member", async () => {
    await assertFails(setDoc(doc(as(OUTSIDER), ...path(MEMBER, OUTSIDER)), body(MEMBER, OUTSIDER)));
  });

  it("refuses an oversized payload dressed up as an emoji", async () => {
    await assertFails(
      setDoc(doc(as(OTHER), ...path(MEMBER, OTHER)), body(MEMBER, OTHER, "x".repeat(400))),
    );
    await assertFails(setDoc(doc(as(OTHER), ...path(MEMBER, OTHER)), body(MEMBER, OTHER, "")));
  });

  it("can be taken back only by its author", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), ...path(MEMBER, OTHER)), body(MEMBER, OTHER));
    });
    await assertFails(deleteDoc(doc(as(MEMBER), ...path(MEMBER, OTHER))));
    await assertSucceeds(deleteDoc(doc(as(OTHER), ...path(MEMBER, OTHER))));
  });
});
