import { useState } from "react";
import type { User } from "firebase/auth";
import { clearReaction, setReaction } from "../../lib/api";
import { useToast } from "../../hooks/useToast";
import { REACTION_EMOJI, type Reaction, type ReactionEmoji } from "../../types/models";
import { summarizeReactors } from "../../lib/reactionNames";
import { cn } from "../../lib/cn";

/**
 * Trash talk, which is most of the point of a league like this.
 *
 * Shows only the reactions a leg has, plus one button to add yours — a row of
 * five permanently-visible emoji on eight legs is noise.
 *
 * Each chip names who left it. "💀 2" tells you nothing about who is laughing
 * at you, and the names used to live in a `title` tooltip, which never appears
 * on the phones this actually gets read on.
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

  const counts = new Map<ReactionEmoji, Reaction[]>();
  for (const reaction of reactions) {
    const bucket = counts.get(reaction.emoji);
    if (bucket) bucket.push(reaction);
    else counts.set(reaction.emoji, [reaction]);
  }

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
      {[...counts.entries()].map(([emoji, list]) => {
        const isMine = mine?.emoji === emoji;
        const names = list.map((reaction) => reaction.name);
        const full = names.join(", ");
        return (
          <button
            key={emoji}
            type="button"
            disabled={!canReact}
            onClick={() => void react(emoji)}
            title={full}
            aria-label={`${emoji} from ${full}`}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
              isMine
                ? "border-ink/30 bg-surface-3 text-ink"
                : "border-line text-ink-muted hover:bg-surface-3",
              !canReact && "cursor-default",
            )}
          >
            <span aria-hidden>{emoji}</span>
            <span aria-hidden className="truncate">
              {summarizeReactors(names)}
            </span>
          </button>
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
