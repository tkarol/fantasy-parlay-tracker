import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { serverTimestamp, setDoc } from "firebase/firestore";
import useAuth from "../hooks/useAuth.js";
import { leagueDoc, memberDoc, weekDoc } from "../lib/firestorePaths.js";
import { makeInviteCode, makeLeagueId } from "../lib/rand.js";

function nextThursdaySixPmLocal(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay(); // 0=Sun ... 4=Thu
  const daysUntilThu = (4 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilThu);
  d.setHours(18, 0, 0, 0);
  return d;
}

export default function CreateLeague() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!user) {
      setErr("Please sign in first.");
      return;
    }
    if (!name.trim()) {
      setErr("Enter a league name.");
      return;
    }

    setSaving(true);
    try {
      const id = makeLeagueId(name);
      const inviteCode = makeInviteCode();

      // 1) Create league doc
      await setDoc(leagueDoc(id), {
        name: name.trim(),
        ownerUid: user.uid,
        ownerEmail: user.email,
        inviteCode,
        createdAt: serverTimestamp(),
        memberUids: [user.uid],
      });

      // 2) Seed your membership (admin)
      await setDoc(memberDoc(id, user.uid), {
        role: "admin",
        uid: user.uid,
        displayName: user.displayName || user.email || "Admin",
        email: user.email || "",
        joinedAt: serverTimestamp(),
      });

      // 3) Create Week 1 (AFTER you're an admin)
      const season = new Date().getFullYear();
      const weekId = `${season}-1`;
      await setDoc(
        weekDoc(id, weekId),
        {
          season,
          week: 1,
          stake: 5,
          deadline: nextThursdaySixPmLocal(),
          closed: false,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 4) Done — go to this league
      nav(`/league/${id}`);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || String(e2));
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      <div className="mx-auto max-w-screen-sm px-4 py-6 md:py-10">
        {/* Header with Back button */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Create League
          </h1>
          <button
            onClick={() => nav("/dashboard")}
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-white/60 bg-white/40 backdrop-blur"
          >
            <span className="-ml-1">←</span> Back to Dashboard
          </button>
        </div>

        {/* Card */}
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border bg-white/90 backdrop-blur p-4 md:p-6 shadow-sm space-y-4"
        >
          <div>
            <label className="block text-xs text-slate-600">League Name</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunday Degens"
            />
          </div>

          {err && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded">
              {err}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => nav("/dashboard")}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              disabled={saving}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create League"}
            </button>
          </div>
        </form>

        <p className="text-xs text-slate-600 mt-3">
          Tip: We create <strong>Week 1</strong> automatically with a $5 stake and a next Thu 6pm deadline.
          You can edit it later in the league.
        </p>
      </div>
    </div>
  );
}
