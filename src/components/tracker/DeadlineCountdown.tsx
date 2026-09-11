import { Badge } from "../ui";
import { formatDateTime, formatDuration } from "../../lib/dates";
import type { Week } from "../../types/models";

/**
 * Live countdown. `now` comes from the shared ticking clock, so the lock
 * actually happens on screen rather than only on the next unrelated render.
 */
export function DeadlineCountdown({ week, now }: { week: Week; now: Date }) {
  if (!week.deadline) {
    return <span className="text-xs text-ink-faint">No deadline set</span>;
  }

  const remaining = week.deadline.getTime() - now.getTime();
  const passed = remaining <= 0;
  const urgent = !passed && remaining < 60 * 60 * 1000;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge tone={passed ? "bad" : urgent ? "warn" : "neutral"}>
        {passed ? "Locked" : `Locks in ${formatDuration(remaining)}`}
      </Badge>
      <span className="text-xs text-ink-faint">{formatDateTime(week.deadline)}</span>
    </div>
  );
}
