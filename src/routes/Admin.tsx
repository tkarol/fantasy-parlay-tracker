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
  Select,
  SkeletonText,
} from "../components/ui";
import { SeasonControls } from "../components/admin/SeasonControls";
import { MemberAdmin } from "../components/admin/MemberAdmin";
import { LegLinkRepair } from "../components/admin/LegLinkRepair";
import { AdminWeekControls } from "../components/tracker/AdminWeekControls";
import { WeekNav } from "../components/tracker/WeekNav";
import { useAuth } from "../hooks/useAuth";
import { useLeagueContext } from "../hooks/useLeagueContext";
import { useLegs } from "../hooks/useLegs";
import { useToast } from "../hooks/useToast";
import { WEEKDAY_NAMES, describeDeadlineRule } from "../lib/dates";
import { deadlineRuleOf, renameLeague, setDeadlineRule, setDefaultStake } from "../lib/api";

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
  const [weekday, setWeekday] = useState("0");
  const [lockTime, setLockTime] = useState("12:00");

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
  const lockWeekday = league?.deadlineWeekday;
  const lockHour = league?.deadlineHour;
  const lockMinute = league?.deadlineMinute;
  useEffect(() => {
    if (leagueName !== undefined) setName(leagueName);
    if (leagueStake !== undefined) setStake(String(leagueStake));
    if (lockWeekday !== undefined) setWeekday(String(lockWeekday));
    if (lockHour !== undefined && lockMinute !== undefined) {
      setLockTime(`${String(lockHour).padStart(2, "0")}:${String(lockMinute).padStart(2, "0")}`);
    }
  }, [leagueName, leagueStake, lockWeekday, lockHour, lockMinute]);

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

      <LegLinkRepair leagueId={leagueId} weeks={weeks} members={members} />

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
        deadlineRule={deadlineRuleOf(league)}
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
              deadlineRule={deadlineRuleOf(league)}
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

          <Field
            label="Picks lock"
            hint={`New weeks get this deadline. Currently ${describeDeadlineRule(deadlineRuleOf(league))}.`}
          >
            {(id) => (
              <div className="flex flex-wrap gap-2">
                <Select
                  id={id}
                  value={weekday}
                  onChange={(event) => setWeekday(event.target.value)}
                  className="!w-auto"
                >
                  {WEEKDAY_NAMES.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Input
                  type="time"
                  value={lockTime}
                  onChange={(event) => setLockTime(event.target.value)}
                  aria-label="Lock time"
                  className="!w-auto"
                />
                <Button
                  loading={busy === "lock"}
                  onClick={() => {
                    const [hour, minute] = lockTime.split(":").map(Number);
                    if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
                      toast.error("Check the time", "Pick a time of day.");
                      return;
                    }
                    void run(
                      "lock",
                      () =>
                        setDeadlineRule(leagueId, {
                          weekday: Number(weekday),
                          hour: hour!,
                          minute: minute!,
                          // Anchored to Eastern so the lock tracks kickoff, not
                          // whoever happens to be creating the week.
                          timeZone: league!.deadlineTimeZone,
                        }),
                      "Lock time saved",
                    );
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
