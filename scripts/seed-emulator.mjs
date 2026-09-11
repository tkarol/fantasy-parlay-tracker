/**
 * Seed the local Firestore + Auth emulators with a realistic league so the
 * whole app can be exercised without touching the real project.
 *
 *   npm run emulators          # in one terminal
 *   npm run seed               # in another
 *   VITE_USE_EMULATORS=true npm run dev
 *
 * Sign in with any seeded address below, password `password`.
 */

const PROJECT = process.env.FIREBASE_PROJECT ?? "fantasy-parlay-tracker";
const FIRESTORE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1`;

// The emulator accepts this bearer token as a rules bypass for admin seeding.
const HEADERS = { "Content-Type": "application/json", Authorization: "Bearer owner" };

function encode(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
  }
  throw new Error(`Cannot encode ${typeof value}`);
}

async function setDoc(path, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)]));
  const response = await fetch(`${FIRESTORE}/${path}`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
}

async function createUser(email, displayName) {
  const response = await fetch(`${AUTH}/accounts:signUp?key=fake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password", displayName, returnSecureToken: true }),
  });
  const body = await response.json();
  if (!response.ok) {
    // Re-running the seed should not fail on users that already exist.
    if (body?.error?.message?.includes("EMAIL_EXISTS")) {
      const signIn = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password", returnSecureToken: true }),
      });
      return (await signIn.json()).localId;
    }
    throw new Error(`${email}: ${JSON.stringify(body)}`);
  }
  return body.localId;
}

const LEAGUE_ID = "sunday-degenerates-seed";

const PEOPLE = [
  { key: "ann", name: "Ann Alvarez", role: "admin" },
  { key: "bo", name: "Bo Chen", role: "member" },
  { key: "cy", name: "Cy Donnelly", role: "member" },
  { key: "dave", name: "Dave Okafor", role: "member" },
];

const PICKS = [
  "Bills -3.5", "Chiefs ML", "Over 47.5", "Lions +2.5", "Eagles -7", "Under 44",
  "Ravens ML", "Jets +6.5", "Cowboys -1", "Over 51", "49ers -6", "Packers ML",
  "Dolphins -3", "Bengals -3", "Texans +1.5", "Rams ML", "Under 40.5", "Giants +7",
  "Broncos -2", "Seahawks -4.5", "Vikings -1.5", "Saints +3", "Bears ML", "Jaguars +4",
];

const ODDS = [-110, -140, -105, 120, -120, -115, -160, 105, 100, -130, 140, -108];

/**
 * Two seasons, shaped like the league's real history: a 2025 that ran twelve
 * weeks and then stopped, and a 2026 that has just started.
 *
 * Results are hand-specified rather than random so the figures on screen can be
 * checked against arithmetic. Each character is one member's result in PEOPLE
 * order - W win, L loss, P push, ? pending, "." not submitted.
 */
const SEASONS = [
  {
    season: 2025,
    stake: 5,
    weeks: [
      "WWWW", // 1  clean win
      "WWWL", // 2  Dave alone breaks it
      "LWLW", // 3  two losses, so blame is shared
      "WPWW", // 4  Bo pushes - that leg drops out and the rest re-price
      "WWWL", // 5  Dave again
      "WWWW", // 6  clean win
      "LWWW", // 7  Ann alone
      "WWLW", // 8  Cy alone
      "WWWW", // 9  clean win
      "WLWW", // 10 Bo alone
      "WWPW", // 11 Cy pushes, the rest win
      "WWWL", // 12 Dave alone - and then they stopped playing
    ],
  },
  {
    season: 2026,
    stake: 10,
    weeks: [
      "WWWW", // 1  strong start to the new year
      "WWLW", // 2  Cy alone
      "??..", // 3  live: only Ann and Bo are in so far
    ],
  },
];

const RESULT_BY_LETTER = { W: "Win", L: "Loss", P: "Push", "?": "Pending" };

