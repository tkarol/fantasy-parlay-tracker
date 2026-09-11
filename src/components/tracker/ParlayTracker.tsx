import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, SkeletonText } from "../ui";
import { WeekPicker } from "./WeekPicker";
import { TicketSummary } from "./TicketSummary";
import { DeadlineCountdown } from "./DeadlineCountdown";
import { LegList } from "./LegList";
import { MyLegForm } from "./MyLegForm";
import { AdminWeekControls } from "./AdminWeekControls";
import { TicketScreenshot } from "./TicketScreenshot";
import { useLegs } from "../../hooks/useLegs";
import { useNow } from "../../hooks/useNow";
import { useToast } from "../../hooks/useToast";
import { describeFirestoreError } from "../../hooks/firestoreState";
import { createWeek } from "../../lib/api";
import { isWeekOpen, settleWeek } from "../../lib/parlay";
import type { Member, Week } from "../../types/models";

export function ParlayTracker({
  leagueId,
  weeks,
  weeksLoading,
  weeksError,
  members,
  user,
  isAdmin,
  isMember,
  defaultStake,
}: {
  leagueId: string;
  weeks: Week[];
  weeksLoading: boolean;
  weeksError: { code?: string } | null;
  members: Member[];
  user: User | null;
  isAdmin: boolean;
  isMember: boolean;
  defaultStake: number;
}) {
  const toast = useToast();
  const now = useNow();
  const [selectedId, setSelectedId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  // Default to the newest week, but never fight a selection the user made.
  useEffect(() => {
    if (weeks.length === 0) {
      setSelectedId("");
      return;
    }
    setSelectedId((current) =>
      current && weeks.some((week) => week.id === current) ? current : weeks[weeks.length - 1]!.id,
    );
  }, [weeks]);

  const week = weeks.find((candidate) => candidate.id === selectedId) ?? null;
  const { legs, loading: legsLoading, error: legsError } = useLegs(leagueId, week?.id);

  const settlement = useMemo(
    () => (week ? settleWeek(week, legs) : null),
    [week, legs],
  );

  const myLeg = useMemo(
    () => (user ? (legs.find((leg) => leg.uid === user.uid) ?? null) : null),
    [legs, user],
  );

  const open = isWeekOpen(week, now);
  const isLatestWeek = week !== null && weeks[weeks.length - 1]?.id === week.id;

  if (weeksError) {
    return (
      <ErrorState
        title="Can't load this league's weeks"
        message={describeFirestoreError(weeksError as never) ?? "Please try again."}
      />
    );
  }

  if (weeksLoading) {
    return (
      <Card>
        <CardBody>
          <SkeletonText lines={5} />
        </CardBody>
      </Card>
    );
  }

  if (!week) {
    return (
      <Card>
        <EmptyState
          icon="🏈"
          title="No weeks yet"
          description={
            isAdmin
              ? "Create the first week to start taking legs."
              : "An admin needs to open the first week before anyone can add a leg."
          }
          action={
            isAdmin ? (
              <Button
                variant="primary"
                loading={creating}
                onClick={async () => {
                  setCreating(true);
                  try {
                    const season = new Date().getFullYear();
                    const id = await createWeek(leagueId, {
                      season,
                      week: 1,
                      stake: defaultStake,
                    });
                    setSelectedId(id);
                    toast.success("Week 1 is open");
                  } catch (error) {
                    toast.error("Couldn't create the week", (error as Error)?.message);
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                Create week 1
              </Button>
            ) : undefined
          }
        />
      </Card>
    );
  }

  const submissionBlockedReason = !isMember
    ? "Only league members can add a leg."
    : week.closed
      ? "This week is closed."
      : !open
        ? "The deadline for this week has passed."
        : !isLatestWeek
          ? "You can only add a leg to the current week."
          : undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              Week {week.week}
              <span className="text-sm font-normal text-ink-faint">{week.season}</span>
              {week.closed && <Badge tone="neutral">Closed</Badge>}
            </span>
          }
          description={<DeadlineCountdown week={week} now={now} />}
          actions={<WeekPicker weeks={weeks} selectedId={week.id} onSelect={setSelectedId} />}
        />
        <CardBody>{settlement && <TicketSummary week={week} settlement={settlement} />}</CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="The ticket"
              description={`${legs.length} leg${legs.length === 1 ? "" : "s"} this week`}
            />
            <CardBody>
              {legsError ? (
                <ErrorState message={describeFirestoreError(legsError) ?? undefined} />
              ) : legsLoading ? (
                <SkeletonText lines={4} />
              ) : (
                <LegList
                  leagueId={leagueId}
                  week={week}
                  legs={legs}
                  isAdmin={isAdmin}
                  adminUid={user?.uid ?? ""}
                  currentUid={user?.uid ?? null}
                />
              )}
            </CardBody>
          </Card>

          {user && (
            <Card>
              <CardHeader
                title="Your leg"
                description={myLeg ? "You're on this ticket." : "Add your pick to the ticket."}
              />
              <CardBody>
                <MyLegForm
                  leagueId={leagueId}
                  week={week}
                  user={user}
                  myLeg={myLeg}
                  otherLegs={legs.filter((leg) => leg.uid !== user.uid)}
                  disabled={submissionBlockedReason !== undefined}
                  disabledReason={submissionBlockedReason}
                />
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Ticket screenshot" />
            <CardBody>
              <TicketScreenshot leagueId={leagueId} week={week} user={user} isAdmin={isAdmin} />
            </CardBody>
          </Card>

          {isAdmin && user && (
            <Card>
              <CardHeader title="Admin" description="Week settings and grading." />
              <CardBody>
                <AdminWeekControls
                  leagueId={leagueId}
                  week={week}
                  weeks={weeks}
                  legs={legs}
                  members={members}
                  adminUid={user.uid}
                  onWeekChange={setSelectedId}
                />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
