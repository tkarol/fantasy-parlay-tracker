import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../firebase";
import {
  appLeagueDoc,
  inviteCodeDoc,
  joinRequestDoc,
  joinRequestsCol,
  leagueDoc,
  leaguesCol,
  legDoc,
  legsCol,
  reactionDoc,
  memberDoc,
  ticketImageDoc,
  weekDoc,
} from "./firestorePaths";
import { leagueConverter } from "./converters";
import { makeInviteCode, makeLeagueId, weekId as makeWeekId } from "./rand";
import { nextThursdaySixPm } from "./dates";
import type { LegResult, Member, MemberRole, ReactionEmoji, Week } from "../types/models";

/**
 * Every Firestore write in the app lives here.
 *
 * Keeping them together means the rules in firestore.rules have exactly one
 * counterpart in the client, and a change to the document shape has one place
 * to be made rather than a dozen inline `setDoc` calls across components.
 */

export function displayNameFor(user: User): string {
  return user.displayName || user.email?.split("@")[0] || "Member";
}

// ---------------------------------------------------------------------------
// Leagues
// ---------------------------------------------------------------------------

export interface CreateLeagueOptions {
  name: string;
  stake?: number;
  season?: number;
}

export async function createLeague(user: User, options: CreateLeagueOptions): Promise<string> {
  const name = options.name.trim();
  const stake = options.stake ?? 5;
  const season = options.season ?? new Date().getFullYear();
  const leagueId = makeLeagueId(name);
  const code = makeInviteCode();

  // Written in dependency order: the invite code and week documents are only
  // permitted once the league (and therefore ownership) exists.
  await setDoc(leagueDoc(leagueId), {
    name,
    ownerUid: user.uid,
    ownerEmail: user.email ?? "",
    inviteCode: code,
    memberUids: [user.uid],
    defaultStake: stake,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(memberDoc(leagueId, user.uid), {
    uid: user.uid,
    role: "admin" satisfies MemberRole,
    displayName: displayNameFor(user),
    email: user.email ?? "",
    photoURL: user.photoURL ?? "",
    joinedAt: serverTimestamp(),
  });

  await setDoc(inviteCodeDoc(code), {
    code,
    leagueId,
    leagueName: name,
    active: true,
  });

  await setDoc(weekDoc(leagueId, makeWeekId(season, 1)), {
    season,
    week: 1,
    stake,
    deadline: nextThursdaySixPm(),
    closed: false,
    createdAt: serverTimestamp(),
  });

  return leagueId;
}

export async function renameLeague(leagueId: string, name: string): Promise<void> {
  await updateDoc(leagueDoc(leagueId), { name: name.trim(), updatedAt: serverTimestamp() });
}

export async function setDefaultStake(leagueId: string, stake: number): Promise<void> {
  await updateDoc(leagueDoc(leagueId), { defaultStake: stake, updatedAt: serverTimestamp() });
}

/** Issue a new invite code and retire the old one. */
export async function rotateInviteCode(leagueId: string, leagueName: string): Promise<string> {
  const snap = await getDoc(leagueDoc(leagueId).withConverter(leagueConverter));
  const previous = snap.data()?.inviteCode;
  const code = makeInviteCode();

  await updateDoc(leagueDoc(leagueId), { inviteCode: code, inviteRotatedAt: serverTimestamp() });
  await setDoc(inviteCodeDoc(code), { code, leagueId, leagueName, active: true });

  if (previous && previous !== code) {
    // Deactivate rather than delete, so a stale code reports "expired" instead
    // of the same "invalid code" a typo produces.
    await setDoc(
      inviteCodeDoc(previous),
      { code: previous, leagueId, leagueName, active: false },
      { merge: true },
    );
  }
  return code;
}

// ---------------------------------------------------------------------------
// Single-league deployment
// ---------------------------------------------------------------------------

export interface AppLeague {
  leagueId: string;
  leagueName: string;
}

/** Which league this deployment serves, if one has been recorded. */
export async function getAppLeague(): Promise<AppLeague | null> {
  const snap = await getDoc(appLeagueDoc());
  if (!snap.exists()) return null;
  const data = snap.data();
  const leagueId = typeof data.leagueId === "string" ? data.leagueId : "";
  if (!leagueId) return null;
  return { leagueId, leagueName: typeof data.leagueName === "string" ? data.leagueName : "" };
}

/**
 * Record the league this deployment serves. Admin-gated by the rules, and
 * called automatically the first time an admin opens the app so the app needs
 * no build-time configuration to work.
 */
export async function setAppLeague(leagueId: string, leagueName: string): Promise<void> {
  await setDoc(appLeagueDoc(), { leagueId, leagueName, updatedAt: serverTimestamp() });
}

// ---------------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------------

export type JoinLookup =
  | { status: "ok"; leagueId: string; leagueName: string }
  | { status: "expired" }
  | { status: "not-found" };

/**
 * Resolve an invite code. Falls back to the legacy league query for codes
 * issued before the /inviteCodes collection existed.
 */
export async function lookupInviteCode(rawCode: string): Promise<JoinLookup> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { status: "not-found" };

  const snap = await getDoc(inviteCodeDoc(code));
  if (snap.exists()) {
    const data = snap.data();
    if (data.active === false) return { status: "expired" };
    return {
      status: "ok",
      leagueId: String(data.leagueId ?? ""),
      leagueName: String(data.leagueName ?? ""),
    };
  }

  // Legacy path: leagues created before invite codes were indexed separately.
  try {
    const legacy = await getDocs(
      query(leaguesCol().withConverter(leagueConverter), where("inviteCode", "==", code)),
    );
    const first = legacy.docs[0];
    if (first) {
      const league = first.data();
      return { status: "ok", leagueId: league.id, leagueName: league.name };
    }
  } catch {
    // Rules deny this query for non-members once every league is migrated.
    // Treating it as "not found" is the correct answer for the user.
  }

  return { status: "not-found" };
}

/**
 * Backfill the /inviteCodes entry for a league created before that collection
 * existed.
 *
 * Non-members cannot query /leagues by invite code under the current rules, so
 * a league without this document is unjoinable. Rather than requiring a
 * migration script and a service account, an admin opening league settings
 * repairs it: the write is idempotent and admin-gated by the same rules.
 */
export async function ensureInviteCodeDoc(
  leagueId: string,
  leagueName: string,
  code: string,
): Promise<boolean> {
  if (!code) return false;

  const existing = await getDoc(inviteCodeDoc(code));
  if (existing.exists()) return false;

  await setDoc(inviteCodeDoc(code), { code, leagueId, leagueName, active: true });
  return true;
}

export async function requestToJoin(
  leagueId: string,
  code: string,
  user: User,
): Promise<void> {
  await setDoc(joinRequestDoc(leagueId, user.uid), {
    requesterUid: user.uid,
    displayName: displayNameFor(user),
    email: user.email ?? "",
    providedCode: code.trim().toUpperCase(),
    createdAt: serverTimestamp(),
  });
}

export async function cancelJoinRequest(leagueId: string, uid: string): Promise<void> {
  await deleteDoc(joinRequestDoc(leagueId, uid));
}

export async function approveJoinRequest(
  leagueId: string,
  request: { uid: string; displayName: string; email: string },
): Promise<void> {
  await setDoc(
    memberDoc(leagueId, request.uid),
    {
      uid: request.uid,
      role: "member" satisfies MemberRole,
      displayName: request.displayName,
      email: request.email,
      joinedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await updateDoc(leagueDoc(leagueId), { memberUids: arrayUnion(request.uid) });
  await deleteDoc(joinRequestDoc(leagueId, request.uid));
}

export async function rejectJoinRequest(leagueId: string, uid: string): Promise<void> {
  await deleteDoc(joinRequestDoc(leagueId, uid));
}

export async function clearJoinRequests(leagueId: string): Promise<void> {
  const snap = await getDocs(joinRequestsCol(leagueId));
  const batch = writeBatch(db);
  for (const request of snap.docs) batch.delete(request.ref);
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function setMemberRole(
  leagueId: string,
  uid: string,
  role: MemberRole,
): Promise<void> {
  await updateDoc(memberDoc(leagueId, uid), { role });
}

export async function removeMember(leagueId: string, uid: string): Promise<void> {
  await deleteDoc(memberDoc(leagueId, uid));
  await updateDoc(leagueDoc(leagueId), { memberUids: arrayRemove(uid) });
}

// ---------------------------------------------------------------------------
// Weeks
// ---------------------------------------------------------------------------

export interface CreateWeekOptions {
  season: number;
  week: number;
  stake: number;
  deadline?: Date | null;
}

export async function createWeek(
  leagueId: string,
  { season, week, stake, deadline }: CreateWeekOptions,
): Promise<string> {
  const id = makeWeekId(season, week);
  await setDoc(
    weekDoc(leagueId, id),
    {
      season,
      week,
      stake,
      deadline: deadline ?? nextThursdaySixPm(),
      closed: false,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
  return id;
}

/**
 * Open a new season at week 1.
 *
 * Seasons are just a field on the week document, so starting a year is simply
 * creating its first week — nothing about the previous season is touched, and
 * its history stays intact and comparable.
 */
export async function startSeason(
  leagueId: string,
  season: number,
  stake: number,
  deadline?: Date | null,
): Promise<string> {
  return createWeek(leagueId, { season, week: 1, stake, deadline: deadline ?? null });
}

export type WeekPatch = Partial<
  Pick<Week, "stake" | "deadline" | "closed" | "note" | "payoutOverride">
>;

export async function updateWeek(
  leagueId: string,
  weekIdValue: string,
  patch: WeekPatch,
): Promise<void> {
  const payload: Record<string, unknown> = { ...patch };
  // `null` means "clear this" — Firestore needs an explicit sentinel.
  if (patch.payoutOverride === null) payload.payoutOverride = deleteField();
  if (patch.closed === true) payload.closedAt = serverTimestamp();
  if (patch.closed === false) payload.closedAt = deleteField();
  await updateDoc(weekDoc(leagueId, weekIdValue), payload);
}

export async function deleteWeek(leagueId: string, weekIdValue: string): Promise<void> {
  // Remove the legs first; deleting a parent document leaves subcollections
  // orphaned and they would reappear if the week id were reused.
  const legs = await getDocs(legsCol(leagueId, weekIdValue));
  const batch = writeBatch(db);
  for (const leg of legs.docs) batch.delete(leg.ref);
  batch.delete(weekDoc(leagueId, weekIdValue));
  await batch.commit();
}

/** Lock a week and open the next one, carrying the stake forward. */
export async function closeWeekAndOpenNext(
  leagueId: string,
  week: Week,
  existingWeekIds: readonly string[],
): Promise<string> {
  await updateWeek(leagueId, week.id, { closed: true });

  const nextWeekNumber = week.week + 1;
  const nextId = makeWeekId(week.season, nextWeekNumber);
  if (!existingWeekIds.includes(nextId)) {
    await createWeek(leagueId, {
      season: week.season,
      week: nextWeekNumber,
      stake: week.stake,
      deadline: nextThursdaySixPm(),
    });
  }
  return nextId;
}

export async function reopenWeek(leagueId: string, weekIdValue: string): Promise<void> {
  await updateWeek(leagueId, weekIdValue, { closed: false });
}

// ---------------------------------------------------------------------------
// Legs
// ---------------------------------------------------------------------------

export interface LegSubmission {
  leg: string;
  odds: number | null;
}

/** A member creating or editing their own leg. Never touches `result`. */
export async function submitMyLeg(
  leagueId: string,
  weekIdValue: string,
  week: Pick<Week, "season" | "week">,
  user: User,
  submission: LegSubmission,
  isNew: boolean,
): Promise<void> {
  const payload: Record<string, unknown> = {
    uid: user.uid,
    memberName: displayNameFor(user),
    leg: submission.leg.trim(),
    odds: submission.odds ?? "",
    season: week.season,
    week: week.week,
    updatedAt: serverTimestamp(),
  };
  if (isNew) {
    payload.result = "Pending";
    payload.createdAt = serverTimestamp();
    payload.createdBy = user.uid;
  }
  await setDoc(legDoc(leagueId, weekIdValue, user.uid), payload, { merge: true });
}

export async function deleteLeg(
  leagueId: string,
  weekIdValue: string,
  legId: string,
): Promise<void> {
  await deleteDoc(legDoc(leagueId, weekIdValue, legId));
}

/** Admin grading. Recorded with who graded it and when. */
export async function gradeLeg(
  leagueId: string,
  weekIdValue: string,
  legId: string,
  result: LegResult,
  gradedByUid: string,
): Promise<void> {
  await updateDoc(legDoc(leagueId, weekIdValue, legId), {
    result,
    gradedByUid,
    gradedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export interface AdminLegPatch {
  memberName?: string;
  leg?: string;
  odds?: number | null;
  result?: LegResult;
}

export async function adminUpdateLeg(
  leagueId: string,
  weekIdValue: string,
  legId: string,
  patch: AdminLegPatch,
  adminUid: string,
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.memberName !== undefined) payload.memberName = patch.memberName.trim();
  if (patch.leg !== undefined) payload.leg = patch.leg.trim();
  if (patch.odds !== undefined) payload.odds = patch.odds ?? "";
  if (patch.result !== undefined) {
    payload.result = patch.result;
    payload.gradedByUid = adminUid;
    payload.gradedAt = serverTimestamp();
  }
  await updateDoc(legDoc(leagueId, weekIdValue, legId), payload);
}

/** Admin adding a leg on behalf of a member, keyed by that member's uid. */
export async function adminAddLegForMember(
  leagueId: string,
  weekIdValue: string,
  week: Pick<Week, "season" | "week">,
  member: { uid: string; displayName: string },
  submission: LegSubmission,
  adminUid: string,
): Promise<void> {
  await setDoc(
    legDoc(leagueId, weekIdValue, member.uid),
    {
      uid: member.uid,
      memberName: member.displayName,
      leg: submission.leg.trim(),
      odds: submission.odds ?? "",
      result: "Pending" satisfies LegResult,
      season: week.season,
      week: week.week,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Grade several legs at once.
 *
 * Eight legs a week, graded one click at a time, is the chore that makes an
 * admin stop running the league. One batch also means the ticket never shows a
 * half-graded state to anyone watching.
 */
export async function gradeLegs(
  leagueId: string,
  weekIdValue: string,
  grades: readonly { legId: string; result: LegResult }[],
  adminUid: string,
): Promise<number> {
  if (grades.length === 0) return 0;

  const batch = writeBatch(db);
  for (const { legId, result } of grades) {
    batch.update(legDoc(leagueId, weekIdValue, legId), {
      result,
      gradedByUid: adminUid,
      gradedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return grades.length;
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

/**
 * Set or clear your reaction to someone's leg.
 *
 * One document per person per leg, so reacting never has to read-modify-write
 * a shared list and two people tapping at once cannot clobber each other.
 */
export async function setReaction(
  leagueId: string,
  weekIdValue: string,
  legId: string,
  user: User,
  emoji: ReactionEmoji,
): Promise<void> {
  await setDoc(reactionDoc(leagueId, weekIdValue, legId, user.uid), {
    legId,
    uid: user.uid,
    name: displayNameFor(user),
    emoji,
  });
}

export async function clearReaction(
  leagueId: string,
  weekIdValue: string,
  legId: string,
  uid: string,
): Promise<void> {
  await deleteDoc(reactionDoc(leagueId, weekIdValue, legId, uid));
}

// ---------------------------------------------------------------------------
// Repairing legacy legs
// ---------------------------------------------------------------------------

export interface LegLinkReport {
  /** Legs that had no uid and now have one. */
  linked: number;
  /** Legs with no uid whose name matched nobody, or matched two people. */
  unmatched: string[];
  scanned: number;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Attach a member uid to legs that never had one.
 *
 * The original app recorded admin-entered legs under an auto id with the
 * admin's uid in `createdBy`, so they carry no owner. Stats resolve those by
 * name, but that breaks the day someone changes their Google display name —
 * this writes the link into the data so it stops depending on the spelling.
 *
 * Read-only on anything it cannot match confidently: a name that answers to
 * two members is reported rather than guessed at.
 */
export async function linkLegacyLegs(
  leagueId: string,
  weeks: readonly Week[],
  members: readonly Member[],
): Promise<LegLinkReport> {
  const byName = new Map<string, Member | null>();
  for (const member of members) {
    const name = normalizeName(member.displayName || member.email || "");
    if (!name) continue;
    byName.set(name, byName.has(name) ? null : member);
  }

  const report: LegLinkReport = { linked: 0, unmatched: [], scanned: 0 };
  const pending: { ref: ReturnType<typeof legDoc>; uid: string; name: string }[] = [];

  for (const week of weeks) {
    const snap = await getDocs(legsCol(leagueId, week.id));
    for (const legSnap of snap.docs) {
      report.scanned += 1;
      const data = legSnap.data();
      if (typeof data.uid === "string" && data.uid) continue;

      // A legacy member leg keyed by uid already resolves; only the
      // auto-id ones need repairing.
      const createdBy = typeof data.createdBy === "string" ? data.createdBy : "";
      if (createdBy && createdBy === legSnap.id) continue;

      const rawName = typeof data.memberName === "string" ? data.memberName : "";
      const matched = byName.get(normalizeName(rawName));
      if (!matched) {
        if (rawName && !report.unmatched.includes(rawName)) report.unmatched.push(rawName);
        continue;
      }

      pending.push({
        ref: legDoc(leagueId, week.id, legSnap.id),
        uid: matched.uid,
        name: matched.displayName || rawName,
      });
    }
  }

  // Firestore caps a batch at 500 writes.
  for (let i = 0; i < pending.length; i += 400) {
    const batch = writeBatch(db);
    for (const item of pending.slice(i, i + 400)) {
      batch.update(item.ref, { uid: item.uid, memberName: item.name });
    }
    await batch.commit();
    report.linked += Math.min(400, pending.length - i);
  }

  return report;
}

export interface UnlinkedScan {
  /** Ownerless legs whose name matches exactly one member — fixable. */
  matchable: number;
  /** Names that match nobody: people who left, or a different spelling. */
  unmatchedNames: string[];
}

/**
 * What the repair could actually achieve.
 *
 * Separating matchable from unmatchable matters: a member who left the league
 * will never match anyone, and counting them as "needs fixing" would leave the
 * repair permanently on screen with nothing useful to do.
 */
export async function scanUnlinkedLegs(
  leagueId: string,
  weeks: readonly Week[],
  members: readonly Member[],
): Promise<UnlinkedScan> {
  const byName = new Map<string, Member | null>();
  for (const member of members) {
    const name = normalizeName(member.displayName || member.email || "");
    if (!name) continue;
    byName.set(name, byName.has(name) ? null : member);
  }

  const scan: UnlinkedScan = { matchable: 0, unmatchedNames: [] };

  for (const week of weeks) {
    const snap = await getDocs(legsCol(leagueId, week.id));
    for (const legSnap of snap.docs) {
      const data = legSnap.data();
      if (typeof data.uid === "string" && data.uid) continue;
      const createdBy = typeof data.createdBy === "string" ? data.createdBy : "";
      if (createdBy && createdBy === legSnap.id) continue;

      const rawName = typeof data.memberName === "string" ? data.memberName : "";
      if (byName.get(normalizeName(rawName))) scan.matchable += 1;
      else if (rawName && !scan.unmatchedNames.includes(rawName)) {
        scan.unmatchedNames.push(rawName);
      }
    }
  }

  return scan;
}

// ---------------------------------------------------------------------------
// Ticket screenshots
// ---------------------------------------------------------------------------

export interface TicketImageInput {
  dataUrl: string;
  width: number;
  height: number;
  encodedBytes: number;
}

/**
 * Save the week's ticket screenshot.
 *
 * The image lives in Firestore, in its own document under the week, where the
 * rules can check that the writer is an admin of this league. Cloud Storage
 * rules cannot read Firestore, so that check was impossible there.
 */
export async function saveTicketImage(
  leagueId: string,
  weekIdValue: string,
  user: User,
  image: TicketImageInput,
): Promise<void> {
  await setDoc(ticketImageDoc(leagueId, weekIdValue), {
    src: image.dataUrl,
    width: image.width,
    height: image.height,
    bytes: image.encodedBytes,
    uploadedAt: serverTimestamp(),
    uploadedByUid: user.uid,
    uploadedByName: displayNameFor(user),
  });

  // Older weeks carry a pointer to a Cloud Storage object. Clear it so the two
  // sources can never disagree about which screenshot is current.
  await updateDoc(weekDoc(leagueId, weekIdValue), { ticketImage: deleteField() }).catch(() => {
    // The field may simply not exist, which is the normal case.
  });
}

export async function removeTicketImage(leagueId: string, weekIdValue: string): Promise<void> {
  await deleteDoc(ticketImageDoc(leagueId, weekIdValue));
  await updateDoc(weekDoc(leagueId, weekIdValue), { ticketImage: deleteField() }).catch(() => {
    // Same as above: absent is fine.
  });
}
