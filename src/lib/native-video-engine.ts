import type { Conversion, InputTrack } from "mediabunny";
import {
  outputSize,
  PRESETS,
  type ExportSettings,
  type VideoMeta,
} from "./video.ts";

export function nativeVideoRate(meta: VideoMeta, settings: ExportSettings) {
  const size = outputSize(meta, settings.resolution, settings.framing);
  const ceiling = parseFloat(PRESETS[settings.platform].rate) * 1_000_000;
  // Keep the existing destination bitrate budget when quantizer control is
  // unavailable, instead of making the faster path a lower-quality preset.
  if (settings.quality === "high") return ceiling;
  return Math.min(
    ceiling,
    Math.max(
      250_000,
      Math.round(size.width * size.height * settings.fps * 0.1),
    ),
  );
}

export function retainsSelectedTracks<T>(
  used: readonly T[],
  video: T | null,
  audio: T | null,
  keepAudio: boolean,
) {
  return (
    video !== null &&
    used.includes(video) &&
    (!keepAudio || audio === null || used.includes(audio))
  );
}

/** Returns null when this browser/source needs the FFmpeg compatibility path. */
export async function exportVideoNative(
  file: File,
  meta: VideoMeta,
  settings: ExportSettings,
  signal: AbortSignal,
  onProgress: (fraction: number) => void,
): Promise<Blob | null> {
  signal.throwIfAborted();
  if (
    typeof globalThis.VideoEncoder !== "function" ||
    typeof globalThis.VideoDecoder !== "function"
  )
    return null;
  let media: typeof import("mediabunny");
  try {
    media = await import("mediabunny");
  } catch {
    signal.throwIfAborted();
    return null;
  }
  const {
    Input,
    BlobSource,
    MP4,
    QTFF,
    MATROSKA,
    WEBM,
    Output,
    Mp4OutputFormat,
    BufferTarget,
    Conversion,
    Quality,
  } = media;
  signal.throwIfAborted();
  const input = new Input({
    formats: [MP4, QTFF, MATROSKA, WEBM],
    source: new BlobSource(file),
  });
  let conversion: Conversion | null = null;
  const abort = () => {
    void conversion?.cancel().catch(() => {});
    input.dispose();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const [videoTrack, audioTrack] = await Promise.all([
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
    ]);
    signal.throwIfAborted();
    if (!videoTrack) return null;
    const { width, height } = outputSize(
      meta,
      settings.resolution,
      settings.framing,
    );
    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });
    conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      showWarnings: false,
      tags: {},
      trim: { start: settings.start, end: settings.end },
      video: {
        codec: "avc",
        width,
        height,
        fit: settings.framing === "crop" ? "cover" : "contain",
        frameRate: settings.fps,
        allowTransformationMetadata: false,
        // Let the browser select acceleration separately for decoding/encoding.
        // Forcing hardware rejects codecs such as VP8 on some Apple devices.
        hardwareAcceleration: "no-preference",
        quality: new Quality({
          quantizer: settings.quality === "high" ? 18 : 23,
          bitrate: nativeVideoRate(meta, settings),
          bitrateMode: "variable",
        }),
      },
      audio: settings.audio
        ? { codec: "aac", sampleRate: 48000, quality: new Quality(192_000) }
        : { discard: true },
    });
    signal.throwIfAborted();
    // A valid conversion can still have dropped an unsupported audio track.
    // Fall back instead of returning an accidentally silent or audio-only MP4.
    if (
      !conversion.isValid ||
      !retainsSelectedTracks<InputTrack>(
        conversion.utilizedTracks,
        videoTrack,
        audioTrack,
        settings.audio,
      )
    )
      return null;
    conversion.onProgress = onProgress;
    await conversion.execute();
    signal.throwIfAborted();
    if (!target.buffer?.byteLength) return null;
    return new Blob([target.buffer], { type: "video/mp4" });
  } catch (error) {
    if (signal.aborted) signal.throwIfAborted();
    // Codec availability depends on the real browser/device, not its user-agent.
    // The existing FFmpeg path retains compatibility when native conversion fails.
    return null;
  } finally {
    signal.removeEventListener("abort", abort);
    if (conversion && conversion.state !== "done")
      await conversion.cancel().catch(() => {});
    input.dispose();
  }
}
