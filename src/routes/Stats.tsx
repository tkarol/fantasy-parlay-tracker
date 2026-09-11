import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, EmptyState, SkeletonText, Stat } from "../components/ui";
import { ProfitChart } from "../components/stats/ProfitChart";
import { Leaderboard } from "../components/stats/Leaderboard";
import { WeekHistory } from "../components/stats/WeekHistory";
import { BustBoard } from "../components/stats/BustBoard";
import { SeasonCompare, MemberSeasonCompare } from "../components/stats/SeasonCompare";
import { AllTime } from "../components/stats/AllTime";
import { useLeagueContext } from "../hooks/useLeagueContext";
import { useLegsByWeek } from "../hooks/useLegs";
import {
  buildAllTimeRecord,
  buildTickets,
  compareSeasons,
  formatStreak,
} from "../lib/stats";
import { formatPercent, formatUsd, formatUsdSigned } from "../lib/odds";
import { cn } from "../lib/cn";

type View = { kind: "season"; season: number } | { kind: "all" };

export default function Stats() {
  const { leagueId, weeks, weeksLoading, members, seasons } = useLeagueContext();
  const [view, setView] = useState<View | null>(null);

  // Memoised: a fresh object here would change identity every render and
  // defeat every useMemo below it.
  const activeView = useMemo<View>(
    () => view ?? (seasons[0] !== undefined ? { kind: "season", season: seasons[0] } : { kind: "all" }),
    [view, seasons],
  );

  const previousSeason = useMemo(() => {
    if (activeView.kind !== "season") return null;
    const index = seasons.indexOf(activeView.season);
    return index >= 0 ? (seasons[index + 1] ?? null) : null;
  }, [activeView, seasons]);

  /*
   * Only subscribe to the weeks actually on screen. A season view needs the
   * comparison season too; the career view needs everything. Loading every
   * week of every season up front would mean one listener per week forever.
   */
  const weekIds = useMemo(() => {
    if (activeView.kind === "all") return weeks.map((week) => week.id);
    return weeks
      .filter(
        (week) =>
          week.season === activeView.season ||
          (previousSeason !== null && week.season === previousSeason),
      )
      .map((week) => week.id);
  }, [weeks, activeView, previousSeason]);

  const { legsByWeek, loading: legsLoading } = useLegsByWeek(leagueId ?? undefined, weekIds);

  const tickets = useMemo(() => {
    const scoped = weeks.filter((week) => weekIds.includes(week.id));
    return buildTickets(scoped, legsByWeek);
  }, [weeks, weekIds, legsByWeek]);

  const comparison = useMemo(
    () =>
      activeView.kind === "season"
        ? compareSeasons(tickets, activeView.season, previousSeason, members)
        : null,
    [tickets, activeView, previousSeason, members],
  );

  const allTime = useMemo(
    () => (activeView.kind === "all" ? buildAllTimeRecord(tickets, members) : null),
    [tickets, activeView, members],
  );

  if (weeksLoading) {
    return (
      <Shell>
        <Card>
          <CardBody>
            <SkeletonText lines={6} />
          </CardBody>
        </Card>
      </Shell>
    );
  }

  if (weeks.length === 0) {
    return (
      <Shell>
        <Card>
          <EmptyState
            icon="📊"
            title="Nothing to show yet"
            description="Stats appear once a week has been played and graded."
          />
        </Card>
      </Shell>
    );
  }

  const loading = legsLoading;

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Stats view" className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2 p-0.5">
          {seasons.map((season) => {
            const active = activeView.kind === "season" && activeView.season === season;
            return (
              <button
                key={season}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setView({ kind: "season", season })}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-sm tnum transition",
                  active ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                )}
              >
                {season}
              </button>
            );
          })}
          {seasons.length > 1 && (
            <button
              role="tab"
              type="button"
              aria-selected={activeView.kind === "all"}
              onClick={() => setView({ kind: "all" })}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm transition",
                activeView.kind === "all"
                  ? "bg-surface font-medium text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              All time
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Card>
          <CardBody>
            <SkeletonText lines={6} />
          </CardBody>
        </Card>
      ) : allTime ? (
        <AllTime record={allTime} />
      ) : comparison ? (
        <>
          {comparison.previous && <SeasonCompare comparison={comparison} />}

          <Card>
            <CardHeader
              title={`${comparison.current.season} season`}
              description="What the group actually won or lost — one shared ticket per week."
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat
                  label="Profit"
                  value={formatUsdSigned(comparison.current.summary.profit)}
                  tone={
                    comparison.current.summary.profit > 0
                      ? "good"
                      : comparison.current.summary.profit < 0
                        ? "bad"
                        : "neutral"
                  }
                  hint={`${formatUsd(comparison.current.summary.totalStaked)} staked`}
                />
                <Stat
                  label="Tickets hit"
                  value={`${comparison.current.summary.ticketsWon}/${comparison.current.summary.ticketsWon + comparison.current.summary.ticketsLost}`}
                  hint={formatPercent(comparison.current.summary.hitRate)}
                />
                <Stat label="ROI" value={formatPercent(comparison.current.summary.roi, 1)} />
                <Stat
                  label="Streak"
                  value={formatStreak(comparison.current.summary.currentStreak)}
                  hint={`best W${comparison.current.summary.longestWinStreak}`}
                />
              </div>

              <ProfitChart points={comparison.current.summary.profitCurve} />

              {comparison.current.summary.ticketsPushed > 0 && (
                <p className="text-xs text-ink-faint">
                  {comparison.current.summary.ticketsPushed} ticket
                  {comparison.current.summary.ticketsPushed === 1 ? "" : "s"} pushed — stake
                  returned, so they're excluded from ROI.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Leaderboard" description="Per-member pick record. Tap a column to sort." />
            <CardBody>
              <Leaderboard members={comparison.current.members} />
            </CardBody>
          </Card>

          <MemberSeasonCompare comparison={comparison} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Hall of shame" description="Tickets broken by exactly one leg." />
              <CardBody>
                <BustBoard busts={comparison.current.busts} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Week by week" description="Every ticket this season." />
              <CardBody>
                <WeekHistory tickets={comparison.current.tickets} />
              </CardBody>
            </Card>
          </div>
        </>
      ) : null}

      <p className="px-1 text-xs text-ink-faint">
        Profit and ROI are the group's real money: one ticket, one stake per week. The
        leaderboard's <span className="font-medium">Solo P&amp;L</span> column is hypothetical —
        what each member's legs would have returned as individual bets — and never adds up to the
        group total.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-screen-xl space-y-4 px-3 py-5 sm:px-6">{children}</div>;
}
