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
const SEASON = 2025;

const PEOPLE = [
  { key: "ann", name: "Ann Alvarez", role: "admin" },
  { key: "bo", name: "Bo Chen", role: "member" },
  { key: "cy", name: "Cy Donnelly", role: "member" },
  { key: "dave", name: "Dave Okafor", role: "member" },
];

/**
 * Six weeks covering every case the settlement logic has to handle:
 * a clean win, a solo bust, a multi-loss ticket, a push that re-prices the
 * rest, an unpriced leg, and a live week still taking legs.
 */
const WEEKS = [
  {
    week: 1, stake: 5, closed: true,
    legs: { ann: ["Bills -3.5", -110, "Win"], bo: ["Chiefs ML", -140, "Win"], cy: ["Over 47.5", -105, "Win"], dave: ["Lions +2.5", 120, "Win"] },
  },
  {
    week: 2, stake: 5, closed: true,
    // Dave alone breaks an otherwise perfect ticket.
    legs: { ann: ["Eagles -7", -120, "Win"], bo: ["Under 44", -110, "Win"], cy: ["Ravens ML", -160, "Win"], dave: ["Jets +6.5", 105, "Loss"] },
  },
  {
    week: 3, stake: 10, closed: true,
    legs: { ann: ["Cowboys -1", -115, "Loss"], bo: ["Over 51", -110, "Win"], cy: ["49ers -6", -130, "Loss"], dave: ["Packers ML", 140, "Win"] },
  },
  {
    week: 4, stake: 10, closed: true,
    // Bo's leg pushes and is removed from the price entirely.
    legs: { ann: ["Dolphins -3", -110, "Win"], bo: ["Bengals -3", -110, "Push"], cy: ["Over 45.5", -108, "Win"], dave: ["Texans +1.5", 100, "Win"] },
  },
  {
    week: 5, stake: 10, closed: true,
    // Cy never recorded a price — the ticket can't be valued.
    legs: { ann: ["Rams ML", -125, "Win"], bo: ["Under 40.5", -115, "Win"], cy: ["Giants +7", null, "Win"], dave: ["Broncos -2", -110, "Loss"] },
  },
  {
    week: 6, stake: 10, closed: false, live: true,
    legs: { ann: ["Seahawks -4.5", -110, "Pending"], bo: ["Over 48", -105, "Pending"] },
  },
];

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

  for (const spec of WEEKS) {
    const weekId = `${SEASON}-${spec.week}`;
    // Week 1 locks on 4 Sep 2025, one week apart thereafter.
    const SEASON_START = Date.UTC(2025, 8, 4, 22, 0, 0);
    const deadline = spec.live
      ? new Date(Date.now() + 36 * 60 * 60 * 1000)
      : new Date(SEASON_START + (spec.week - 1) * 7 * 24 * 60 * 60 * 1000);

    await setDoc(`leagues/${LEAGUE_ID}/weeks/${weekId}`, {
      season: SEASON,
      week: spec.week,
      stake: spec.stake,
      deadline,
      closed: spec.closed,
      createdAt: new Date("2025-09-01T12:00:00Z"),
      ...(spec.closed ? { closedAt: deadline } : {}),
    });

    for (const [key, [text, odds, result]] of Object.entries(spec.legs)) {
      const uid = uids[key];
      await setDoc(`leagues/${LEAGUE_ID}/weeks/${weekId}/legs/${uid}`, {
        uid,
        memberName: PEOPLE.find((p) => p.key === key).name,
        leg: text,
        odds: odds === null ? "" : odds,
        result,
        season: SEASON,
        week: spec.week,
        createdBy: uid,
        createdAt: new Date("2025-09-02T12:00:00Z"),
        updatedAt: new Date("2025-09-02T12:00:00Z"),
      });
    }
  }

  // A legacy-shaped leg: no uid field, auto id, createdBy pointing at the
  // admin who typed it in. Exercises the back-compat path in the converters.
  await setDoc(`leagues/${LEAGUE_ID}/weeks/${SEASON}-3/legs/legacyAutoId01`, {
    memberName: "Old Teammate",
    leg: "Titans +3 (entered by admin)",
    odds: 110,
    result: "Loss",
    season: SEASON,
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
