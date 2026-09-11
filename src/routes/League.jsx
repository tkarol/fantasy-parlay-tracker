import React from "react";
import { Link, useParams } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";
import useLeague from "../hooks/useLeague.js";
import FantasyParlayTracker from "../components/FantasyParlayTracker.jsx";

export default function League() {
  const { leagueId } = useParams();
  const { user } = useAuth();
  const { league, myMember, loading } = useLeague(leagueId, user?.uid);

  const isOwner = league && user && league.ownerUid === user.uid;
  const role = myMember?.role || (isOwner ? "admin" : null);
  const isAdmin = role === "admin";
  const isMember = !!role; // only admins for now until approved

  if (loading) return <div className="p-4">Loading…</div>;
  if (!league) return <div className="p-4">League not found.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 p-2 md:p-4">
      <div className="mx-auto w-full max-w-screen-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">{league.name || leagueId}</h1>
            <div className="text-xs text-slate-500">League ID: {leagueId}</div>
          </div>
          {isAdmin && (
            <Link to={`/league/${leagueId}/settings`} className="rounded-lg border px-3 py-1">
              Settings
            </Link>
          )}
        </div>

        <FantasyParlayTracker leagueId={leagueId} isAdmin={role === "admin"} isMember={!!role} />
      </div>
    </div>
  );
}
