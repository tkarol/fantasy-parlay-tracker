import { Card, CardBody, CardHeader } from "../ui";
import { DeltaChip, type DeltaFormat } from "./DeltaChip";
import { formatPercent, formatUsdSigned } from "../../lib/odds";
import type { MetricDelta, SeasonComparison } from "../../lib/stats";
import { cn } from "../../lib/cn";

interface Row {
  label: string;
  metric: MetricDelta;
  format: DeltaFormat;
  render: (value: number | null) => string;
  goodDirection?: "up" | "down";
}

/** This season against the one before it. */
export function SeasonCompare({ comparison }: { comparison: SeasonComparison }) {
  const previousSeason = comparison.previous?.season;

  const rows: Row[] = [
    {
      label: "Profit",
      metric: comparison.profit,
      format: "money",
      render: (value) => formatUsdSigned(value),
    },
    {
      label: "ROI",
      metric: comparison.roi,
      format: "percent",
      render: (value) => formatPercent(value, 1),
    },
    {
      label: "Tickets hit",
      metric: comparison.hitRate,
      format: "percent",
      render: (value) => formatPercent(value),
    },
    {
      label: "Weeks played",
      metric: comparison.weeksSettled,
      format: "count",
      render: (value) => (value === null ? "—" : String(value)),
    },
  ];

  return (
    <Card>
      <CardHeader
        title={`${comparison.current.season} vs ${previousSeason ?? "—"}`}
        description={
          previousSeason
            ? `How this season is going against ${previousSeason}.`
            : "No earlier season to compare against yet."
        }
      />
      <CardBody>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((row) => (
            <div key={row.label} className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                {row.label}
              </div>
              <div
                className={cn(
                  "mt-0.5 text-lg font-semibold tnum",
                  row.label === "Profit" && (row.metric.current ?? 0) > 0 && "text-emerald-600 dark:text-emerald-400",
                  row.label === "Profit" && (row.metric.current ?? 0) < 0 && "text-rose-600 dark:text-rose-400",
                )}
              >
                {row.render(row.metric.current)}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <DeltaChip
                  change={row.metric.change}
                  format={row.format}
                  goodDirection={row.goodDirection}
                />
                {row.metric.previous !== null && (
                  <span className="text-[11px] text-ink-faint">
                    was {row.render(row.metric.previous)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/** Each member's season against their last one. */
export function MemberSeasonCompare({ comparison }: { comparison: SeasonComparison }) {
  const previousSeason = comparison.previous?.season;
  if (!previousSeason || comparison.members.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Who improved"
        description={`Each member's ${comparison.current.season} against their ${previousSeason}.`}
      />
      <CardBody>
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-faint">
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Member
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {comparison.current.season} hit%
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {previousSeason} hit%
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Change
                </th>
                <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                  Busts
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.members.map((row) => (
                <tr key={row.key} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-ink">{row.name}</span>
                    {!row.current && (
                      <span className="ml-2 text-xs text-ink-faint">didn't play</span>
                    )}
                    {!row.previous && (
                      <span className="ml-2 text-xs text-ink-faint">first season</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tnum text-ink-muted">
                    {formatPercent(row.current?.hitRate ?? null)}
                  </td>
                  <td className="px-3 py-2.5 text-right tnum text-ink-muted">
                    {formatPercent(row.previous?.hitRate ?? null)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <DeltaChip change={row.hitRate.change} format="percent" />
                  </td>
                  <td className="hidden px-3 py-2.5 text-right tnum text-ink-muted sm:table-cell">
                    {row.current?.soloBusts ?? 0}
                    <span className="ml-1 text-xs text-ink-faint">
                      (was {row.previous?.soloBusts ?? 0})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
