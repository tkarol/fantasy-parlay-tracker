import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { Button, Input } from "./ui";
import { useToast } from "../hooks/useToast";

export const EMULATORS_ENABLED = import.meta.env.VITE_USE_EMULATORS === "true";

/**
 * Email sign-in for local emulator work only — a Google popup can't complete
 * against the Auth emulator. Renders nothing unless VITE_USE_EMULATORS is set,
 * so it never reaches a real deployment.
 */
export function DevSignIn() {
  const toast = useToast();
  const [email, setEmail] = useState("ann@example.test");
  const [busy, setBusy] = useState(false);

  if (!EMULATORS_ENABLED) return null;

  return (
    <div className="flex items-center gap-1">
      <Input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-label="Emulator sign-in email"
        className="h-8 w-44 py-1 text-xs"
      />
      <Button
        size="sm"
        variant="primary"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await signInWithEmailAndPassword(auth, email, "password");
          } catch (error) {
            toast.error("Emulator sign-in failed", (error as Error)?.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Dev sign in
      </Button>
    </div>
  );
}
