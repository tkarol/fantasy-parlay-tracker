// src/components/NavBar.jsx
import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function NavBar() {
  const { user, signIn, signOut, error } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { pathname } = useLocation();

  React.useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const baseTab =
    "relative inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition";
  const tabIdle =
    "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80";
  const tabActive =
    "text-slate-900 bg-slate-200/70 shadow-inner";

  const Brand = () => (
    <Link
      to="/"
      className="inline-flex items-center gap-2 text-slate-900 font-extrabold tracking-tight"
    >
      <span className="grid h-8 w-8 place-content-center rounded-xl bg-slate-900 text-white text-sm shadow">
        🏈
      </span>
      <span className="text-base md:text-lg leading-none">Fantasy Parlay</span>
    </Link>
  );

  const NavTabs = ({ className = "" }) => (
    <nav className={`flex items-center gap-1 ${className}`}>
      {user && (
        <>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `${baseTab} ${isActive ? tabActive : tabIdle}`
            }
          >
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/create"
            className={({ isActive }) =>
              `${baseTab} ${isActive ? tabActive : tabIdle}`
            }
          >
            <span>Create</span>
          </NavLink>
          <NavLink
            to="/join"
            className={({ isActive }) =>
              `${baseTab} ${isActive ? tabActive : tabIdle}`
            }
          >
            <span>Join</span>
          </NavLink>
        </>
      )}
    </nav>
  );

  const Avatar = () => (
    <button
      onClick={() => setMenuOpen((v) => !v)}
      className="relative inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white pl-2 pr-1 py-1 hover:shadow-sm"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
    >
      <div
        title={user?.displayName || user?.email}
        className="h-7 w-7 rounded-full bg-slate-300 grid place-content-center text-xs font-semibold text-slate-900"
      >
        {user?.displayName?.[0] || "U"}
      </div>
      <span className="hidden md:block text-xs text-slate-700 max-w-[22ch] truncate">
        {user?.displayName || user?.email}
      </span>
      <svg
        className={`h-4 w-4 text-slate-500 transition ${menuOpen ? "rotate-180" : ""}`}
        viewBox="0 0 20 20" fill="currentColor"
      >
        <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
      </svg>
      {/* Menu */}
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          <div className="px-3 py-2">
            <div className="text-xs text-slate-500">Signed in as</div>
            <div className="text-sm font-medium truncate">
              {user?.displayName || user?.email}
            </div>
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <Link
            to="/dashboard"
            role="menuitem"
            className="block w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => setMenuOpen(false)}
          >
            Dashboard
          </Link>
          <div className="my-1 h-px bg-slate-100" />
          <button
            role="menuitem"
            onClick={signOut}
            className="block w-full text-left rounded-lg px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
          >
            Sign out
          </button>
        </div>
      )}
    </button>
  );

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Glassy bar */}
      <div className="w-full border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
        <div className="mx-auto max-w-screen-2xl px-3 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brand />
          </div>

            {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-3">
            <NavTabs />
            {!user ? (
              <button
                onClick={signIn}
                className="ml-2 rounded-xl bg-slate-900 text-white px-3 py-2 text-sm hover:opacity-90"
              >
                Sign in
              </button>
            ) : (
              <Avatar />
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            Menu
            <svg className={`h-4 w-4 transition ${mobileOpen ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {/* Mobile sheet */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white">
            <div className="px-3 py-3 space-y-2">
              {user ? (
                <>
                  <NavTabs className="flex-col gap-2" />
                  <div className="flex items-center justify-between rounded-xl border p-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-slate-300 grid place-content-center text-xs font-semibold">
                        {user?.displayName?.[0] || "U"}
                      </div>
                      <div className="text-xs text-slate-700 truncate max-w-[55vw]">
                        {user?.displayName || user?.email}
                      </div>
                    </div>
                    <button
                      onClick={signOut}
                      className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={signIn}
                  className="w-full rounded-xl bg-slate-900 text-white px-3 py-2 text-sm hover:opacity-90"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error rail (auth) */}
      {error && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-700 text-sm px-3 md:px-6 py-2">
          {error}
        </div>
      )}
    </header>
  );
}
