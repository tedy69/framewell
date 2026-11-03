import type { Framing } from "./video";

export type PhotoPlatform = "instagram" | "whatsapp";
export type PhotoFormat = "jpeg" | "png";
export interface PhotoDimensions {
  width: number;
  height: number;
}
export interface PhotoSettings {
  platform: PhotoPlatform;
  resolution: number;
  framing: Framing;
  format: PhotoFormat;
  quality: "high" | "balanced";
  background: "black" | "white";
}
export const PHOTO_PRESETS = {
  instagram: {
    name: "Instagram Story",
    short: "Instagram",
    description: "A portrait canvas for the photo you want to share.",
  },
  whatsapp: {
    name: "WhatsApp Status",
    short: "WhatsApp",
    description: "Start your status with a clear original photo.",
  },
} as const;
export const PHOTO_MAX_BYTES = 30 * 1024 * 1024;
export function validatePhotoDimensions({ width, height }: PhotoDimensions) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 32 ||
    height < 32
  )
    return "Choose an original photo at least 32 × 32 pixels.";
  if (width * height > 60_000_000 || width > 16384 || height > 16384)
    return "This photo is too large for this browser tool. Choose a version up to 60 megapixels and 16,384 pixels on either edge.";
  return null;
}
export function photoLayout(
  source: PhotoDimensions | null,
  resolution: number,
  framing: Framing,
) {
  // Multiples of 9 and 16 keep an exact portrait ratio without enlarging content.
  const limit = source
    ? Math.min(
        resolution,
        framing === "crop"
          ? Math.min(source.width, (source.height * 9) / 16)
          : Math.max(source.width, (source.height * 9) / 16),
      )
    : resolution;
  const width = Math.max(9, Math.floor(limit / 9) * 9);
  const height = (width / 9) * 16;
  if (!source)
    return { width, height, x: 0, y: 0, drawWidth: width, drawHeight: height };
  const scale = Math.min(
    1,
    framing === "crop"
      ? Math.max(width / source.width, height / source.height)
      : Math.min(width / source.width, height / source.height),
  );
  const drawWidth = source.width * scale,
    drawHeight = source.height * scale;
  return {
    width,
    height,
    x: (width - drawWidth) / 2,
    y: (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  };
}
export function isAnimatedPhoto(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));
  if (bytes.length >= 8 && bytes[0] === 137 && text(1, 3) === "PNG") {
    for (let offset = 8; offset + 12 <= bytes.length; ) {
      const length = view.getUint32(offset, false);
      if (text(offset + 4, 4) === "acTL") return true;
      if (length > bytes.length - offset - 12) break;
      offset += length + 12;
    }
  }
  if (bytes.length >= 12 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    for (let offset = 12; offset + 8 <= bytes.length; ) {
      const length = view.getUint32(offset + 4, true);
      if (
        text(offset, 4) === "ANIM" ||
        (text(offset, 4) === "VP8X" &&
          length >= 1 &&
          offset + 8 < bytes.length &&
          (bytes[offset + 8] & 2) !== 0)
      )
        return true;
      if (length > bytes.length - offset - 8) break;
      offset += 8 + length + (length % 2);
    }
  }
  return false;
}
export function photoFilename(name: string, settings: PhotoSettings) {
  const stem =
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80) || "photo";
  return `${stem}-${settings.platform}.${settings.format === "jpeg" ? "jpg" : "png"}`;
}
export async function readPhoto(file: File, signal: AbortSignal) {
  if (!/\.(jpe?g|png|webp)$/i.test(file.name))
    throw new Error(
      "Choose a JPEG, PNG, or WebP photo. For HEIC, export a JPEG from your Photos app first.",
    );
  if (file.size > PHOTO_MAX_BYTES)
    throw new Error(
      "This photo is over 30 MB. Choose a smaller original photo.",
    );
  const header = new Uint8Array(await file.arrayBuffer());
  const isJpeg =
    header.length >= 3 &&
    header[0] === 255 &&
    header[1] === 216 &&
    header[2] === 255;
  const isPng =
    header.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => header[index] === value,
    );
  const isWebp =
    header.length >= 12 &&
    String.fromCharCode(...header.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...header.subarray(8, 12)) === "WEBP";
  if (!isJpeg && !isPng && !isWebp)
    throw new Error(
      "This file is not a JPEG, PNG, or WebP photo. Choose an original still image.",
    );
  if (isAnimatedPhoto(header))
    throw new Error(
      "Choose a still photo. Animated PNG and WebP images are not supported.",
    );
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        signal.removeEventListener("abort", abort);
        error ? reject(error) : resolve();
      };
      const abort = () => {
        image.removeAttribute("src");
        finish(new DOMException("Cancelled", "AbortError"));
      };
      const timer = window.setTimeout(
        () =>
          finish(
            new Error(
              "Reading the photo took too long. Try a smaller JPEG or PNG.",
            ),
          ),
        20000,
      );
      image.onload = () => finish();
      image.onerror = () =>
        finish(
          new Error(
            "This photo could not be decoded. Choose an original JPEG, PNG, or WebP.",
          ),
        );
      signal.addEventListener("abort", abort, { once: true });
      image.src = url;
    });
    const width = image.naturalWidth,
      height = image.naturalHeight;
    const error = validatePhotoDimensions({ width, height });
    if (error) throw new Error(error);
    return { file, url, image, width, height };
  } catch (error) {
    image.removeAttribute("src");
    URL.revokeObjectURL(url);
    throw error;
  }
}
export async function renderPhoto(
  source: PhotoDimensions & { image: CanvasImageSource; file: File },
  settings: PhotoSettings,
) {
  const layout = photoLayout(source, settings.resolution, settings.framing);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  try {
    const ctx = canvas.getContext("2d", { colorSpace: "srgb" });
    if (!ctx)
      throw new Error(
        "Photo export is unavailable in this browser. Try another browser.",
      );
    ctx.fillStyle = settings.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      source.image,
      layout.x,
      layout.y,
      layout.drawWidth,
      layout.drawHeight,
    );
    const type = settings.format === "jpeg" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Photo export failed. Try a smaller image.")),
        type,
        settings.quality === "high" ? 0.95 : 0.85,
      ),
    );
    if (blob.type !== type)
      throw new Error(
        "This browser cannot export the selected format. Choose PNG instead.",
      );
    return {
      file: new File([blob], photoFilename(source.file.name, settings), {
        type,
      }),
      width: layout.width,
      height: layout.height,
    };
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}
