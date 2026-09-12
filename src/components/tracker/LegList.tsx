import { useState } from "react";
import type { User } from "firebase/auth";
import { Badge, Button, ConfirmDialog, EmptyState, Input, Select } from "../ui";
import { ResultBadge } from "./ResultBadge";
import { LegReactions } from "./LegReactions";
import { resultAccent } from "./resultAccent";
import { useToast } from "../../hooks/useToast";
import { adminUpdateLeg, deleteLeg, gradeLeg, setLegOdds } from "../../lib/api";
import { americanToDecimal, formatAmerican, parseAmerican } from "../../lib/odds";
import { parsePick } from "../../lib/slip";
import { QuickPrices } from "./OddsField";
import { LEG_RESULTS, type Leg, type LegResult, type Reaction, type Week } from "../../types/models";
import { cn } from "../../lib/cn";

export function LegList({
  leagueId,
  week,
  legs,
  isAdmin,
  adminUid,
  currentUid,
  user,
  reactions,
  canReact,
}: {
  leagueId: string;
  week: Week;
  legs: Leg[];
  isAdmin: boolean;
  adminUid: string;
  currentUid: string | null;
  user: User | null;
  reactions: Record<string, Reaction[]>;
  canReact: boolean;
}) {
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Leg | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (legs.length === 0) {
    return (
      <EmptyState
        icon="🎟"
        title="No legs yet"
        description="The ticket fills in as members add their picks."
      />
    );
  }

  async function onGrade(leg: Leg, result: LegResult) {
    try {
      await gradeLeg(leagueId, week.id, leg.id, result, adminUid);
    } catch (error) {
      toast.error("Couldn't save that grade", (error as Error)?.message);
    }
  }

  async function onConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteLeg(leagueId, week.id, pendingDelete.id);
      toast.success("Leg removed");
      setPendingDelete(null);
    } catch (error) {
      toast.error("Couldn't remove that leg", (error as Error)?.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ul className="space-y-2">
        {legs.map((leg) => {
          const isMine = currentUid !== null && leg.uid === currentUid;
          const decimal = americanToDecimal(leg.odds);

          if (isAdmin && editingId === leg.id) {
            return (
              <li key={leg.id}>
                <AdminLegEditor
                  leagueId={leagueId}
                  weekId={week.id}
                  leg={leg}
                  adminUid={adminUid}
                  onDone={() => setEditingId(null)}
                />
              </li>
            );
          }

          return (
            <li
              key={leg.id}
              className={cn(
                "rounded-xl border border-l-4 border-line bg-surface px-3 py-2.5",
                resultAccent(leg.result),
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {leg.memberName || "Unknown member"}
                    </span>
                    {isMine && <Badge tone="info">You</Badge>}
                    {leg.odds === null && <Badge tone="warn">No odds</Badge>}
                  </div>
                  <p className="mt-0.5 break-words text-sm text-ink-muted">{leg.leg || "—"}</p>
                  <LegReactions
                    leagueId={leagueId}
                    weekId={week.id}
                    legId={leg.id}
                    reactions={reactions[leg.id] ?? []}
                    user={user}
                    canReact={canReact}
                  />
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="tnum text-sm font-semibold text-ink" title={decimal ? `${decimal.toFixed(2)}x` : undefined}>
                    {formatAmerican(leg.odds)}
                  </span>
                  <ResultBadge result={leg.result} />
                </div>
              </div>

              {/* Every leg now arrives unpriced, so the price goes in right
                  here rather than through the full edit row. It disappears as
                  soon as there is one. */}
              {isAdmin && leg.odds === null && (
                <PriceLeg leagueId={leagueId} weekId={week.id} legId={leg.id} />
              )}

              {isAdmin && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
                  {LEG_RESULTS.map((result) => (
                    <button
                      key={result}
                      type="button"
                      onClick={() => onGrade(leg, result)}
                      aria-pressed={leg.result === result}
                      className={cn(
                        "rounded-lg px-2 py-1 text-xs font-medium transition",
                        leg.result === result
                          ? "bg-accent text-accent-ink"
                          : "border border-line text-ink-muted hover:bg-surface-3 hover:text-ink",
                      )}
                    >
                      {result}
                    </button>
                  ))}
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(leg.id)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setPendingDelete(leg)}>
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this leg?"
        destructive
        busy={deleting}
        confirmLabel="Delete leg"
        message={
          <>
            <span className="font-medium text-ink">{pendingDelete?.memberName}</span>'s leg{" "}
            <span className="italic">{pendingDelete?.leg}</span> will be removed from this ticket.
          </>
        }
        onConfirm={onConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

/** One leg's price, entered where the leg is. */
function PriceLeg({
  leagueId,
  weekId,
  legId,
}: {
  leagueId: string;
  weekId: string;
  legId: string;
}) {
  const toast = useToast();
  const [odds, setOdds] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(raw: string) {
    const parsed = parseAmerican(raw);
    if (parsed === null) {
      if (raw.trim() !== "") toast.error("Check the price", "Use American odds, like -110 or +150.");
      return;
    }
    setSaving(true);
    try {
      await setLegOdds(leagueId, weekId, [{ legId, odds: parsed }]);
    } catch (error) {
      toast.error("Couldn't save that price", (error as Error)?.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
      <span className="text-xs font-medium text-ink-muted">Price</span>
      <Input
        value={odds}
        disabled={saving}
        onChange={(event) => setOdds(event.target.value)}
        onBlur={(event) => void save(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        placeholder="-110"
        aria-label="Price this leg"
        className="!w-28"
      />
      <QuickPrices
        value={odds}
        onPick={(next) => {
          setOdds(next);
          void save(next);
        }}
      />
    </div>
  );
}

function AdminLegEditor({
  leagueId,
  weekId,
  leg,
  adminUid,
  onDone,
}: {
  leagueId: string;
  weekId: string;
  leg: Leg;
  adminUid: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [memberName, setMemberName] = useState(leg.memberName);
  const [text, setText] = useState(leg.leg);
  const [odds, setOdds] = useState(leg.odds === null ? "" : String(leg.odds));
  const [result, setResult] = useState<LegResult>(leg.result);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    if (odds.trim() !== "" && parseAmerican(odds) === null) {
      toast.error("Check the odds", "Use American odds, like -110 or +150.");
      return;
    }
    setSaving(true);
    try {
      await adminUpdateLeg(
        leagueId,
        weekId,
        leg.id,
        { memberName, leg: text, odds: parseAmerican(odds), result },
        adminUid,
      );
      toast.success("Leg updated");
      onDone();
    } catch (error) {
      toast.error("Couldn't update that leg", (error as Error)?.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={memberName}
          onChange={(event) => setMemberName(event.target.value)}
          placeholder="Member name"
          aria-label="Member name"
        />
        <div className="space-y-1.5">
          <Input
            value={odds}
            onChange={(event) => setOdds(event.target.value)}
            placeholder="Odds, e.g. -110"
            aria-label="Odds"
          />
          <QuickPrices value={odds} onPick={setOdds} />
        </div>
      </div>
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onPaste={(event) => {
          const parsed = parsePick(event.clipboardData.getData("text"));
          if (parsed.odds === null) return;
          event.preventDefault();
          setText(parsed.leg);
          setOdds(String(parsed.odds));
        }}
        onBlur={(event) => {
          if (odds.trim() !== "") return;
          const parsed = parsePick(event.target.value);
          if (parsed.odds === null) return;
          setText(parsed.leg);
          setOdds(String(parsed.odds));
        }}
        placeholder="Leg description — paste the whole line and the price splits out"
        aria-label="Leg description"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={result}
          onChange={(event) => setResult(event.target.value as LegResult)}
          aria-label="Result"
          className="w-32"
        >
          {LEG_RESULTS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={onSave} loading={saving}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
