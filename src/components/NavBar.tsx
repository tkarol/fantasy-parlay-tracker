import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Button, ThemeToggle } from "./ui";
import { useAuth } from "../hooks/useAuth";
import { cn } from "../lib/cn";

const LINKS = [
  { to: "/dashboard", label: "Leagues" },
  { to: "/create", label: "Create" },
  { to: "/join", label: "Join" },
];

export function NavBar() {
  const { user, signIn, signOut, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-3 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden
            className="grid h-7 w-7 place-content-center rounded-lg bg-brand text-xs font-bold text-brand-ink"
          >
            FP
          </span>
          <span className="hidden text-sm font-semibold text-ink sm:block">Parlay Tracker</span>
        </Link>

        {user && (
          <div className="hidden items-center gap-1 sm:flex">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-1.5 text-sm transition",
                    isActive || pathname.startsWith(link.to)
                      ? "bg-surface-3 font-medium text-ink"
                      : "text-ink-muted hover:bg-surface-3 hover:text-ink",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />

          {loading ? (
            <div className="skeleton h-8 w-20 rounded-lg" />
          ) : user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2.5 transition hover:bg-surface-3"
              >
                <Avatar name={user.displayName ?? user.email ?? "?"} photoURL={user.photoURL} />
                <span className="hidden max-w-[10rem] truncate text-sm text-ink sm:block">
                  {user.displayName ?? user.email}
                </span>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-2 w-52 animate-slide-up overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
                  >
                    <div className="border-b border-line px-3 py-2">
                      <p className="truncate text-sm font-medium text-ink">{user.displayName}</p>
                      <p className="truncate text-xs text-ink-faint">{user.email}</p>
                    </div>
                    <div className="p-1 sm:hidden">
                      {LINKS.map((link) => (
                        <Link
                          key={link.to}
                          to={link.to}
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                          className="block rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-3 hover:text-ink"
                        >
                          {link.label}
                        </Link>
                      ))}
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
          ) : (
            <Button variant="primary" size="sm" onClick={() => void signIn()}>
              Sign in
            </Button>
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
