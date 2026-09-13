/**
 * Who reacted, short enough to sit on a chip.
 *
 * A reaction is only worth anything if you can see who left it. Display names
 * come from Google and are usually "First Last", which is too long to sit on a
 * chip beside an emoji, so these shorten to first names and only reach for more
 * when that would be ambiguous.
 */

/** "Ann Alvarez" -> "Ann". Leaves a single-word name alone. */
function firstName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") return "Someone";
  return trimmed.split(/\s+/)[0]!;
}

function lastInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1]! : "";
  return last ? ` ${last[0]!.toUpperCase()}.` : "";
}

/**
 * Shorten each name as far as it can go while staying distinguishable from the
 * others in the same group — two Mikes on one leg become "Mike R." and
 * "Mike T." rather than "Mike, Mike".
 */
export function shortNames(names: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const name of names) {
    const first = firstName(name);
    counts.set(first, (counts.get(first) ?? 0) + 1);
  }

  return names.map((name) => {
    const first = firstName(name);
    if ((counts.get(first) ?? 0) < 2) return first;
    const disambiguated = first + lastInitial(name);
    // No surname to fall back on: the full name is the best available.
    return disambiguated === first ? name.trim() : disambiguated;
  });
}
