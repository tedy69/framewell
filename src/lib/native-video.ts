import type { ExportSettings, VideoMeta } from "./video.ts";

export interface NativeVideoRequest {
  file: File;
  meta: VideoMeta;
  settings: ExportSettings;
}
export type NativeVideoReply =
  | { type: "progress"; fraction: number }
  | { type: "result"; blob: Blob }
  | { type: "unsupported" };
const IDLE_TIMEOUT_MS = 30_000;

/** Isolate native codecs so cancellation or a stalled browser codec can be stopped. */
export async function exportVideoNative(
  file: File,
  meta: VideoMeta,
  settings: ExportSettings,
  signal: AbortSignal,
  onProgress: (fraction: number) => void,
): Promise<Blob | null> {
  signal.throwIfAborted();
  if (
    typeof globalThis.Worker !== "function" ||
    typeof globalThis.VideoEncoder !== "function" ||
    typeof globalThis.VideoDecoder !== "function"
  )
    return null;
  let worker: Worker;
  try {
    worker = new Worker(new URL("./native-video.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    return null;
  }
  return new Promise<Blob | null>((resolve, reject) => {
    let settled = false;
    let lastProgress = Date.now();
    let previousFraction = -1;
    const visible = () => {
      lastProgress = Date.now();
    };
    const finish = (blob: Blob | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      clearInterval(watchdog);
      signal.removeEventListener("abort", abort);
      if (typeof document !== "undefined")
        document.removeEventListener("visibilitychange", visible);
      worker.terminate();
      error ? reject(error) : resolve(blob);
    };
    const abort = () =>
      finish(
        null,
        signal.reason ?? new DOMException("Cancelled", "AbortError"),
      );
    const watchdog = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) {
        lastProgress = Date.now();
        return;
      }
      if (Date.now() - lastProgress >= IDLE_TIMEOUT_MS) finish(null);
    }, 1000);
    signal.addEventListener("abort", abort, { once: true });
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", visible);
    worker.onmessage = (event: MessageEvent<NativeVideoReply>) => {
      if (settled) return;
      const reply = event.data;
      if (reply.type === "progress") {
        if (reply.fraction > previousFraction) {
          previousFraction = reply.fraction;
          lastProgress = Date.now();
        }
        onProgress(reply.fraction);
      } else if (reply.type === "result") finish(reply.blob);
      else finish(null);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish(null);
    };
    worker.onmessageerror = () => finish(null);
    try {
      worker.postMessage({ file, meta, settings } satisfies NativeVideoRequest);
    } catch {
      finish(null);
    }
  });
}
