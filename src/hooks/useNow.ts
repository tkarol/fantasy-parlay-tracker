import { useEffect, useState } from "react";

/**
 * A clock that actually ticks.
 *
 * Deadline state was previously computed once inside a `useMemo` over
 * `Date.now()`, so a week never locked on screen — the UI kept offering the
 * submit form until something unrelated forced a re-render.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    // Waking from a background tab can leave the clock stale by minutes.
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  return now;
}
