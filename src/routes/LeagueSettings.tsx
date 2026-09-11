import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  SkeletonText,
} from "../components/ui";
import { Avatar } from "../components/NavBar";
import { useAuth } from "../hooks/useAuth";
import { useLeague } from "../hooks/useLeague";
import { useJoinRequests, useMembers } from "../hooks/useMembers";
import { useToast } from "../hooks/useToast";
import {
  approveJoinRequest,
  ensureInviteCodeDoc,
  rejectJoinRequest,
  removeMember,
  renameLeague,
  rotateInviteCode,
  setDefaultStake,
  setMemberRole,
} from "../lib/api";
import { formatDate } from "../lib/dates";
import type { Member } from "../types/models";

export default function LeagueSettings() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const { league, isAdmin, isOwner, loading } = useLeague(leagueId, user?.uid);
  const { members, loading: membersLoading } = useMembers(leagueId);
  const { requests } = useJoinRequests(leagueId, isAdmin);

  const [name, setName] = useState("");
  const [stake, setStake] = useState("5");
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<Member | null>(null);

  // Primitive deps on purpose: `league` is a fresh object on every snapshot,
  // and depending on it would wipe the form out from under an in-progress edit.
  const leagueName = league?.name;
  const leagueStake = league?.defaultStake;
  useEffect(() => {
    if (leagueName !== undefined) setName(leagueName);
    if (leagueStake !== undefined) setStake(String(leagueStake));
  }, [leagueName, leagueStake]);

  // Repair leagues created before invite codes were indexed separately. Without
  // this document nobody can join with the existing code.
  const inviteCode = league?.inviteCode;
  useEffect(() => {
    if (!isAdmin || !leagueId || !inviteCode || !leagueName) return;
    void ensureInviteCodeDoc(leagueId, leagueName, inviteCode).catch(() => {
      // Non-fatal: rotating the code achieves the same repair.
    });
  }, [isAdmin, leagueId, inviteCode, leagueName]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Card>
          <CardBody>
            <SkeletonText lines={5} />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!league || !leagueId) return null;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <EmptyState
            icon="🔒"
            title="Admins only"
            description="Only league admins can change settings."
            action={<ButtonLink to={`/league/${leagueId}`}>Back to the league</ButtonLink>}
          />
        </Card>
      </div>
    );
  }

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

  const inviteUrl = `${window.location.origin}/join?code=${league.inviteCode}`;

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Couldn't copy", "Your browser blocked clipboard access — copy it manually.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
      <header>
        <Link to={`/league/${leagueId}`} className="text-xs text-ink-muted hover:text-ink hover:underline">
          ← Back to {league.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">League settings</h1>
      </header>

      <Card>
        <CardHeader title="Invite" description="Share either the code or the link." />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-lg tracking-[0.25em] text-ink">
              {league.inviteCode || "—"}
            </code>
            <Button size="sm" onClick={() => void copy(league.inviteCode, "Code")}>
              Copy code
            </Button>
            <Button size="sm" onClick={() => void copy(inviteUrl, "Link")}>
              Copy link
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={busy === "rotate"}
              onClick={() =>
                void run(
                  "rotate",
                  () => rotateInviteCode(leagueId, league.name),
                  "New code issued — the old one no longer works",
                )
              }
            >
              Rotate
            </Button>
          </div>
          <p className="text-xs text-ink-faint">
            Rotating retires the current code. Anyone holding it will be told it expired rather
            than that it's invalid.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Join requests"
          description={requests.length ? `${requests.length} waiting` : "Nobody waiting right now."}
        />
        <CardBody>
          {requests.length === 0 ? (
            <p className="text-sm text-ink-muted">
              People who enter your invite code show up here for approval.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {requests.map((request) => (
                <li key={request.uid} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={request.displayName} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{request.displayName}</p>
                    <p className="truncate text-xs text-ink-faint">{request.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      loading={busy === `approve-${request.uid}`}
                      onClick={() =>
                        void run(
                          `approve-${request.uid}`,
                          () => approveJoinRequest(leagueId, request),
                          `${request.displayName} is in`,
                        )
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === `reject-${request.uid}`}
                      onClick={() =>
                        void run(
                          `reject-${request.uid}`,
                          () => rejectJoinRequest(leagueId, request.uid),
                          "Request declined",
                        )
                      }
                    >
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Members" description={`${members.length} in the league`} />
        <CardBody>
          {membersLoading ? (
            <SkeletonText lines={3} />
          ) : (
            <ul className="divide-y divide-line">
              {members.map((member) => {
                const memberIsOwner = member.uid === league.ownerUid;
                return (
                  <li key={member.uid} className="flex flex-wrap items-center gap-3 py-3">
                    <Avatar name={member.displayName} photoURL={member.photoURL} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                        {member.displayName}
                        {memberIsOwner && <Badge tone="brand">Owner</Badge>}
                        {!memberIsOwner && member.role === "admin" && <Badge tone="info">Admin</Badge>}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {member.email}
                        {member.joinedAt && ` · joined ${formatDate(member.joinedAt)}`}
                      </p>
                    </div>

                    {!memberIsOwner && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={busy === `role-${member.uid}`}
                          onClick={() =>
                            void run(
                              `role-${member.uid}`,
                              () =>
                                setMemberRole(
                                  leagueId,
                                  member.uid,
                                  member.role === "admin" ? "member" : "admin",
                                ),
                              member.role === "admin"
                                ? `${member.displayName} is now a member`
                                : `${member.displayName} is now an admin`,
                            )
                          }
                        >
                          {member.role === "admin" ? "Demote" : "Make admin"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPendingRemoval(member)}>
                          Remove
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="League" />
        <CardBody className="space-y-4">
          <Field label="Name">
            {(id) => (
              <div className="flex gap-2">
                <Input id={id} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
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

          <Field label="Default weekly stake" hint="Applied to newly created weeks.">
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

          {isOwner && (
            <p className="text-xs text-ink-faint">
              You own this league, so you can't be removed or demoted by another admin.
            </p>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={`Remove ${pendingRemoval?.displayName}?`}
        destructive
        busy={busy === "remove"}
        confirmLabel="Remove member"
        message="They lose access to the league. Legs they already submitted stay on past tickets and in the stats."
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          const target = pendingRemoval;
          if (!target) return;
          void run(
            "remove",
            async () => {
              await removeMember(leagueId, target.uid);
              setPendingRemoval(null);
              if (target.uid === user?.uid) navigate("/dashboard");
            },
            `${target.displayName} removed`,
          );
        }}
      />
    </div>
  );
}
