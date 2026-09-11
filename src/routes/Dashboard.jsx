// src/pages/Dashboard.jsx
import React from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";
import useUserLeagues from "../hooks/useUserLeagues.js";

export default function Dashboard() {
  const { user } = useAuth();
  const { owned, memberOf, loading } = useUserLeagues(user?.uid);

  // Merge owned + memberOf, prefer "owner" role if both
  const leagues = React.useMemo(() => {
    const map = new Map();
    (owned || []).forEach((l) => map.set(l.id, { ...l, role: "owner" }));
    (memberOf || []).forEach((l) => {
      if (map.has(l.id)) return; // already owner
      map.set(l.id, { ...l, role: "member" });
    });
    return Array.from(map.values()).sort((a, b) =>
      (a.name || a.id).localeCompare(b.name || b.id)
    );
  }, [owned, memberOf]);

  const hasAny = leagues.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 p-4">
      <div className="mx-auto w-full max-w-screen-lg">
        {/* Header */}
        <header className="mb-5">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Your Leagues</h1>
          <p className="text-slate-600 text-sm md:text-base mt-1">
            Open a league to view weeks, add your leg, and see results.
          </p>
        </header>

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            Loading…
          </div>
        )}

        {/* Empty */}
        {!loading && !hasAny && (
          <section className="rounded-2xl border bg-white p-8 shadow-sm text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 grid place-content-center text-2xl">
              🏈
            </div>
            <h2 className="text-lg font-semibold mt-3">No leagues found</h2>
            <p className="text-slate-600 text-sm mt-1">
              Ask a league owner to invite you with their code.
            </p>
          </section>
        )}

        {/* Unified list */}
        {!loading && hasAny && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leagues.map((l) => (
              <li
                key={l.id}
                className="group rounded-2xl border bg-white/90 backdrop-blur shadow-sm hover:shadow-md transition
                           overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate text-slate-900">
                        {l.name || l.id}
                      </div>
                      <div className="text-[11px] text-slate-500">ID: {l.id}</div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap
                        ${l.role === "owner"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                    >
                      {l.role === "owner" ? "Owner" : "Member"}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="mt-4">
                    <Link
                      to={`/league/${l.id}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-3 py-2 text-sm
                                 hover:opacity-90"
                    >
                      Open League
                      <span className="transition -translate-x-0 group-hover:translate-x-0.5">→</span>
                    </Link>
                  </div>
                </div>

                {/* Decorative footer stripe */}
                <div
                  className={`h-1 w-full ${
                    l.role === "owner" ? "bg-emerald-200" : "bg-amber-200"
                  }`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
