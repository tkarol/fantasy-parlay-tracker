import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, ButtonLink, Card, CardBody, EmptyState, ErrorState, SkeletonText } from "../components/ui";
import { ParlayTracker } from "../components/tracker/ParlayTracker";
import { SeasonStats } from "../components/stats/SeasonStats";
import { useAuth } from "../hooks/useAuth";
import { useLeague } from "../hooks/useLeague";
import { useMembers } from "../hooks/useMembers";
import { useWeeks } from "../hooks/useWeeks";
import { cn } from "../lib/cn";

type Tab = "ticket" | "stats";

export default function League() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();
  const { league, isAdmin, isMember, loading, forbidden } = useLeague(leagueId, user?.uid);
  const { weeks, loading: weeksLoading, error: weeksError } = useWeeks(leagueId);
  const { members } = useMembers(leagueId);
  const [tab, setTab] = useState<Tab>("ticket");

  if (loading) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-6">
        <Card>
          <CardBody>
            <SkeletonText lines={6} />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (forbidden || (!league && !loading)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <EmptyState
            icon="🔒"
            title={forbidden ? "You're not in this league" : "League not found"}
            description={
              forbidden
                ? "Ask an admin for the invite code, then request access."
                : "The link may be wrong, or the league was deleted."
            }
            action={
              <>
                <ButtonLink to="/join" variant="primary">
                  Join with a code
                </ButtonLink>
                <ButtonLink to="/dashboard">Your leagues</ButtonLink>
              </>
            }
          />
        </Card>
      </div>
    );
  }

  if (!league || !leagueId) return null;

  return (
    <div className="mx-auto max-w-screen-2xl px-3 py-5 sm:px-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/dashboard" className="text-xs text-ink-muted hover:text-ink hover:underline">
            ← All leagues
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight text-ink sm:text-2xl">
            {league.name}
            {isAdmin && <Badge tone="brand">Admin</Badge>}
            {!isMember && <Badge tone="neutral">Viewer</Badge>}
          </h1>
        </div>

        {isAdmin && (
          <ButtonLink to={`/league/${leagueId}/settings`} size="sm">
            Settings
          </ButtonLink>
        )}
      </header>

      <div
        role="tablist"
        aria-label="League views"
        className="mb-4 inline-flex rounded-xl border border-line bg-surface-2 p-0.5"
      >
        {(
          [
            ["ticket", "This week"],
            ["stats", "Season"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm transition",
              tab === value ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {weeksError && tab === "ticket" ? (
        <ErrorState message="Couldn't load this league's weeks." />
      ) : tab === "ticket" ? (
        <ParlayTracker
          leagueId={leagueId}
          weeks={weeks}
          weeksLoading={weeksLoading}
          weeksError={weeksError}
          members={members}
          user={user}
          isAdmin={isAdmin}
          isMember={isMember}
          defaultStake={league.defaultStake}
        />
      ) : (
        <SeasonStats
          leagueId={leagueId}
          weeks={weeks}
          members={members}
          onSelectWeek={() => setTab("ticket")}
        />
      )}
    </div>
  );
}
