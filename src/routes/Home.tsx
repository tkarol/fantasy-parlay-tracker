import { Navigate } from "react-router-dom";
import { Button, ButtonLink, Card, CardBody, Badge } from "../components/ui";
import { useAuth } from "../hooks/useAuth";

const FEATURES = [
  {
    title: "One ticket, one leg each",
    body: "Everyone adds a pick with its price. The combined odds and payout update live as legs land.",
  },
  {
    title: "Graded, not guessed",
    body: "Admins grade each leg. A push voids that leg and re-prices the rest, exactly like the book does.",
  },
  {
    title: "Receipts",
    body: "Upload a screenshot of the real ticket so there's no arguing about what was actually placed.",
  },
  {
    title: "Season-long blame",
    body: "Hit rates, streaks, and a running tally of who alone broke an otherwise-winning ticket.",
  },
];

export default function Home() {
  const { user, signIn, loading } = useAuth();

  // Signed-in users have no reason to see the pitch.
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="mx-auto max-w-screen-lg px-4 py-10 sm:px-6 sm:py-16">
      <section className="text-center">
        <Badge tone="neutral">Weekly group parlays</Badge>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Build one parlay together.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-ink-muted sm:text-lg">
          Every member adds a leg to a single weekly ticket. The app handles the odds, the payout,
          and the bragging rights.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {user ? (
            <>
              <ButtonLink to="/dashboard" variant="primary" size="lg">
                Go to your leagues
              </ButtonLink>
              <ButtonLink to="/create" size="lg">
                Create a league
              </ButtonLink>
            </>
          ) : (
            <Button variant="primary" size="lg" onClick={() => void signIn()} loading={loading}>
              Sign in with Google
            </Button>
          )}
        </div>
      </section>

      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <CardBody>
              <h2 className="text-sm font-semibold text-ink">{feature.title}</h2>
              <p className="mt-1 text-sm text-ink-muted">{feature.body}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-ink-faint">
        For tracking friendly wagers among people who already agreed to them. It doesn't place bets
        or move money.
      </p>
    </div>
  );
}
