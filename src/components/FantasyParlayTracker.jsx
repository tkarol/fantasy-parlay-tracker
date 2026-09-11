// components/FantasyParlayTracker.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

// --- Helpers ---
const RESULTS = ["Win", "Loss", "Push", "Pending"];

function americanToDecimal(odds) {
  if (odds === undefined || odds === null || odds === "") return 1;
  const n = Number(odds);
  if (!Number.isFinite(n) || n === 0) return 1;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}
function decimalToAmerican(dec) {
  if (!Number.isFinite(dec) || dec <= 1) return 0;
  const profit = dec - 1;
  return profit >= 1 ? Math.round(profit * 100) : Math.round(-100 / profit);
}
function r2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}
function usd(x) {
  return (x < 0 ? "-" : "") + "$" + Math.abs(r2(x)).toFixed(2);
}
function nextThursdaySixPmLocal(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay();
  const daysUntilThu = (4 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilThu);
  d.setHours(18, 0, 0, 0);
  return d;
}
function tsToDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "object" && typeof val.seconds === "number") return new Date(val.seconds * 1000);
  const d = new Date(val);
  return Number.isFinite(d.getTime()) ? d : null;
}
function fmtDateTimeLocalInput(d) {
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtNice(d) {
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function nameFromEmail(email = "") {
  return email.split("@")[0] || "";
}

// =====================================================================

export default function FantasyParlayTracker({ leagueId, isAdmin, isMember }) {
  const { user, logout } = useAuth();

  // ---- Data access state
  const [canRead, setCanRead] = useState(true);

  // Weeks
  const [weeksList, setWeeksList] = useState([]);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(-1);
  const selectedWeek = selectedWeekIdx >= 0 ? weeksList[selectedWeekIdx] : null;
  const hasWeeks = weeksList.length > 0;
  const isCurrentWeek = selectedWeekIdx === weeksList.length - 1 || weeksList.length === 1;

  useEffect(() => {
    if (!leagueId) return;
    const qRef = query(
      collection(db, "leagues", leagueId, "weeks"),
      orderBy("season"),
      orderBy("week")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        setCanRead(true);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setWeeksList(rows);
        if (rows.length) {
          setSelectedWeekIdx((prev) => (prev >= 0 && prev < rows.length ? prev : rows.length - 1));
        } else {
          setSelectedWeekIdx(-1);
        }
      },
      (err) => {
        console.warn("Weeks listener error:", err?.code || err);
        setCanRead(false);
        setWeeksList([]);
        setSelectedWeekIdx(-1);
      }
    );
    return unsub;
  }, [leagueId]);

  // Legs for selected week
  const [legs, setLegs] = useState([]);
  useEffect(() => {
    if (!selectedWeek || !canRead || !leagueId) {
      setLegs([]);
      return;
    }
    const legsRef = collection(db, "leagues", leagueId, "weeks", selectedWeek.id, "legs");
    const unsub = onSnapshot(
      legsRef,
      (snap) => setLegs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.warn("Legs listener error:", err?.code || err);
        setLegs([]);
      }
    );
    return unsub;
  }, [selectedWeek, canRead, leagueId]);

  // My leg (current week only)
  const [legText, setLegText] = useState("");
  const myUid = user?.uid;
  const myLeg = useMemo(() => legs.find((l) => l.id === myUid), [legs, myUid]);

  // Deadline + closed
  const deadlineDate = useMemo(() => tsToDate(selectedWeek?.deadline), [selectedWeek]);
  const deadlinePassed = useMemo(() => (deadlineDate ? Date.now() >= deadlineDate.getTime() : false), [deadlineDate]);
  const weekClosed = !!selectedWeek?.closed;

  // Ticket status (overall parlay for the week)
  const ticketStatus = useMemo(() => {
    if (!legs.length) return { label: "Building…", tone: "neutral" };
    const anyLoss = legs.some((l) => l.result === "Loss");
    const allWin = legs.length > 0 && legs.every((l) => l.result === "Win");
    const anyPending = legs.some((l) => (l.result ?? "Pending") === "Pending");
    const anyPush = legs.some((l) => l.result === "Push");

    if (weekClosed) {
      if (anyLoss) return { label: "Parlay Lost", tone: "bad" };
      if (allWin) return { label: "Parlay Won", tone: "good" };
      if (anyPush) return { label: "Parlay Push", tone: "meh" };
      return { label: "Parlay Pending", tone: "meh" };
    } else {
      if (anyLoss) return { label: "Likely Lost", tone: "bad" };
      if (allWin && !anyPending) return { label: "All Legs Hit", tone: "good" };
      return { label: "Building…", tone: "neutral" };
    }
  }, [legs, weekClosed]);

  // Parlay stake/totals
  const parlayStake = selectedWeek?.stake ?? 5;
  const filledLegs = legs.filter(
    (l) => l.odds !== "" && l.odds !== undefined && l.odds !== null && Number.isFinite(Number(l.odds))
  );
  const allHaveOdds = filledLegs.length === legs.length && legs.length > 0;
  const parlayTotals = useMemo(() => {
    if (!allHaveOdds) return { hasAll: false, potential: 0, am: null };
    const dec = legs.reduce((prod, e) => prod * americanToDecimal(Number(e.odds)), 1);
    const am = decimalToAmerican(dec);
    const potential = r2(parlayStake * (dec - 1));
    return { hasAll: true, potential, am };
  }, [legs, parlayStake, allHaveOdds]);

  // Member can edit only if they're in the league, it's current/open/before deadline; admins can always edit
  const memberCanEdit =
    !!user && (!!isAdmin ? true : isMember && isCurrentWeek && !deadlinePassed && !weekClosed);

  // Member/Admin submit/update own leg
  async function submitOrUpdateMyLeg(e) {
    e?.preventDefault?.();
    if (!user) return alert("Please sign in");
    if (!leagueId) return alert("Missing league context");

    const latestIdx = weeksList.length - 1;
    const wk = isAdmin ? (selectedWeek || weeksList[latestIdx]) : weeksList[latestIdx];
    if (!wk) return alert("No week selected — ask an admin to create this week.");

    if (!isAdmin && (!isMember || !isCurrentWeek || weekClosed || deadlinePassed)) {
      return alert("Submissions are only allowed for league members before the deadline on the current week.");
    }
    if (!legText.trim()) return alert("Enter your leg description");

    try {
      const ref = doc(db, "leagues", leagueId, "weeks", wk.id, "legs", user.uid);
      const payload = {
        memberName: user.displayName || nameFromEmail(user.email) || "Member",
        leg: legText.trim(),
        result: myLeg?.result || "Pending",
        season: wk.season,
        week: wk.week,
        createdBy: user.uid,
        createdAt: myLeg?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload, { merge: true });
      setLegText("");
    } catch (err) {
      console.error("Failed to submit leg:", err);
      alert(`Failed to submit leg: ${err?.message || err}`);
    }
  }

  async function deleteMyLeg() {
    if (!user || !leagueId) return;
    const latestIdx = weeksList.length - 1;
    const wk = isAdmin ? selectedWeek : weeksList[latestIdx];
    if (!wk) return;
    if (!isAdmin && (!isMember || !isCurrentWeek || weekClosed || deadlinePassed)) {
      return alert("Edits disabled for this week.");
    }
    await deleteDoc(doc(db, "leagues", leagueId, "weeks", wk.id, "legs", user.uid));
  }

  // Admin actions
  async function createWeek(season, week, stake = 5, deadlineDate) {
    if (!isAdmin) return alert("Admins only");
    const id = `${season}-${week}`;
    const wref = doc(db, "leagues", leagueId, "weeks", id);
    await setDoc(
      wref,
      {
        season: Number(season),
        week: Number(week),
        stake: Number(stake) || 5,
        deadline: deadlineDate || nextThursdaySixPmLocal(),
        closed: false,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
  async function updateStake(newStake) {
    if (!isAdmin || !selectedWeek) return;
    await updateDoc(doc(db, "leagues", leagueId, "weeks", selectedWeek.id), {
      stake: Number(newStake) || 5,
    });
  }
  async function updateDeadline(dateStr) {
    if (!isAdmin || !selectedWeek) return;
    const ms = Date.parse(dateStr);
    if (!Number.isFinite(ms)) return alert("Invalid date");
    await updateDoc(doc(db, "leagues", leagueId, "weeks", selectedWeek.id), {
      deadline: new Date(ms),
    });
  }
  async function setNextThursday() {
    if (!isAdmin || !selectedWeek) return;
    await updateDoc(doc(db, "leagues", leagueId, "weeks", selectedWeek.id), {
      deadline: nextThursdaySixPmLocal(),
    });
  }
  async function deleteWeek() {
    if (!isAdmin || !selectedWeek) return;
    if (!confirm(`Delete week ${selectedWeek.id}?`)) return;
    await deleteDoc(doc(db, "leagues", leagueId, "weeks", selectedWeek.id));
  }

  const adminAddLeg = useCallback(
    async ({ weekId, memberName, leg, odds, result }) => {
      if (!isAdmin) {
        alert("Admins only");
        return;
      }
      if (!weekId || !memberName || !leg) {
        alert("Fill week, member, and leg");
        return;
      }
      const newRef = doc(collection(db, "leagues", leagueId, "weeks", weekId, "legs"));
      await setDoc(
        newRef,
        {
          memberName: memberName.trim(),
          leg: leg.trim(),
          odds: odds === "" ? "" : Number(odds),
          result: result || "Pending",
          season: Number(weekId.split("-")[0]) || undefined,
          week: Number(weekId.split("-")[1]) || undefined,
          createdBy: user?.uid || "admin",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    [isAdmin, user?.uid, leagueId]
  );

  // --- Admin inline edit state & actions ---
  const [editingId, setEditingId] = useState(null);
  const [draftMemberName, setDraftMemberName] = useState("");
  const [draftLeg, setDraftLeg] = useState("");
  const [draftOdds, setDraftOdds] = useState("");
  const [draftResult, setDraftResult] = useState("Pending");

  const beginEdit = (row) => {
    setEditingId(row.id);
    setDraftMemberName(row.memberName || "");
    setDraftLeg(row.leg || "");
    setDraftOdds(row.odds === "" || row.odds == null ? "" : String(row.odds));
    setDraftResult(row.result || "Pending");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraftMemberName("");
    setDraftLeg("");
    setDraftOdds("");
    setDraftResult("Pending");
  };
  const saveEdit = async () => {
    if (!isAdmin || !selectedWeek || !editingId) return;
    const ref = doc(db, "leagues", leagueId, "weeks", selectedWeek.id, "legs", editingId);
    const payload = {
      memberName: draftMemberName.trim(),
      leg: draftLeg.trim(),
      odds: draftOdds === "" ? "" : Number(draftOdds),
      result: draftResult,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(ref, payload);
    cancelEdit();
  };
  const adminDeleteLeg = async (legId) => {
    if (!isAdmin || !selectedWeek) return;
    if (!confirm("Delete this leg?")) return;
    await deleteDoc(doc(db, "leagues", leagueId, "weeks", selectedWeek.id, "legs", legId));
    if (editingId === legId) cancelEdit();
  };

  // Close week => lock it, then auto-create the next week if missing
  async function closeWeekAndCreateNext() {
    if (!isAdmin || !selectedWeek) return;
    const wref = doc(db, "leagues", leagueId, "weeks", selectedWeek.id);
    await updateDoc(wref, { closed: true, closedAt: serverTimestamp() });

    const nextSeason = selectedWeek.season;
    const nextWeekNum = Number(selectedWeek.week) + 1;
    const nextId = `${nextSeason}-${nextWeekNum}`;

    const nextExists = weeksList.some((w) => w.id === nextId);
    if (!nextExists) {
      await setDoc(
        doc(db, "leagues", leagueId, "weeks", nextId),
        {
          season: nextSeason,
          week: nextWeekNum,
          stake: selectedWeek.stake ?? 5,
          deadline: nextThursdaySixPmLocal(),
          closed: false,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    const idx = weeksList.findIndex((w) => w.id === nextId);
    if (idx >= 0) setSelectedWeekIdx(idx);
    else setSelectedWeekIdx(weeksList.length);
  }

  // Ticket banner styles
  const bannerClass =
    ticketStatus.tone === "good"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : ticketStatus.tone === "bad"
      ? "bg-rose-50 border-rose-200 text-rose-800"
      : ticketStatus.tone === "meh"
      ? "bg-amber-50 border-amber-200 text-amber-800"
      : "bg-slate-50 border-slate-200 text-slate-700";

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      {/* keep clear of sticky NavBar */}
      <div className="pt-16 px-2 md:px-4">
        <div className="mx-auto w-full max-w-screen-2xl">
          {/* HEADER */}
          <header className="rounded-2xl bg-white/90 backdrop-blur border shadow-sm p-3 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <Link to="/dashboard" className="text-sm text-slate-600 hover:underline">← Back to Dashboard</Link>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Fantasy Parlay Tracker</h1>
                <p className="text-slate-600 text-sm md:text-base">One $5 parlay every week — each member adds one leg.</p>
              </div>

              {user && (
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="flex items-center gap-2 rounded-full border bg-slate-50 pl-2 pr-1 py-1">
                    <div className="h-8 w-8 rounded-full bg-slate-900 text-white grid place-content-center text-xs font-semibold">
                      {user.displayName?.[0] || "U"}
                    </div>
                    <span className="text-xs md:text-sm text-slate-700 mr-1 truncate max-w-[40vw]">
                      {user.displayName || user.email}
                    </span>
                    {isAdmin ? (
                      <span className="text-[10px] md:text-xs text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-full">Admin</span>
                    ) : isMember ? (
                      <span className="text-[10px] md:text-xs text-amber-700 bg-amber-100 border border-amber-200 px-2 py-1 rounded-full">Member</span>
                    ) : (
                      <span className="text-[10px] md:text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full">Viewer</span>
                    )}
                    <button
                      onClick={logout}
                      className="rounded-lg bg-slate-900 text-white px-2 md:px-3 py-1 hover:opacity-90 ml-1 md:ml-2 text-xs md:text-sm"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* MAIN */}
          {(user || canRead) ? (
            <>
              <section className="mt-3 rounded-2xl border shadow-sm bg-white p-3 md:p-5">
                {/* Subheader: week info + controls */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    <h2 className="font-semibold text-slate-800 text-base md:text-lg">
                      {selectedWeek ? <>Season {selectedWeek.season} • Week {selectedWeek.week}</> : "No week yet"}
                    </h2>
                    {selectedWeek && (
                      <span
                        className={`text-[10px] md:text-xs px-2 py-1 rounded-full border ${
                          weekClosed ? "text-slate-700 bg-slate-100 border-slate-200" : "text-emerald-700 bg-emerald-100 border-emerald-200"
                        }`}
                      >
                        {weekClosed ? "Closed" : "Open"}
                      </span>
                    )}
                  </div>

                  {/* Segmented navigator */}
                  <div className="w-full md:w-auto flex items-center justify-center md:justify-end">
                    <div className="inline-flex h-9 rounded-xl border bg-white shadow-sm overflow-hidden">
                      <button
                        disabled={selectedWeekIdx <= 0}
                        onClick={() => setSelectedWeekIdx((i) => Math.max(0, i - 1))}
                        className="px-3 md:px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                        aria-label="Previous week"
                        type="button"
                      >
                        <span className="sr-only">Previous</span>
                        <span aria-hidden>◀</span>
                      </button>
                                  
                      <div className="px-3 md:px-4 grid place-items-center text-xs md:text-sm bg-slate-50 border-x text-slate-700 tabular-nums min-w-[90px]">
                        {weeksList.length ? selectedWeekIdx + 1 : 0} / {weeksList.length || 0}
                      </div>
                                  
                      <button
                        disabled={selectedWeekIdx >= weeksList.length - 1}
                        onClick={() =>
                          setSelectedWeekIdx((i) => Math.min(weeksList.length - 1, i + 1))
                        }
                        className="px-3 md:px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                        aria-label="Next week"
                        type="button"
                      >
                        <span className="sr-only">Next</span>
                        <span aria-hidden>▶</span>
                      </button>
                    </div>
                  </div>

                </div>

                {/* Ticket status banner */}
                <div className={`rounded-xl border px-3 md:px-4 py-2 md:py-3 mb-3 md:mb-4 ${bannerClass}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-semibold text-sm md:text-base">{ticketStatus.label}</div>
                    <div className="text-xs md:text-sm">
                      Deadline: <span className="font-medium">{fmtNice(deadlineDate)}</span>
                      {deadlinePassed && !weekClosed && (
                        <span className="ml-2 text-[10px] md:text-xs px-2 py-0.5 rounded-full border border-rose-200 bg-rose-50 text-rose-700">
                          Deadline passed
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 2xl:grid-cols-12 gap-3 md:gap-4">
                  {/* Legs list */}
                  <div className="2xl:col-span-9">
                    {legs.length === 0 ? (
                      <div className="text-slate-500 text-sm">
                        {hasWeeks
                          ? "No legs submitted yet."
                          : isAdmin
                          ? "Create the first week to start collecting legs."
                          : "Waiting for admin to create the first week."}
                      </div>
                    ) : (
                      <ul className="divide-y">
                        {legs.map((e) => {
                          const status = e.result || "Pending";
                          const border =
                            status === "Win"
                              ? "border-l-4 border-emerald-500"
                              : status === "Loss"
                              ? "border-l-4 border-rose-500"
                              : status === "Push"
                              ? "border-l-4 border-slate-400"
                              : "border-l-4 border-amber-500";
                          const chip =
                            status === "Win"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : status === "Loss"
                              ? "bg-rose-100 text-rose-800 border-rose-200"
                              : status === "Push"
                              ? "bg-slate-100 text-slate-800 border-slate-200"
                              : "bg-amber-100 text-amber-800 border-amber-200";

                          const isEditing = editingId === e.id;

                          return (
                            <li key={e.id} className={`py-3 pl-3 pr-2 ${border}`}>
                              {/* view mode */}
                              {!isEditing && (
                                <div className="flex items-start gap-2 md:gap-3">
                                  <span className={`px-2 py-0.5 text-[10px] md:text-xs rounded-full border ${chip} shrink-0`}>
                                    {status}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs md:text-sm text-slate-500 truncate">
                                      {e.memberName || (e.createdByEmail && nameFromEmail(e.createdByEmail)) || e.id}
                                    </div>
                                    <div className="font-medium break-words" title={e.leg}>
                                      {e.leg}
                                    </div>
                                  </div>
                                  <div className="text-xs md:text-sm text-slate-700 w-14 md:w-16 text-right shrink-0">
                                    {e.odds === "" || e.odds === undefined || e.odds === null
                                      ? "—"
                                      : Number(e.odds) > 0
                                      ? `+${Number(e.odds)}`
                                      : Number(e.odds)}
                                  </div>

                                  {isAdmin && (
                                    <div className="ml-1 md:ml-2 flex gap-1 md:gap-2 shrink-0">
                                      <button
                                        onClick={() => beginEdit(e)}
                                        className="rounded-md border px-2 py-1 text-[10px] md:text-xs hover:bg-slate-50"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => adminDeleteLeg(e.id)}
                                        className="rounded-md border px-2 py-1 text-[10px] md:text-xs text-white bg-rose-600 hover:brightness-95"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* edit mode (admin only) */}
                              {isEditing && isAdmin && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2 items-end">
                                  <div className="xl:col-span-1">
                                    <label className="block text-[10px] md:text-xs text-slate-500">Member</label>
                                    <input
                                      className="w-full rounded-lg border px-2 py-1 text-sm"
                                      value={draftMemberName}
                                      onChange={(e) => setDraftMemberName(e.target.value)}
                                    />
                                  </div>
                                  <div className="sm:col-span-2 xl:col-span-3">
                                    <label className="block text-[10px] md:text-xs text-slate-500">Leg</label>
                                    <input
                                      className="w-full rounded-lg border px-2 py-1 text-sm"
                                      value={draftLeg}
                                      onChange={(e) => setDraftLeg(e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] md:text-xs text-slate-500">Odds</label>
                                    <input
                                      type="number"
                                      className="w-full rounded-lg border px-2 py-1 text-sm"
                                      value={draftOdds}
                                      onChange={(e) => setDraftOdds(e.target.value)}
                                      placeholder="+120"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] md:text-xs text-slate-500">Result</label>
                                    <select
                                      className="w-full rounded-lg border px-2 py-1 text-sm"
                                      value={draftResult}
                                      onChange={(e) => setDraftResult(e.target.value)}
                                    >
                                      {RESULTS.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="sm:col-span-2 xl:col-span-2 flex justify-end gap-2">
                                    <button
                                      onClick={cancelEdit}
                                      type="button"
                                      className="rounded-md border px-3 py-1 text-sm hover:bg-slate-50"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={saveEdit}
                                      type="button"
                                      className="rounded-md bg-emerald-600 text-white px-3 py-1 text-sm hover:brightness-95"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Parlay summary */}
                  <div className="2xl:col-span-3">
                    <div className="rounded-xl border p-3 md:p-4 bg-gradient-to-b from-white to-slate-50">
                      <div className="text-[10px] md:text-xs uppercase tracking-wide text-slate-500">Parlay</div>
                      <div className="mt-1 text-[26px] md:text-[30px] leading-none font-extrabold tracking-tight">
                        {parlayTotals.hasAll ? (parlayTotals.am > 0 ? `+${parlayTotals.am}` : parlayTotals.am) : "—"}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 md:gap-3 text-sm">
                        <div className="rounded-lg border bg-white p-2">
                          <div className="text-[11px] text-slate-500">Stake</div>
                          {isAdmin ? (
                            <input
                              type="number"
                              className="mt-0.5 w-full rounded-md border px-2 py-1"
                              value={parlayStake}
                              onChange={(e) => updateStake(e.target.value)}
                            />
                          ) : (
                            <div className="mt-0.5 font-medium">{usd(parlayStake)}</div>
                          )}
                        </div>
                        <div className="rounded-lg border bg-white p-2">
                          <div className="text-[11px] text-slate-500">Potential Win</div>
                          <div className="mt-0.5 font-medium">{parlayTotals.hasAll ? usd(parlayTotals.potential) : "—"}</div>
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border bg-white p-2">
                        <div className="text-[11px] text-slate-500">Deadline</div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {isAdmin ? (
                            <>
                              <input
                                type="datetime-local"
                                className="rounded-md border px-2 py-1 text-sm"
                                value={fmtDateTimeLocalInput(deadlineDate)}
                                onChange={(e) => updateDeadline(e.target.value)}
                              />
                              <button onClick={setNextThursday} className="rounded-md border px-2 py-1 text-sm bg-white hover:bg-slate-50">
                                Next Thu 6PM
                              </button>
                              {!weekClosed && (
                                <button
                                  onClick={closeWeekAndCreateNext}
                                  className="rounded-md bg-slate-900 text-white px-2 py-1 text-sm hover:opacity-90"
                                >
                                  Close & Create Next
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="px-2 py-1 rounded border bg-white text-sm">{fmtNice(deadlineDate)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Week dots (scrollable on mobile) */}
                <div className="mt-3 md:mt-4 flex gap-1 overflow-x-auto py-1">
                  {weeksList.map((w, i) => (
                    <button
                      key={w.id}
                      onClick={() => setSelectedWeekIdx(i)}
                      className={`h-2.5 w-8 rounded-full ${i === selectedWeekIdx ? "bg-slate-900" : "bg-slate-300"}`}
                      aria-label={`Week ${w.week}`}
                    />
                  ))}
                </div>
              </section>

              {/* Submit card */}
              <section className="mt-3 md:mt-4">
                <form
                  onSubmit={submitOrUpdateMyLeg}
                  className="max-w-2xl mx-auto rounded-2xl border shadow-sm p-4 md:p-5 bg-white"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                    <h2 className="font-semibold text-slate-800 text-base md:text-lg">Your Leg for the Current Week</h2>
                    {!isMember && !isAdmin && (
                      <span className="self-start sm:self-auto text-[10px] md:text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full">
                        View-only (not a member)
                      </span>
                    )}
                    {user && isMember && !isAdmin && (!isCurrentWeek || weekClosed || deadlinePassed) && (
                      <span className="self-start sm:self-auto text-[10px] md:text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full">
                        {weekClosed ? "Week closed" : deadlinePassed ? "Deadline passed" : "Only current week is editable"}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] md:text-xs text-slate-500">Leg Description</label>
                    <input
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="e.g. Steelers ML, Kelce 60+ yards"
                      value={legText}
                      onChange={(e) => setLegText(e.target.value)}
                      disabled={!memberCanEdit && !isAdmin}
                    />
                  </div>
                  <div className="flex gap-2 justify-end mt-3">
                    {myLeg && (
                      <button
                        type="button"
                        onClick={deleteMyLeg}
                        className="rounded-xl bg-rose-600 text-white px-4 py-2 hover:brightness-95"
                        disabled={!memberCanEdit && !isAdmin}
                      >
                        Remove
                      </button>
                    )}
                    <button
                      type="submit"
                      className="rounded-xl bg-emerald-600 text-white px-4 py-2 hover:brightness-95"
                      disabled={!memberCanEdit && !isAdmin}
                    >
                      {myLeg ? "Update" : "Submit"} Leg
                    </button>
                  </div>
                </form>
              </section>

              {isAdmin && (
                <section className="mt-3 md:mt-4 rounded-2xl border shadow-sm p-4 md:p-5 bg-white">
                  <h2 className="font-semibold text-slate-800 mb-3">Admin — Create / Manage Weeks</h2>
                  <AdminWeekCreator
                    onCreate={createWeek}
                    nextDefault={() => {
                      const last = weeksList[weeksList.length - 1];
                      if (!last) return { season: new Date().getFullYear(), week: 1 };
                      return { season: last.season, week: last.week + 1 };
                    }}
                  />
                  <h3 className="font-semibold text-slate-800 mt-6 mb-2">Admin — Manually Add a Leg</h3>
                  <AdminManualLeg weeks={weeksList} onAdd={adminAddLeg} />
                </section>
              )}

              <MemberStats
                leagueId={leagueId}
                selectedSeason={selectedWeek?.season}
                allWeeks={weeksList}
                canRead={canRead}
              />
            </>
          ) : null}

          <footer className="py-8 text-center text-xs text-slate-500">
            Built for friendly league bragging rights. Good luck! 🍀
          </footer>
        </div>
      </div>
    </div>
  );
}

// --- Admin Week Creator ---
function AdminWeekCreator({ onCreate, nextDefault }) {
  const next = nextDefault();
  const [season, setSeason] = useState(next.season);
  const [week, setWeek] = useState(next.week);
  const [stake, setStake] = useState(5);
  const [when, setWhen] = useState(() => fmtDateTimeLocalInput(nextThursdaySixPmLocal()));

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const ms = Date.parse(when);
        await onCreate(season, week, stake, new Date(ms));
      }}
      className="grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-3"
    >
      <div>
        <label className="block text-[10px] md:text-xs text-slate-500">Season</label>
        <input
          type="number"
          className="w-full rounded-lg border px-3 py-2"
          value={season}
          onChange={(e) => setSeason(Number(e.target.value) || new Date().getFullYear())}
        />
      </div>
      <div>
        <label className="block text-[10px] md:text-xs text-slate-500">Week #</label>
        <input
          type="number"
          className="w-full rounded-lg border px-3 py-2"
          value={week}
          onChange={(e) => setWeek(Number(e.target.value) || 1)}
        />
      </div>
      <div>
        <label className="block text-[10px] md:text-xs text-slate-500">Stake ($)</label>
        <input
          type="number"
          className="w-full rounded-lg border px-3 py-2"
          value={stake}
          onChange={(e) => setStake(Number(e.target.value) || 5)}
        />
      </div>
      <div>
        <label className="block text-[10px] md:text-xs text-slate-500">Deadline (Thu 6PM local)</label>
        <input
          type="datetime-local"
          className="w-full rounded-lg border px-3 py-2"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
      </div>
      <div className="flex items-end">
        <button type="submit" className="rounded-xl bg-slate-900 text-white px-4 py-2 w-full hover:opacity-90">
          Create Week
        </button>
      </div>
    </form>
  );
}

// --- Admin Manual Leg ---
function AdminManualLeg({ weeks, onAdd }) {
  const [weekId, setWeekId] = useState(weeks[weeks.length - 1]?.id || "");
  const [memberName, setMemberName] = useState("");
  const [leg, setLeg] = useState("");
  const [odds, setOdds] = useState("");
  const [result, setResult] = useState("Pending");

  useEffect(() => {
    if (weeks.length && !weekId) setWeekId(weeks[weeks.length - 1].id);
  }, [weeks, weekId]);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onAdd({
          weekId,
          memberName: memberName.trim(),
          leg: leg.trim(),
          odds: odds === "" ? "" : Number(odds),
          result,
        });
        setMemberName("");
        setLeg("");
        setOdds("");
      }}
      className="grid grid-cols-1 md:grid-cols-6 gap-2 md:gap-3 mt-2"
    >
      <div className="md:col-span-2">
        <label className="block text-[10px] md:text-xs text-slate-500">Week</label>
        <select className="w-full rounded-lg border px-3 py-2" value={weekId} onChange={(e) => setWeekId(e.target.value)}>
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.season}-W{w.week}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[10px] md:text-xs text-slate-500">Member Name</label>
        <input className="w-full rounded-lg border px-3 py-2" value={memberName} onChange={(e) => setMemberName(e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <label className="block text-[10px] md:text-xs text-slate-500">Leg</label>
        <input className="w-full rounded-lg border px-3 py-2" value={leg} onChange={(e) => setLeg(e.target.value)} />
      </div>
      <div>
        <label className="block text-[10px] md:text-xs text-slate-500">Odds (+/-)</label>
        <input type="number" className="w-full rounded-lg border px-3 py-2" value={odds} onChange={(e) => setOdds(e.target.value)} />
      </div>
      <div>
        <label className="block text-[10px] md:text-xs text-slate-500">Result</label>
        <select className="w-full rounded-lg border px-3 py-2" value={result} onChange={(e) => setResult(e.target.value)}>
          {RESULTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-6 flex justify-end">
        <button type="submit" className="rounded-xl bg-slate-900 text-white px-4 py-2 hover:opacity-90">
          Add Leg
        </button>
      </div>
    </form>
  );
}

// --- Member Stats (responsive) ---
function MemberStats({ leagueId, selectedSeason, allWeeks, canRead }) {
  const season = Number.isFinite(Number(selectedSeason)) ? Number(selectedSeason) : null;

  const [legsByWeek, setLegsByWeek] = useState({});

  useEffect(() => {
    if (!canRead || !leagueId) {
      setLegsByWeek({});
      return;
    }
    let unsubs = [];
    const weeksForSeason =
      (season == null ? allWeeks : allWeeks.filter((w) => Number(w.season) === season)) || [];
    if (!weeksForSeason.length) {
      setLegsByWeek({});
      return () => {};
    }
    weeksForSeason.forEach((w) => {
      const legsRef = collection(db, "leagues", leagueId, "weeks", w.id, "legs");
      const unsub = onSnapshot(
        legsRef,
        (snap) => {
          setLegsByWeek((prev) => ({
            ...prev,
            [w.id]: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          }));
        },
        (err) => console.warn("Stats legs listener error:", err?.code || err)
      );
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((u) => u && u());
  }, [season, allWeeks, canRead, leagueId]);

  const seasonLegs = useMemo(() => {
    const ids = Object.keys(legsByWeek);
    const arr = [];
    for (const id of ids) arr.push(...(legsByWeek[id] || []));
    return arr;
  }, [legsByWeek]);

  const members = useMemo(() => {
    const set = new Set(
      seasonLegs.map((l) => {
        const nm = (l.memberName || "").trim();
        if (nm) return nm;
        const guess =
          (l.createdByEmail && nameFromEmail(l.createdByEmail)) ||
          (l.createdBy && String(l.createdBy)) ||
          l.id;
        return String(guess);
      })
    );
    return Array.from(set).filter(Boolean);
  }, [seasonLegs]);

  const byMember = useMemo(() => {
    const by = {};
    for (const m of members)
      by[m] = { legs: 0, wins: 0, losses: 0, pushes: 0, net: 0, roi: 0, streak: "-" };

    const sorted = [...seasonLegs].sort(
      (a, b) =>
        (a.week || 0) - (b.week || 0) ||
        (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
    );

    const hist = {};
    for (const e of sorted) {
      const name =
        (e.memberName || "").trim() ||
        (e.createdByEmail && nameFromEmail(e.createdByEmail)) ||
        (e.createdBy && String(e.createdBy)) ||
        e.id;

      if (!by[name]) by[name] = { legs: 0, wins: 0, losses: 0, pushes: 0, net: 0, roi: 0, streak: "-" };
      by[name].legs++;
      if (e.result === "Win") {
        by[name].wins++;
        by[name].net += 5 * (americanToDecimal(e.odds) - 1);
      } else if (e.result === "Loss") {
        by[name].losses++;
        by[name].net -= 5;
      } else if (e.result === "Push") {
        by[name].pushes++;
      }
      if (!hist[name]) hist[name] = [];
      if (e.result === "Win" || e.result === "Loss") hist[name].push(e.result);
    }
    for (const m of Object.keys(by)) {
      const row = by[m];
      row.roi = row.legs ? (row.net / (row.legs * 5)) * 100 : 0;
      const arr = hist[m] || [];
      if (arr.length) {
        let i = arr.length - 1;
        const last = arr[i];
        let len = 0;
        while (i >= 0 && arr[i] === last) { len++; i--; }
        row.streak = (last === "Win" ? "W" : "L") + len;
      }
    }
    return by;
  }, [seasonLegs, members]);

  const streakScore = (s) => {
    if (!s || s === "-") return 0;
    const sign = s[0] === "W" ? 1 : -1;
    const n = parseInt(s.slice(1), 10) || 0;
    return sign * n;
  };

  // ORDER: best hit% (resolved only) desc, then streak desc, then total legs desc, then name asc
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const A = byMember[a] || { wins: 0, losses: 0, legs: 0, streak: "-" };
      const B = byMember[b] || { wins: 0, losses: 0, legs: 0, streak: "-" };

      const resA = A.wins + A.losses;
      const resB = B.wins + B.losses;
      const hitA = resA ? A.wins / resA : 0;
      const hitB = resB ? B.wins / resB : 0;

      if (hitB !== hitA) return hitB - hitA;

      const sA = streakScore(A.streak);
      const sB = streakScore(B.streak);
      if (sB !== sA) return sB - sA;

      if (B.legs !== A.legs) return B.legs - A.legs;
      return a.localeCompare(b);
    });
  }, [members, byMember]);

  const headerLabel = season == null ? "All Seasons" : `Season ${season}`;

  return (
    <section className="mt-3 md:mt-4 rounded-2xl border shadow-sm p-3 md:p-5 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800 text-base md:text-lg">Member Stats — {headerLabel}</h2>
      </div>

      {/* Mobile card list */}
      <ul className="sm:hidden space-y-2">
        {sortedMembers.length === 0 && (
          <li className="rounded-lg border bg-slate-50 py-4 text-center text-slate-500">No stats yet.</li>
        )}
        {sortedMembers.map((m) => {
          const s = byMember[m];
          const resolved = s.wins + s.losses;
          const hit = resolved ? (s.wins / resolved) * 100 : 0;
          return (
            <li key={m} className="rounded-lg border p-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="font-medium">{m}</div>
                <span className="text-xs rounded-full border px-2 py-0.5 bg-slate-50">{s.streak}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 text-center text-xs">
                <div>
                  <div className="text-slate-500">W-L-P</div>
                  <div className="font-medium">{s.wins}-{s.losses}-{s.pushes}</div>
                </div>
                <div>
                  <div className="text-slate-500">Hit%</div>
                  <div className="font-medium">{r2(hit)}%</div>
                </div>
                <div>
                  <div className="text-slate-500">Legs</div>
                  <div className="font-medium">{s.legs}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full text-xs md:text-sm">
          <thead className="sticky top-0 bg-slate-100/80">
            <tr className="text-left text-slate-600">
              <th className="py-2 pr-4 font-medium">Member</th>
              <th className="py-2 pr-4 font-medium">W-L-P</th>
              <th className="py-2 pr-4 font-medium">Hit%</th>
              <th className="py-2 pr-4 font-medium">Streak</th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((m) => {
              const s = byMember[m];
              const resolved = s.wins + s.losses;
              const hit = resolved ? (s.wins / resolved) * 100 : 0;

              return (
                <tr key={m} className="border-t hover:bg-slate-50">
                  <td className="py-2 pr-4 font-medium">{m}</td>
                  <td className="py-2 pr-4">{s.wins}-{s.losses}-{s.pushes}</td>
                  <td className="py-2 pr-4">{r2(hit)}%</td>
                  <td className="py-2 pr-4">{s.streak}</td>
                </tr>
              );
            })}
            {sortedMembers.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500">No stats yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
