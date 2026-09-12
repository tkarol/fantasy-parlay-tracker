import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ThemeToggle } from "./ui";
import { useAuth } from "../hooks/useAuth";
import { useLeagueContext } from "../hooks/useLeagueContext";
import { cn } from "../lib/cn";

export function NavBar() {
  const { user, signOut } = useAuth();
  const { leagueName, isMember, isAdmin } = useLeagueContext();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: "/", label: "This week", end: true },
    { to: "/stats", label: "Stats", end: false },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", end: false }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-screen-xl items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link to="/" className="flex min-w-0 shrink items-center gap-2">
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-content-center rounded-lg bg-accent text-xs font-bold text-accent-ink"
          >
            FP
          </span>
          <span className="hidden truncate text-sm font-semibold text-ink sm:block">
            {leagueName || "Parlay Tracker"}
          </span>
        </Link>

        {isMember && (
          <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    "shrink-0 rounded-lg px-2.5 py-1.5 text-sm transition sm:px-3",
                    isActive
                      ? "bg-accent-soft font-semibold text-accent"
                      : "text-ink-muted hover:bg-surface-3 hover:text-ink",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />

          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
                className="flex items-center rounded-full border border-line p-0.5 transition hover:bg-surface-3"
              >
                <Avatar name={user.displayName ?? user.email ?? "?"} photoURL={user.photoURL} />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-2 w-56 animate-slide-up overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
                  >
                    <div className="border-b border-line px-3 py-2">
                      <p className="truncate text-sm font-medium text-ink">{user.displayName}</p>
                      <p className="truncate text-xs text-ink-faint">{user.email}</p>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 sm:hidden">
                      <span className="text-sm text-ink-muted">Theme</span>
                      <ThemeToggle />
                    </div>
                    <div className="border-t border-line p-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          void signOut();
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-3 hover:text-ink"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

export function Avatar({
  name,
  photoURL,
  size = "sm",
}: {
  name: string;
  photoURL?: string | null;
  size?: "sm" | "md";
}) {
  const dimension = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt=""
        className={cn("shrink-0 rounded-full object-cover", dimension)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-content-center rounded-full bg-brand font-semibold text-brand-ink",
        dimension,
      )}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
