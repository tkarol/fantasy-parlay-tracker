import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

/**
 * Config comes from `.env` (see `.env.example`). These values are public
 * client identifiers — security is enforced by firestore.rules / storage.rules,
 * not by keeping them hidden. Reading them from env keeps the repo free of a
 * hardcoded config that silently drifts from the real project.
 */
function requireEnv(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `Missing ${key}. Copy .env.example to .env and fill in your Firebase web config.`,
    );
  }
  return value;
}

const firebaseConfig: FirebaseOptions = {
  apiKey: requireEnv("VITE_FIREBASE_API_KEY"),
  authDomain: requireEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: requireEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: requireEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requireEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: requireEnv("VITE_FIREBASE_APP_ID"),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * Point at the local emulator suite when VITE_USE_EMULATORS=true, so rules and
 * data can be exercised without touching the real project. See README.
 */
if (import.meta.env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

export const googleProvider = new GoogleAuthProvider();
// Always show the account chooser; avoids silently reusing the wrong Google account.
googleProvider.setCustomParameters({ prompt: "select_account" });

// Keep users signed in across tabs and restarts.
void setPersistence(auth, browserLocalPersistence).catch(() => {
  /* Safari private mode blocks persistence; session-only auth still works. */
});
