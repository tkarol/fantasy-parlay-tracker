import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Modal } from "../ui";
import { useToast } from "../../hooks/useToast";
import { gradeLegs } from "../../lib/api";
import { formatAmerican, formatUsdSigned } from "../../lib/odds";
import { settleParlay, ticketStatusLabel } from "../../lib/parlay";
import { LEG_RESULTS, type Leg, type LegResult, type Week } from "../../types/models";
import { cn } from "../../lib/cn";

/** One key per outcome, so a whole ticket grades without leaving the keyboard. */
const KEYS: Record<string, LegResult> = {
  w: "Win",
  l: "Loss",
  p: "Push",
  v: "Void",
  n: "Pending",
};

/**
 * Grade a whole week in one pass.
 *
 * Nothing is written until Save, and then as a single batch — so a
 * half-finished grading session never shows up on everyone else's screen.
 */
export function GradeWeekDialog({
  open,
  onClose,
  leagueId,
  week,
  legs,
  adminUid,
}: {
  open: boolean;
  onClose: () => void;
  leagueId: string;
  week: Week;
  legs: Leg[];
  adminUid: string;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, LegResult>>({});
  const [focused, setFocused] = useState(0);
  const [saving, setSaving] = useState(false);
  const rowsRef = useRef<(HTMLLIElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(Object.fromEntries(legs.map((leg) => [leg.id, leg.result])));
    // Start on the first leg still needing a decision.
    const firstPending = legs.findIndex((leg) => leg.result === "Pending");
    setFocused(firstPending >= 0 ? firstPending : 0);
  }, [open, legs]);

  const graded = useMemo(
    () => legs.map((leg) => ({ ...leg, result: draft[leg.id] ?? leg.result })),
    [legs, draft],
  );

  const preview = useMemo(
    () => settleParlay(graded, week.stake, { payoutOverride: week.payoutOverride }),
    [graded, week.stake, week.payoutOverride],
  );

  const changed = legs.filter((leg) => (draft[leg.id] ?? leg.result) !== leg.result);
  const stillPending = graded.filter((leg) => leg.result === "Pending").length;

  function apply(index: number, result: LegResult) {
    const leg = legs[index];
    if (!leg) return;
    setDraft((current) => ({ ...current, [leg.id]: result }));
    // Move on automatically; grading is a list to get through.
    setFocused((current) => Math.min(current + 1, legs.length - 1));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const key = event.key.toLowerCase();

    if (key === "arrowdown" || key === "arrowup") {
      event.preventDefault();
      setFocused((current) =>
        Math.max(0, Math.min(legs.length - 1, current + (key === "arrowdown" ? 1 : -1))),
      );
      return;
    }

    const result = KEYS[key];
    if (result) {
      event.preventDefault();
      apply(focused, result);
    }
  }

  // Keep the focused row on screen when arrowing through a long ticket.
  useEffect(() => {
    rowsRef.current[focused]?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  async function save() {
    if (changed.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const count = await gradeLegs(
        leagueId,
        week.id,
        changed.map((leg) => ({ legId: leg.id, result: draft[leg.id]! })),
        adminUid,
      );
      toast.success(`Graded ${count} leg${count === 1 ? "" : "s"}`);
      onClose();
    } catch (error) {
      toast.error("Couldn't save those grades", (error as Error)?.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Grade week ${week.week}`}
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            <kbd className="rounded border border-line px-1">W</kbd> win{" "}
            <kbd className="rounded border border-line px-1">L</kbd> loss{" "}
            <kbd className="rounded border border-line px-1">P</kbd> push{" "}
            <kbd className="rounded border border-line px-1">V</kbd> void{" "}
            <kbd className="rounded border border-line px-1">N</kbd> pending
          </span>
          <span className="text-ink-faint">— arrows to move, nothing saves until you do</span>
        </span>
      }
      footer={
        <>
          <span className="mr-auto text-xs text-ink-muted">
            {changed.length > 0
              ? `${changed.length} change${changed.length === 1 ? "" : "s"}`
              : "No changes yet"}
            {stillPending > 0 && ` · ${stillPending} still pending`}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={changed.length === 0}>
            Save {changed.length > 0 ? changed.length : ""}
          </Button>
        </>
      }
    >
      {/* The list owns the keyboard while the dialog is open. */}
      <div
        role="listbox"
        aria-label="Legs to grade"
        tabIndex={0}
        onKeyDown={onKeyDown}
        ref={listRef}
        data-autofocus
        className="outline-none"
      >
        <ul className="space-y-1">
          {legs.map((leg, index) => {
            const result = draft[leg.id] ?? leg.result;
            const isFocused = index === focused;
            const isChanged = result !== leg.result;

            return (
              <li
                key={leg.id}
                ref={(node) => {
                  rowsRef.current[index] = node;
                }}
                role="option"
                aria-selected={isFocused}
                onClick={() => setFocused(index)}
                className={cn(
                  "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2 transition",
                  isFocused ? "border-ink/40 bg-surface-2" : "border-line",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{leg.memberName}</span>
                    {isChanged && <Badge tone="info">changed</Badge>}
                  </div>
                  <p className="truncate text-xs text-ink-muted">
                    {leg.leg} <span className="tnum">{formatAmerican(leg.odds)}</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {LEG_RESULTS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setFocused(index);
                        apply(index, option);
                      }}
                      aria-pressed={result === option}
                      className={cn(
                        "rounded-lg px-2 py-1 text-xs font-medium transition",
                        result === option
                          ? "bg-accent text-accent-ink"
                          : "border border-line text-ink-muted hover:bg-surface-3 hover:text-ink",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm">
          <span className="text-ink-muted">If you save this: </span>
          <span className="font-semibold text-ink">{ticketStatusLabel(preview.status)}</span>
          {preview.settled && preview.profit !== null && (
            <span
              className={cn(
                "ml-2 font-semibold tnum",
                preview.profit > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : preview.profit < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-ink-muted",
              )}
            >
              {formatUsdSigned(preview.profit)}
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}
