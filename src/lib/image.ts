/**
 * Client-side image preparation for ticket screenshots.
 *
 * Phone screenshots are routinely 3-6 MB. Downscaling and re-encoding before
 * upload keeps them under the storage rule's 8 MB cap, makes the upload fast
 * on a phone connection, and keeps the league's storage bill near zero.
 */

export interface PreparedImage {
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
  /** Object URL for preview. The caller must revoke it. */
  previewUrl: string;
  originalBytes: number;
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const MAX_EDGE = 2000;
const QUALITY = 0.85;

export function isSupportedImage(file: File): boolean {
  return /^image\/(png|jpe?g|webp|gif|heic|heif)$/i.test(file.type);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari refuses some HEIC variants here; fall back to an <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That file could not be read as an image."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareTicketImage(file: File): Promise<PreparedImage> {
  if (!isSupportedImage(file)) {
    throw new Error("Please choose an image file (PNG, JPEG, WebP or HEIC).");
  }

  const source = await loadBitmap(file);
  const sourceWidth = "width" in source ? source.width : 0;
  const sourceHeight = "height" in source ? source.height : 0;
  if (!sourceWidth || !sourceHeight) throw new Error("That image appears to be empty.");

  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not process that image.");
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  if ("close" in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("Your browser could not process that image.");

  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error("That image is too large even after compression. Try cropping it first.");
  }

  return {
    blob,
    fileName: `ticket-${Date.now()}.jpg`,
    width,
    height,
    previewUrl: URL.createObjectURL(blob),
    originalBytes: file.size,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
