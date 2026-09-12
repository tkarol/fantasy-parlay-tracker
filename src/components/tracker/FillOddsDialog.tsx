import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Modal, Select, Textarea } from "../ui";
import { useToast } from "../../hooks/useToast";
import { setLegOdds } from "../../lib/api";
import { formatAmerican } from "../../lib/odds";
import { matchScore, parseSlip } from "../../lib/slip";
import type { Leg, Week } from "../../types/models";
import { cn } from "../../lib/cn";

/**
 * Paste the real ticket, fill every price at once.
 *
 * Matching is a guess, so nothing is written until the admin has seen which
 * line went to which leg and can reassign any of them. A wrong price would not
 * just look untidy — it would feed the standings, where points are weighted by
 * exactly that number.
 */
export function FillOddsDialog({
  open,
  onClose,
  leagueId,
  week,
  legs,
}: {
  open: boolean;
  onClose: () => void;
  leagueId: string;
  week: Week;
  legs: Leg[];
}) {
  const toast = useToast();
  const [slip, setSlip] = useState("");
  const [assignment, setAssignment] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSlip("");
    setAssignment({});
  }, [open]);

  const lines = useMemo(() => parseSlip(slip).filter((line) => line.odds !== null), [slip]);

  // Best guess per line, without ever giving one leg to two lines.
  const suggested = useMemo(() => {
    const result: Record<string, string> = {};
    const taken = new Set<string>();

    for (const [index, line] of lines.entries()) {
      let best: { legId: string; score: number } | null = null;
      for (const leg of legs) {
        if (taken.has(leg.id)) continue;
        const score = matchScore(line.leg, leg.leg);
        if (!best || score > best.score) best = { legId: leg.id, score };
      }
      if (best && best.score > 0.15) {
        result[String(index)] = best.legId;
        taken.add(best.legId);
      } else {
        result[String(index)] = "";
      }
    }
    return result;
  }, [lines, legs]);

  const chosen = (index: number) => assignment[String(index)] ?? suggested[String(index)] ?? "";

  const updates = lines
    .map((line, index) => ({ legId: chosen(index), odds: line.odds! }))
    .filter((update) => update.legId !== "");

  const unmatched = lines.length - updates.length;

  async function apply() {
    if (updates.length === 0) return;
    setSaving(true);
    try {
      const count = await setLegOdds(leagueId, week.id, updates);
      toast.success(`Priced ${count} leg${count === 1 ? "" : "s"}`);
      onClose();
    } catch (error) {
      toast.error("Couldn't save those prices", (error as Error)?.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Fill odds from the slip"
      description="Paste the ticket from your sportsbook. Check what matched, then save."
      footer={
        <>
          <span className="mr-auto text-xs text-ink-muted">
            {lines.length === 0
              ? "Nothing pasted yet"
              : `${updates.length} of ${lines.length} matched${unmatched > 0 ? ` · ${unmatched} unassigned` : ""}`}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={apply} loading={saving} disabled={updates.length === 0}>
            Save {updates.length > 0 ? updates.length : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Textarea
          value={slip}
          onChange={(event) => setSlip(event.target.value)}
          rows={5}
          placeholder={"Buffalo Bills -3.5 (-110)\nKansas City Chiefs ML (-140)\nOver 47.5 (-105)"}
          aria-label="Pasted bet slip"
          className="font-mono text-xs"
        />

        {lines.length > 0 && (
          <ul className="space-y-1.5">
            {lines.map((line, index) => {
              const legId = chosen(index);
              const target = legs.find((leg) => leg.id === legId);

              return (
                <li
                  key={`${line.raw}-${index}`}
                  className={cn(
                    "rounded-xl border px-3 py-2",
                    legId ? "border-line bg-surface-2" : "border-amber-500/40 bg-amber-500/5",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{line.leg}</span>
                    <Badge tone="info">{formatAmerican(line.odds)}</Badge>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ink-faint">goes to</span>
                    <Select
                      value={legId}
                      aria-label={`Which leg gets ${formatAmerican(line.odds)}`}
                      className="!w-auto min-w-0 flex-1 text-xs"
                      onChange={(event) =>
                        setAssignment((current) => ({
                          ...current,
                          [String(index)]: event.target.value,
                        }))
                      }
                    >
                      <option value="">— skip this line —</option>
                      {legs.map((leg) => (
                        <option key={leg.id} value={leg.id}>
                          {leg.memberName}: {leg.leg.slice(0, 40)}
                          {leg.odds !== null ? ` (now ${formatAmerican(leg.odds)})` : ""}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {target?.odds !== null && target !== undefined && target.odds !== line.odds && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Replaces {formatAmerican(target.odds)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
