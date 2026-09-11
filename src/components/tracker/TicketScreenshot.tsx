import { useRef, useState, type DragEvent } from "react";
import type { User } from "firebase/auth";
import { Button, ConfirmDialog, EmptyState, Modal, Skeleton } from "../ui";
import { useToast } from "../../hooks/useToast";
import { useTicketImage } from "../../hooks/useTicketImage";
import { removeTicketImage, saveTicketImage } from "../../lib/api";
import { formatBytes, prepareTicketImage, type PreparedImage } from "../../lib/image";
import { formatDateTime } from "../../lib/dates";
import type { TicketImage, Week } from "../../types/models";
import { cn } from "../../lib/cn";

/**
 * The real sportsbook ticket for a week.
 *
 * Admin-only, enforced by firestore.rules on the image document itself.
 */
export function TicketScreenshot({
  leagueId,
  week,
  user,
  isAdmin,
}: {
  leagueId: string;
  week: Week;
  user: User | null;
  isAdmin: boolean;
}) {
  const toast = useToast();
  const { image, loading } = useTicketImage(leagueId, week);

  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [working, setWorking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setWorking(true);
    try {
      setPrepared(await prepareTicketImage(file));
    } catch (error) {
      toast.error("Couldn't use that image", (error as Error)?.message);
    } finally {
      setWorking(false);
    }
  }

  async function onSave() {
    if (!prepared || !user) return;
    setWorking(true);
    try {
      await saveTicketImage(leagueId, week.id, user, prepared);
      setPrepared(null);
      toast.success("Ticket screenshot saved");
    } catch (error) {
      toast.error("Couldn't save that screenshot", messageFor(error));
    } finally {
      setWorking(false);
    }
  }

  async function onRemove() {
    setWorking(true);
    try {
      await removeTicketImage(leagueId, week.id);
      toast.success("Screenshot removed");
      setConfirmRemove(false);
    } catch (error) {
      toast.error("Couldn't remove the screenshot", messageFor(error));
    } finally {
      setWorking(false);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void onFiles(event.dataTransfer.files);
  }

  if (loading && !prepared) return <Skeleton className="h-48 w-full" />;

  // A freshly picked image takes over until it is saved or discarded.
  if (prepared) {
    return (
      <div className="space-y-3">
        <img
          src={prepared.dataUrl}
          alt="Selected ticket screenshot preview"
          className="mx-auto max-h-72 w-auto rounded-xl border border-line object-contain"
        />
        <p className="text-xs text-ink-faint">
          {prepared.width}×{prepared.height} · {formatBytes(prepared.encodedBytes)}
          {prepared.originalBytes > prepared.encodedBytes && (
            <> (from {formatBytes(prepared.originalBytes)})</>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="primary" onClick={onSave} loading={working}>
            Save screenshot
          </Button>
          <Button variant="ghost" disabled={working} onClick={() => setPrepared(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (image) {
    return (
      <>
        <figure className="space-y-2">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block w-full overflow-hidden rounded-xl border border-line bg-surface-2"
            aria-label="View the full ticket screenshot"
          >
            <img
              src={image.src}
              alt={`Parlay ticket for week ${week.week}`}
              loading="lazy"
              className="mx-auto max-h-96 w-auto object-contain transition hover:opacity-90"
              width={image.width ?? undefined}
              height={image.height ?? undefined}
            />
          </button>
          <figcaption className="text-xs text-ink-faint">
            Added by {image.uploadedByName || "an admin"}
            {image.uploadedAt ? ` · ${formatDateTime(image.uploadedAt)}` : ""}
          </figcaption>
          {isAdmin && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
                Replace
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(true)}>
                Remove
              </Button>
              <HiddenInput ref={inputRef} onFiles={onFiles} />
            </div>
          )}
        </figure>

        <Lightbox image={image} week={week} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />

        <ConfirmDialog
          open={confirmRemove}
          title="Remove this screenshot?"
          destructive
          busy={working}
          confirmLabel="Remove"
          message="The image is deleted for everyone in the league."
          onConfirm={onRemove}
          onCancel={() => setConfirmRemove(false)}
        />
      </>
    );
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon="📷"
        title="No ticket screenshot yet"
        description="An admin can add a photo of the real ticket once it's placed."
      />
    );
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "rounded-xl border-2 border-dashed px-6 py-8 text-center transition",
        dragging ? "border-ink/40 bg-surface-3" : "border-line bg-surface-2",
      )}
    >
      <div className="mx-auto mb-2 grid h-10 w-10 place-content-center rounded-xl bg-surface-3 text-lg">
        📷
      </div>
      <p className="text-sm font-medium text-ink">Add the ticket screenshot</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-ink-muted">
        Drop an image here, or choose one. It's resized in your browser first, so a phone
        screenshot stays small.
      </p>
      <Button
        className="mt-3"
        size="sm"
        variant="secondary"
        loading={working}
        onClick={() => inputRef.current?.click()}
      >
        Choose image
      </Button>
      <HiddenInput ref={inputRef} onFiles={onFiles} />
    </div>
  );
}

function messageFor(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === "permission-denied") return "Only a league admin can change the ticket screenshot.";
  if (code === "invalid-argument") {
    return "That image is too large to store. Try cropping it to just the ticket.";
  }
  return (error as { message?: string })?.message ?? "Please try again.";
}

function HiddenInput({
  ref,
  onFiles,
}: {
  ref: React.Ref<HTMLInputElement>;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      className="sr-only"
      onChange={(event) => {
        void onFiles(event.target.files);
        // Allow re-selecting the same file after a cancel.
        event.target.value = "";
      }}
    />
  );
}

function Lightbox({
  image,
  week,
  open,
  onClose,
}: {
  image: TicketImage;
  week: Week;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`Week ${week.week} ticket`}
      description={image.uploadedByName ? `Uploaded by ${image.uploadedByName}` : undefined}
    >
      <img
        src={image.src}
        alt={`Parlay ticket for week ${week.week}`}
        className="mx-auto w-auto max-w-full object-contain"
      />
    </Modal>
  );
}
