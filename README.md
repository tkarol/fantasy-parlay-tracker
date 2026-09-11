# Fantasy Parlay Tracker

Run a weekly group parlay with your friends. One shared ticket per week, one
leg each, live odds and payout, and season-long bragging rights.

React 19 · TypeScript · Vite · Tailwind · Firebase (Auth, Firestore, Storage)

---

## How it works

Each week the league puts one stake on one ticket. Every member contributes a
single leg with its price. If all legs land, the group wins; one loss kills it.

- **Members** add and edit their own leg, with odds, until the week's deadline.
- **Admins** grade each leg, set the stake and deadline, upload a screenshot of
  the real ticket, close the week, and approve join requests.
- **Everyone** sees the ticket update live, plus season stats: hit rates,
  streaks, real group P&L, and who alone broke an otherwise-winning ticket.

### Settlement rules

Legs settle the way a sportsbook settles them:

| Situation | Result |
|---|---|
| Every counting leg wins | Ticket wins, paid at the combined price |
| Any leg loses | Ticket loses immediately, even with legs still pending |
| A leg pushes or is voided | **That leg is removed and the rest re-priced** |
| Every leg pushes | Ticket pushes, stake returned |

The push rule is the one that most often gets implemented wrong: a push does
not stay in the odds product, and it does not make the whole ticket a push.

Admins can record an **actual payout** when the book returns something other
than the calculated price (boosts, promos, corrections). That figure then
drives the season P&L.

---

## Getting started

```bash
npm install
cp .env.example .env     # fill in from Firebase console → Project settings
npm run dev
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then production build |
| `npm run typecheck` | `tsc -b` only |
| `npm run lint` | ESLint |
| `npm test` | Vitest (domain logic) |
| `npm run emulators` | Local Auth + Firestore + Storage emulators |
| `npm run seed` | Seed the emulators with a realistic league |
| `npm run dev:emulated` | Dev server pointed at the emulators |
| `npm run deploy` | Build and deploy hosting + rules |
| `npm run deploy:rules` | Deploy only Firestore/Storage rules and indexes |

### Local development against emulators

Nothing touches the real project, and you can exercise the security rules:

```bash
npm run emulators      # terminal 1
npm run seed           # terminal 2 — creates a league with six graded weeks
npm run dev:emulated   # terminal 3
```

The seeded league covers every settlement case: a clean win, a ticket broken by
one member, a multi-loss ticket, a push that re-prices the rest, a leg with no
recorded odds, and a live week still taking legs. In emulator mode the navbar
shows an email sign-in box (a Google popup can't complete against the Auth
emulator) — use `ann@example.test` / `password` for an admin.

---

## Data model

```
leagues/{leagueId}                   name, ownerUid, inviteCode, memberUids[], defaultStake
  members/{uid}                      role: admin | member, displayName, email
  weeks/{season}-{week}              stake, deadline, closed, ticketImage, payoutOverride
    legs/{uid}                       leg, odds, result, memberName
  joinRequests/{uid}                 pending access requests
inviteCodes/{CODE}                   public code → leagueId lookup
```

A leg's document id **is** the member's uid, so "one leg per member per week" is
structural rather than enforced by a check.

Invite codes live in their own collection so someone who isn't in a league yet
can resolve a code without being able to read leagues.

---

## Security

Rules live in `firestore.rules` and `storage.rules` and are deployed with
`npm run deploy:rules`. In summary:

- League contents are visible to members only.
- A member may write **only their own leg**, **only** on an open pre-deadline
  week, and **can never set their own result** — no self-grading.
- Admins grade legs, manage weeks, and approve members.
- The league owner cannot be demoted or removed by another admin.
- Listing leagues is constrained to the caller's own leagues.

**Storage caveat, by design:** Storage rules cannot query Firestore, so league
membership is not checkable there. Ticket uploads are namespaced by uploader
uid and capped by size and content type, and an upload stays inert until an
admin points the week document at it — and *that* write is admin-gated by
`firestore.rules`. The worst a signed-in non-member can do is store an image in
a folder nobody reads.

The Firebase web config in `.env` is not a secret; access is enforced by the
rules above. `.env` is gitignored regardless.

---

## Upgrading an existing league

Data written by earlier versions is read through tolerant converters — missing
fields fall back to sane defaults, and legs written before the `uid` field
existed are attributed by document id. One caveat worth knowing:

- Legs added by an admin *on behalf of* a member in the old version recorded the
  **admin's** uid in `createdBy`. Crediting the admin would corrupt the
  leaderboard, so those legs are grouped by member name instead. They appear
  under that name rather than merged into the member's account.

Leagues created before the `inviteCodes` collection existed are repaired
automatically: an admin opening **League settings** once backfills the document.
Until then the existing invite code won't let new people join. Rotating the code
has the same effect.

---

## Project layout

```
src/
  lib/          pure domain logic — odds, parlay settlement, season stats
  types/        the models everything above the data layer speaks
  hooks/        Firestore subscriptions, auth, theme, ticking clock
  providers/    auth, theme and toast contexts
  components/
    ui/         buttons, cards, modals, toasts, empty and error states
    tracker/    the weekly ticket
    stats/      leaderboard, charts, history
  routes/       pages
scripts/        emulator seeding
```

`src/lib` has no Firebase imports beyond type conversion, so the settlement and
stats logic is tested as plain functions — see `npm test`.

---

## Notes

This tracks wagers people have already agreed to among themselves. It does not
place bets, hold money, or connect to a sportsbook.
