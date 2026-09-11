import { useEffect, useState } from "react";
import { Button, ConfirmDialog, Field, Input, Modal, Select } from "../ui";
import { useToast } from "../../hooks/useToast";
import {
  adminAddLegForMember,
  closeWeekAndOpenNext,
  createWeek,
  deleteWeek,
  reopenWeek,
  updateWeek,
} from "../../lib/api";
import { nextThursdaySixPm, toDateTimeLocalValue } from "../../lib/dates";
import { parseAmerican } from "../../lib/odds";
import type { Leg, Member, Week } from "../../types/models";

export function AdminWeekControls({
  leagueId,
  week,
  weeks,
  legs,
  members,
  adminUid,
  onWeekChange,
}: {
  leagueId: string;
  week: Week;
  weeks: Week[];
  legs: Leg[];
  members: Member[];
  adminUid: string;
  onWeekChange: (weekId: string) => void;
}) {
  const toast = useToast();
  const [stake, setStake] = useState(String(week.stake));
  const [deadline, setDeadline] = useState(toDateTimeLocalValue(week.deadline));
  const [payout, setPayout] = useState(week.payoutOverride === null ? "" : String(week.payoutOverride));
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addLegOpen, setAddLegOpen] = useState(false);
  const [newWeekOpen, setNewWeekOpen] = useState(false);

  useEffect(() => {
    setStake(String(week.stake));
    setDeadline(toDateTimeLocalValue(week.deadline));
    setPayout(week.payoutOverride === null ? "" : String(week.payoutOverride));
  }, [week.id, week.stake, week.deadline, week.payoutOverride]);

  async function run(label: string, action: () => Promise<unknown>, success?: string) {
    setBusy(label);
    try {
      await action();
      if (success) toast.success(success);
    } catch (error) {
      toast.error("That didn't work", (error as Error)?.message);
    } finally {
      setBusy(null);
    }
  }

  const missingMembers = members.filter(
    (member) => !legs.some((leg) => leg.uid === member.uid),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Stake" hint="Total on the ticket for this week.">
          {(id) => (
            <div className="flex gap-2">
              <Input
                id={id}
                value={stake}
                inputMode="decimal"
                onChange={(event) => setStake(event.target.value)}
              />
              <Button
                variant="secondary"
                loading={busy === "stake"}
                onClick={() => {
                  const value = Number(stake);
                  if (!Number.isFinite(value) || value < 0) {
                    toast.error("Check the stake", "Enter a number like 5 or 20.");
                    return;
                  }
                  void run("stake", () => updateWeek(leagueId, week.id, { stake: value }), "Stake updated");
                }}
              >
                Save
              </Button>
            </div>
          )}
        </Field>

        <Field label="Deadline" hint="Submissions lock at this time.">
          {(id) => (
            <div className="flex gap-2">
              <Input
                id={id}
                type="datetime-local"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
              <Button
                variant="secondary"
                loading={busy === "deadline"}
                onClick={() => {
                  const ms = Date.parse(deadline);
                  if (!Number.isFinite(ms)) {
                    toast.error("Check the deadline", "That date couldn't be read.");
                    return;
                  }
                  void run(
                    "deadline",
                    () => updateWeek(leagueId, week.id, { deadline: new Date(ms) }),
                    "Deadline updated",
                  );
                }}
              >
                Save
              </Button>
            </div>
          )}
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          loading={busy === "thursday"}
          onClick={() =>
            void run(
              "thursday",
              () => updateWeek(leagueId, week.id, { deadline: nextThursdaySixPm() }),
              "Deadline set to Thursday 6pm",
            )
          }
        >
          Set next Thursday 6pm
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAddLegOpen(true)}>
          Add a leg for someone
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setNewWeekOpen(true)}>
          Create a week
        </Button>
      </div>

      <Field
        label="Actual payout (optional)"
        hint="Record what the book actually returned — boosts, promos, corrections. Total returned, not profit."
      >
        {(id) => (
          <div className="flex gap-2">
            <Input
              id={id}
              value={payout}
              inputMode="decimal"
              placeholder="Leave blank to use the calculated price"
              onChange={(event) => setPayout(event.target.value)}
            />
            <Button
              variant="secondary"
              loading={busy === "payout"}
              onClick={() => {
                const trimmed = payout.trim();
                if (trimmed === "") {
                  void run(
                    "payout",
                    () => updateWeek(leagueId, week.id, { payoutOverride: null }),
                    "Payout cleared",
                  );
                  return;
                }
                const value = Number(trimmed);
                if (!Number.isFinite(value) || value < 0) {
                  toast.error("Check the payout", "Enter a number like 23.86.");
                  return;
                }
                void run(
                  "payout",
                  () => updateWeek(leagueId, week.id, { payoutOverride: value }),
                  "Payout recorded",
                );
              }}
            >
              Save
            </Button>
          </div>
        )}
      </Field>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {week.closed ? (
          <Button
            variant="secondary"
            loading={busy === "reopen"}
            onClick={() => void run("reopen", () => reopenWeek(leagueId, week.id), "Week reopened")}
          >
            Reopen week
          </Button>
        ) : (
          <Button
            variant="primary"
            loading={busy === "close"}
            onClick={() =>
              void run(
                "close",
                async () => {
                  const nextId = await closeWeekAndOpenNext(
                    leagueId,
                    week,
                    weeks.map((w) => w.id),
                  );
                  onWeekChange(nextId);
                },
                "Week closed and the next one opened",
              )
            }
          >
            Close week &amp; open next
          </Button>
        )}
        <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
          Delete week
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete week ${week.week}?`}
        destructive
        busy={busy === "delete"}
        confirmLabel="Delete week"
        message={`This removes the week and all ${legs.length} leg${legs.length === 1 ? "" : "s"} on it. This cannot be undone.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          void run(
            "delete",
            async () => {
              await deleteWeek(leagueId, week.id);
              const fallback = weeks.filter((w) => w.id !== week.id).at(-1);
              if (fallback) onWeekChange(fallback.id);
              setConfirmDelete(false);
            },
            "Week deleted",
          )
        }
      />

      <AddLegForMemberDialog
        open={addLegOpen}
        onClose={() => setAddLegOpen(false)}
        leagueId={leagueId}
        week={week}
        adminUid={adminUid}
        candidates={missingMembers}
      />

      <CreateWeekDialog
        open={newWeekOpen}
        onClose={() => setNewWeekOpen(false)}
        leagueId={leagueId}
        weeks={weeks}
        defaultStake={week.stake}
        onCreated={onWeekChange}
      />
    </div>
  );
}

