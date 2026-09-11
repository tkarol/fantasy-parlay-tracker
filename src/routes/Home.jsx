// src/pages/Home.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";

export default function Home() {
  const { user, signIn } = useAuth(); // if your hook uses `login`, alias it here
  const nav = useNavigate();

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-slate-50">
      {/* keep content clear of sticky navbar */}
      <div className="pt-16">
        {/* HERO */}
        <section className="relative">
          <div className="absolute inset-0 -z-10">
            {/* subtle background accents */}
            <div className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-gradient-to-b from-slate-100/80 to-transparent" />
            <svg
              aria-hidden
              className="absolute right-0 top-8 h-32 w-32 opacity-20 text-slate-300"
              viewBox="0 0 200 200"
            >
              <circle cx="100" cy="100" r="80" fill="currentColor" />
            </svg>
          </div>

          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-10 md:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7">
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  New
                  <span className="hidden xs:inline">Group parlays, simplified</span>
                </p>
                <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                  Build one parlay together.
                  <span className="block mt-1 text-slate-600 font-semibold">
                    Track legs, odds, and bragging rights every week.
                  </span>
                </h1>
                <p className="mt-4 text-slate-600 text-base md:text-lg max-w-2xl">
                  Each member adds a leg. We calculate combined odds, potential payout, hit rates,
                  streaks, and season-long stats — all in real time.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  {user ? (
                    <>
                      <button
                        onClick={() => nav("/dashboard")}
                        className="rounded-xl bg-slate-900 text-white px-5 py-3 text-sm md:text-base shadow hover:opacity-90"
                      >
                        Go to Dashboard
                      </button>
                      <Link
                        to="/create"
                        className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm md:text-base hover:bg-slate-50"
                      >
                        Create a League
                      </Link>
                      <Link
                        to="/join"
                        className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm md:text-base hover:bg-slate-50"
                      >
                        Join a League
                      </Link>
                    </>
                  ) : (
                    <button
                      onClick={signIn}
                      className="rounded-xl bg-slate-900 text-white px-5 py-3 text-sm md:text-base shadow hover:opacity-90"
                    >
                      Sign in with Google
                    </button>
                  )}
                </div>

                {/* quick value strip */}
                <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  {[
                    ["Real-time", "Firestore updates"],
                    ["Hit%", "auto-calculated"],
                    ["Streaks", "W/L tracking"],
                    ["Payout", "combined odds"],
                  ].map(([big, small]) => (
                    <div
                      key={big}
                      className="rounded-xl border bg-white/70 backdrop-blur px-4 py-3"
                    >
                      <div className="text-lg font-semibold text-slate-900">{big}</div>
                      <div className="text-xs text-slate-500">{small}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview card */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border bg-white/80 backdrop-blur shadow-sm p-5">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Season 2025 • Week 1</div>
                    <span className="text-xs px-2 py-1 rounded-full border text-emerald-700 bg-emerald-100 border-emerald-200">
                      Open
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl border bg-slate-50 p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border bg-white p-2">
                        <div className="text-[11px] text-slate-500">Stake</div>
                        <div className="mt-0.5 font-medium">$5.00</div>
                      </div>
                      <div className="rounded-lg border bg-white p-2">
                        <div className="text-[11px] text-slate-500">Potential Win</div>
                        <div className="mt-0.5 font-medium">—</div>
                      </div>
                    </div>

                    <ul className="mt-3 divide-y">
                      <li className="py-3 pl-3 pr-2 flex items-start gap-3 border-l-4 border-amber-500">
                        <span className="px-2 py-0.5 text-xs rounded-full border bg-amber-100 text-amber-800 border-amber-200">
                          Pending
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-500 truncate">member</div>
                          <div className="font-medium break-words">Waiting for legs…</div>
                        </div>
                        <div className="text-sm text-slate-700 min-w-[70px] text-right">—</div>
                      </li>
                      <li className="py-3 pl-3 pr-2 flex items-start gap-3 border-l-4 border-emerald-500">
                        <span className="px-2 py-0.5 text-xs rounded-full border bg-emerald-100 text-emerald-800 border-emerald-200">
                          Win
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-500 truncate">sam</div>
                          <div className="font-medium break-words">KC Chiefs ML</div>
                        </div>
                        <div className="text-sm text-slate-700 min-w-[70px] text-right">+120</div>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                      Deadline <span className="font-medium">Thu 6:00 PM</span>
                    </div>
                    {user ? (
                      <Link
                        to="/dashboard"
                        className="text-sm rounded-lg border px-3 py-1.5 hover:bg-slate-50"
                      >
                        Open my leagues →
                      </Link>
                    ) : (
                      <button
                        onClick={signIn}
                        className="text-sm rounded-lg bg-slate-900 text-white px-3 py-1.5 hover:opacity-90"
                      >
                        Get started
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">Why you’ll love it</h2>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                t: "One-click league setup",
                d: "Create a league and invite friends with a short code. Approve join requests in one place.",
              },
              {
                t: "Member-only submissions",
                d: "Only approved members can add legs. Everyone else can view the action.",
              },
              {
                t: "Smart stats",
                d: "We compute hit%, W/L streaks, ROI, and season summaries automatically.",
              },
              {
                t: "Deadline & lock",
                d: "Admins set a cutoff and close weeks. No late swaps, no drama.",
              },
              {
                t: "Real-time Firestore",
                d: "Changes appear instantly across the league; no refresh needed.",
              },
              {
                t: "Clean & fast UI",
                d: "Built with modern React and Tailwind for a crisp, responsive feel.",
              },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border bg-white p-5 hover:shadow-sm transition">
                <div className="h-9 w-9 rounded-xl bg-slate-900/90 text-white grid place-content-center text-sm font-bold">
                  ✓
                </div>
                <h3 className="mt-3 font-semibold text-slate-900">{f.t}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 pb-16">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">How it works</h2>
          <ol className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              ["Create or Join", "Start a league or enter an invite code to request access."],
              ["Add Legs Weekly", "Each member adds one leg before the deadline."],
              ["Track & Toast", "We calculate the combined odds and results automatically."],
            ].map(([title, copy], i) => (
              <li key={title} className="rounded-2xl border bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-900 text-white grid place-content-center text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="font-semibold">{title}</div>
                </div>
                <p className="mt-2 text-sm text-slate-600">{copy}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="rounded-xl bg-slate-900 text-white px-5 py-3 text-sm md:text-base shadow hover:opacity-90"
                >
                  Go to Dashboard
                </Link>
                <Link
                  to="/create"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm md:text-base hover:bg-slate-50"
                >
                  Create a League
                </Link>
              </>
            ) : (
              <button
                onClick={signIn}
                className="rounded-xl bg-slate-900 text-white px-5 py-3 text-sm md:text-base shadow hover:opacity-90"
              >
                Sign in to get started
              </button>
            )}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t bg-white">
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-slate-500">
            Built for friendly league bragging rights. Good luck! 🍀
          </div>
        </footer>
      </div>
    </div>
  );
}
