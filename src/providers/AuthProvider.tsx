import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { AuthContext, type AuthState } from "./authContext";

/**
 * Single auth listener for the whole app. The previous build called a
 * `useAuth()` hook in every component, each opening its own
 * `onAuthStateChanged` subscription and keeping its own copy of the state.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Surface failures from a redirect sign-in started on a previous page load.
    void getRedirectResult(auth).catch((err: unknown) => {
      setError(messageFor(err));
    });

    return onAuthStateChanged(
      auth,
      (next) => {
        setUser(next);
        setLoading(false);
      },
      (err) => {
        setError(messageFor(err));
        setLoading(false);
      },
    );
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";

      // A blocked popup is the normal case for in-app browsers; fall back to a
      // redirect. A user who simply closed the popup is not an error worth
      // reporting.
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return;
      }
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: unknown) {
          setError(messageFor(redirectErr));
          return;
        }
      }
      setError(messageFor(err));
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
    } catch (err: unknown) {
      setError(messageFor(err));
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, error, signIn, signOut, clearError }),
    [user, loading, error, signIn, signOut, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function messageFor(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/network-request-failed":
      return "Network error — check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorised for sign-in in the Firebase console.";
    default:
      return (err as { message?: string })?.message ?? "Something went wrong.";
  }
}
