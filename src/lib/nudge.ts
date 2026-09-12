import { formatDuration } from "./dates";
import type { Leg, Member, Week } from "../types/models";

/**
 * Chasing people for their pick is the thing that actually stalls a weekly
 * league, so the app writes the message rather than making the admin do it.
 */

export function membersMissingLegs(
  members: readonly Member[],
  legs: readonly Leg[],
): Member[] {
  const submitted = new Set(legs.map((leg) => leg.uid).filter(Boolean));
  return members.filter((member) => !submitted.has(member.uid));
}

/** "Ann, Bo and Cy" — an actual sentence, not a comma-joined list. */
export function formatNameList(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export interface NudgeOptions {
  week: Week;
  missing: readonly Member[];
  now: Date;
  url: string;
  leagueName?: string;
}

/**
 * The message an admin pastes into the group chat. Written to be read on a
 * phone: who it's aimed at, how long they have, and where to go.
 */
export function buildNudgeMessage({
  week,
  missing,
  now,
  url,
  leagueName,
}: NudgeOptions): string {
  const names = formatNameList(missing.map((member) => member.displayName));
  const header = leagueName ? `${leagueName} — week ${week.week}` : `Week ${week.week}`;

  if (missing.length === 0) {
    return `${header}: everyone's in. ${url}`;
  }

  const remaining = week.deadline ? week.deadline.getTime() - now.getTime() : null;
  const timing =
    remaining === null
      ? ""
      : remaining <= 0
        ? " Picks are closed."
        : ` Locks in ${formatDuration(remaining)}.`;

  const verb = missing.length === 1 ? "a pick" : "picks";
  return `${header}: still need ${verb} from ${names}.${timing} ${url}`;
}

/**
 * A repeating calendar event for the weekly deadline.
 *
 * Members add it once and their own phone reminds them from then on. Real push
 * notifications would need a server, and this covers most of the same ground
 * for nothing.
 */
export function buildDeadlineCalendar(week: Week, url: string, leagueName: string): string {
  const deadline = week.deadline;
  if (!deadline) throw new Error("This week has no deadline to remind you about.");

  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  // Fold long lines at 75 octets, as iCalendar requires.
  const fold = (line: string): string => {
    if (line.length <= 75) return line;
    const parts = [line.slice(0, 75)];
    let rest = line.slice(75);
    while (rest.length > 74) {
      parts.push(` ${rest.slice(0, 74)}`);
      rest = rest.slice(74);
    }
    if (rest) parts.push(` ${rest}`);
    return parts.join("\r\n");
  };

  const escape = (text: string) => text.replace(/([\\,;])/g, "\\$1").replace(/\n/g, "\\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fantasy Parlay Tracker//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:parlay-deadline-${week.season}@fantasy-parlay-tracker`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(deadline)}`,
    `DURATION:PT15M`,
    "RRULE:FREQ=WEEKLY",
    `SUMMARY:${escape(`${leagueName} — parlay pick due`)}`,
    `DESCRIPTION:${escape(`Add your leg to this week's ticket: ${url}`)}`,
    `URL:${escape(url)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape("Parlay pick due in 2 hours")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(fold).join("\r\n");
}
