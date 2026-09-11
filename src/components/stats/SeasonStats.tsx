import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Select, SkeletonText, Stat } from "../ui";
import { ProfitChart } from "./ProfitChart";
import { Leaderboard } from "./Leaderboard";
import { WeekHistory } from "./WeekHistory";
import { BustBoard } from "./BustBoard";
import { useLegsByWeek } from "../../hooks/useLegs";
import { buildLeaderboard, buildTickets, formatStreak, summarizeSeason } from "../../lib/stats";
import { formatPercent, formatUsd, formatUsdSigned } from "../../lib/odds";
import type { Member, Week } from "../../types/models";

export function SeasonStats({
  leagueId,
  weeks,
  members,
  onSelectWeek,
}: {
  leagueId: string;
  weeks: Week[];
  members: Member[];
  onSelectWeek?: (weekId: string) => void;
}) {
  const seasons = useMemo(
    () => [...new Set(weeks.map((week) => week.season))].sort((a, b) => b - a),
    [weeks],
  );
  const [season, setSeason] = useState<number | null>(null);
  const activeSeason = season ?? seasons[0] ?? null;

  const seasonWeeks = useMemo(
    () => weeks.filter((week) => week.season === activeSeason),
    [weeks, activeSeason],
  );

  const weekIds = useMemo(() => seasonWeeks.map((week) => week.id), [seasonWeeks]);
  const { legsByWeek, loading } = useLegsByWeek(leagueId, weekIds);

  const tickets = useMemo(
    () => buildTickets(seasonWeeks, legsByWeek),
    [seasonWeeks, legsByWeek],
  );
  const summary = useMemo(() => summarizeSeason(tickets), [tickets]);
  const { members: leaderboard, busts } = useMemo(
    () => buildLeaderboard(tickets, members),
    [tickets, members],
  );

  if (weeks.length === 0) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Season"
          description="What the group actually won or lost — one shared ticket per week."
          actions={
            seasons.length > 1 ? (
              <Select
                value={String(activeSeason ?? "")}
                onChange={(event) => setSeason(Number(event.target.value))}
                aria-label="Select season"
                className="w-auto"
              >
                {seasons.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            ) : undefined
          }
        />
        <CardBody className="space-y-4">
          {loading ? (
            <SkeletonText lines={4} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat
                  label="Profit"
                  value={formatUsdSigned(summary.profit)}
                  tone={summary.profit > 0 ? "good" : summary.profit < 0 ? "bad" : "neutral"}
                  hint={`${formatUsd(summary.totalStaked)} staked`}
                />
                <Stat
                  label="Tickets hit"
                  value={`${summary.ticketsWon}/${summary.ticketsWon + summary.ticketsLost}`}
                  hint={formatPercent(summary.hitRate)}
                />
                <Stat label="ROI" value={formatPercent(summary.roi, 1)} />
                <Stat
                  label="Streak"
                  value={formatStreak(summary.currentStreak)}
                  hint={`best W${summary.longestWinStreak}`}
                />
              </div>

              <ProfitChart points={summary.profitCurve} />

              {summary.ticketsPushed > 0 && (
                <p className="text-xs text-ink-faint">
                  {summary.ticketsPushed} ticket{summary.ticketsPushed === 1 ? "" : "s"} pushed —
                  stake returned, so they're excluded from ROI.
                </p>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Leaderboard"
          description="Per-member pick record. Tap a column to sort."
        />
        <CardBody>
          {loading ? <SkeletonText lines={4} /> : <Leaderboard members={leaderboard} />}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Hall of shame"
            description="Tickets broken by exactly one leg."
          />
          <CardBody>{loading ? <SkeletonText lines={3} /> : <BustBoard busts={busts} />}</CardBody>
        </Card>

        <Card>
          <CardHeader title="Week by week" description="Every ticket this season." />
          <CardBody>
            {loading ? <SkeletonText lines={3} /> : <WeekHistory tickets={tickets} onSelectWeek={onSelectWeek} />}
          </CardBody>
        </Card>
      </div>

      <p className="px-1 text-xs text-ink-faint">
        Profit and ROI above are the group's real money: one ticket, one stake per week. The
        leaderboard's <span className="font-medium">Solo P&amp;L</span> column is hypothetical — what
        each member's legs would have returned as individual bets — and never adds up to the
        group total.
      </p>
    </div>
  );
}
