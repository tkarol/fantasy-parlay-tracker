import { db } from "../firebase";
import { collection, doc } from "firebase/firestore";

export const leaguesCol   = () => collection(db, "leagues");
export const leagueDoc    = (id) => doc(db, "leagues", id);

export const membersCol   = (leagueId) => collection(db, "leagues", leagueId, "members");
export const memberDoc    = (leagueId, uid) => doc(db, "leagues", leagueId, "members", uid);

export const weeksCol     = (leagueId) => collection(db, "leagues", leagueId, "weeks");
export const weekDoc      = (leagueId, weekId) => doc(db, "leagues", leagueId, "weeks", weekId);

export const legsCol      = (leagueId, weekId) => collection(db, "leagues", leagueId, "weeks", weekId, "legs");
export const legDoc       = (leagueId, weekId, uid) => doc(db, "leagues", leagueId, "weeks", weekId, "legs", uid);

export const joinReqsCol  = (leagueId) => collection(db, "leagues", leagueId, "joinRequests");
export const joinReqDoc   = (leagueId, uid) => doc(db, "leagues", leagueId, "joinRequests", uid);
