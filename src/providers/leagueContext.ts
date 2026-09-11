import { createContext } from "react";
import type { FirestoreError } from "firebase/firestore";
import type { CurrentLeague } from "../hooks/useCurrentLeague";
import type { Member, Week } from "../types/models";

export interface LeagueContextValue extends CurrentLeague {
  weeks: Week[];
  weeksLoading: boolean;
  weeksError: FirestoreError | null;
  members: Member[];
  membersLoading: boolean;
  /** Seasons that have at least one week, newest first. */
  seasons: number[];
  /** The newest week overall — what the app opens on. */
  latestWeek: Week | null;
}

export const LeagueContext = createContext<LeagueContextValue | null>(null);
