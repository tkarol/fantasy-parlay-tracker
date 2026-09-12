import { collection, doc } from "firebase/firestore";
import { db } from "../firebase";

export const leaguesCol = () => collection(db, "leagues");
export const leagueDoc = (leagueId: string) => doc(db, "leagues", leagueId);

export const membersCol = (leagueId: string) => collection(db, "leagues", leagueId, "members");
export const memberDoc = (leagueId: string, uid: string) =>
  doc(db, "leagues", leagueId, "members", uid);

export const weeksCol = (leagueId: string) => collection(db, "leagues", leagueId, "weeks");
export const weekDoc = (leagueId: string, weekId: string) =>
  doc(db, "leagues", leagueId, "weeks", weekId);

export const legsCol = (leagueId: string, weekId: string) =>
  collection(db, "leagues", leagueId, "weeks", weekId, "legs");
export const legDoc = (leagueId: string, weekId: string, uid: string) =>
  doc(db, "leagues", leagueId, "weeks", weekId, "legs", uid);

export const joinRequestsCol = (leagueId: string) =>
  collection(db, "leagues", leagueId, "joinRequests");
export const joinRequestDoc = (leagueId: string, uid: string) =>
  doc(db, "leagues", leagueId, "joinRequests", uid);

/**
 * The single league this deployment serves. Readable by any signed-in user so
 * someone who isn't a member yet can still find the league and ask to join.
 */
export const appLeagueDoc = () => doc(db, "appConfig", "league");

/** Public code -> league lookup, so non-members never read league documents. */
export const inviteCodesCol = () => collection(db, "inviteCodes");
export const inviteCodeDoc = (code: string) => doc(db, "inviteCodes", code.toUpperCase());

/**
 * Reactions for a week, one document per person per leg.
 *
 * The document id encodes both, which is what lets the rules check ownership
 * without having to reason about edits to a shared array.
 */
export const reactionsCol = (leagueId: string, weekId: string) =>
  collection(db, "leagues", leagueId, "weeks", weekId, "reactions");

export const reactionId = (legId: string, uid: string) => `${legId}__${uid}`;

export const reactionDoc = (leagueId: string, weekId: string, legId: string, uid: string) =>
  doc(db, "leagues", leagueId, "weeks", weekId, "reactions", reactionId(legId, uid));

/**
 * The week's ticket screenshot, in its own document.
 *
 * Kept out of the week document on purpose: the app subscribes to every week
 * at once, and an image embedded there would be pulled down on every one of
 * those reads.
 */
export const ticketImageDoc = (leagueId: string, weekId: string) =>
  doc(db, "leagues", leagueId, "weeks", weekId, "media", "ticket");
