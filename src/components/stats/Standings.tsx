import { Badge as Chip, EmptyState } from "../ui";
import { rankMovement, type Badge, type StandingsRow } from "../../lib/scoring";
import { formatAmerican } from "../../lib/odds";
import { cn } from "../../lib/cn";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * The season table.
 *
 * The parlay itself almost never cashes, so this is the thing actually being
 * competed for. Points are weighted by how hard each pick was, which is why a
 * member can lead on points while sitting mid-table on hit rate.
 */
export function Standings({
  rows,
  badges,
}: {
  rows: StandingsRow[];
  badges: Map<string, Badge[]>;
}) {
  if (rows.length === 0 || rows.every((row) => row.legs === 0)) {
    return (
      <EmptyState
        icon="🏆"
        title="No points yet"
        description="Standings fill in as weeks are graded and closed."
      />
    );
  }

  const leader = rows[0]?.points ?? 0;

  return (
    <ol className="space-y-1.5">
      {rows.map((row) => {
        const movement = rankMovement(row);
        const earned = badges.get(row.key) ?? [];
        const share = leader > 0 ? Math.max(0, row.points / leader) : 0;

        return (
          <li
            key={row.key}
            className={cn(
              "relative overflow-hidden rounded-xl border px-3 py-2.5",
              row.rank === 1 && row.points > 0
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-line bg-surface",
            )}
          >
            {/* A quiet bar behind each row showing distance from the leader. */}
            <div
              aria-hidden
              className="absolute inset-y-0 left-0 bg-surface-3/70"
              style={{ width: `${Math.round(share * 100)}%` }}
            />

            <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="w-7 shrink-0 text-center text-sm font-bold tnum text-ink-muted">
                {row.rank <= 3 && row.points > 0 ? MEDALS[row.rank - 1] : row.rank}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-ink">{row.name}</span>

                  {movement !== null && movement !== 0 && (
                    <span
                      title={`${Math.abs(movement)} place${Math.abs(movement) === 1 ? "" : "s"} ${movement > 0 ? "up" : "down"} since last week`}
                      className={cn(
                        "text-[11px] font-medium tnum",
                        movement > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {movement > 0 ? "▲" : "▼"}
                      {Math.abs(movement)}
                    </span>
                  )}

                  {earned.map((badge) => (
                    <span key={badge.id} title={`${badge.label} — ${badge.description}`}>
                      {badge.emoji}
                      <span className="sr-only">
                        {badge.label}: {badge.description}
                      </span>
                    </span>
                  ))}
                </div>

                <div className="mt-0.5 text-xs text-ink-muted">
                  {row.wins}–{row.losses}
                  {row.bestLeg && (
                    <>
                      {" · best: "}
                      <span className="tnum">{formatAmerican(row.bestLeg.leg.odds)}</span>
                      {` (${row.bestLeg.points} pts)`}
                    </>
                  )}
                  {row.bustPoints > 0 && (
                    <span className="text-rose-600 dark:text-rose-400"> · −{row.bustPoints} busts</span>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-lg font-bold tnum text-ink">{row.points}</div>
                <div className="text-[10px] uppercase tracking-wide text-ink-faint">pts</div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The running Survivor board. */
export function SurvivorBoard({
  entrants,
  alive,
  champion,
  furthest,
}: {
  entrants: { key: string; name: string; alive: boolean; survived: number; eliminatedWeek: { week: number } | null }[];
  alive: number;
  champion: { name: string; survived: number } | null;
  furthest: { name: string; survived: number }[];
}) {
  if (entrants.length === 0) {
    return <EmptyState icon="🎲" title="Nobody entered yet" />;
  }

  return (
    <div className="space-y-3">
      {champion ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <span className="font-semibold text-ink">{champion.name}</span>{" "}
          {alive === 1
            ? "is the last one standing."
            : `lasted longest — ${champion.survived} week${champion.survived === 1 ? "" : "s"}.`}
        </p>
      ) : furthest.length > 1 ? (
        <p className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink-muted">
          Everyone's out. {furthest.map((entrant) => entrant.name).join(" and ")} tied on{" "}
          {furthest[0]!.survived} weeks.
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">{alive}</span> still alive. One losing leg and
          you're out — a push or a missed week won't kill you.
        </p>
      )}

      <ul className="flex flex-wrap gap-1.5">
        {entrants.map((entrant) => (
          <li key={entrant.key}>
            <Chip tone={entrant.alive ? "good" : "neutral"}>
              <span className={cn(!entrant.alive && "line-through opacity-70")}>{entrant.name}</span>
              {entrant.alive ? (
                <span className="tnum text-[10px]">{entrant.survived}</span>
              ) : (
                entrant.eliminatedWeek && (
                  <span className="text-[10px]">wk {entrant.eliminatedWeek.week}</span>
                )
              )}
            </Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}
