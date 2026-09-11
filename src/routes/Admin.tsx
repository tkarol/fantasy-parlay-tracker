import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  SkeletonText,
} from "../components/ui";
import { SeasonControls } from "../components/admin/SeasonControls";
import { MemberAdmin } from "../components/admin/MemberAdmin";
import { AdminWeekControls } from "../components/tracker/AdminWeekControls";
import { WeekNav } from "../components/tracker/WeekNav";
import { useAuth } from "../hooks/useAuth";
import { useLeagueContext } from "../hooks/useLeagueContext";
import { useLegs } from "../hooks/useLegs";
import { useToast } from "../hooks/useToast";
import { renameLeague, setDefaultStake } from "../lib/api";

/** Everything an admin does, on one page, in the order they tend to need it. */
export default function Admin() {
  const { user } = useAuth();
  const {
    leagueId,
    league,
    weeks,
    weeksLoading,
    members,
    membersLoading,
    seasons,
    isAdmin,
    state,
  } = useLeagueContext();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [stake, setStake] = useState("5");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (weeks.length === 0) {
      setSelectedId("");
      return;
    }
    setSelectedId((current) =>
      current && weeks.some((week) => week.id === current) ? current : weeks[weeks.length - 1]!.id,
    );
  }, [weeks]);

  const leagueName = league?.name;
  const leagueStake = league?.defaultStake;
  useEffect(() => {
    if (leagueName !== undefined) setName(leagueName);
    if (leagueStake !== undefined) setStake(String(leagueStake));
  }, [leagueName, leagueStake]);

  const week = weeks.find((candidate) => candidate.id === selectedId) ?? null;
  const { legs } = useLegs(leagueId ?? undefined, week?.id);

  if (state === "loading") {
    return (
      <Shell>
        <Card>
          <CardBody>
            <SkeletonText lines={5} />
          </CardBody>
        </Card>
      </Shell>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;
  if (!leagueId || !league || !user) return null;

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

  return (
    <Shell>
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Admin</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Grading happens on the ticket itself — this page is for weeks, seasons and people.
        </p>
      </header>

      <MemberAdmin
        leagueId={leagueId}
        members={members}
        membersLoading={membersLoading}
        ownerUid={league.ownerUid}
      />

      <SeasonControls
        leagueId={leagueId}
        weeks={weeks}
        seasons={seasons}
        defaultStake={league.defaultStake}
        onSeasonStarted={setSelectedId}
      />

      <Card>
        <CardHeader
          title="Weeks"
          description={week ? `Editing week ${week.week} of ${week.season}.` : undefined}
          actions={
            weeks.length > 0 ? (
              <WeekNav weeks={weeks} selectedId={selectedId} onSelect={setSelectedId} />
            ) : undefined
          }
        />
        <CardBody>
          {weeksLoading ? (
            <SkeletonText lines={4} />
          ) : !week ? (
            <EmptyState
              icon="🗓"
              title="No weeks yet"
              description="Start a season above to open week 1."
            />
          ) : (
            <AdminWeekControls
              leagueId={leagueId}
              week={week}
              weeks={weeks}
              legs={legs}
              members={members}
              adminUid={user.uid}
              onWeekChange={setSelectedId}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="League" />
        <CardBody className="space-y-4">
          <Field label="Name">
            {(id) => (
              <div className="flex gap-2">
                <Input
                  id={id}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                />
                <Button
                  loading={busy === "name"}
                  onClick={() => {
                    if (!name.trim()) {
                      toast.error("Name can't be empty");
                      return;
                    }
                    void run("name", () => renameLeague(leagueId, name), "League renamed");
                  }}
                >
                  Save
                </Button>
              </div>
            )}
          </Field>

          <Field label="Default weekly stake" hint="Applied to newly created weeks and seasons.">
            {(id) => (
              <div className="flex gap-2">
                <Input
                  id={id}
                  value={stake}
                  inputMode="decimal"
                  onChange={(event) => setStake(event.target.value)}
                />
                <Button
                  loading={busy === "stake"}
                  onClick={() => {
                    const value = Number(stake);
                    if (!Number.isFinite(value) || value < 0) {
                      toast.error("Check the stake", "Enter a number like 5 or 20.");
                      return;
                    }
                    void run("stake", () => setDefaultStake(leagueId, value), "Default stake saved");
                  }}
                >
                  Save
                </Button>
              </div>
            )}
          </Field>
        </CardBody>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl space-y-4 px-3 py-5 sm:px-6">{children}</div>;
}
