import { Badge, Stat } from "../ui";
import { ticketStatusLabel, ticketStatusTone, type ParlaySettlement } from "../../lib/parlay";
import { formatAmerican, formatUsd, formatUsdSigned } from "../../lib/odds";
import type { Week } from "../../types/models";

const TONE_TO_BADGE = {
  good: "good",
  bad: "bad",
  warn: "warn",
  info: "info",
  neutral: "neutral",
} as const;

export function TicketSummary({
  week,
  settlement,
}: {
  week: Week;
  settlement: ParlaySettlement;
}) {
  const tone = ticketStatusTone(settlement.status);
  const settledProfit = settlement.profit;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TONE_TO_BADGE[tone]} className="px-2.5 py-1 text-sm">
          {ticketStatusLabel(settlement.status)}
        </Badge>
        {settlement.voidedLegs > 0 && (
          <Badge tone="warn">
            {settlement.voidedLegs} leg{settlement.voidedLegs === 1 ? "" : "s"} voided
          </Badge>
        )}
        {settlement.pendingLegs > 0 && (
          <span className="text-xs text-ink-muted">
            {settlement.pendingLegs} of {settlement.countingLegs} still pending
          </span>
        )}
        {week.payoutOverride !== null && <Badge tone="info">Payout recorded manually</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Stake" value={formatUsd(settlement.stake)} />
        <Stat
          label="Combined odds"
          value={settlement.allPriced ? formatAmerican(settlement.combinedAmerican) : "—"}
          hint={
            settlement.allPriced && settlement.combinedDecimal
              ? `${settlement.combinedDecimal.toFixed(2)}x`
              : "Waiting on prices"
          }
        />
        <Stat
          label={settlement.settled ? "Returned" : "To return"}
          value={
            settlement.status === "lost"
              ? formatUsd(0)
              : week.payoutOverride !== null
                ? formatUsd(week.payoutOverride)
                : formatUsd(settlement.toReturn)
          }
        />
        <Stat
          label={settlement.settled ? "Profit" : "Potential profit"}
          value={
            settlement.settled
              ? formatUsdSigned(settledProfit)
              : formatUsdSigned(settlement.potentialProfit)
          }
          tone={
            settlement.settled
              ? settledProfit === null
                ? "neutral"
                : settledProfit > 0
                  ? "good"
                  : settledProfit < 0
                    ? "bad"
                    : "neutral"
              : "neutral"
          }
        />
      </div>

      {settlement.status === "won" && !settlement.allPriced && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          This ticket won but not every leg has odds recorded, so the payout can't be calculated.
          An admin can add the missing prices or record the actual payout.
        </p>
      )}
    </div>
  );
}
