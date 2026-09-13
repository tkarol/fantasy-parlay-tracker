import { useState } from "react";
import type { User } from "firebase/auth";
import { clearReaction, setReaction } from "../../lib/api";
import { useToast } from "../../hooks/useToast";
import { REACTION_EMOJI, type Reaction, type ReactionEmoji } from "../../types/models";
import { shortNames } from "../../lib/reactionNames";
import { cn } from "../../lib/cn";

/**
 * Trash talk, which is most of the point of a league like this.
 *
 * Shows only the reactions a leg has, plus one button to add yours — a row of
 * five permanently-visible emoji on eight legs is noise.
 *
 * One chip per person, not per emoji. Nobody has more than one reaction on a
 * leg, so a chip is simply someone and what they left — "💀 Cy", "🤡 Dave" —
 * and answering "who roasted me" is reading, not parsing a grouped count.
 */
export function LegReactions({
  leagueId,
  weekId,
  legId,
  reactions,
  user,
  canReact,
}: {
  leagueId: string;
  weekId: string;
  legId: string;
  reactions: Reaction[];
  user: User | null;
  canReact: boolean;
}) {
  const toast = useToast();
  const [picking, setPicking] = useState(false);

  const mine = user ? reactions.find((reaction) => reaction.uid === user.uid) : undefined;

  // Shortened together, so two people sharing a first name stay tellable apart.
  const labels = shortNames(reactions.map((reaction) => reaction.name));

  async function react(emoji: ReactionEmoji) {
    if (!user) return;
    setPicking(false);
    try {
      // Tapping what you already picked takes it back.
      if (mine?.emoji === emoji) await clearReaction(leagueId, weekId, legId, user.uid);
      else await setReaction(leagueId, weekId, legId, user, emoji);
    } catch (error) {
      toast.error("Couldn't save that", (error as Error)?.message);
    }
  }

  if (reactions.length === 0 && !canReact) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {reactions.map((reaction, index) => {
        const isMine = mine?.uid === reaction.uid;
        const label = labels[index] ?? reaction.name;
        const content = (
          <>
            <span aria-hidden className="text-base leading-none">
              {reaction.emoji}
            </span>
            <span aria-hidden className="truncate font-medium">
              {label}
            </span>
          </>
        );
        // Solid rather than outlined: on a white card an outline chip reads as
        // chrome and the eye skips it, which is how this got missed before.
        const shape =
          "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs";

        // Only your own chip does anything — tapping someone else's would have
        // nothing to change.
        return isMine && canReact ? (
          <button
            key={reaction.uid}
            type="button"
            onClick={() => void react(reaction.emoji)}
            title={`${reaction.name} — tap to remove yours`}
            aria-label={`Your ${reaction.emoji} — remove it`}
            className={cn(shape, "border-accent-line bg-accent-soft text-ink transition hover:bg-surface-3")}
          >
            {content}
          </button>
        ) : (
          <span
            key={reaction.uid}
            title={reaction.name}
            aria-label={`${reaction.emoji} from ${reaction.name}`}
            className={cn(shape, "border-line bg-surface-3 text-ink")}
          >
            {content}
          </span>
        );
      })}

      {canReact && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setPicking((open) => !open)}
            aria-expanded={picking}
            aria-label="React to this leg"
            className="rounded-full border border-dashed border-line px-2 py-0.5 text-xs text-ink-faint transition hover:border-solid hover:text-ink"
          >
            +
          </button>

          {picking && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPicking(false)} aria-hidden />
              {/* Opens downward: above the button puts it off-screen for the
                  first leg on a short viewport. */}
              <div className="absolute left-0 top-full z-20 mt-1 flex animate-slide-up gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-lg">
                {REACTION_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => void react(emoji)}
                    className={cn(
                      "rounded-lg px-1.5 py-1 text-base transition hover:bg-surface-3",
                      mine?.emoji === emoji && "bg-surface-3",
                    )}
                  >
                    <span aria-hidden>{emoji}</span>
                    <span className="sr-only">React with {emoji}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
