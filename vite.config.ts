import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const REQUIRED_ENV = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

/**
 * Fail the build when the Firebase config is missing.
 *
 * Without this a missing .env builds cleanly and produces a bundle that throws
 * on first paint — a white screen that only shows up after deploying. Better
 * to never produce that artifact.
 */
function assertEnv(mode: string, command: string) {
  const env = loadEnv(mode, process.cwd(), "");
  const missing = REQUIRED_ENV.filter((key) => !env[key]);
  if (missing.length === 0) return;

  const message =
    `Missing Firebase config: ${missing.join(", ")}.\n` +
    `Copy .env.example to .env and fill it in (see README).`;

  if (command === "build") throw new Error(message);
  console.warn(`\n[config] ${message}\n`);
}

export default defineConfig(({ mode, command }) => {
  assertEnv(mode, command);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      target: "es2022",
      sourcemap: true,
      rollupOptions: {
        output: {
          // Firebase is the bulk of the bundle; split it so app code
          // invalidates independently of the SDK on redeploys.
          manualChunks: {
            firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
            react: ["react", "react-dom", "react-router-dom"],
          },
        },
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});
