import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, ButtonLink, Card, CardBody, CardHeader, Field, Input } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { lookupInviteCode, requestToJoin } from "../lib/api";

export default function JoinLeague() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Support invite links of the form /join?code=ABC123.
  useEffect(() => {
    const fromUrl = params.get("code");
    if (fromUrl) setCode(fromUrl.toUpperCase());
  }, [params]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      toast.error("Sign in first", "You need an account to request access.");
      return;
    }

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      toast.error("Enter a code", "Ask an admin for the league's invite code.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await lookupInviteCode(trimmed);

      if (result.status === "not-found") {
        toast.error("That code doesn't match a league", "Check for typos and try again.");
        return;
      }
      if (result.status === "expired") {
        toast.error("That code has expired", "The admin rotated it. Ask for the current one.");
        return;
      }

      await requestToJoin(result.leagueId, trimmed, user);
      setSentTo(result.leagueName || result.leagueId);
      toast.success("Request sent", "An admin needs to approve you.");
    } catch (error) {
      toast.error("Couldn't send the request", (error as Error)?.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
      <Card>
        <CardHeader
          title="Join a league"
          description="Enter the invite code an admin shared with you."
          actions={
            <ButtonLink to="/dashboard" size="sm" variant="ghost">
              Cancel
            </ButtonLink>
          }
        />
        <CardBody>
          {sentTo ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto grid h-12 w-12 place-content-center rounded-2xl bg-emerald-500/10 text-xl">
                ✓
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ink">Request sent to {sentTo}</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  You'll see the league on your dashboard once an admin approves you.
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <Button variant="primary" onClick={() => navigate("/dashboard")}>
                  Back to dashboard
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSentTo(null);
                    setCode("");
                  }}
                >
                  Join another
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <Field label="Invite code" hint="Six characters, letters and numbers.">
                {(id) => (
                  <Input
                    id={id}
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    placeholder="ABC123"
                    maxLength={12}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="text-center font-mono text-lg tracking-[0.3em]"
                    autoFocus
                  />
                )}
              </Field>

              <Button type="submit" variant="primary" fullWidth loading={submitting}>
                Request to join
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
