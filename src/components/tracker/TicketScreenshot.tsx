import { useEffect, useRef, useState, type DragEvent } from "react";
import type { User } from "firebase/auth";
import { Button, ConfirmDialog, EmptyState, Modal } from "../ui";
import { useToast } from "../../hooks/useToast";
import { removeTicketImage, uploadTicketImage } from "../../lib/api";
import { formatBytes, prepareTicketImage, type PreparedImage } from "../../lib/image";
import { formatDateTime } from "../../lib/dates";
import type { TicketImage, Week } from "../../types/models";
import { cn } from "../../lib/cn";

/**
 * The real sportsbook ticket for a week.
 *
 * Admin-only: the Firestore write that points the week at an uploaded image is
 * gated by firestore.rules, which is where the admin check has to live —
 * storage rules cannot read Firestore.
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
  const image = week.ticketImage;

  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Object URLs leak until revoked.
  useEffect(() => {
    return () => {
      if (prepared) URL.revokeObjectURL(prepared.previewUrl);
    };
  }, [prepared]);

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      const next = await prepareTicketImage(file);
      setPrepared((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return next;
      });
    } catch (error) {
      toast.error("Couldn't read that image", (error as Error)?.message);
    }
  }

  async function onUpload() {
    if (!prepared || !user) return;
    setProgress(0);
    try {
      await uploadTicketImage(leagueId, week.id, user, prepared, setProgress);
      URL.revokeObjectURL(prepared.previewUrl);
      setPrepared(null);
      toast.success("Ticket screenshot saved");
    } catch (error) {
      toast.error("Upload failed", (error as Error)?.message);
    } finally {
      setProgress(null);
    }
  }

  async function onRemove() {
    setRemoving(true);
    try {
      await removeTicketImage(leagueId, week.id, image);
      toast.success("Screenshot removed");
      setConfirmRemove(false);
    } catch (error) {
      toast.error("Couldn't remove the screenshot", (error as Error)?.message);
    } finally {
      setRemoving(false);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void onFiles(event.dataTransfer.files);
  }

  if (image && !prepared) {
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
              src={image.url}
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
          busy={removing}
          confirmLabel="Remove"
          message="The image will be deleted for everyone in the league."
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
        description="An admin can upload a photo of the real ticket once it's placed."
      />
    );
  }

  if (prepared) {
    return (
      <div className="space-y-3">
        <img
          src={prepared.previewUrl}
          alt="Selected ticket screenshot preview"
          className="mx-auto max-h-72 w-auto rounded-xl border border-line object-contain"
        />
        <p className="text-xs text-ink-faint">
          {prepared.width}×{prepared.height} · {formatBytes(prepared.blob.size)}
          {prepared.originalBytes > prepared.blob.size && (
            <> (compressed from {formatBytes(prepared.originalBytes)})</>
          )}
        </p>

        {progress !== null && (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-brand transition-[width]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="primary" onClick={onUpload} loading={progress !== null}>
            Save screenshot
          </Button>
          <Button
            variant="ghost"
            disabled={progress !== null}
            onClick={() => {
              URL.revokeObjectURL(prepared.previewUrl);
              setPrepared(null);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
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
        Drop an image here, or choose one. It's resized before upload so a phone screenshot
        stays small.
      </p>
      <Button className="mt-3" size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
        Choose image
      </Button>
      <HiddenInput ref={inputRef} onFiles={onFiles} />
    </div>
  );
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
      footer={
        <Button
          variant="secondary"
          onClick={() => window.open(image.url, "_blank", "noopener,noreferrer")}
        >
          Open full size
        </Button>
      }
    >
      <img
        src={image.url}
        alt={`Parlay ticket for week ${week.week}`}
        className="mx-auto w-auto max-w-full object-contain"
      />
    </Modal>
  );
}
