import { Button, Modal } from "./ui";
import { Avatar } from "./NavBar";
import { useAuth } from "../hooks/useAuth";
import { useLeagueContext } from "../hooks/useLeagueContext";
import { useNow } from "../hooks/useNow";
import { useActivityDigest } from "../hooks/useActivityDigest";
import { describeDigest, type ActivityItem } from "../lib/activity";
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
 *
 * Centred rather than the app's usual bottom sheet: a sheet is for a form a
 * thumb has to reach, and this is something to read.
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

  const weekNumbers = [...new Set(items.map((item) => item.week))];
  // The body scrolls, but a forty-item scroll is not something anyone reads.
  const shown = items.slice(0, MAX_SHOWN);
  const hidden = items.length - shown.length;

  return (
    <Modal
      open
      onClose={dismiss}
      placement="center"
      title={firstRun ? "Here's what you missed" : "While you were away"}
      description={
        <div>
          {describeDigest(items)} on your leg
          {weekNumbers.length === 1 ? ` in week ${weekNumbers[0]}` : ""}.
        </div>
      }
      footer={
        <Button variant="primary" onClick={dismiss} data-autofocus>
          Got it
        </Button>
      }
    >
      <ul className="divide-y divide-line">
        {shown.map((item) => (
          <ActivityRow key={item.id} item={item} now={now} />
        ))}
      </ul>
      {hidden > 0 && (
        <p className="pt-3 text-center text-xs text-ink-faint">and {hidden} more on your leg</p>
      )}
    </Modal>
  );
}

/** One piece of news: who, when, and what they did. */
function ActivityRow({ item, now }: { item: ActivityItem; now: Date }) {
  return (
    <li className="flex items-start gap-2.5 py-3 first:pt-0 last:pb-0">
      <Avatar name={item.who} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-ink">{item.who}</span>
          <span className="text-xs text-ink-faint">
            week {item.week} · {item.at ? formatRelative(item.at, now) : "earlier"}
          </span>
        </div>

        {item.kind === "comment" ? (
          // Set off behind a rule so a comment reads as something somebody
          // said, rather than as another row of interface.
          <p className="mt-1 whitespace-pre-wrap break-words border-l-2 border-accent-line pl-2.5 text-sm text-ink">
            {item.text}
          </p>
        ) : (
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
            <span aria-hidden className="text-xl leading-none">
              {item.emoji}
            </span>
            <span>reacted</span>
            <span className="sr-only">with {item.emoji}</span>
          </p>
        )}
      </div>
    </li>
  );
}
