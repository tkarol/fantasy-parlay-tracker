# Fantasy Parlay Tracker

Run a weekly group parlay with your friends. One shared ticket per week, one
leg each, live odds and payout, and season-long bragging rights.

This is a **single-league app**: it serves one league, so there is no league
picker, no invite codes to type, and no dashboard to get through. Sign in and
you're looking at this week's ticket.

React 19 · TypeScript · Vite · Tailwind · Firebase (Auth, Firestore, Storage)

---

## How it works

Each week the league puts one stake on one ticket. Every member contributes a
single leg with its price. If all legs land, the group wins; one loss kills it.

- **Members** add and edit their own leg — the pick, and nothing else — until
  picks lock.
- **Admins** lock the picks when the bet is placed, price the legs off the real
  slip, grade each leg, set the stake, upload a screenshot of the ticket, close
  the week, and approve join requests.
- **Everyone** sees the ticket update live, plus season stats: hit rates,
  streaks, real group P&L, and who alone broke an otherwise-winning ticket.

### The journey

**Member:** sign in with Google → tap *Request access* once → an admin approves
→ every visit after that lands on this week's ticket with the leg form right
there: one box, their pick, done. Three places to go: **This week**, **Stats**,
and **Admin** for admins.

**Admin:** everything on one page — approve people, start a new season, manage
weeks, set stakes. Locking, grading and closing happen inline on the ticket
itself, where the legs are.

### Seasons

Weeks belong to a season (`2025-7` is week 7 of 2025), and a season is just a
field on the week — so seasons never need closing. A league that stops halfway
through a year simply has no more weeks for it.

Start the next year from **Admin → Seasons → Start a new season**. It opens week
1 of that year and leaves everything before it untouched. The stats page then
offers each season plus **All time**, and compares the current season against
the previous one: profit, ROI, tickets hit, weeks played, and each member's hit
rate against their own last season.

### When picks lock

By default a week has **no deadline**: it stays open until an admin presses
**Lock picks** on the week page — normally the moment the real bet is placed.
That is one button, in the same place as everything else the week needs, and it
is undone by **Reopen picks** just as easily.

A stored deadline is an absolute instant, not a rule that keeps being
re-evaluated, so a week written with the wrong one is not corrected by changing
the rule later. Manual locking sidesteps that entirely: there is nothing
scheduled, so nothing can be scheduled wrong. *Admin → Weeks → Remove lock*
clears a deadline a week is already carrying.

Leagues that would rather it happen on a timer can switch *Admin → League →
Picks lock* to **Automatically, every week** and pick the day and time —
**Sundays at 12:00 PM Eastern** by default, just before the 1pm kickoffs. New
weeks then open with that deadline already set, and *Admin → Weeks → Schedule …*
applies it to a single week.

Either way the lock is one mechanism: a `deadline` on the week document, which
the security rules enforce. Locking by hand simply sets it to the current
instant. The automatic rule is anchored to a named time zone rather than to
whoever creates the week, which matters twice over: an admin on a trip does not
move the league's deadline, and the season crosses the end of daylight saving —
noon Eastern is 16:00 UTC in September but 17:00 UTC in December, so the offset
is resolved per date instead of assumed.

### Who enters the odds

Members do not. They submit a pick and nothing else.

The price that matters is the one the book actually gave, and that is on the
slip the admin places — not on the screen a member was looking at when they
sent their pick in. Asking eight people for a number none of them could get
right produced legs that were wrong as often as missing, so the ask is gone.

Pricing happens once, after the bet is placed:

- **Paste slip** on the ticket takes the whole bet slip pasted as text and
  matches each line to a leg, filling every price in one go.
- A leg still without one shows a **Price** box on its own row, with the four
  prices almost every leg lands on one tap away.

Until then a leg is marked *No odds* and the ticket simply shows no price, and
the admin week bar says how many are still waiting. A member editing the wording
of their pick afterwards does not disturb a price already recorded.

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
| `npm run test:rules` | Security-rules tests (needs the emulator running) |
| `npm run emulators` | Local Auth + Firestore emulators |
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

