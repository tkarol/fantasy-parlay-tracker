import { EmptyState } from "../ui";
import { formatAmerican } from "../../lib/odds";
import type { BustEvent } from "../../lib/stats";

/**
 * Tickets that one member alone broke, and what it cost the group.
 * The single best source of grief in a league like this.
 */
export function BustBoard({ busts }: { busts: BustEvent[] }) {
  if (busts.length === 0) {
    return (
      <EmptyState
        icon="🧊"
        title="Nobody has solo-busted a ticket"
        description="A bust is logged when every other leg won and one member's leg didn't."
      />
    );
  }

  const worst = [...busts].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));

  return (
    <ul className="space-y-2">
      {worst.map((bust) => (
        <li
          key={`${bust.weekId}-${bust.key}`}
          className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-xl border border-line bg-surface-2 px-3 py-2.5"
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">{bust.name}</div>
            <p className="truncate text-xs text-ink-muted">
              Week {bust.week} · {bust.leg} {formatAmerican(bust.odds)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold tnum text-rose-600 dark:text-rose-400">
              {bust.cost === null ? "—" : `-$${bust.cost.toFixed(2)}`}
            </div>
            <div className="text-[11px] text-ink-faint">would have won</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
