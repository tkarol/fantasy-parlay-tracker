import { isValidAmerican } from "./odds";

/**
 * Pulling a price out of text copied from a sportsbook.
 *
 * Nobody should retype a number that is already on their screen. The hard part
 * is that a pick line is full of numbers that are not prices — spreads, totals,
 * yardage, player props — so this only accepts a token that could not be
 * anything else.
 */

export interface ParsedPick {
  /** The description with the price removed. */
  leg: string;
  odds: number | null;
}

/**
 * A price is a whole number of at least 100 in magnitude, with an explicit
 * sign or wrapped in brackets. That rules out spreads (-3.5, -7), totals
 * (47.5) and prop lines (250.5 yards), which either carry a decimal or sit
 * below 100.
 */
const CANDIDATE = /([([])?\s*([+\-−–—])?\s*(\d+(?:\.\d+)?)\s*([)\]])?/g;

interface Candidate {
  value: number;
  start: number;
  end: number;
  bracketed: boolean;
  signed: boolean;
}

function candidates(text: string): Candidate[] {
  const found: Candidate[] = [];

  for (const match of text.matchAll(CANDIDATE)) {
    const [whole, open, sign, digits, close] = match;
    if (digits === undefined) continue;

    // A decimal is a line, never an American price.
    if (digits.includes(".")) continue;

    const bracketed = Boolean(open && close);
    const signed = Boolean(sign);
    // Unicode minus and the various dashes all mean negative here.
    const negative = sign === "-" || sign === "−" || sign === "–" || sign === "—";
    const value = negative ? -Number(digits) : Number(digits);

    if (!isValidAmerican(value)) continue;
    // An unsigned, unbracketed number is far more likely to be a total or a
    // jersey number than a price.
    if (!signed && !bracketed) continue;

    found.push({
      value,
      start: match.index,
      end: match.index + whole.length,
      bracketed,
      signed,
    });
  }

  return found;
}

/** Split a single pick line into its description and its price. */
export function parsePick(input: string): ParsedPick {
  const text = input.trim();
  if (!text) return { leg: "", odds: null };

  const found = candidates(text);
  if (found.length === 0) return { leg: text, odds: null };

  // A bracketed price is unambiguous; otherwise take the last one, since the
  // price is written after the selection.
  const chosen = found.filter((c) => c.bracketed).at(-1) ?? found.at(-1)!;

  const leg = `${text.slice(0, chosen.start)} ${text.slice(chosen.end)}`
    .replace(/\s+/g, " ")
    .replace(/[\s,;|@]+$/, "")
    .trim();

  return { leg: leg || text, odds: chosen.value };
}

export interface SlipLine extends ParsedPick {
  /** The original line, for showing the admin what was matched. */
  raw: string;
}

/**
 * Split a pasted slip into its lines.
 *
 * Books separate legs with newlines; blank lines and obvious boilerplate
 * ("PARLAY", "Total wager", "To win") are dropped so a straight copy-paste
 * works without tidying.
 */
const BOILERPLATE =
  /^(parlay|same game parlay|sgp|total (wager|stake|odds|payout)|to win|wager|stake|payout|odds|bet slip|cash out|\d+ leg parlay)\b/i;

export function parseSlip(input: string): SlipLine[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !BOILERPLATE.test(line))
    .map((raw) => ({ raw, ...parsePick(raw) }))
    // A line that is nothing but a price is a total, not a leg.
    .filter((line) => line.leg.length > 0 && line.leg !== String(line.odds));
}

/**
 * How well a slip line matches an existing leg, 0..1.
 *
 * Deliberately simple word overlap: the admin confirms every match before
 * anything is written, so a good-enough guess beats a clever one that is hard
 * to predict.
 */
export function matchScore(slipLine: string, legText: string): number {
  const words = (value: string) =>
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s.+-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 1),
    );

  const a = words(slipLine);
  const b = words(legText);
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;

  return shared / Math.max(a.size, b.size);
}
