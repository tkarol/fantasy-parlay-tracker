export function makeInviteCode(len = 6) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
  }
  // simple, readable league id
  export function makeLeagueId(name = "") {
    const base = (name || "league")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${base || "league"}-${suffix}`;
  }
  