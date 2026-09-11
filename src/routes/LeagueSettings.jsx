// src/pages/LeagueSettings.jsx
import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  updateDoc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import useAuth from "../hooks/useAuth.js";
import useLeague from "../hooks/useLeague.js";
import {
  joinReqsCol,
  joinReqDoc,
  leagueDoc,
  memberDoc,
  membersCol,
} from "../lib/firestorePaths.js";
import { makeInviteCode } from "../lib/rand.js";

export default function LeagueSettings() {
  const { leagueId } = useParams();
  const { user } = useAuth();
  const { league, myMember, loading } = useLeague(leagueId, user?.uid);
  const isAdmin =
    myMember?.role === "admin" || (league && league.ownerUid === user?.uid);

  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);

  React.useEffect(() => {
    if (!isAdmin) return;
    const unsub1 = onSnapshot(joinReqsCol(leagueId), (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(membersCol(leagueId), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsub1 && unsub1();
      unsub2 && unsub2();
    };
  }, [isAdmin, leagueId]);

  if (loading) return <div className="p-4">Loading…</div>;
  if (!isAdmin) return <div className="p-4">Admins only.</div>;

  async function rotateInvite() {
    const code = makeInviteCode();
    await updateDoc(leagueDoc(leagueId), {
      inviteCode: code,
      inviteRotatedAt: serverTimestamp(),
    });
  }
  async function approve(uid, displayName, email) {
    await setDoc(
      memberDoc(leagueId, uid),
      { role: "member", uid, displayName, email, joinedAt: serverTimestamp() },
      { merge: true }
    );
    await updateDoc(leagueDoc(leagueId), { memberUids: arrayUnion(uid) });
    await deleteDoc(joinReqDoc(leagueId, uid));
  }
  async function reject(uid) {
    await deleteDoc(joinReqDoc(leagueId, uid));
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      {/* keep content clear of sticky NavBar */}
      <div className="pt-16 px-3 md:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Header w/ Back button */}
          <header className="rounded-2xl bg-white/90 backdrop-blur border shadow-sm p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Link
                  to={`/league/${leagueId}`}
                  className="inline-flex items-center gap-2 text-sm text-slate-700 hover:underline"
                >
                  ← Back to League
                </Link>
                <h1 className="mt-1 text-xl md:text-2xl font-bold">
                  League Settings
                </h1>
                <div className="text-xs text-slate-500">
                  League ID: <span className="font-mono">{leagueId}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-sm">
                  Invite Code:{" "}
                  <span className="px-2 py-1 rounded border bg-slate-50 font-mono">
                    {league?.inviteCode || "N/A"}
                  </span>
                </div>
                <button
                  onClick={rotateInvite}
                  className="rounded-lg border px-3 py-2 text-sm bg-white hover:bg-slate-50"
                >
                  Rotate
                </button>
              </div>
            </div>
          </header>

          {/* Join Requests */}
          <section className="rounded-xl border bg-white p-4 md:p-5">
            <h2 className="text-lg font-semibold mb-2">Join Requests</h2>
            {requests.length ? (
              <ul className="divide-y">
                {requests.map((r) => (
                  <li key={r.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.displayName}</div>
                      <div className="text-xs text-slate-500">{r.email}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => approve(r.id, r.displayName, r.email)}
                        className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm hover:brightness-95"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reject(r.id)}
                        className="rounded-md bg-rose-600 text-white px-3 py-1.5 text-sm hover:brightness-95"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-600">No pending requests.</div>
            )}
          </section>

          {/* Members */}
          <section className="rounded-xl border bg-white p-4 md:p-5">
            <h2 className="text-lg font-semibold mb-2">Members</h2>
            {members.length ? (
              <ul className="divide-y">
                {members.map((m) => (
                  <li key={m.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {m.displayName || m.email || m.id}
                      </div>
                      <div className="text-xs text-slate-500">
                        Role: {m.role || "member"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-600">No members yet.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
