import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  WithFieldValue,
} from "firebase/firestore";
import { DEFAULT_DEADLINE_RULE, toDate } from "./dates";
import { parseAmerican } from "./odds";
import { parseWeekId } from "./rand";
import {
  LEG_RESULTS,
  type InviteCode,
  type JoinRequest,
  type League,
  type Leg,
  type LegResult,
  type Member,
  type MemberRole,
  type TicketImage,
  type Week,
} from "../types/models";

/**
 * Firestore converters.
 *
 * These are deliberately forgiving on read: documents written by the original
 * version of this app are missing fields that are now part of the model, and
 * legacy legs identify their author differently. Reading must never throw on
 * an old document — every field falls back to a sane default.
 *
 * They are read-oriented. Writes go through plain document references so a
 * partial update never has to satisfy the full model shape.
 */

/** Document ids live on the model but must never be written into the document. */
function withoutId<T extends { id?: unknown }>(value: WithFieldValue<T>): DocumentData {
  const { id: _id, ...rest } = value as Record<string, unknown>;
  return rest;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function legResult(value: unknown): LegResult {
  return LEG_RESULTS.includes(value as LegResult) ? (value as LegResult) : "Pending";
}

function memberRole(value: unknown): MemberRole {
  return value === "admin" ? "admin" : "member";
}

// ---------------------------------------------------------------------------

export const leagueConverter: FirestoreDataConverter<League, DocumentData> = {
  toFirestore: withoutId,
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): League {
    const d = snap.data(options) ?? {};
    return {
      id: snap.id,
      name: str(d.name, snap.id),
      ownerUid: str(d.ownerUid),
      ownerEmail: str(d.ownerEmail),
      inviteCode: str(d.inviteCode),
      memberUids: strArray(d.memberUids),
      defaultStake: num(d.defaultStake, 5),
      // Leagues from before the deadline was configurable fall back to the
      // default rather than to whatever constant the code used at the time.
      deadlineWeekday: num(d.deadlineWeekday, DEFAULT_DEADLINE_RULE.weekday),
      deadlineHour: num(d.deadlineHour, DEFAULT_DEADLINE_RULE.hour),
      deadlineMinute: num(d.deadlineMinute, DEFAULT_DEADLINE_RULE.minute),
      deadlineTimeZone: str(d.deadlineTimeZone) || DEFAULT_DEADLINE_RULE.timeZone,
      createdAt: toDate(d.createdAt),
      updatedAt: toDate(d.updatedAt),
    };
  },
};

export const memberConverter: FirestoreDataConverter<Member, DocumentData> = {
  toFirestore: (member) => ({ ...member }),
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): Member {
    const d = snap.data(options) ?? {};
    return {
      uid: str(d.uid, snap.id),
      role: memberRole(d.role),
      displayName: str(d.displayName) || str(d.email) || snap.id,
      email: str(d.email),
      photoURL: str(d.photoURL) || null,
      joinedAt: toDate(d.joinedAt),
    };
  },
};

/**
 * Reads both shapes: the current `src` data URL and the `url` left behind by
 * the Cloud Storage version, so screenshots uploaded before the move still
 * display.
 */
export function readTicketImage(value: unknown): TicketImage | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  const src = str(d.src) || str(d.url);
  if (!src) return null;
  return {
    src,
    width: typeof d.width === "number" ? d.width : null,
    height: typeof d.height === "number" ? d.height : null,
    bytes: num(d.bytes, src.length),
    uploadedAt: toDate(d.uploadedAt as never),
    uploadedByUid: str(d.uploadedByUid),
    uploadedByName: str(d.uploadedByName),
  };
}

export const ticketImageConverter: FirestoreDataConverter<TicketImage, DocumentData> = {
  toFirestore: (image) => ({ ...image }),
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): TicketImage {
    return (
      readTicketImage(snap.data(options)) ?? {
        src: "",
        width: null,
        height: null,
        bytes: 0,
        uploadedAt: null,
        uploadedByUid: "",
        uploadedByName: "",
      }
    );
  },
};

export const weekConverter: FirestoreDataConverter<Week, DocumentData> = {
  toFirestore: withoutId,
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): Week {
    const d = snap.data(options) ?? {};
    // Older documents may lack season/week fields; the id carries both.
    const fromId = parseWeekId(snap.id);
    return {
      id: snap.id,
      season: num(d.season, fromId?.season ?? new Date().getFullYear()),
      week: num(d.week, fromId?.week ?? 1),
      stake: num(d.stake, 5),
      deadline: toDate(d.deadline),
      closed: bool(d.closed),
      closedAt: toDate(d.closedAt),
      createdAt: toDate(d.createdAt),
      note: str(d.note),
      ticketImage: readTicketImage(d.ticketImage),
      payoutOverride: typeof d.payoutOverride === "number" ? d.payoutOverride : null,
    };
  },
};

export const legConverter: FirestoreDataConverter<Leg, DocumentData> = {
  toFirestore: withoutId,
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): Leg {
    const d = snap.data(options) ?? {};

    /*
     * Author resolution across three generations of document:
     *   - current:  an explicit `uid` field
     *   - legacy member leg: document id IS the author's uid, and `createdBy`
     *     matches it
     *   - legacy admin-entered leg: auto-generated id with `createdBy` set to
     *     the *admin* who typed it in. Attributing it to that admin would be
     *     wrong, so it gets no uid and is grouped by name instead.
     */
    const explicitUid = str(d.uid);
    const createdBy = str(d.createdBy);
    const uid = explicitUid || (createdBy && createdBy === snap.id ? snap.id : "");

    return {
      id: snap.id,
      uid,
      memberName: str(d.memberName),
      leg: str(d.leg),
      odds: parseAmerican(d.odds),
      result: legResult(d.result),
      season: typeof d.season === "number" ? d.season : null,
      week: typeof d.week === "number" ? d.week : null,
      createdAt: toDate(d.createdAt),
      updatedAt: toDate(d.updatedAt),
      gradedByUid: str(d.gradedByUid) || null,
      gradedAt: toDate(d.gradedAt),
    };
  },
};

export const joinRequestConverter: FirestoreDataConverter<JoinRequest, DocumentData> = {
  toFirestore: (request) => ({ ...request }),
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): JoinRequest {
    const d = snap.data(options) ?? {};
    return {
      uid: str(d.requesterUid, snap.id),
      displayName: str(d.displayName) || str(d.email) || snap.id,
      email: str(d.email),
      providedCode: str(d.providedCode),
      createdAt: toDate(d.createdAt),
    };
  },
};

export const inviteCodeConverter: FirestoreDataConverter<InviteCode, DocumentData> = {
  toFirestore: (invite) => ({ ...invite }),
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): InviteCode {
    const d = snap.data(options) ?? {};
    return {
      code: str(d.code, snap.id),
      leagueId: str(d.leagueId),
      leagueName: str(d.leagueName),
      active: bool(d.active, true),
    };
  },
};
