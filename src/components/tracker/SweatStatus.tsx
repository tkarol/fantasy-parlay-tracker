import { formatOneIn, longshotComparison, ticketOdds, type ParlaySettlement } from "../../lib/parlay";
import { formatAmerican, formatUsd } from "../../lib/odds";
import { isVoidingResult, type Leg } from "../../types/models";
import { cn } from "../../lib/cn";

/**
 * The state of the ticket while games are settling.
 *
 * A parlay is only interesting once it is either still alive or freshly dead,
 * so this leads with the number that matters — how many legs are left — and
 * shows each leg as a chip you can read at a glance from across the room.
 */
export function SweatStatus({
  legs,
  settlement,
  stake,
}: {
  legs: Leg[];
  settlement: ParlaySettlement;
  stake: number;
}) {
  const counting = legs.filter((leg) => !isVoidingResult(leg.result));
  const remaining = settlement.pendingLegs;

  // Nothing worth sweating before the ticket is priced and graded.
  if (settlement.status === "empty" || settlement.status === "building") return null;

  const killer = legs.find((leg) => leg.result === "Loss");

  const headline =
    settlement.status === "won"
      ? "Cashed"
      : settlement.status === "lost"
        ? "Dead"
        : settlement.status === "push"
          ? "Push"
          : remaining === 0
            ? "All legs in"
            : `${remaining} leg${remaining === 1 ? "" : "s"} to go`;

  const subline =
    settlement.status === "won"
      ? `${formatUsd(settlement.toReturn)} back`
      : settlement.status === "lost"
        ? killer
          ? `${killer.memberName} busted it`
          : "One leg missed"
        : settlement.status === "push"
          ? "Every leg voided — stake returned"
          : `${settlement.winningLegs} of ${counting.length} landed`;

  const tone =
    settlement.status === "won"
      ? "border-emerald-500/40 bg-emerald-500/10"
      : settlement.status === "lost"
        ? "border-rose-500/40 bg-rose-500/10"
        : "border-line bg-surface-2";

  return (
    <div className={cn("rounded-xl border px-4 py-3", tone)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <div className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
            {headline}
          </div>
          <div className="text-xs text-ink-muted">{subline}</div>
        </div>

        {!settlement.settled && settlement.potentialProfit !== null && (
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Playing for</div>
            <div className="text-lg font-semibold tnum text-ink">
              {formatUsd(settlement.toReturn)}
            </div>
          </div>
        )}
      </div>

      {/* One chip per leg, in submission order. */}
      <ul className="mt-2.5 flex flex-wrap gap-1">
        {legs.map((leg) => (
          <li
            key={leg.id}
            title={`${leg.memberName}: ${leg.leg} ${formatAmerican(leg.odds)} — ${leg.result}`}
            className={cn(
              "h-2 w-8 rounded-full",
              leg.result === "Win" && "bg-emerald-500",
              leg.result === "Loss" && "bg-rose-500",
              isVoidingResult(leg.result) && "bg-amber-400",
              leg.result === "Pending" && "bg-slate-300 dark:bg-slate-600",
            )}
          >
            <span className="sr-only">
              {leg.memberName}: {leg.result}
            </span>
          </li>
        ))}
      </ul>

      <TicketOddsLine legs={legs} settlement={settlement} stake={stake} />
    </div>
  );
}

/**
 * What the market actually thinks of this ticket, and what one leg is costing.
 */
function TicketOddsLine({
  legs,
  settlement,
  stake,
}: {
  legs: Leg[];
  settlement: ParlaySettlement;
  stake: number;
}) {
  const odds = ticketOdds(settlement.combinedDecimal);
  if (!odds) return null;

  const comparison = longshotComparison(legs);

  return (
    <p className="mt-2.5 border-t border-line pt-2 text-xs text-ink-muted">
      {formatUsd(stake)} on this hits <span className="font-semibold text-ink">{formatOneIn(odds.oneIn)}</span>
      {comparison && comparison.leg.odds !== null && (
        <>
          {" · drop "}
          <span className="text-ink">{comparison.leg.memberName}'s</span>{" "}
          <span className="tnum">{formatAmerican(comparison.leg.odds)}</span> and it's{" "}
          <span className="font-semibold text-ink">{formatOneIn(comparison.without.oneIn)}</span>
        </>
      )}
    </p>
  );
}
