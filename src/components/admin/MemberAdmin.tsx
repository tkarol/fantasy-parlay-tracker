import { useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, SkeletonText } from "../ui";
import { Avatar } from "../NavBar";
import { useToast } from "../../hooks/useToast";
import { useJoinRequests } from "../../hooks/useMembers";
import { approveJoinRequest, rejectJoinRequest, removeMember, setMemberRole } from "../../lib/api";
import { formatDate } from "../../lib/dates";
import type { Member } from "../../types/models";

export function MemberAdmin({
  leagueId,
  members,
  membersLoading,
  ownerUid,
}: {
  leagueId: string;
  members: Member[];
  membersLoading: boolean;
  ownerUid: string;
}) {
  const toast = useToast();
  const { requests } = useJoinRequests(leagueId, true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<Member | null>(null);

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
    <>
      {requests.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader
            title={`${requests.length} waiting to join`}
            description="Approve to let them add a leg."
          />
          <CardBody>
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
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Members"
          description={`${members.length} in the league${requests.length === 0 ? " · nobody waiting to join" : ""}`}
        />
        <CardBody>
          {membersLoading ? (
            <SkeletonText lines={3} />
          ) : (
            <ul className="divide-y divide-line">
              {members.map((member) => {
                const isOwner = member.uid === ownerUid;
                return (
                  <li key={member.uid} className="flex flex-wrap items-center gap-3 py-3">
                    <Avatar name={member.displayName} photoURL={member.photoURL} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 truncate text-sm font-medium text-ink">
                        {member.displayName}
                        {isOwner && <Badge tone="brand">Owner</Badge>}
                        {!isOwner && member.role === "admin" && <Badge tone="info">Admin</Badge>}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {member.email}
                        {member.joinedAt && ` · joined ${formatDate(member.joinedAt)}`}
                      </p>
                    </div>

                    {!isOwner && (
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
            },
            `${target.displayName} removed`,
          );
        }}
      />
    </>
  );
}