function AddLegForMemberDialog({
  open,
  onClose,
  leagueId,
  week,
  adminUid,
  candidates,
}: {
  open: boolean;
  onClose: () => void;
  leagueId: string;
  week: Week;
  adminUid: string;
  candidates: Member[];
}) {
  const toast = useToast();
  const [uid, setUid] = useState("");
  const [text, setText] = useState("");
  const [odds, setOdds] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setUid(candidates[0]?.uid ?? "");
      setText("");
      setOdds("");
    }
  }, [open, candidates]);

  async function onSave() {
    const member = candidates.find((m) => m.uid === uid);
    if (!member) {
      toast.error("Pick a member", "Choose who this leg belongs to.");
      return;
    }
    if (!text.trim()) {
      toast.error("Add the pick", "Describe the leg.");
      return;
    }
    setSaving(true);
    try {
      await adminAddLegForMember(
        leagueId,
        week.id,
        week,
        { uid: member.uid, displayName: member.displayName },
        { leg: text, odds: parseAmerican(odds) },
        adminUid,
      );
      toast.success(`Leg added for ${member.displayName}`);
      onClose();
    } catch (error) {
      toast.error("Couldn't add that leg", (error as Error)?.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a leg for a member"
      description="Legs are keyed to the member, so this counts towards their record."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} loading={saving} disabled={candidates.length === 0}>
            Add leg
          </Button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <p className="text-sm text-ink-muted">Everyone in this league already has a leg this week.</p>
      ) : (
        <div className="space-y-3">
          <Field label="Member">
            {(id) => (
              <Select id={id} value={uid} onChange={(event) => setUid(event.target.value)}>
                {candidates.map((member) => (
                  <option key={member.uid} value={member.uid}>
                    {member.displayName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Pick">
            {(id) => (
              <Input
                id={id}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Chiefs -7"
              />
            )}
          </Field>
          <Field label="Odds" hint="Optional — can be filled in later.">
            {(id) => (
              <Input
                id={id}
                value={odds}
                onChange={(event) => setOdds(event.target.value)}
                placeholder="-110"
              />
            )}
          </Field>
        </div>
      )}
    </Modal>
  );
}

function CreateWeekDialog({
  open,
  onClose,
  leagueId,
  weeks,
  defaultStake,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  leagueId: string;
  weeks: Week[];
  defaultStake: number;
  onCreated: (weekId: string) => void;
}) {
  const toast = useToast();
  const latest = weeks.at(-1);
  const [season, setSeason] = useState(String(latest?.season ?? new Date().getFullYear()));
  const [weekNumber, setWeekNumber] = useState(String((latest?.week ?? 0) + 1));
  const [stake, setStake] = useState(String(defaultStake));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSeason(String(latest?.season ?? new Date().getFullYear()));
    setWeekNumber(String((latest?.week ?? 0) + 1));
    setStake(String(defaultStake));
  }, [open, latest?.season, latest?.week, defaultStake]);

  async function onSave() {
    const seasonValue = Number(season);
    const weekValue = Number(weekNumber);
    const stakeValue = Number(stake);
    if (!Number.isInteger(seasonValue) || seasonValue < 2000) {
      toast.error("Check the season", "Use a year like 2025.");
      return;
    }
    if (!Number.isInteger(weekValue) || weekValue < 1) {
      toast.error("Check the week", "Use a whole number, 1 or higher.");
      return;
    }
    if (weeks.some((w) => w.season === seasonValue && w.week === weekValue)) {
      toast.error("That week already exists", `Season ${seasonValue}, week ${weekValue}.`);
      return;
    }
    setSaving(true);
    try {
      const id = await createWeek(leagueId, {
        season: seasonValue,
        week: weekValue,
        stake: Number.isFinite(stakeValue) ? stakeValue : defaultStake,
      });
      onCreated(id);
      toast.success(`Week ${weekValue} created`);
      onClose();
    } catch (error) {
      toast.error("Couldn't create that week", (error as Error)?.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a week"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} loading={saving}>
            Create week
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Season">
          {(id) => <Input id={id} value={season} onChange={(e) => setSeason(e.target.value)} inputMode="numeric" />}
        </Field>
        <Field label="Week">
          {(id) => (
            <Input id={id} value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} inputMode="numeric" />
          )}
        </Field>
        <Field label="Stake">
          {(id) => <Input id={id} value={stake} onChange={(e) => setStake(e.target.value)} inputMode="decimal" />}
        </Field>
      </div>
    </Modal>
  );
}
