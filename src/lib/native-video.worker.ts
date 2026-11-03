import { exportVideoNative } from "./native-video-engine";
import type { NativeVideoRequest, NativeVideoReply } from "./native-video";

self.onmessage = async (event: MessageEvent<NativeVideoRequest>) => {
  const { file, meta, settings } = event.data;
  let lastUpdate = -Infinity;
  const send = (reply: NativeVideoReply) => self.postMessage(reply);
  try {
    const blob = await exportVideoNative(
      file,
      meta,
      settings,
      new AbortController().signal,
      (fraction) => {
        const now = performance.now();
        if (now - lastUpdate >= 100 || fraction === 1) {
          lastUpdate = now;
          send({ type: "progress", fraction });
        }
      },
    );
    send(blob ? { type: "result", blob } : { type: "unsupported" });
  } catch {
    send({ type: "unsupported" });
  }
};
