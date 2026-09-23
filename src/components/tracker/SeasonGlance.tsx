import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader, SkeletonText } from "../ui";
import { formatPercent, formatUsdSigned } from "../../lib/odds";
import { formatStreak, type SeasonSummary } from "../../lib/stats";
import type { StandingsRow } from "../../lib/scoring";
import { cn } from "../../lib/cn";

/**
 * The season in one glance, at the foot of the week page.
 *
 * Deliberately not a second stats page: three headline numbers and the table,
 * because the question someone has after looking at this week's ticket is "how
 * are we doing, and where am I" — not one the full page should have to be
 * opened to answer.
 */
export function SeasonGlance({
  season,
  summary,
  standings,
  currentUid,
  loading,
}: {
  season: number;
  summary: SeasonSummary;
  standings: StandingsRow[];
  currentUid: string | null;
  loading: boolean;
}) {
  // A summary built from legs that have not arrived yet is all zeros, and
  // flashing "0-0 / $0.00" before the real figures looks like a broken season.
  if (loading) {
    return (
      <Card>
        <CardHeader title={`${season} so far`} />
        <CardBody>
          <SkeletonText lines={3} />
        </CardBody>
      </Card>
    );
  }

  // Nothing has settled yet, so every figure would be a dash.
  if (summary.weeksSettled === 0) return null;

  const decided = summary.ticketsWon + summary.ticketsLost;

  return (
    <Card>
      <CardHeader
        title={`${season} so far`}
        actions={
          <Link
            to="/stats"
            className="text-sm font-medium text-brand hover:underline"
          >
            Full stats →
          </Link>
        }
      />
      <CardBody className="space-y-4">
        {/*
          The money gets its own row on a phone. Split three equal ways at
          390px each tile has ~83px of usable width, and a figure like
          "+$120.57" does not fit in that — and a P&L is the one number here
          that must never be shortened to make a layout work.
        */}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <Stat
            label="Group P&L"
            value={formatUsdSigned(summary.profit)}
            tone={summary.profit > 0 ? "good" : summary.profit < 0 ? "bad" : "flat"}
            note={summary.roi === null ? undefined : `${formatPercent(summary.roi)} ROI`}
            className="col-span-2 sm:col-span-1"
          />
          <Stat
            label="Tickets hit"
            value={`${summary.ticketsWon}–${summary.ticketsLost}`}
            note={decided > 0 ? formatPercent(summary.hitRate) : undefined}
          />
          <Stat
            label="Run"
            value={formatStreak(summary.currentStreak)}
            note={`${summary.weeksSettled} week${summary.weeksSettled === 1 ? "" : "s"} in`}
          />
        </dl>

        {standings.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-faint">
              Standings
            </h3>
            {/* Capped: stretched across a desktop card the points end up an
                inch from the name they belong to. */}
            <ul className="max-w-lg space-y-1">
              {standings.map((row) => (
                <StandingLine key={row.key} row={row} isMine={row.uid === currentUid} />
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Stat({
  label,
  value,
  note,
  tone = "flat",
  className,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "good" | "bad" | "flat";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-line bg-surface-2 px-2.5 py-2.5 sm:px-3",
        className,
      )}
    >
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-xl font-bold tnum leading-tight",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
          tone === "bad" && "text-rose-600 dark:text-rose-400",
          tone === "flat" && "text-ink",
        )}
      >
        {value}
      </dd>
      {note && <div className="text-xs text-ink-faint">{note}</div>}
    </div>
  );
}

function StandingLine({ row, isMine }: { row: StandingsRow; isMine: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1 text-sm",
        isMine && "bg-accent-soft",
      )}
    >
      <span className="w-5 shrink-0 tnum text-xs font-medium text-ink-faint">{row.rank}</span>
      <span className={cn("min-w-0 flex-1 truncate", isMine ? "font-semibold text-ink" : "text-ink")}>
        {row.name}
        {isMine && <span className="ml-1 text-xs font-normal text-ink-muted">(you)</span>}
      </span>
      <span className="shrink-0 tnum font-semibold text-ink">{row.points}</span>
      <span className="shrink-0 text-xs text-ink-faint">pts</span>
    </li>
  );
}
