import { Card, CardBody, CardHeader, Stat } from "../ui";
import { Leaderboard } from "./Leaderboard";
import { formatPercent, formatUsd, formatUsdSigned } from "../../lib/odds";
import type { AllTimeRecord } from "../../lib/stats";
import { cn } from "../../lib/cn";

/** Career totals across every season the league has played. */
export function AllTime({ record }: { record: AllTimeRecord }) {
  const { summary, bySeasonProfit } = record;
  const peak = Math.max(1, ...bySeasonProfit.map((row) => Math.abs(row.profit)));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="All time"
          description={`${record.seasons.length} season${record.seasons.length === 1 ? "" : "s"}, ${summary.weeksSettled} settled weeks.`}
        />
        <CardBody className="space-y-4">
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
            <Stat label="Best run" value={`W${summary.longestWinStreak}`} hint={`worst L${summary.longestLossStreak}`} />
          </div>

          {/* One bar per season: magnitude by length, direction by side. */}
          <ul className="space-y-1.5">
            {bySeasonProfit.map((row) => {
              const share = Math.abs(row.profit) / peak;
              const positive = row.profit >= 0;
              return (
                <li key={row.season} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-xs font-medium tnum text-ink-muted">
                    {row.season}
                  </span>
                  <span className="flex h-5 flex-1 items-center">
                    <span className="flex h-2 w-full items-center overflow-hidden rounded-full bg-surface-3">
                      <span
                        className={cn("h-full rounded-full", positive ? "bg-sky-600" : "bg-rose-600")}
                        style={{ width: `${Math.max(2, share * 100)}%` }}
                      />
                    </span>
                  </span>
                  <span
                    className={cn(
                      "w-20 shrink-0 text-right text-xs font-semibold tnum",
                      positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {formatUsdSigned(row.profit)}
                  </span>
                  <span className="hidden w-16 shrink-0 text-right text-[11px] text-ink-faint sm:block">
                    {row.weeks} wk{row.weeks === 1 ? "" : "s"}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Career leaderboard" description="Every leg, every season." />
        <CardBody>
          <Leaderboard members={record.members} />
        </CardBody>
      </Card>
    </div>
  );
}
