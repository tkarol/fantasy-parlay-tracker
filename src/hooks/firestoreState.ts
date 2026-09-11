import type { FirestoreError } from "firebase/firestore";

export interface QueryState<T> {
  data: T;
  loading: boolean;
  error: FirestoreError | null;
}

export function initialState<T>(empty: T): QueryState<T> {
  return { data: empty, loading: true, error: null };
}

/** True when a listener failed because the caller isn't allowed to read. */
export function isPermissionDenied(error: FirestoreError | null): boolean {
  return error?.code === "permission-denied";
}

export function describeFirestoreError(error: FirestoreError | null): string | null {
  if (!error) return null;
  switch (error.code) {
    case "permission-denied":
      return "You don't have access to this league.";
    case "unavailable":
      return "Can't reach the server — you may be offline.";
    case "failed-precondition":
      return "This query needs a Firestore index that hasn't been created yet.";
    default:
      return error.message;
  }
}
