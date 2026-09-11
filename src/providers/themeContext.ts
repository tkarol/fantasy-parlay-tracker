import { createContext } from "react";

export type ThemePreference = "light" | "dark" | "system";

export interface ThemeState {
  preference: ThemePreference;
  /** What is actually on screen once "system" is resolved. */
  resolved: "light" | "dark";
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeState | null>(null);
export const THEME_STORAGE_KEY = "parlay-theme";
