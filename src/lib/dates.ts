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
 * The next occurrence of a given weekday and time, local to the viewer.
 * Defaults to Thursday 6pm — NFL kickoff, the league's usual lock.
 */
export function nextWeekday(
  weekday = 4,
  hour = 18,
  minute = 0,
  from: Date = new Date(),
): Date {
  const d = new Date(from);
  const delta = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function nextThursdaySixPm(from: Date = new Date()): Date {
  return nextWeekday(4, 18, 0, from);
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
