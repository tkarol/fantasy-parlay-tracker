import { REACTION_EMOJI, type Leg, type Reaction } from "../../types/models";

/**
 * The prompt to go trash-talk, shown at the moment it makes sense: you have
 * put your own leg up, other people's are sitting there, and you have not
 * reacted to any of them.
 *
 * Reactions are the social half of the app, but nothing ever asked for one —
 * the only affordance was a small "+" under each pick, which reads as nothing
 * in particular until someone tells you what it does.
 *
 * It clears itself the moment you leave a reaction, so it asks once per week
 * rather than nagging all season.
 */
export function ReactionNudge({
  legs,
  reactions,
  currentUid,
  enabled,
}: {
  legs: readonly Leg[];
  reactions: Record<string, Reaction[]>;
  currentUid: string | null;
  /** False on past weeks and for non-members — this is about the week at hand. */
  enabled: boolean;
}) {
  if (!enabled || !currentUid) return null;

  // Before you have picked, your job is picking; the form says so already.
  if (!legs.some((leg) => leg.uid === currentUid)) return null;
  if (!legs.some((leg) => leg.uid !== currentUid)) return null;

  const reacted = Object.values(reactions).some((list) =>
    list.some((reaction) => reaction.uid === currentUid),
  );
  if (reacted) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-accent-line bg-accent-soft px-3 py-2">
      <span aria-hidden className="text-base leading-none">
        {REACTION_EMOJI.join(" ")}
      </span>
      <span className="text-sm text-ink">
        You're on the ticket. Now rate everyone else's — tap the{" "}
        <span className="rounded border border-line bg-surface px-1 text-xs text-ink-muted">+</span>{" "}
        under their pick.
      </span>
    </div>
  );
}
