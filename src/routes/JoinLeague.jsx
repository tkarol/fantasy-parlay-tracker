import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import useAuth from "../hooks/useAuth.js";
import { joinReqDoc } from "../lib/firestorePaths.js";

export default function JoinLeague() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!user) { setErr("Please sign in first."); return; }
    const clean = code.trim().toUpperCase();
    if (!clean) return setErr("Enter an invite code.");
    setSubmitting(true);
    try {
      const q = query(collection(db, "leagues"), where("inviteCode", "==", clean));
      const snap = await getDocs(q);
      if (snap.empty) {
        setErr("Invalid code.");
        setSubmitting(false);
        return;
      }
      const league = { id: snap.docs[0].id, ...snap.docs[0].data() };
      await setDoc(joinReqDoc(league.id, user.uid), {
        requesterUid: user.uid,
        displayName: user.displayName || user.email,
        email: user.email,
        providedCode: clean,
        createdAt: serverTimestamp(),
      });
      setMsg(`Request sent to "${league.name || league.id}". The admin must approve you.`);
      setSubmitting(false);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || String(e2));
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 p-4">
      <div className="mx-auto max-w-lg">
        {/* Header with Back button */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Join a League</h1>
          <button
            onClick={() => nav("/dashboard")}
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-white/60 bg-white/40 backdrop-blur"
          >
            <span className="-ml-1">←</span> Back to Dashboard
          </button>
        </div>

        <form onSubmit={onSubmit} className="rounded-2xl border bg-white/90 backdrop-blur p-4 md:p-5 shadow-sm space-y-3">
          <div>
            <label className="block text-xs text-slate-600">Invite Code</label>
            <input
              className="w-full rounded-lg border px-3 py-2 uppercase tracking-wider"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 9X2K4M"
            />
          </div>

          {err && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded">
              {err}
            </div>
          )}
          {msg && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded">
              {msg}
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
              disabled={submitting}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 hover:opacity-90"
            >
              {submitting ? "Submitting…" : "Request Access"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