The seeded league runs a full 2025 season of twelve weeks that then stops, plus
a 2026 season two weeks in with a third live — the same shape the real league
has. Between them they cover every settlement case: clean wins, a ticket broken
by one member, a multi-loss ticket, pushes that re-price the rest, a leg with no
recorded odds, and a legacy leg with no `uid`. In emulator mode the navbar
shows an email sign-in box (a Google popup can't complete against the Auth
emulator) — use `ann@example.test` / `password` for an admin.

---

## Deploying

`firebase deploy` pushes two things from this repo: the built site (`hosting`)
and the Firestore rules and indexes. There is nothing to deploy for Cloud
Storage — screenshots live in Firestore, so the project stays on the free plan.

### Continuous deployment (recommended)

Pushing to `main` builds and deploys automatically via
`.github/workflows/deploy.yml`. Pull requests run the same checks without
deploying. Every run typechecks, lints, runs the unit tests, runs the security
rules against a real Firestore emulator, and builds — so a change that weakens
the rules fails in CI rather than in production.

#### One-time setup

**1. Create a deploy service account.** In the Google Cloud console for the
project, go to *IAM & Admin → Service Accounts → Create service account*, name
it something like `github-deploy`, and grant it:

- **Firebase Hosting Admin** — to publish the site
- **Firebase Rules Admin** — to publish `firestore.rules`
- **Cloud Datastore Index Admin** — to publish `firestore.indexes.json`
- **Service Usage Consumer** — the CLI needs it to address the project

(*Firebase Admin* alone also works and is fewer clicks, but it is much broader
than a deploy job needs.)

Then *Keys → Add key → Create new key → JSON* and download it.

**2. Add two repository secrets** under *Settings → Secrets and variables →
Actions → New repository secret*:

| Secret | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | the entire contents of that JSON key file |
| `DOTENV` | the entire contents of your local `.env` |

`DOTENV` holds the Firebase web config. Those values are public — they ship in
the JavaScript bundle to every visitor, and access is enforced by
`firestore.rules`, not by hiding them. They live in a secret only because the
repository is the wrong place to keep build configuration, not because they are
sensitive.

**3. Push to `main`.** Watch it under the repository's *Actions* tab.

Treat the service account JSON as a real credential: it can publish to the
project. If it ever leaks, delete that key in the Cloud console and add a new
one.

### Deploying by hand

Not normally needed once CI is set up, but useful for the very first deploy or
if you want to push something without a commit.

1. **Create `.env`** from `.env.example` with your Firebase web config
   (console → Project settings → Your apps). The build fails if it is missing
   or incomplete, rather than producing a bundle that white-screens on load.

2. **Deploy:**

   ```bash
   npm install
   firebase login
   npm run build && firebase deploy
   ```

3. **Sign in once as an admin.** That first visit records which league this
   deployment serves, which is what lets everyone else find it and request
   access.

4. **Approve your members** under Admin. Anyone who signs in before you do this
   sees "Waiting on an admin".

### Note on the sign-in domain

`authDomain` is not taken from `.env` when the app is being served from one of
the project's own Hosting domains — `src/lib/authDomain.ts` uses the domain
already in the address bar instead.

This is load-bearing, not tidiness. `signInWithRedirect` stashes its pending
state in browser storage keyed to `authDomain` and reads it back after bouncing
through Google. With the stock config the app is served from `.web.app` while
`authDomain` is `.firebaseapp.com`, so that write and that read land in two
different storage partitions on every browser that partitions third-party
storage — Safari by default since 16.1, Chrome with third-party cookies off.
Sign-in then dies with *"Unable to process request due to missing initial
state."*

iPhones hit it hardest, because they block pop-ups by default: the pop-up flow
is refused, the code falls back to a redirect, and the redirect is the broken
one. Both are factory settings, so it is close to every member rather than an
edge case.

