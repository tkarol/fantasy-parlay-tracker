import { useEffect, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader } from "../ui";
import { useToast } from "../../hooks/useToast";
import { linkLegacyLegs, scanUnlinkedLegs, type UnlinkedScan } from "../../lib/api";
import type { Member, Week } from "../../types/models";

/**
 * One-off repair for legs the original app saved without an owner.
 *
 * Stats already resolve those by name, so nothing is broken on screen — but
 * that match breaks the day someone changes their Google display name. This
 * writes the link into the data. The card hides itself once there is nothing
 * left to fix.
 */
export function LegLinkRepair({
  leagueId,
  weeks,
  members,
}: {
  leagueId: string;
  weeks: Week[];
  members: Member[];
}) {
  const toast = useToast();
  const [scan, setScan] = useState<UnlinkedScan | null>(null);
  const [running, setRunning] = useState(false);
  const [unmatched, setUnmatched] = useState<string[]>([]);

  useEffect(() => {
    if (weeks.length === 0 || members.length === 0) return;
    let cancelled = false;
    scanUnlinkedLegs(leagueId, weeks, members)
      .then((result) => {
        if (!cancelled) setScan(result);
      })
      .catch(() => {
        if (!cancelled) setScan({ matchable: 0, unmatchedNames: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, weeks, members]);

  // Still scanning, or nothing here can actually be fixed. Legs belonging to
  // people who left never match anyone, and nagging about them forever is
  // worse than leaving them as they are.
  if (scan === null || scan.matchable === 0) return null;
  const unlinked = scan.matchable;

  return (
    <Card className="border-amber-500/40">
      <CardHeader
        title="Link old legs to members"
        description={
          <>
            <Badge tone="warn">{unlinked} unlinked</Badge>{" "}
            <span>
              These were entered by an admin in the old app and never recorded whose they were.
              The leaderboard already matches them up by name — this makes it permanent, so it
              keeps working if someone changes their Google name.
            </span>
          </>
        }
      />
      <CardBody className="space-y-3">
        <Button
          variant="primary"
          loading={running}
          onClick={async () => {
            setRunning(true);
            try {
              const report = await linkLegacyLegs(leagueId, weeks, members);
              setUnmatched(report.unmatched);
              setScan(await scanUnlinkedLegs(leagueId, weeks, members));
              toast.success(
                `Linked ${report.linked} leg${report.linked === 1 ? "" : "s"}`,
                report.unmatched.length > 0
                  ? `${report.unmatched.length} name${report.unmatched.length === 1 ? "" : "s"} didn't match a member.`
                  : undefined,
              );
            } catch (error) {
              toast.error("Couldn't link those legs", (error as Error)?.message);
            } finally {
              setRunning(false);
            }
          }}
        >
          Link {unlinked} leg{unlinked === 1 ? "" : "s"}
        </Button>

        {unmatched.length > 0 && (
          <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
            <p className="text-xs font-medium text-ink">Left alone — no member matches:</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {unmatched.map((name) => (
                <li key={name}>
                  <Badge tone="neutral">{name}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-faint">
              These are people who left the league, or a name spelled differently from their
              account. They still appear on the leaderboard under that name.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
