import { useState } from "react";
import { Badge, EmptyState } from "../ui";
import { formatPercent, formatUsdSigned } from "../../lib/odds";
import { formatStreak, sortLeaderboard, type LeaderboardSortKey, type MemberStats } from "../../lib/stats";
import { cn } from "../../lib/cn";

interface Column {
  key: LeaderboardSortKey;
  label: string;
  title: string;
  align: "left" | "right";
  render: (row: MemberStats) => React.ReactNode;
  className?: string;
}

const COLUMNS: Column[] = [
  {
    key: "name",
    label: "Member",
    title: "League member",
    align: "left",
    render: (row) => <span className="font-medium text-ink">{row.name}</span>,
  },
  {
    key: "legs",
    label: "Legs",
    title: "Legs submitted",
    align: "right",
    render: (row) => row.legs,
  },
  {
    key: "wins",
    label: "W–L–P",
    title: "Wins, losses, pushes",
    align: "right",
    render: (row) => (
      <span className="tnum">
        {row.wins}–{row.losses}–{row.pushes}
      </span>
    ),
  },
  {
    key: "hitRate",
    label: "Hit%",
    title: "Wins as a share of decided legs. Pushes don't count either way.",
    align: "right",
    render: (row) => <span className="font-semibold">{formatPercent(row.hitRate)}</span>,
  },
  {
    key: "streak",
    label: "Streak",
    title: "Current run of wins or losses",
    align: "right",
    render: (row) => formatStreak(row.streak),
  },
  {
    key: "winsAboveExpected",
    label: "vs price",
    title: "Wins above what the odds implied. Positive means beating the market.",
    align: "right",
    render: (row) =>
      row.winsAboveExpected === null ? (
        "—"
      ) : (
        <span
          className={cn(
            row.winsAboveExpected > 0 && "text-emerald-600 dark:text-emerald-400",
            row.winsAboveExpected < 0 && "text-rose-600 dark:text-rose-400",
          )}
        >
          {row.winsAboveExpected > 0 ? "+" : ""}
          {row.winsAboveExpected.toFixed(1)}
        </span>
      ),
    className: "hidden md:table-cell",
  },
  {
    key: "carries",
    label: "Carries",
    title: "Winning legs on tickets that cashed",
    align: "right",
    render: (row) => row.carries,
    className: "hidden sm:table-cell",
  },
  {
    key: "soloBusts",
    label: "Busts",
    title: "Tickets this member alone broke",
    align: "right",
    render: (row) =>
      row.soloBusts > 0 ? (
        <span className="font-semibold text-rose-600 dark:text-rose-400">{row.soloBusts}</span>
      ) : (
        "0"
      ),
  },
  {
    key: "bustCost",
    label: "Cost",
    title: "Profit the group lost to this member's solo busts",
    align: "right",
    render: (row) => (row.bustCost > 0 ? `-$${row.bustCost.toFixed(2)}` : "—"),
    className: "hidden sm:table-cell",
  },
  {
    key: "soloProfit",
    label: "Solo P&L",
    title:
      "Hypothetical: what these legs would have made as individual bets. Not the group's money.",
    align: "right",
    render: (row) => (
      <span
        className={cn(
          "tnum",
          row.soloProfit > 0 && "text-emerald-600 dark:text-emerald-400",
          row.soloProfit < 0 && "text-rose-600 dark:text-rose-400",
        )}
      >
        {formatUsdSigned(row.soloProfit)}
      </span>
    ),
    className: "hidden lg:table-cell",
  },
];

export function Leaderboard({ members }: { members: MemberStats[] }) {
  const [sort, setSort] = useState<{ key: LeaderboardSortKey; direction: "asc" | "desc" }>({
    key: "hitRate",
    direction: "desc",
  });

  if (members.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No stats yet"
        description="Once legs are graded, the leaderboard fills in."
      />
    );
  }

  const rows = sortLeaderboard(members, sort.key, sort.direction);

  function toggle(key: LeaderboardSortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
        : { key, direction: key === "name" ? "asc" : "desc" },
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            {COLUMNS.map((column) => {
              const active = sort.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  title={column.title}
                  aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                  className={cn(
                    "px-3 py-2 text-xs font-medium",
                    column.align === "right" ? "text-right" : "text-left",
                    column.className,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(column.key)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded transition hover:text-ink",
                      active ? "text-ink" : "text-ink-faint",
                    )}
                  >
                    {column.label}
                    <span aria-hidden className={cn("text-[9px]", !active && "opacity-0")}>
                      {sort.direction === "desc" ? "▼" : "▲"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key} className="border-b border-line/60 last:border-0">
              {COLUMNS.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-3 py-2.5 tnum text-ink-muted",
                    column.align === "right" ? "text-right" : "text-left",
                    column.className,
                  )}
                >
                  {column.key === "name" ? (
                    <span className="flex items-center gap-2">
                      {index === 0 && sort.key === "hitRate" && sort.direction === "desc" && (
                        <Badge tone="brand">1st</Badge>
                      )}
                      {column.render(row)}
                      {row.legs === 0 && <span className="text-xs text-ink-faint">no legs</span>}
                    </span>
                  ) : (
                    column.render(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
