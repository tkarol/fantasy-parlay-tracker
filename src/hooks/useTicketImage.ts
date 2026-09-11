import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { ticketImageDoc } from "../lib/firestorePaths";
import { readTicketImage } from "../lib/converters";
import type { TicketImage, Week } from "../types/models";

/**
 * The week's ticket screenshot.
 *
 * Loaded per week rather than with the week list, so subscribing to a whole
 * season never pulls image bytes for weeks nobody is looking at.
 *
 * Falls back to a Cloud Storage URL still recorded on the week document, so
 * screenshots uploaded before the move keep working.
 */
export function useTicketImage(leagueId: string | undefined, week: Week | null) {
  const [image, setImage] = useState<TicketImage | null>(null);
  const [loading, setLoading] = useState(true);

  const weekId = week?.id;
  const legacy = week?.ticketImage ?? null;

  useEffect(() => {
    if (!leagueId || !weekId) {
      setImage(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    return onSnapshot(
      ticketImageDoc(leagueId, weekId),
      (snap) => {
        setImage(snap.exists() ? readTicketImage(snap.data()) : null);
        setLoading(false);
      },
      () => {
        setImage(null);
        setLoading(false);
      },
    );
  }, [leagueId, weekId]);

  return { image: image ?? legacy, loading };
}
