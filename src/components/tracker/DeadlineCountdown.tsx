import { Badge } from "../ui";
import { formatDateTime, formatDuration } from "../../lib/dates";
import type { Week } from "../../types/models";

/**
 * Live countdown. `now` comes from the shared ticking clock, so the lock
 * actually happens on screen rather than only on the next unrelated render.
 *
 * A week with no deadline is the normal case: picks stay open until an admin
 * locks them by hand, usually the moment the bet is actually placed.
 */
export function DeadlineCountdown({ week, now }: { week: Week; now: Date }) {
  if (!week.deadline) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge tone={week.closed ? "neutral" : "good"}>{week.closed ? "Closed" : "Open"}</Badge>
        <span className="text-xs text-ink-faint">
          {week.closed ? "This week is finished." : "Picks stay open until an admin locks them."}
        </span>
      </div>
    );
  }

  const remaining = week.deadline.getTime() - now.getTime();
  const passed = remaining <= 0;
  const urgent = !passed && remaining < 60 * 60 * 1000;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge tone={passed ? "bad" : urgent ? "warn" : "neutral"}>
        {passed ? "Locked" : `Locks in ${formatDuration(remaining)}`}
      </Badge>
      <span className="text-xs text-ink-faint">
        {passed ? `Picks closed ${formatDateTime(week.deadline)}` : formatDateTime(week.deadline)}
      </span>
    </div>
  );
}
