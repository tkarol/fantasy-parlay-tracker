import { Card, CardBody, EmptyState, ButtonLink, Badge, Skeleton } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useUserLeagues } from "../hooks/useUserLeagues";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { leagues, loading } = useUserLeagues(user?.uid);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-screen-lg px-4 py-10">
        <Card>
          <EmptyState
            icon="🔒"
            title="Sign in to see your leagues"
            description="Use the sign-in button in the top right."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-lg px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Your leagues</h1>
          <p className="mt-1 text-sm text-ink-muted">Open a league to add your leg or check the board.</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink to="/create" variant="primary" size="sm">
            Create
          </ButtonLink>
          <ButtonLink to="/join" size="sm">
            Join
          </ButtonLink>
        </div>
      </header>

      {loading ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <li key={index}>
              <Card>
                <CardBody className="space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      ) : leagues.length === 0 ? (
        <Card>
          <EmptyState
            icon="🏈"
            title="No leagues yet"
            description="Create one and share the invite code, or join with a code a friend sent you."
            action={
              <>
                <ButtonLink to="/create" variant="primary">
                  Create a league
                </ButtonLink>
                <ButtonLink to="/join">Join with a code</ButtonLink>
              </>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map((league) => (
            <li key={league.id}>
              <Link
                to={`/league/${league.id}`}
                className="group block h-full rounded-2xl border border-line bg-surface shadow-sm transition hover:border-ink/20 hover:shadow-md"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 truncate font-semibold text-ink">{league.name}</h2>
                    <Badge tone={league.relation === "owner" ? "brand" : "neutral"}>
                      {league.relation === "owner" ? "Owner" : "Member"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">
                    {league.memberUids.length} member{league.memberUids.length === 1 ? "" : "s"}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-ink">
                    Open
                    <span aria-hidden className="transition group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
