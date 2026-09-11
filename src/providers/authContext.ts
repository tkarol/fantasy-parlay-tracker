import { createContext } from "react";
import type { User } from "firebase/auth";

export interface AuthState {
  user: User | null;
  /** True until Firebase has resolved the initial session. */
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);