async function main() {
  console.log(`Seeding ${PROJECT} emulators…`);

  const uids = {};
  for (const person of PEOPLE) {
    uids[person.key] = await createUser(`${person.key}@example.test`, person.name);
  }

  const ownerUid = uids.ann;

  await setDoc(`leagues/${LEAGUE_ID}`, {
    name: "Sunday Degenerates",
    ownerUid,
    ownerEmail: "ann@example.test",
    inviteCode: "SEED01",
    memberUids: PEOPLE.map((p) => uids[p.key]),
    defaultStake: 10,
    createdAt: new Date("2025-09-01T12:00:00Z"),
  });

  // Single-league deployment marker, so a non-member can find the league.
  await setDoc("appConfig/league", {
    leagueId: LEAGUE_ID,
    leagueName: "Sunday Degenerates",
  });

  await setDoc("inviteCodes/SEED01", {
    code: "SEED01",
    leagueId: LEAGUE_ID,
    leagueName: "Sunday Degenerates",
    active: true,
  });

  for (const person of PEOPLE) {
    await setDoc(`leagues/${LEAGUE_ID}/members/${uids[person.key]}`, {
      uid: uids[person.key],
      role: person.role,
      displayName: person.name,
      email: `${person.key}@example.test`,
      joinedAt: new Date("2025-09-01T12:00:00Z"),
    });
  }

  // Week 1 of each season locks in early September; each week is seven days on.
  const seasonStart = {
    2025: Date.UTC(2025, 8, 4, 22, 0, 0),
    2026: Date.UTC(2026, 8, 3, 22, 0, 0),
  };

  for (const { season, stake, weeks } of SEASONS) {
    for (let index = 0; index < weeks.length; index += 1) {
      const weekNumber = index + 1;
      const weekId = `${season}-${weekNumber}`;
      const letters = weeks[index];
      const live = letters.includes("?");

      const deadline = live
        ? new Date(Date.now() + 36 * 60 * 60 * 1000)
        : new Date(seasonStart[season] + index * 7 * 24 * 60 * 60 * 1000);

      await setDoc(`leagues/${LEAGUE_ID}/weeks/${weekId}`, {
        season,
        week: weekNumber,
        stake,
        deadline,
        closed: !live,
        createdAt: new Date(seasonStart[season] - 86_400_000),
        ...(live ? {} : { closedAt: deadline }),
      });

      for (let p = 0; p < PEOPLE.length; p += 1) {
        const letter = letters[p];
        // "." marks a member who simply has not submitted yet.
        if (!letter || letter === ".") continue;

        const person = PEOPLE[p];
        const uid = uids[person.key];
        // One 2025 leg was never priced, to exercise the unpriced path.
        const unpriced = season === 2025 && weekNumber === 7 && person.key === "cy";
        const legWritten = seasonStart[season] + index * 7 * 24 * 60 * 60 * 1000 - 3_600_000;

        await setDoc(`leagues/${LEAGUE_ID}/weeks/${weekId}/legs/${uid}`, {
          uid,
          memberName: person.name,
          leg: PICKS[(index * PEOPLE.length + p) % PICKS.length],
          odds: unpriced ? "" : ODDS[(index + p) % ODDS.length],
          result: RESULT_BY_LETTER[letter],
          season,
          week: weekNumber,
          createdBy: uid,
          createdAt: new Date(legWritten),
          updatedAt: new Date(legWritten),
        });
      }
    }
  }

  // A legacy-shaped leg: no uid field, auto id, createdBy pointing at the
  // admin who typed it in. Exercises the back-compat path in the converters.
  await setDoc(`leagues/${LEAGUE_ID}/weeks/2025-3/legs/legacyAutoId01`, {
    memberName: "Old Teammate",
    leg: "Titans +3 (entered by admin)",
    odds: 110,
    result: "Loss",
    season: 2025,
    week: 3,
    createdBy: ownerUid,
    createdAt: new Date("2025-09-16T12:00:00Z"),
  });

  // A pending join request for the settings screen.
  const petraUid = await createUser("petra@example.test", "Petra Novak");
  await setDoc(`leagues/${LEAGUE_ID}/joinRequests/${petraUid}`, {
    requesterUid: petraUid,
    displayName: "Petra Novak",
    email: "petra@example.test",
    providedCode: "SEED01",
    createdAt: new Date(),
  });

  console.log(`\nSeeded league: ${LEAGUE_ID}`);
  console.log("Sign in as any of:");
  for (const person of PEOPLE) {
    console.log(`  ${person.key}@example.test / password  (${person.role})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
