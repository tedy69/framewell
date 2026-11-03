import type { Conversion, InputTrack } from "mediabunny";
import {
  outputSize,
  nativeQualityOptions,
  audioBitrate,
  type ExportSettings,
  type VideoMeta,
} from "./video.ts";

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
        quality: new Quality(nativeQualityOptions(meta, settings)),
      },
      audio: settings.audio
        ? {
            codec: "aac",
            sampleRate: 48000,
            quality: new Quality(audioBitrate(settings)),
          }
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
