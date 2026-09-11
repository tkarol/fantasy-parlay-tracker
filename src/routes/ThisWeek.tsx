import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorState, SkeletonText } from "../components/ui";
import { WeekNav } from "../components/tracker/WeekNav";
import { TicketSummary } from "../components/tracker/TicketSummary";
import { DeadlineCountdown } from "../components/tracker/DeadlineCountdown";
import { LegList } from "../components/tracker/LegList";
import { MyLegForm } from "../components/tracker/MyLegForm";
import { TicketScreenshot } from "../components/tracker/TicketScreenshot";
import { useAuth } from "../hooks/useAuth";
import { useLeagueContext } from "../hooks/useLeagueContext";
import { useLegs } from "../hooks/useLegs";
import { useNow } from "../hooks/useNow";
import { describeFirestoreError } from "../hooks/firestoreState";
import { isWeekOpen, settleWeek } from "../lib/parlay";

/**
 * The landing page. A member signing in should see this week's ticket and,
 * if they haven't picked yet, the form to add their leg — without navigating.
 */
export default function ThisWeek() {
  const { user } = useAuth();
  const { leagueId, weeks, weeksLoading, weeksError, members, isAdmin, isMember } =
    useLeagueContext();
  const now = useNow();

  const [selectedId, setSelectedId] = useState("");

  // Open on the newest week, but never override a week the user picked.
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
  const { legs, loading: legsLoading, error: legsError } = useLegs(leagueId ?? undefined, week?.id);

  const settlement = useMemo(() => (week ? settleWeek(week, legs) : null), [week, legs]);
  const myLeg = useMemo(
    () => (user ? (legs.find((leg) => leg.uid === user.uid) ?? null) : null),
    [legs, user],
  );

  if (weeksError) {
    return (
      <Shell>
        <ErrorState message={describeFirestoreError(weeksError) ?? "Please try again."} />
      </Shell>
    );
  }

  if (weeksLoading) {
    return (
      <Shell>
        <Card>
          <CardBody>
            <SkeletonText lines={6} />
          </CardBody>
        </Card>
      </Shell>
    );
  }

  if (!week || !leagueId) {
    return (
      <Shell>
        <Card>
          <EmptyState
            icon="🏈"
            title="No weeks yet"
            description={
              isAdmin
                ? "Open the first week from the admin page and the ticket starts here."
                : "An admin needs to open a week before anyone can add a leg."
            }
            action={
              isAdmin ? (
                <Link
                  to="/admin"
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-ink"
                >
                  Go to admin
                </Link>
              ) : undefined
            }
          />
        </Card>
      </Shell>
    );
  }

  const open = isWeekOpen(week, now);
  const isLatestWeek = weeks[weeks.length - 1]?.id === week.id;

  const blockedReason = !isMember
    ? "Only league members can add a leg."
    : week.closed
      ? "This week is closed."
      : !open
        ? "The deadline has passed."
        : !isLatestWeek
          ? "You can only add a leg to the current week."
          : undefined;

  // When someone still needs to pick, that form is the page's main event.
  const needsLeg = isMember && !myLeg && blockedReason === undefined;

  const legForm = user && (
    <Card className={needsLeg ? "border-ink/25 shadow-md" : undefined}>
      <CardHeader
        title={needsLeg ? "Add your leg" : "Your leg"}
        description={
          needsLeg
            ? "You're not on this ticket yet."
            : myLeg
              ? "You're on this ticket."
              : undefined
        }
      />
      <CardBody>
        <MyLegForm
          leagueId={leagueId}
          week={week}
          user={user}
          myLeg={myLeg}
          otherLegs={legs.filter((leg) => leg.uid !== user.uid)}
          disabled={blockedReason !== undefined}
          disabledReason={blockedReason}
        />
      </CardBody>
    </Card>
  );

  return (
    <Shell>
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
          actions={<WeekNav weeks={weeks} selectedId={week.id} onSelect={setSelectedId} />}
        />
        <CardBody>{settlement && <TicketSummary week={week} settlement={settlement} />}</CardBody>
      </Card>

      {needsLeg && legForm}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="The ticket"
              description={`${legs.length} of ${members.length} member${members.length === 1 ? "" : "s"} in`}
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

          {!needsLeg && legForm}
        </div>

        <Card className="h-fit">
          <CardHeader title="Ticket screenshot" />
          <CardBody>
            <TicketScreenshot leagueId={leagueId} week={week} user={user} isAdmin={isAdmin} />
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-screen-xl space-y-4 px-3 py-5 sm:px-6">{children}</div>
  );
}
