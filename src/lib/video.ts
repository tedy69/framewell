export type Platform = "instagram" | "whatsapp" | "tiktok";
export type Framing = "fit" | "crop";
export interface VideoMeta {
  width: number;
  height: number;
  duration: number;
}
export interface ExportSettings {
  platform: Platform;
  resolution: number;
  fps: number;
  framing: Framing;
  quality: "high" | "balanced";
  audio: boolean;
  start: number;
  end: number;
}
export const PRESETS = {
  instagram: {
    name: "Instagram Story",
    short: "Instagram",
    description: "A clean, vertical canvas for your stories.",
    resolution: 1080,
    rate: "10M",
    compactRate: 8_000_000,
    note: "Choose the highest upload quality available in Instagram. Upload the exported file directly from your gallery.",
  },
  whatsapp: {
    name: "WhatsApp Status",
    short: "WhatsApp",
    description: "A lighter file for your everyday updates.",
    resolution: 720,
    rate: "4M",
    compactRate: 4_000_000,
    note: "WhatsApp does not support HD media for Status and may reduce quality. This preset cannot bypass that compression.",
  },
  tiktok: {
    name: "TikTok",
    short: "TikTok",
    description: "Keep the detail in your next short video.",
    resolution: 1080,
    rate: "12M",
    compactRate: 10_000_000,
    note: "Start with the original recording and upload this MP4 directly. TikTok applies its own processing after upload.",
  },
} as const;
const even = (value: number) => Math.max(2, Math.floor(value / 2) * 2);
export function outputSize(
  meta: VideoMeta | null,
  resolution: number,
  framing: Framing,
) {
  const ratio = 9 / 16;
  const width = even(
    meta
      ? Math.min(
          resolution,
          framing === "crop"
            ? Math.min(meta.width, meta.height * ratio)
            : Math.max(meta.width, meta.height * ratio),
        )
      : resolution,
  );
  return { width, height: even(width / ratio) };
}
export function validateRange(start: number, end: number, duration: number) {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end > duration + 0.01 ||
    end - start < 0.1
  )
    return "Choose a valid clip of at least 0.1 seconds within your video.";
  if (end - start > 180)
    return "Export up to 3 minutes at a time. Shorten the clip to continue.";
  return null;
}
export function videoBitrate(meta: VideoMeta, settings: ExportSettings) {
  const preset = PRESETS[settings.platform];
  if (settings.quality === "high") return parseFloat(preset.rate) * 1_000_000;
  const { width, height } = outputSize(meta, settings.resolution, settings.framing);
  // 4 Mbps at 720p/30, scaled to the pixels actually exported. Higher frame
  // rates share detail between frames, so they need less than a linear increase.
  return Math.min(
    preset.compactRate,
    Math.max(
      250_000,
      Math.round(
        4_000_000 * ((width * height) / (720 * 1280)) * Math.sqrt(settings.fps / 30),
      ),
    ),
  );
}
export function audioBitrate(settings: ExportSettings) {
  return settings.quality === "high" ? 192_000 : 128_000;
}
export function nativeQualityOptions(meta: VideoMeta, settings: ExportSettings) {
  return {
    // An explicit quantizer overrides the bitrate. Only High detail opts into
    // that unbounded size tradeoff; Balanced must use bitrate-based encoding.
    ...(settings.quality === "high" ? { quantizer: 18 } : {}),
    bitrate: videoBitrate(meta, settings),
    bitrateMode: "variable" as const,
  };
}
export function exportArgs(
  input: string,
  meta: VideoMeta,
  settings: ExportSettings,
) {
  const { width, height } = outputSize(
    meta,
    settings.resolution,
    settings.framing,
  );
  const filter =
    settings.framing === "crop"
      ? `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height},setsar=1`
      : `scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;
  return [
    "-ss",
    String(settings.start),
    "-i",
    input,
    "-t",
    String(settings.end - settings.start),
    "-map",
    "0:v:0",
    ...(settings.audio ? ["-map", "0:a:0?"] : []),
    "-vf",
    filter,
    "-r",
    String(settings.fps),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    settings.quality === "high" ? "18" : "23",
    "-maxrate",
    String(videoBitrate(meta, settings)),
    "-bufsize",
    String(videoBitrate(meta, settings) * 2),
    "-pix_fmt",
    "yuv420p",
    ...(settings.audio
      ? ["-c:a", "aac", "-b:a", String(audioBitrate(settings)), "-ar", "48000"]
      : ["-an"]),
    "-map_metadata",
    "-1",
    "-movflags",
    "+faststart",
    "-y",
    "output.mp4",
  ];
}
export function time(value: number) {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(value % 60)
    .toString()
    .padStart(2, "0")}`;
}
export function bytes(value: number) {
  return value >= 1024 * 1024
    ? `${(value / 1024 / 1024).toFixed(1)} MB`
    : `${(value / 1024).toFixed(0)} KB`;
}
