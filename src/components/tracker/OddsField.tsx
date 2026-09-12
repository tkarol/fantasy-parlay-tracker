import { cn } from "../../lib/cn";

/** The prices almost every leg lands on, so nobody types -110 by hand. */
const QUICK_PRICES = [-110, -120, 100, 150];

export function QuickPrices({
  value,
  onPick,
}: {
  value: string;
  onPick: (odds: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {QUICK_PRICES.map((price) => {
        const label = price > 0 ? `+${price}` : String(price);
        const active = value.trim().replace(/^\+/, "") === String(price);
        return (
          <button
            key={price}
            type="button"
            onClick={() => onPick(String(price))}
            aria-pressed={active}
            className={cn(
              "rounded-lg px-2 py-0.5 text-xs tnum leading-5 transition",
              active
                ? "bg-accent text-accent-ink"
                : "border border-line text-ink-muted hover:bg-surface-3 hover:text-ink",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
