import { useEffect, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { Button, Field, Input } from "../ui";
import { useToast } from "../../hooks/useToast";
import { deleteLeg, submitMyLeg } from "../../lib/api";
import { formatAmerican } from "../../lib/odds";
import type { Leg, Week } from "../../types/models";

/**
 * A member's own leg: the pick, and nothing else.
 *
 * Members used to type their own price too, which made them responsible for a
 * number they had no way to get right — the book's final price is on the slip
 * the admin places, not on the screen the member was looking at. So the pick
 * is all that is asked for, and pricing happens once, from the real ticket.
 */
export function MyLegForm({
  leagueId,
  week,
  user,
  myLeg,
  disabled,
  disabledReason,
  emphasis = false,
}: {
  leagueId: string;
  week: Week;
  user: User;
  myLeg: Leg | null;
  disabled: boolean;
  disabledReason?: string;
  /** Bigger submit for the "your turn" card. */
  emphasis?: boolean;
}) {
  const toast = useToast();
  const [text, setText] = useState(myLeg?.leg ?? "");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Re-sync when the week changes or another device edits the same leg.
  useEffect(() => {
    setText(myLeg?.leg ?? "");
  }, [myLeg?.id, myLeg?.leg, week.id]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (disabled) return;

    if (!text.trim()) {
      toast.error("Add your pick", "Describe the leg you want on the ticket.");
      return;
    }

    setSaving(true);
    try {
      // No `odds` key: the price is the admin's, and an edit here must not
      // erase one they have already filled in.
      await submitMyLeg(leagueId, week.id, week, user, { leg: text }, !myLeg);
      toast.success(myLeg ? "Leg updated" : "Leg added to the ticket");
    } catch (error) {
      toast.error("Couldn't save your leg", messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    setRemoving(true);
    try {
      await deleteLeg(leagueId, week.id, user.uid);
      setText("");
      toast.success("Leg removed");
    } catch (error) {
      toast.error("Couldn't remove your leg", messageOf(error));
    } finally {
      setRemoving(false);
    }
  }

  if (disabled) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface-2 px-4 py-5 text-center">
        <p className="text-sm text-ink-muted">{disabledReason ?? "Submissions are closed."}</p>
        {myLeg && (
          <p className="mt-2 text-sm text-ink">
            Your leg: <span className="font-medium">{myLeg.leg}</span>
            {myLeg.odds !== null && (
              <span className="tnum text-ink-muted"> {formatAmerican(myLeg.odds)}</span>
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Your pick" hint="Whatever you'd tell the group — team, line, however you say it.">
        {(id) => (
          <Input
            id={id}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Bills -3.5"
            maxLength={500}
            autoComplete="off"
          />
        )}
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="primary"
          size={emphasis ? "lg" : "md"}
          loading={saving}
          className={emphasis ? "flex-1 sm:flex-none" : undefined}
        >
          {myLeg ? "Update my leg" : "Add my leg"}
        </Button>
        {myLeg && (
          <Button type="button" variant="ghost" onClick={onRemove} loading={removing}>
            Remove
          </Button>
        )}
      </div>
    </form>
  );
}

function messageOf(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === "permission-denied") {
    return "The deadline may have just passed, or you're no longer a member of this league.";
  }
  return (error as { message?: string })?.message ?? "Please try again.";
}
