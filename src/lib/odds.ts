/**
 * American odds helpers.
 *
 * Every function returns `null` rather than a silent fallback when the input
 * is not usable. The previous implementation returned decimal `1` for missing
 * odds, which made an unpriced leg look like a legitimate 1.00 multiplier and
 * quietly understated the whole ticket.
 */

/** American odds are invalid between -100 and +100 exclusive, and at 0. */
export function isValidAmerican(odds: unknown): odds is number {
  const n = Number(odds);
  if (odds === null || odds === undefined || odds === "") return false;
  if (!Number.isFinite(n)) return false;
  return n >= 100 || n <= -100;
}

/** Coerce loose input (string from a form, legacy `""`) to odds or null. */
export function parseAmerican(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  const raw = typeof input === "string" ? input.trim().replace(/^\+/, "") : input;
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return isValidAmerican(n) ? n : null;
}

/** +150 -> 2.5, -200 -> 1.5. Returns null for unusable odds. */
export function americanToDecimal(odds: unknown): number | null {
  if (!isValidAmerican(odds)) return null;
  const n = Number(odds);
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

/** 2.5 -> +150, 1.5 -> -200. Returns null for decimals at or below evens. */
export function decimalToAmerican(dec: number): number | null {
  if (!Number.isFinite(dec) || dec <= 1) return null;
  const profit = dec - 1;
  return profit >= 1 ? Math.round(profit * 100) : Math.round(-100 / profit);
}

/** Break-even win probability implied by the price, as a 0..1 fraction. */
export function impliedProbability(odds: unknown): number | null {
  const dec = americanToDecimal(odds);
  return dec === null ? null : 1 / dec;
}

/** Display form with an explicit sign: `+150`, `-200`, `—` when unknown. */
export function formatAmerican(odds: number | null | undefined): string {
  if (odds === null || odds === undefined || !Number.isFinite(odds)) return "—";
  return odds > 0 ? `+${Math.round(odds)}` : `${Math.round(odds)}`;
}

/** Round to cents, avoiding the classic 1.005 float drift. */
export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** `$12.34`, `-$5.00`. */
export function formatUsd(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  const v = round2(x);
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
}

/** `+$12.34` / `-$5.00` — for P&L columns where the sign carries meaning. */
export function formatUsdSigned(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  const v = round2(x);
  if (v === 0) return "$0.00";
  return `${v < 0 ? "-" : "+"}$${Math.abs(v).toFixed(2)}`;
}

export function formatPercent(fraction: number | null | undefined, digits = 0): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(digits)}%`;
}
