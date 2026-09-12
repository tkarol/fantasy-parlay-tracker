import type { User } from "firebase/auth";
import { Card, CardBody } from "../ui";
import { MyLegForm } from "./MyLegForm";
import { formatDuration } from "../../lib/dates";
import type { Leg, Week } from "../../types/models";
import { cn } from "../../lib/cn";

/**
 * The member's one job each week.
 *
 * When a pick is still missing this is the loudest thing on the page and sits
 * above everything else — carrying its own week and deadline so it makes sense
 * as the first thing read. Once the pick is in it goes quiet: a settled ticket
 * is for reading, not for shouting at people who have already acted.
 */
export function YourLegCard({
  leagueId,
  week,
  user,
  myLeg,
  otherLegs,
  now,
  disabled,
  disabledReason,
  needsLeg,
}: {
  leagueId: string;
  week: Week;
  user: User;
  myLeg: Leg | null;
  otherLegs: Leg[];
  now: Date;
  disabled: boolean;
  disabledReason?: string;
  needsLeg: boolean;
}) {
  const remaining = week.deadline ? week.deadline.getTime() - now.getTime() : null;
  const urgent = remaining !== null && remaining > 0 && remaining < 6 * 60 * 60 * 1000;

  if (!needsLeg) {
    return (
      <Card>
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5",
            myLeg
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-line bg-surface-2",
          )}
        >
          {myLeg && (
            <span
              aria-hidden
              className="grid h-6 w-6 place-content-center rounded-full bg-emerald-600 text-xs font-bold text-white"
            >
              ✓
            </span>
          )}
          <h2 className="text-base font-semibold text-ink">
            {myLeg ? "You're on this ticket" : "Your leg"}
          </h2>
          {/* Only offer an edit that is actually still possible. */}
          {myLeg && !disabled && (
            <span className="text-sm text-ink-muted">— change it any time before the lock.</span>
          )}
        </div>
        <CardBody>
          <MyLegForm
            leagueId={leagueId}
            week={week}
            user={user}
            myLeg={myLeg}
            otherLegs={otherLegs}
            disabled={disabled}
            disabledReason={disabledReason}
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="attention-ring border-accent-line ring-1 ring-accent/25">
      <div className="border-b border-accent-line bg-accent-soft px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-ink">
            Your turn
          </span>
          <span
            className={cn(
              "text-xs font-medium tnum",
              urgent ? "text-rose-600 dark:text-rose-400" : "text-ink-muted",
            )}
          >
            Week {week.week}
            {remaining !== null && remaining > 0 && ` · locks in ${formatDuration(remaining)}`}
          </span>
        </div>

        <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          Add your leg to the ticket
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Paste your pick straight from your sportsbook — the price fills itself in.
        </p>
      </div>

      <CardBody>
        <MyLegForm
          leagueId={leagueId}
          week={week}
          user={user}
          myLeg={myLeg}
          otherLegs={otherLegs}
          disabled={disabled}
          disabledReason={disabledReason}
          emphasis
        />
      </CardBody>
    </Card>
  );
}
