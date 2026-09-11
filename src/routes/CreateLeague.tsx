import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ButtonLink, Card, CardBody, CardHeader, Field, Input } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { createLeague } from "../lib/api";

export default function CreateLeague() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [stake, setStake] = useState("5");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      toast.error("Sign in first", "You need an account to create a league.");
      return;
    }
    if (!name.trim()) {
      toast.error("Name your league", "Give it something your friends will recognise.");
      return;
    }
    const stakeValue = Number(stake);
    if (!Number.isFinite(stakeValue) || stakeValue < 0) {
      toast.error("Check the stake", "Enter a number like 5 or 20.");
      return;
    }

    setSaving(true);
    try {
      const leagueId = await createLeague(user, { name, stake: stakeValue });
      toast.success("League created", "Week 1 is open and ready for legs.");
      navigate(`/league/${leagueId}/settings`);
    } catch (error) {
      toast.error("Couldn't create the league", (error as Error)?.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
      <Card>
        <CardHeader
          title="Create a league"
          description="You'll be the admin: you grade legs, set deadlines, and approve members."
          actions={
            <ButtonLink to="/dashboard" size="sm" variant="ghost">
              Cancel
            </ButtonLink>
          }
        />
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="League name">
              {(id) => (
                <Input
                  id={id}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Sunday Degenerates"
                  maxLength={80}
                  autoFocus
                />
              )}
            </Field>

            <Field label="Weekly stake" hint="The total on each week's ticket. You can change it per week.">
              {(id) => (
                <Input
                  id={id}
                  value={stake}
                  onChange={(event) => setStake(event.target.value)}
                  inputMode="decimal"
                />
              )}
            </Field>

            <Button type="submit" variant="primary" fullWidth loading={saving}>
              Create league
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
