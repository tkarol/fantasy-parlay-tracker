import { useState } from "react";
import { Badge, Button, ConfirmDialog } from "../ui";
import { useToast } from "../../hooks/useToast";
import { clearDeadline, closeWeekAndOpenNext, lockPicksNow, updateWeek } from "../../lib/api";
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
 * closing it, and navigating back. The week now runs end to end from here:
 * lock the picks, grade them, close and open the next one.
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
  /** The league's automatic lock rule, or null when it locks by hand. */
  deadlineRule: DeadlineRule | null;
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
  const needsGrading = pending > 0;
  const submitted = settlement.countingLegs + settlement.voidedLegs;

  // Nothing to do on a week nobody has joined yet, or one already finished.
  if (open && noLegs) return null;
  if (week.closed && !needsGrading) return null;
  // While picks are open the only move is to lock them — and when a deadline
  // is already set, the countdown says when that happens on its own.
  if (open && week.deadline) return null;

  const mode = open ? "lock" : needsGrading ? "grade" : "close";

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

  const message =
    mode === "lock"
      ? `${submitted} pick${submitted === 1 ? "" : "s"} in. Lock them once you've placed the bet.`
      : mode === "grade"
        ? week.closed
          ? pending === 1
            ? "1 leg never got graded — this week won't count until it is."
            : `${pending} legs never got graded — this week won't count until they are.`
          : pending === 1
            ? "1 leg still needs grading."
            : `${pending} legs still need grading.`
        : "Every leg is graded. Close the week to lock it in and open the next one.";

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5",
          mode === "lock"
            ? "border-line bg-surface-2"
            : mode === "grade"
              ? "border-accent-line bg-accent-soft"
              : "border-emerald-500/30 bg-emerald-500/10",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {/* The week header already says "Open", so the lock bar does not
              repeat it — the other two states are news. */}
          {mode !== "lock" && (
            <Badge tone={mode === "grade" ? "brand" : "good"}>
              {week.closed ? "Closed" : needsGrading ? "Locked" : "Ready"}
            </Badge>
          )}
          <span className="text-sm text-ink">{message}</span>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {mode === "lock" ? (
            <Button
              size="sm"
              variant="primary"
              loading={busy === "lock"}
              onClick={() =>
                void run(
                  "lock",
                  () => lockPicksNow(leagueId, week.id),
                  "Picks are locked — nobody can add or edit a leg now",
                )
              }
            >
              Lock picks
            </Button>
          ) : mode === "grade" ? (
            <>
              <Button size="sm" variant="primary" onClick={onGrade}>
                Grade {pending} leg{pending === 1 ? "" : "s"}
              </Button>
              {/* Locking by hand has to be undoable by hand, or a misclick
                  costs somebody their pick. */}
              {!week.closed && week.deadline && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === "unlock"}
                  onClick={() =>
                    void run(
                      "unlock",
                      () => clearDeadline(leagueId, week.id),
                      "Picks are open again",
                    )
                  }
                >
                  Reopen picks
                </Button>
              )}
            </>
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
