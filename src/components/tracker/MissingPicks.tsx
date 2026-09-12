import { Badge, Button } from "../ui";
import { Avatar } from "../NavBar";
import { useToast } from "../../hooks/useToast";
import { buildDeadlineCalendar, buildNudgeMessage, membersMissingLegs } from "../../lib/nudge";
import type { Leg, Member, Week } from "../../types/models";

/**
 * Who still owes a pick, and the two things that actually get them in:
 * a message ready to paste into the group chat, and a calendar reminder
 * members add once so their own phone nags them from then on.
 */
export function MissingPicks({
  week,
  legs,
  members,
  leagueName,
  now,
  open,
}: {
  week: Week;
  legs: Leg[];
  members: Member[];
  leagueName: string;
  now: Date;
  open: boolean;
}) {
  const toast = useToast();
  const missing = membersMissingLegs(members, legs);
  const url = typeof window === "undefined" ? "" : window.location.origin;

  async function copyNudge() {
    const message = buildNudgeMessage({ week, missing, now, url, leagueName });
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Nudge copied", "Paste it into the group chat.");
    } catch {
      // Clipboard access is blocked outside a secure context, and on iOS when
      // the gesture is not trusted. Show the text so it can still be copied.
      toast.info("Copy this", message);
    }
  }

  function downloadReminder() {
    try {
      const ics = buildDeadlineCalendar(week, url, leagueName || "Parlay");
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "parlay-deadline.ics";
      anchor.click();
      URL.revokeObjectURL(href);
      toast.success("Reminder downloaded", "Open it to add the weekly deadline to your calendar.");
    } catch (error) {
      toast.error("Couldn't build the reminder", (error as Error)?.message);
    }
  }

  const everyoneIn = missing.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5">
        {everyoneIn ? (
          <>
            <Badge tone="good">All in</Badge>
            <span className="text-sm text-ink-muted">
              Every member is on this ticket.
            </span>
          </>
        ) : (
          <>
            <Badge tone={open ? "warn" : "neutral"}>
              {missing.length} still out
            </Badge>
            <ul className="flex flex-wrap items-center gap-1.5">
              {missing.map((member) => (
                <li
                  key={member.uid}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2"
                >
                  <Avatar name={member.displayName} photoURL={member.photoURL} />
                  <span className="text-xs text-ink">{member.displayName}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        {!everyoneIn && open && (
          <Button size="sm" variant="secondary" onClick={copyNudge}>
            Copy nudge
          </Button>
        )}
        {/* Only worth offering while the lock is still ahead of us — a
            reminder for a deadline that has already passed is noise. */}
        {week.deadline && open && (
          <Button size="sm" variant="ghost" onClick={downloadReminder} title="Add the weekly deadline to your calendar">
            Remind me
          </Button>
        )}
      </div>
    </div>
  );
}
