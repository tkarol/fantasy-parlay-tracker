import { Timestamp } from "firebase/firestore";

/** Anything Firestore or a form might hand us for a date. */
export type DateLike = Date | Timestamp | { seconds: number } | string | number | null | undefined;

/** Normalise any stored date representation to a `Date`, or null. */
export function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  const parsed = new Date(value as string | number);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/**
 * When picks lock.
 *
 * Anchored to a named time zone rather than the viewer's, because an NFL
 * deadline belongs to the games, not to whoever happened to create the week.
 * The season also runs across the end of daylight saving — noon Eastern is
 * 16:00 UTC in September and 17:00 UTC in December — so the offset has to be
 * resolved per date instead of assumed.
 */
export interface DeadlineRule {
  /** 0 = Sunday. */
  weekday: number;
  hour: number;
  minute: number;
  /** IANA zone, e.g. "America/New_York". */
  timeZone: string;
}

/** Noon Eastern on Sunday, just before the 1pm kickoffs. */
export const DEFAULT_DEADLINE_RULE: DeadlineRule = {
  weekday: 0,
  hour: 12,
  minute: 0,
  timeZone: "America/New_York",
};

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** How far the zone is from UTC at a given instant, in milliseconds. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  // Some engines render midnight as hour 24.
  const hour = value("hour") % 24;
  const wallClock = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    hour,
    value("minute"),
    value("second"),
  );
  return wallClock - instant;
}

/**
 * The instant at which a given wall-clock time occurs in a zone.
 *
 * Resolved twice: the first offset is looked up using the wall time as if it
 * were UTC, which lands on the wrong side of a DST change for times near the
 * boundary. The second pass uses the corrected instant.
 */
export function zonedTimeToInstant(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wallClock = Date.UTC(year, monthIndex, day, hour, minute);
  const firstPass = wallClock - zoneOffsetMs(wallClock, timeZone);
  return new Date(wallClock - zoneOffsetMs(firstPass, timeZone));
}

/** The calendar date and weekday an instant falls on, in a given zone. */
function zonedDateParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(value("year")),
    monthIndex: Number(value("month")) - 1,
    day: Number(value("day")),
    weekday: Math.max(0, SHORT_WEEKDAYS.indexOf(value("weekday"))),
  };
}

/** The next time the deadline comes round, strictly after `from`. */
export function nextDeadline(
  rule: DeadlineRule = DEFAULT_DEADLINE_RULE,
  from: Date = new Date(),
): Date {
  const { year, monthIndex, day, weekday } = zonedDateParts(from, rule.timeZone);
  const daysAhead = (rule.weekday - weekday + 7) % 7;

  // Date.UTC normalises a day number past the end of the month.
  const candidate = zonedTimeToInstant(
    year,
    monthIndex,
    day + daysAhead,
    rule.hour,
    rule.minute,
    rule.timeZone,
  );
  if (candidate.getTime() > from.getTime()) return candidate;

  return zonedTimeToInstant(
    year,
    monthIndex,
    day + daysAhead + 7,
    rule.hour,
    rule.minute,
    rule.timeZone,
  );
}

/** "Sundays at 12:00 PM ET" — how the rule reads in the admin panel. */
export function describeDeadlineRule(rule: DeadlineRule, on: Date = new Date()): string {
  const time = new Intl.DateTimeFormat(undefined, {
    timeZone: rule.timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(zonedTimeToInstant(2026, 0, 4, rule.hour, rule.minute, rule.timeZone));

  const zone =
    new Intl.DateTimeFormat("en-US", { timeZone: rule.timeZone, timeZoneName: "short" })
      .formatToParts(on)
      .find((part) => part.type === "timeZoneName")?.value ?? rule.timeZone;

  return `${WEEKDAY_NAMES[rule.weekday] ?? "Sunday"}s at ${time} ${zone}`;
}

/** Value for an `<input type="datetime-local">`, which expects local time. */
export function toDateTimeLocalValue(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function formatDateTime(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** `2d 4h`, `3h 12m`, `45s`, or `—`. Used for the deadline countdown. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  const abs = Math.abs(ms);
  const s = Math.floor(abs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** `in 3h 12m` / `2d ago`. */
export function formatRelative(date: Date | null, now: Date = new Date()): string {
  if (!date) return "—";
  const delta = date.getTime() - now.getTime();
  const text = formatDuration(delta);
  return delta >= 0 ? `in ${text}` : `${text} ago`;
}
