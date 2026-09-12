import { weeklyAwards } from "../../lib/scoring";
import type { WeekTicket } from "../../lib/stats";

/** What happened this week, worked out from the grades alone. */
export function WeekAwards({ ticket }: { ticket: WeekTicket }) {
  const awards = weeklyAwards(ticket);
  if (awards.length === 0) return null;

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {awards.map((award) => (
        <li
          key={award.kind}
          className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5"
        >
          <span aria-hidden className="text-lg leading-none">
            {award.emoji}
          </span>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              {award.title}
            </div>
            <div className="truncate text-sm font-semibold text-ink">
              {award.name || "The whole ticket"}
            </div>
            <div className="truncate text-xs text-ink-muted">{award.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
