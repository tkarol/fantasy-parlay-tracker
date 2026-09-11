import { cn } from "../../lib/cn";

export type DeltaFormat = "money" | "percent" | "count";

/**
 * The change in a metric against the comparison season.
 *
 * "Better" is not always "bigger" — fewer busts is an improvement — so the
 * direction that counts as good is passed in rather than assumed.
 */
export function DeltaChip({
  change,
  format,
  goodDirection = "up",
  suffix,
}: {
  change: number | null;
  format: DeltaFormat;
  goodDirection?: "up" | "down";
  suffix?: string;
}) {
  if (change === null) {
    return <span className="text-[11px] text-ink-faint">no comparison</span>;
  }
  if (change === 0) {
    return <span className="text-[11px] text-ink-faint">no change</span>;
  }

  const improved = goodDirection === "up" ? change > 0 : change < 0;
  const arrow = change > 0 ? "▲" : "▼";

  const magnitude =
    format === "money"
      ? `$${Math.abs(change).toFixed(2)}`
      : format === "percent"
        ? `${Math.abs(change * 100).toFixed(1)} pts`
        : `${Math.abs(change)}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium tnum",
        improved ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      )}
    >
      <span aria-hidden>{arrow}</span>
      {magnitude}
      {suffix && <span className="font-normal text-ink-faint">{suffix}</span>}
    </span>
  );
}
