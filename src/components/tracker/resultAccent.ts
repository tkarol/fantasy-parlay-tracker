import type { LegResult } from "../../types/models";

/** Left edge colour on a leg row — scannable without reading the badge. */
export function resultAccent(result: LegResult): string {
  switch (result) {
    case "Win":
      return "border-l-emerald-500";
    case "Loss":
      return "border-l-rose-500";
    case "Push":
    case "Void":
      return "border-l-amber-500";
    default:
      return "border-l-slate-300 dark:border-l-slate-600";
  }
}
