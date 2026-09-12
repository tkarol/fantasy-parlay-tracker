import { useState, type ReactNode } from "react";
import { Button, Card, CardBody, Field, Input, SkeletonText } from "./ui";
import { useAuth } from "../hooks/useAuth";
import { useLeagueContext } from "../hooks/useLeagueContext";
import { useToast } from "../hooks/useToast";
import { DevSignIn, EMULATORS_ENABLED } from "./DevSignIn";
import { cancelJoinRequest, createLeague, requestToJoin, setAppLeague } from "../lib/api";

/**
 * Everything between landing on the site and seeing the ticket.
 *
 * The whole journey for a member is: sign in with Google, tap once to ask for
 * access, and after an admin approves, land straight on this week's ticket.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const { state } = useLeagueContext();

  switch (state) {
    case "loading":
      return (
        <Centered>
          <Card>
            <CardBody>
              <SkeletonText lines={5} />
            </CardBody>
          </Card>
        </Centered>
      );
    case "signed-out":
      return <SignedOut />;
    case "no-league":
      return <FirstRun />;
    case "not-member":
      return <RequestAccess />;
    case "pending":
      return <AwaitingApproval />;
    case "ready":
      return <>{children}</>;
  }
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-md px-4 py-10 sm:py-16">{children}</div>;
}

function Hero({
  title,
  body,
  children,
}: {
  title: string;
  body: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Centered>
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-content-center rounded-2xl bg-accent text-lg font-bold text-accent-ink">
          FP
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
        <div className="mx-auto mt-3 max-w-sm text-sm text-ink-muted">{body}</div>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </Centered>
  );
}

function SignedOut() {
  const { signIn, loading } = useAuth();

  return (
    <Hero
      title="One parlay. One leg each."
      body="Sign in to add your leg to this week's ticket and see where you sit on the board."
    >
      {EMULATORS_ENABLED ? (
        <div className="flex justify-center">
          <DevSignIn />
        </div>
      ) : (
        <Button variant="primary" size="lg" onClick={() => void signIn()} loading={loading}>
          Sign in with Google
        </Button>
      )}
    </Hero>
  );
}

function RequestAccess() {
  const { user } = useAuth();
  const { leagueId, leagueName } = useLeagueContext();
  const toast = useToast();
  const [sending, setSending] = useState(false);

  return (
    <Hero
      title={leagueName ? `Join ${leagueName}` : "Ask to join"}
      body="An admin has to let you in. One tap and they'll see your request."
    >
      <Button
        variant="primary"
        size="lg"
        loading={sending}
        onClick={async () => {
          if (!user || !leagueId) return;
          setSending(true);
          try {
            await requestToJoin(leagueId, "", user);
            toast.success("Request sent", "You'll be in as soon as an admin approves.");
          } catch (error) {
            toast.error("Couldn't send that request", (error as Error)?.message);
          } finally {
            setSending(false);
          }
        }}
      >
        Request access
      </Button>
    </Hero>
  );
}

function AwaitingApproval() {
  const { user, signOut } = useAuth();
  const { leagueId, leagueName } = useLeagueContext();
  const toast = useToast();

  return (
    <Hero
      title="Waiting on an admin"
      body={
        <>
          Your request to join {leagueName || "the league"} is in. This page updates on its own
          once you're approved.
        </>
      }
    >
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="ghost"
          onClick={async () => {
            if (!user || !leagueId) return;
            try {
              await cancelJoinRequest(leagueId, user.uid);
              toast.info("Request withdrawn");
            } catch (error) {
              toast.error("Couldn't withdraw that", (error as Error)?.message);
            }
          }}
        >
          Withdraw request
        </Button>
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </Hero>
  );
}

/** First run: no league exists yet, so whoever is here creates it. */
function FirstRun() {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [stake, setStake] = useState("5");
  const [saving, setSaving] = useState(false);

  return (
    <Centered>
      <Card>
        <CardBody className="space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-ink">Set up your league</h1>
            <p className="mt-1 text-sm text-ink-muted">
              This is a one-time setup. You'll be the admin: you grade legs, set deadlines and
              approve members.
            </p>
          </div>

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

          <Field label="Weekly stake" hint="The total on each week's ticket. Changeable later.">
            {(id) => (
              <Input
                id={id}
                value={stake}
                inputMode="decimal"
                onChange={(event) => setStake(event.target.value)}
              />
            )}
          </Field>

          <Button
            variant="primary"
            fullWidth
            loading={saving}
            onClick={async () => {
              if (!user) return;
              if (!name.trim()) {
                toast.error("Name your league");
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
                await setAppLeague(leagueId, name.trim());
                toast.success("League created", "Week 1 is open and ready for legs.");
              } catch (error) {
                toast.error("Couldn't create the league", (error as Error)?.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            Create league
          </Button>
        </CardBody>
      </Card>
    </Centered>
  );
}
