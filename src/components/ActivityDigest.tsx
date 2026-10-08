import { Button, Modal } from "./ui";
import { useAuth } from "../hooks/useAuth";
import { useLeagueContext } from "../hooks/useLeagueContext";
import { useNow } from "../hooks/useNow";
import { useActivityDigest } from "../hooks/useActivityDigest";
import { describeDigest } from "../lib/activity";
import { formatRelative } from "../lib/dates";

/**
 * "While you were away" — what people did to your leg since you last looked.
 *
 * Reactions and comments are the point of the league, but they happen on a
 * page nobody reloads between Sunday and Thursday, so they were going unread.
 * This catches you on the way in, wherever you land.
 *
 * Dismissing moves the read mark to now, so each piece of news is shown once.
 */
export function ActivityDigest() {
  const { user } = useAuth();
  const { leagueId, weeks, isMember } = useLeagueContext();
  const now = useNow();
  const { items, dismiss } = useActivityDigest(
    isMember ? (leagueId ?? undefined) : undefined,
    weeks,
    user?.uid,
  );

  if (items.length === 0) return null;

  const summary = describeDigest(items);
  const weekNumbers = [...new Set(items.map((item) => item.week))];

  return (
    <Modal
      open
      onClose={dismiss}
      title="While you were away"
      description={
        <div>
          {summary} on your leg
          {weekNumbers.length === 1 ? ` in week ${weekNumbers[0]}` : ""}.
        </div>
      }
      footer={
        <Button variant="primary" onClick={dismiss} data-autofocus>
          Got it
        </Button>
      }
    >
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-line bg-surface-2 px-3 py-2"
          >
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-ink">{item.who}</span>
              <span className="text-xs text-ink-faint">
                week {item.week} · {formatRelative(item.at, now)}
              </span>
            </div>
            {item.kind === "comment" ? (
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink">{item.text}</p>
            ) : (
              <p className="mt-0.5 text-sm text-ink-muted">
                reacted <span aria-hidden className="text-base">{item.emoji}</span>
                <span className="sr-only">with {item.emoji}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
