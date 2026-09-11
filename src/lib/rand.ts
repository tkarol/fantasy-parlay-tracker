/** Ambiguous glyphs (0/O, 1/I/L) are excluded — codes get read aloud. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomInts(count: number): Uint32Array {
  const out = new Uint32Array(count);
  // crypto is available in every browser this app targets; the fallback keeps
  // the function usable in a plain node context (scripts, tests).
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < count; i += 1) out[i] = Math.floor(Math.random() * 0xffffffff);
  return out;
}

export function makeInviteCode(length = 6): string {
  const values = randomInts(length);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[values[i]! % CODE_ALPHABET.length];
  }
  return code;
}

/** Readable, collision-resistant league id derived from the name. */
export function makeLeagueId(name: string): string {
  const base = (name || "league")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const suffix = makeInviteCode(4).toLowerCase();
  return `${base || "league"}-${suffix}`;
}

export function weekId(season: number, week: number): string {
  return `${season}-${week}`;
}

/** Inverse of `weekId`; returns null for an id that isn't season-week shaped. */
export function parseWeekId(id: string): { season: number; week: number } | null {
  const match = /^(\d{4})-(\d{1,2})$/.exec(id);
  if (!match) return null;
  return { season: Number(match[1]), week: Number(match[2]) };
}
