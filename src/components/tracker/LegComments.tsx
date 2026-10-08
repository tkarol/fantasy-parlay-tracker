import { useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { Button, Input } from "../ui";
import { useToast } from "../../hooks/useToast";
import { addComment, deleteComment } from "../../lib/api";
import { formatRelative } from "../../lib/dates";
import { shortNames } from "../../lib/reactionNames";
import { MAX_COMMENT_LENGTH, type Comment } from "../../types/models";
import { cn } from "../../lib/cn";

/**
 * The argument under a leg.
 *
 * Collapsed to a count until someone asks for it: eight legs each with an open
 * thread would bury the ticket, which is what the page is actually for.
 */
export function LegComments({
  leagueId,
  weekId,
  legId,
  comments,
  user,
  canComment,
  isAdmin,
  now,
}: {
  leagueId: string;
  weekId: string;
  legId: string;
  comments: Comment[];
  user: User | null;
  canComment: boolean;
  isAdmin: boolean;
  now: Date;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const labels = shortNames(comments.map((comment) => comment.name));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !text.trim()) return;
    setSaving(true);
    try {
      await addComment(leagueId, weekId, legId, user, text);
      setText("");
    } catch (error) {
      toast.error("Couldn't post that", (error as Error)?.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(comment: Comment) {
    try {
      await deleteComment(leagueId, weekId, comment.id);
    } catch (error) {
      toast.error("Couldn't remove that", (error as Error)?.message);
    }
  }

  if (comments.length === 0 && !canComment) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="rounded-full px-1.5 py-0.5 text-xs text-ink-muted transition hover:bg-surface-3 hover:text-ink"
      >
        {comments.length === 0
          ? "Say something"
          : `${comments.length} comment${comments.length === 1 ? "" : "s"}`}
        <span aria-hidden className="ml-1 text-ink-faint">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-1.5 space-y-1.5">
          {comments.map((comment, index) => {
            const mine = user !== null && comment.uid === user.uid;
            return (
              <div
                key={comment.id}
                className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm"
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-ink">{labels[index] ?? comment.name}</span>
                  <span className="text-xs text-ink-faint">
                    {comment.createdAt ? formatRelative(comment.createdAt, now) : "just now"}
                  </span>
                  {(mine || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => void onDelete(comment)}
                      className="ml-auto text-xs text-ink-faint transition hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-ink">{comment.text}</p>
              </div>
            );
          })}

          {canComment && (
            <form onSubmit={onSubmit} className="flex gap-1.5">
              <Input
                value={text}
                onChange={(event) => setText(event.target.value)}
                // Short: at phone width the Post button leaves ~110px, and
                // the toggle above already says "Say something".
                placeholder="Comment"
                maxLength={MAX_COMMENT_LENGTH}
                aria-label="Add a comment"
                className={cn("h-8 py-1 text-sm")}
              />
              <Button type="submit" size="sm" variant="secondary" loading={saving} disabled={!text.trim()}>
                Post
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
