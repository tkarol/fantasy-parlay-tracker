/**
 * Client-side image preparation for ticket screenshots.
 *
 * Screenshots are stored in Firestore rather than Cloud Storage, so the whole
 * document must fit under Firestore's 1 MiB limit. Base64 inflates bytes by
 * about a third, so the encoded image is held to BYTE_BUDGET with room to
 * spare for the rest of the document.
 *
 * Phone screenshots routinely arrive at 3-6 MB, so quality and then dimensions
 * step down until the result fits. A parlay ticket is text on a flat
 * background, which survives that treatment well.
 */

/** Firestore hard limit for one document. */
export const FIRESTORE_DOC_LIMIT = 1_048_576;

/** Binary budget before base64. 600 KB encodes to ~800 KB, leaving headroom. */
const BYTE_BUDGET = 600 * 1024;

const MAX_EDGES = [1800, 1500, 1200, 1000, 800];
const QUALITIES = [0.82, 0.72, 0.62, 0.5, 0.4];

export interface PreparedImage {
  /** `data:image/jpeg;base64,...` — written straight into Firestore. */
  dataUrl: string;
  width: number;
  height: number;
  /** Size of the encoded string, which is what counts against the limit. */
  encodedBytes: number;
  originalBytes: number;
}

export function isSupportedImage(file: File): boolean {
  return /^image\/(png|jpe?g|webp|gif|heic|heif|avif)$/i.test(file.type);
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

function draw(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxEdge: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not process that image.");

  // Screenshots are usually opaque; a white base avoids black edges when a
  // transparent PNG is flattened into JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);

  return { canvas, width, height };
}

export async function prepareTicketImage(file: File): Promise<PreparedImage> {
  if (!isSupportedImage(file)) {
    throw new Error("Please choose an image file (PNG, JPEG, WebP or HEIC).");
  }

  const source = await loadBitmap(file);
  const sourceWidth = "width" in source ? source.width : 0;
  const sourceHeight = "height" in source ? source.height : 0;
  if (!sourceWidth || !sourceHeight) throw new Error("That image appears to be empty.");

  let best: PreparedImage | null = null;

  // Try the largest dimensions first and give up quality before size, so a
  // readable ticket stays readable.
  for (const maxEdge of MAX_EDGES) {
    const { canvas, width, height } = draw(
      source as CanvasImageSource,
      sourceWidth,
      sourceHeight,
      maxEdge,
    );

    for (const quality of QUALITIES) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const encodedBytes = dataUrl.length;
      const candidate: PreparedImage = {
        dataUrl,
        width,
        height,
        encodedBytes,
        originalBytes: file.size,
      };

      if (encodedBytes <= BYTE_BUDGET * 1.34) {
        if ("close" in source) source.close();
        return candidate;
      }
      // Keep the smallest attempt in case nothing fits, for the error message.
      if (!best || encodedBytes < best.encodedBytes) best = candidate;
    }
  }

  if ("close" in source) source.close();
  throw new Error(
    `That image is still ${formatBytes(best?.encodedBytes ?? 0)} at the lowest quality. Try cropping it to just the ticket.`,
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