Firebase Hosting serves `/__/auth/handler` on every domain in the project, so
using the domain being viewed keeps the handshake first-party and leaves
nothing to partition. `.env` still supplies the value for `localhost`.

**If you add a custom domain**, it needs the same treatment: add it to the
`hosted` list, to Firebase console → Authentication → Settings → Authorized
domains, and to the OAuth client's authorized redirect URIs (Google Cloud
console → APIs & Services → Credentials → the auto-created Web client) as
`https://<domain>/__/auth/handler`. Missing that last one fails sign-in with
`redirect_uri_mismatch`.

### Note on rules

If the project was previously in test mode, this is the first deploy that
actually restricts access. Members need a `members/{uid}` document in the
league to read anything — which the app has always written on approval, so
existing members are fine.

The `weeks` collection is ordered by season and week, which needs a composite
index. `firestore.indexes.json` declares it and the deploy creates it; a newly
created index takes a few minutes to build, and queries error until it is ready.

## Data model

```
leagues/{leagueId}                   name, ownerUid, memberUids[], defaultStake,
                                     autoDeadline + the weekly lock rule
  members/{uid}                      role: admin | member, displayName, email
  weeks/{season}-{week}              season, week, stake, closed, payoutOverride,
                                     deadline (absent while picks are open)
    legs/{uid}                       leg, odds, result, memberName
    media/ticket                     screenshot of the real ticket
  joinRequests/{uid}                 pending access requests
appConfig/league                     which league this deployment serves
inviteCodes/{CODE}                   legacy code → leagueId lookup
```

The schema still supports many leagues — the app just serves one. Which one is
resolved in order: `VITE_LEAGUE_ID` if set, then the `appConfig/league`
document, then whichever league the signed-in user belongs to. An admin's first
visit writes `appConfig/league` automatically, so **no configuration is
required**; that document is what lets someone who isn't a member yet find the
league to ask to join.

A leg's document id **is** the member's uid, so "one leg per member per week" is
structural rather than enforced by a check.

---

## Security

Rules live in `firestore.rules` and are deployed with `npm run deploy:rules`.
In summary:

- League contents are visible to members only.
- A member may write **only their own leg**, **only** on a week that is open
  and unlocked, and **can never set their own result** — no self-grading. A
  week with no `deadline` field is unlocked; locking sets it to that instant.
- Admins grade legs, manage weeks, and approve members.
- The league owner cannot be demoted or removed by another admin.
- Listing leagues is constrained to the caller's own leagues.
- `appConfig/league` is readable by any signed-in user but writable only by an
  admin of the league it names — otherwise anyone could repoint the deployment
  at a league of their own.
- The ticket screenshot is written only by a league admin and read only by its
  members, with a size cap enforced in the rules.

**Ticket screenshots are stored in Firestore, not Cloud Storage.** Storage
requires a billing plan, and its rules cannot read Firestore — so they could
never tell a league admin from any signed-in stranger. In Firestore that check
is direct: only an admin of the league can write the image, and only its
members can read it.

The cost is Firestore's 1 MiB document limit. The browser resizes and
re-encodes before saving, stepping quality down and then dimensions until the
image fits, so a 5 MB phone screenshot lands around 200 KB. The image is kept
in its own document under the week (`weeks/{weekId}/media/ticket`) so that
subscribing to a whole season never pulls image bytes for weeks nobody is
looking at.

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

Leagues created before this version are picked up automatically — an admin's
first visit records the league in `appConfig/league`, and from then on new
members can find it and request access without a code.

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
    stats/      leaderboard, charts, history, season comparison
    admin/      seasons and member management
  routes/       This week, Stats, Admin
scripts/        emulator seeding
```

`src/lib` has no Firebase imports beyond type conversion, so the settlement and
stats logic is tested as plain functions — see `npm test`.

---

## Notes

This tracks wagers people have already agreed to among themselves. It does not
place bets, hold money, or connect to a sportsbook.
