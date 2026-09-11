import { Badge, EmptyState } from "../ui";
import { ticketStatusLabel, ticketStatusTone } from "../../lib/parlay";
import { formatAmerican, formatUsdSigned } from "../../lib/odds";
import type { WeekTicket } from "../../lib/stats";
import { cn } from "../../lib/cn";

const TONE_TO_BADGE = {
  good: "good",
  bad: "bad",
  warn: "warn",
  info: "info",
  neutral: "neutral",
} as const;

/** Every week of the season at a glance, newest first. */
export function WeekHistory({
  tickets,
  onSelectWeek,
}: {
  tickets: WeekTicket[];
  onSelectWeek?: (weekId: string) => void;
}) {
  if (tickets.length === 0) {
    return <EmptyState icon="🗓" title="No weeks yet" description="Weeks appear here as they're played." />;
  }

  const ordered = [...tickets].reverse();

  return (
    <ul className="divide-y divide-line">
      {ordered.map(({ week, legs, settlement }) => {
        const tone = ticketStatusTone(settlement.status);
        const row = (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="w-12 shrink-0 text-center">
                <div className="text-[10px] uppercase tracking-wide text-ink-faint">Week</div>
                <div className="text-lg font-semibold tnum text-ink">{week.week}</div>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={TONE_TO_BADGE[tone]}>{ticketStatusLabel(settlement.status)}</Badge>
                  {week.ticketImage && (
                    <span title="Has a ticket screenshot" aria-label="Has a ticket screenshot">
                      📷
                    </span>
                  )}
                  {settlement.voidedLegs > 0 && <Badge tone="warn">{settlement.voidedLegs} void</Badge>}
                </div>
                <div className="mt-0.5 truncate text-xs text-ink-muted">
                  {legs.length} leg{legs.length === 1 ? "" : "s"}
                  {settlement.allPriced && settlement.combinedAmerican !== null && (
                    <> · {formatAmerican(settlement.combinedAmerican)}</>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div
                className={cn(
                  "text-sm font-semibold tnum",
                  settlement.profit === null
                    ? "text-ink-faint"
                    : settlement.profit > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : settlement.profit < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-ink-muted",
                )}
              >
                {settlement.settled ? formatUsdSigned(settlement.profit) : "—"}
              </div>
              <div className="text-[11px] text-ink-faint">
                {settlement.settled ? "settled" : "in play"}
              </div>
            </div>
          </>
        );

        return (
          <li key={week.id}>
            {onSelectWeek ? (
              <button
                type="button"
                onClick={() => onSelectWeek(week.id)}
                className="flex w-full items-center gap-3 px-1 py-3 text-left transition hover:bg-surface-3"
              >
                {row}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-1 py-3">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
