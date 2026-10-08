import { Button, Modal } from "./ui";
import { useAuth } from "../hooks/useAuth";
import { useLeagueContext } from "../hooks/useLeagueContext";
import { useNow } from "../hooks/useNow";
import { useActivityDigest } from "../hooks/useActivityDigest";
import { describeDigest } from "../lib/activity";
import { formatRelative } from "../lib/dates";

const MAX_SHOWN = 20;

/**
 * "While you were away" — what people did to your leg since you last looked.
 *
 * Reactions and comments are the point of the league, but they happen on a
 * page nobody reloads between Sunday and Thursday, so they were going unread.
 * This catches you on the way in, wherever you land.
 *
 * Dismissing moves the read mark to now, so each piece of news is shown once.
 *
 * Someone with no read mark — which is everyone the first time they open the
 * app after this ships — gets the backlog instead of a silent clock-start, so
 * the feature does not launch by telling the whole league nothing.
 */
export function ActivityDigest() {
  const { user } = useAuth();
  const { leagueId, weeks, isMember } = useLeagueContext();
  const now = useNow();
  const { items, firstRun, dismiss } = useActivityDigest(
    isMember ? (leagueId ?? undefined) : undefined,
    weeks,
    user?.uid,
  );

  if (items.length === 0) return null;

  const summary = describeDigest(items);
  const weekNumbers = [...new Set(items.map((item) => item.week))];
  // The body scrolls, but a forty-item scroll is not something anyone reads.
  const shown = items.slice(0, MAX_SHOWN);
  const hidden = items.length - shown.length;

  return (
    <Modal
      open
      onClose={dismiss}
      title={firstRun ? "Here's what you missed" : "While you were away"}
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
        {shown.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-line bg-surface-2 px-3 py-2"
          >
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-ink">{item.who}</span>
              <span className="text-xs text-ink-faint">
                week {item.week} · {item.at ? formatRelative(item.at, now) : "earlier"}
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
      {hidden > 0 && (
        <p className="mt-2 text-center text-xs text-ink-faint">
          and {hidden} more on your leg
        </p>
      )}
    </Modal>
  );
}
