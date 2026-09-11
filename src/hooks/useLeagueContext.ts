import { useContext } from "react";
import { LeagueContext, type LeagueContextValue } from "../providers/leagueContext";

export function useLeagueContext(): LeagueContextValue {
  const context = useContext(LeagueContext);
  if (!context) throw new Error("useLeagueContext must be used inside <LeagueProvider>");
  return context;
}
