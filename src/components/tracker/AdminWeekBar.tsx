import { useState } from "react";
import { Badge, Button, ConfirmDialog } from "../ui";
import { useToast } from "../../hooks/useToast";
import { closeWeekAndOpenNext, updateWeek } from "../../lib/api";
import type { DeadlineRule } from "../../lib/dates";
import type { ParlaySettlement } from "../../lib/parlay";
import type { Week } from "../../types/models";
import { cn } from "../../lib/cn";

/**
 * The one thing this week still needs from an admin, and the button that does
 * it — on the page where the ticket already is.
 *
 * Grading lived here while closing lived on the admin page, so finishing a
 * week meant grading, navigating away, finding the right week in a dropdown,
 * closing it, and navigating back.
 */
export function AdminWeekBar({
  leagueId,
  week,
  weeks,
  settlement,
  deadlineRule,
  open,
  onGrade,
  onWeekChange,
}: {
  leagueId: string;
  week: Week;
  weeks: Week[];
  settlement: ParlaySettlement;
  deadlineRule: DeadlineRule;
  /** Whether the week is still accepting legs. */
  open: boolean;
  onGrade: () => void;
  onWeekChange: (weekId: string) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<"next" | "only" | null>(null);

  const pending = settlement.pendingLegs;
  const noLegs = settlement.status === "empty";

  // Before the deadline there is nothing for an admin to do but wait.
  if (open && pending > 0) return null;
  if (week.closed && pending === 0) return null;
  if (noLegs && open) return null;

  async function run(label: string, action: () => Promise<unknown>, success: string) {
    setBusy(label);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error("That didn't work", (error as Error)?.message);
    } finally {
      setBusy(null);
      setConfirmClose(null);
    }
  }

  async function close(alsoOpenNext: boolean) {
    await run(
      "close",
      async () => {
        if (alsoOpenNext) {
          const nextId = await closeWeekAndOpenNext(
            leagueId,
            week,
            weeks.map((w) => w.id),
            deadlineRule,
          );
          // Land on the week that is now current, rather than the one just closed.
          onWeekChange(nextId);
        } else {
          await updateWeek(leagueId, week.id, { closed: true });
        }
      },
      alsoOpenNext ? `Week ${week.week} closed, week ${week.week + 1} is open` : `Week ${week.week} closed`,
    );
  }

  const needsGrading = pending > 0;

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5",
          needsGrading
            ? "border-accent-line bg-accent-soft"
            : "border-emerald-500/30 bg-emerald-500/10",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Badge tone={needsGrading ? "brand" : "good"}>
            {week.closed ? "Closed" : needsGrading ? "Locked" : "Ready"}
          </Badge>
          <span className="text-sm text-ink">
            {needsGrading
              ? week.closed
                ? pending === 1
                  ? "1 leg never got graded — this week won't count until it is."
                  : `${pending} legs never got graded — this week won't count until they are.`
                : pending === 1
                  ? "1 leg still needs grading."
                  : `${pending} legs still need grading.`
              : "Every leg is graded. Close the week to lock it in and open the next one."}
          </span>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {needsGrading ? (
            <Button size="sm" variant="primary" onClick={onGrade}>
              Grade {pending} leg{pending === 1 ? "" : "s"}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="primary"
                loading={busy === "close"}
                onClick={() => void close(true)}
              >
                Close &amp; open week {week.week + 1}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => setConfirmClose("only")}
              >
                Close only
              </Button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmClose === "only"}
        title={`Close week ${week.week} without opening another?`}
        confirmLabel="Close only"
        busy={busy === "close"}
        message="Use this at the end of a season. Nobody can add a leg until you start the next season or create a week by hand."
        onCancel={() => setConfirmClose(null)}
        onConfirm={() => void close(false)}
      />
    </>
  );
}
