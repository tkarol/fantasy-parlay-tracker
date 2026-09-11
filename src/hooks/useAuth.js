// src/hooks/useAuth.js
import { useEffect, useMemo, useState } from "react";
import { auth, googleProvider } from "../firebase";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
} from "firebase/auth";

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err1) {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (err2) {
        setError(err2?.message || "Sign-in failed");
        // Optional: surface it immediately
        alert(err2?.message || "Sign-in failed");
      }
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (err) {
      setError(err?.message || "Sign-out failed");
      alert(err?.message || "Sign-out failed");
    }
  };

  return useMemo(
    () => ({ user, loading, error, signIn, signOut }),
    [user, loading, error]
  );
}
