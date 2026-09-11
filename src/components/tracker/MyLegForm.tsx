import { useEffect, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { Button, Field, Input } from "../ui";
import { useToast } from "../../hooks/useToast";
import { deleteLeg, submitMyLeg } from "../../lib/api";
import {
  americanToDecimal,
  decimalToAmerican,
  formatAmerican,
  formatUsd,
  parseAmerican,
} from "../../lib/odds";
import { combineDecimal } from "../../lib/parlay";
import type { Leg, Week } from "../../types/models";

/**
 * A member's own leg, including its price.
 *
 * Members could previously only submit leg *text* — every odds value had to be
 * typed in later by an admin, which is why so many legs sat unpriced.
 */
export function MyLegForm({
  leagueId,
  week,
  user,
  myLeg,
  otherLegs,
  disabled,
  disabledReason,
}: {
  leagueId: string;
  week: Week;
  user: User;
  myLeg: Leg | null;
  otherLegs: Leg[];
  disabled: boolean;
  disabledReason?: string;
}) {
  const toast = useToast();
  const [text, setText] = useState(myLeg?.leg ?? "");
  const [odds, setOdds] = useState(myLeg?.odds === null ? "" : String(myLeg?.odds ?? ""));
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [oddsError, setOddsError] = useState<string | null>(null);

  // Re-sync when the week changes or another device edits the same leg.
  useEffect(() => {
    setText(myLeg?.leg ?? "");
    setOdds(myLeg?.odds === null || myLeg?.odds === undefined ? "" : String(myLeg.odds));
    setOddsError(null);
  }, [myLeg?.id, myLeg?.leg, myLeg?.odds, week.id]);

  const parsedOdds = parseAmerican(odds);
  const oddsLooksWrong = odds.trim() !== "" && parsedOdds === null;

  // Live preview of what this leg does to the ticket.
  const projected = combineDecimal([...otherLegs.map((leg) => leg.odds), parsedOdds]);
  const myDecimal = americanToDecimal(parsedOdds);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (disabled) return;

    if (!text.trim()) {
      toast.error("Add your pick", "Describe the leg you want on the ticket.");
      return;
    }
    if (oddsLooksWrong) {
      setOddsError("Use American odds, like -110 or +150.");
      return;
    }

    setSaving(true);
    try {
      await submitMyLeg(leagueId, week.id, week, user, { leg: text, odds: parsedOdds }, !myLeg);
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
      setOdds("");
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
            Your leg: <span className="font-medium">{myLeg.leg}</span>{" "}
            <span className="tnum text-ink-muted">{formatAmerican(myLeg.odds)}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <Field label="Your pick" hint="What are you putting on the ticket?">
          {(id) => (
            <Input
              id={id}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Bills -3.5 vs Jets"
              maxLength={500}
              autoComplete="off"
            />
          )}
        </Field>

        <Field
          label="Odds"
          error={oddsError}
          hint={myDecimal ? `${myDecimal.toFixed(2)}x` : "American, e.g. -110"}
        >
          {(id) => (
            <Input
              id={id}
              value={odds}
              onChange={(event) => {
                setOdds(event.target.value);
                setOddsError(null);
              }}
              placeholder="-110"
              inputMode="text"
              className={oddsLooksWrong ? "border-rose-500/60" : undefined}
            />
          )}
        </Field>
      </div>

      {projected !== null && (
        <p className="rounded-lg bg-surface-3 px-3 py-2 text-xs text-ink-muted">
          With your leg the ticket prices at{" "}
          <span className="font-semibold tnum text-ink">
            {formatAmerican(decimalToAmerican(projected))}
          </span>{" "}
          — {formatUsd(week.stake)} returns{" "}
          <span className="font-semibold tnum text-ink">{formatUsd(week.stake * projected)}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" loading={saving}>
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
