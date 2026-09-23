import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  SkeletonText,
} from "../components/ui";
import { WeekNav } from "../components/tracker/WeekNav";
import { DeadlineCountdown } from "../components/tracker/DeadlineCountdown";
import { LegList } from "../components/tracker/LegList";
import { YourLegCard } from "../components/tracker/YourLegCard";
import { TicketScreenshot } from "../components/tracker/TicketScreenshot";
import { MissingPicks } from "../components/tracker/MissingPicks";
import { AdminWeekBar } from "../components/tracker/AdminWeekBar";
import { deadlineRuleOf } from "../lib/api";
import { SweatStatus } from "../components/tracker/SweatStatus";
import { WeekAwards } from "../components/tracker/WeekAwards";
import { GradeWeekDialog } from "../components/tracker/GradeWeekDialog";
import { FillOddsDialog } from "../components/tracker/FillOddsDialog";
import { SeasonGlance } from "../components/tracker/SeasonGlance";
import { ReactionNudge } from "../components/tracker/ReactionNudge";
import { useAuth } from "../hooks/useAuth";
import { useLeagueContext } from "../hooks/useLeagueContext";
import { useLegs, useLegsByWeek } from "../hooks/useLegs";
import { useReactions } from "../hooks/useReactions";
import { useNow } from "../hooks/useNow";
import { describeFirestoreError } from "../hooks/firestoreState";
import { isWeekOpen, settleWeek } from "../lib/parlay";
import { buildTickets, summarizeSeason } from "../lib/stats";
import { buildStandings } from "../lib/scoring";

/**
 * The landing page. A member signing in should see this week's ticket and,
 * if they haven't picked yet, the form to add their leg — without navigating.
 */
export default function ThisWeek() {
  const { user } = useAuth();
  const { leagueId, league, weeks, weeksLoading, weeksError, members, isAdmin, isMember, leagueName } =
    useLeagueContext();
  const now = useNow();

  const [selectedId, setSelectedId] = useState("");
  const [gradingOpen, setGradingOpen] = useState(false);
  const [fillOddsOpen, setFillOddsOpen] = useState(false);

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
  const reactions = useReactions(leagueId ?? undefined, week?.id);

  const settlement = useMemo(() => (week ? settleWeek(week, legs) : null), [week, legs]);

  /*
   * The season summary at the foot of the page. Scoped to the season being
   * viewed rather than every season on record: this is one listener per week,
   * and a glance does not need last year.
   */
  const season = week?.season ?? null;
  const seasonWeeks = useMemo(
    () => (season === null ? [] : weeks.filter((candidate) => candidate.season === season)),
    [weeks, season],
  );
  const seasonWeekIds = useMemo(() => seasonWeeks.map((w) => w.id), [seasonWeeks]);
  const { legsByWeek, loading: seasonLegsLoading } = useLegsByWeek(
    leagueId ?? undefined,
    seasonWeekIds,
  );
  const seasonTickets = useMemo(
    () => buildTickets(seasonWeeks, legsByWeek),
    [seasonWeeks, legsByWeek],
  );
  const seasonSummary = useMemo(() => summarizeSeason(seasonTickets), [seasonTickets]);
  const seasonStandings = useMemo(
    () => buildStandings(seasonTickets, members),
    [seasonTickets, members],
  );
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
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
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
        ? "Picks are locked for this week."
        : !isLatestWeek
          ? "You can only add a leg to the current week."
          : undefined;

  // When someone still needs to pick, that form is the page's main event.
  const needsLeg = isMember && !myLeg && blockedReason === undefined;

  const legForm = user && (
    <YourLegCard
      leagueId={leagueId}
      week={week}
      user={user}
      myLeg={myLeg}
      now={now}
      disabled={blockedReason !== undefined}
      disabledReason={blockedReason}
      needsLeg={needsLeg}
    />
  );

  return (
    <Shell>
      {needsLeg && legForm}

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
        <CardBody className="space-y-3">
          {settlement && legs.length > 0 && (
            <SweatStatus legs={legs} settlement={settlement} week={week} />
          )}
          {isMember && (
            <MissingPicks
              week={week}
              legs={legs}
              members={members}
              leagueName={leagueName}
              now={now}
              open={open}
            />
          )}
          {isAdmin && settlement && (
            <AdminWeekBar
              leagueId={leagueId}
              week={week}
              weeks={weeks}
              settlement={settlement}
              unpriced={legs.filter((leg) => leg.odds === null).length}
              deadlineRule={deadlineRuleOf(league)}
              open={open}
              onGrade={() => setGradingOpen(true)}
              onFillOdds={() => setFillOddsOpen(true)}
              onWeekChange={setSelectedId}
            />
          )}
        </CardBody>
      </Card>

      {settlement?.settled && (
        <WeekAwards ticket={{ week, legs, settlement }} />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="The ticket"
              description={`${legs.length} of ${members.length} member${members.length === 1 ? "" : "s"} in`}
              actions={
                isAdmin && legs.length > 0 ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setFillOddsOpen(true)}>
                      Paste slip
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setGradingOpen(true)}>
                      Grade all
                    </Button>
                  </>
                ) : undefined
              }
            />
            <CardBody>
              {legsError ? (
                <ErrorState message={describeFirestoreError(legsError) ?? undefined} />
              ) : legsLoading ? (
                <SkeletonText lines={4} />
              ) : (
                <>
                  <ReactionNudge
                    legs={legs}
                    reactions={reactions}
                    currentUid={user?.uid ?? null}
                    enabled={isMember && isLatestWeek}
                  />
                  <LegList
                    leagueId={leagueId}
                    week={week}
                    legs={legs}
                    isAdmin={isAdmin}
                    adminUid={user?.uid ?? ""}
                    currentUid={user?.uid ?? null}
                    user={user}
                    reactions={reactions}
                    canReact={isMember}
                  />
                </>
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

      {season !== null && (
        <SeasonGlance
          season={season}
          summary={seasonSummary}
          standings={seasonStandings}
          currentUid={user?.uid ?? null}
          loading={seasonLegsLoading}
        />
      )}

      {isAdmin && (
        <FillOddsDialog
          open={fillOddsOpen}
          onClose={() => setFillOddsOpen(false)}
          leagueId={leagueId}
          week={week}
          legs={legs}
        />
      )}

      {isAdmin && user && (
        <GradeWeekDialog
          open={gradingOpen}
          onClose={() => setGradingOpen(false)}
          leagueId={leagueId}
          week={week}
          legs={legs}
          adminUid={user.uid}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-screen-xl space-y-4 px-3 py-5 sm:px-6">{children}</div>
  );
}
