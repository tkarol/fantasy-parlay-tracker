/**
 * Application-level models. Firestore `Timestamp`s are converted to `Date` at
 * the data-access boundary (see `lib/converters.ts`) so everything above it —
 * including all pure domain logic — is plain, testable data.
 */

export type MemberRole = "admin" | "member";

/** A leg's graded outcome. `Void` is treated identically to `Push`. */
export type LegResult = "Win" | "Loss" | "Push" | "Void" | "Pending";

export const LEG_RESULTS: readonly LegResult[] = ["Pending", "Win", "Loss", "Push", "Void"];

/** Results that remove a leg from the ticket rather than settling it. */
export function isVoidingResult(result: LegResult): boolean {
  return result === "Push" || result === "Void";
}

export interface League {
  id: string;
  name: string;
  ownerUid: string;
  ownerEmail: string;
  inviteCode: string;
  memberUids: string[];
  /** Stake applied to newly created weeks. */
  defaultStake: number;
  /** When picks lock each week. Applied to newly created weeks. */
  deadlineWeekday: number;
  deadlineHour: number;
  deadlineMinute: number;
  /** IANA zone the deadline is anchored to, so it never drifts with DST. */
  deadlineTimeZone: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface Member {
  uid: string;
  role: MemberRole;
  displayName: string;
  email: string;
  photoURL: string | null;
  joinedAt: Date | null;
}

/**
 * A screenshot of the real sportsbook ticket.
 *
 * Held in its own Firestore document rather than Cloud Storage: Storage now
 * requires a billing plan, and — more usefully — Storage rules cannot read
 * Firestore, so they could never check league membership. Here they can.
 *
 * `src` is either a `data:` URL (current) or an https URL left over from the
 * Cloud Storage era.
 */
export interface TicketImage {
  src: string;
  width: number | null;
  height: number | null;
  /** Encoded size, for display and for keeping under the document limit. */
  bytes: number;
  uploadedAt: Date | null;
  uploadedByUid: string;
  uploadedByName: string;
}

export interface Week {
  /** `${season}-${week}` — stable and sortable within a season. */
  id: string;
  season: number;
  week: number;
  stake: number;
  deadline: Date | null;
  closed: boolean;
  closedAt: Date | null;
  createdAt: Date | null;
  note: string;
  ticketImage: TicketImage | null;
  /**
   * Actual amount the book returned, when it differs from the computed price
   * (boosts, promos, manual corrections). Total returned, not profit.
   */
  payoutOverride: number | null;
}

export interface Leg {
  /** Document id. For member-submitted legs this IS the member's uid. */
  id: string;
  uid: string;
  memberName: string;
  leg: string;
  /** American odds, or null when not yet priced. */
  odds: number | null;
  result: LegResult;
  season: number | null;
  week: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  gradedByUid: string | null;
  gradedAt: Date | null;
}

export interface JoinRequest {
  uid: string;
  displayName: string;
  email: string;
  providedCode: string;
  createdAt: Date | null;
}

export interface InviteCode {
  code: string;
  leagueId: string;
  leagueName: string;
  active: boolean;
}

/** The only reactions a leg accepts. Kept short so the row stays tappable. */
export const REACTION_EMOJI = ["🔥", "🎯", "😬", "💀", "🤡"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return REACTION_EMOJI.includes(value as ReactionEmoji);
}

export interface Reaction {
  legId: string;
  uid: string;
  name: string;
  emoji: ReactionEmoji;
}
