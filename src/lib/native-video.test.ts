import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { retainsSelectedTracks } from "./native-video-engine.ts";
import { exportVideoNative } from "./native-video.ts";
import {
  videoBitrate,
  nativeQualityOptions,
  audioBitrate,
  exportArgs,
  type ExportSettings,
} from "./video.ts";
import type { NativeVideoReply } from "./native-video.ts";
const settings: ExportSettings = {
  platform: "instagram",
  resolution: 1080,
  framing: "fit",
  fps: 30,
  quality: "high",
  audio: true,
  start: 0,
  end: 6,
};
test("balanced compression scales with output pixels and fps within destination budgets", () => {
  const hd = { width: 1080, height: 1920, duration: 6 },
    small = { width: 720, height: 1280, duration: 6 };
  assert.equal(videoBitrate(hd, settings), 10_000_000);
  assert.equal(videoBitrate(small, settings), 10_000_000);
  assert.ok(
    videoBitrate(small, { ...settings, quality: "balanced" }) <
      videoBitrate(hd, { ...settings, quality: "balanced" }),
  );
  assert.ok(
    videoBitrate(small, { ...settings, quality: "balanced" }) <
      videoBitrate(small, settings),
  );
  assert.ok(
    videoBitrate(hd, { ...settings, platform: "whatsapp" }) <= 4_000_000,
  );
  const balanced = { ...settings, quality: "balanced" as const };
  assert.equal(videoBitrate(small, balanced), 4_000_000);
  assert.equal(videoBitrate(hd, balanced), 8_000_000);
  assert.equal(
    videoBitrate(small, { ...balanced, platform: "whatsapp", resolution: 720, fps: 60 }),
    4_000_000,
  );
  assert.ok(
    videoBitrate(small, { ...balanced, fps: 60 }) > videoBitrate(small, balanced),
  );
  assert.equal(videoBitrate({ width: 64, height: 64, duration: 6 }, balanced), 250_000);
});
test("balanced native encoding cannot override the size budget with a quantizer; fallback shares rates", () => {
  const balanced = { ...settings, quality: "balanced" as const };
  assert.equal(nativeQualityOptions(meta, balanced).quantizer, undefined);
  assert.equal(nativeQualityOptions(meta, settings).quantizer, 18);
  assert.equal(nativeQualityOptions(meta, balanced).bitrateMode, "variable");
  const args = exportArgs("source.mp4", meta, balanced);
  assert.equal(
    args[args.indexOf("-maxrate") + 1],
    String(videoBitrate(meta, balanced)),
  );
  assert.equal(
    args[args.indexOf("-bufsize") + 1],
    String(videoBitrate(meta, balanced) * 2),
  );
  assert.equal(args[args.indexOf("-b:a") + 1], String(audioBitrate(balanced)));
  assert.equal(audioBitrate(balanced), 128_000);
  assert.equal(audioBitrate(settings), 192_000);
});
test("a native conversion may not silently discard selected video or source audio", () => {
  const video = {},
    audio = {};
  assert.equal(retainsSelectedTracks([video, audio], video, audio, true), true);
  assert.equal(retainsSelectedTracks([video], video, audio, true), false);
  assert.equal(retainsSelectedTracks([audio], video, audio, true), false);
  assert.equal(retainsSelectedTracks([video], video, null, true), true);
  assert.equal(retainsSelectedTracks([video], video, audio, false), true);
  assert.equal(retainsSelectedTracks([], null, null, false), false);
});
test("browsers without native encoding fall back without loading or processing the file", async () => {
  if (typeof globalThis.VideoEncoder === "function") return;
  const result = await exportVideoNative(
    new File(["fixture"], "clip.mp4"),
    { width: 720, height: 1280, duration: 6 },
    settings,
    new AbortController().signal,
    () => {},
  );
  assert.equal(result, null);
});
test("already cancelled work stops before attempting a fallback", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    exportVideoNative(
      new File(["fixture"], "clip.mp4"),
      { width: 720, height: 1280, duration: 6 },
      settings,
      controller.signal,
      () => {},
    ),
    { name: "AbortError" },
  );
});

function mockNativeWorker(
  t: TestContext,
  run: (worker: { send: (reply: NativeVideoReply) => void }) => void,
) {
  let instance: FakeWorker;
  class FakeWorker {
    terminated = false;
    onmessage: ((event: MessageEvent<NativeVideoReply>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    constructor() {
      instance = this;
    }
    postMessage() {
      run(this);
    }
    terminate() {
      this.terminated = true;
    }
    send(reply: NativeVideoReply) {
      this.onmessage?.({ data: reply } as MessageEvent<NativeVideoReply>);
    }
  }
  for (const [key, value] of [
    ["Worker", FakeWorker],
    ["VideoEncoder", class {}],
    ["VideoDecoder", class {}],
  ] as const) {
    const before = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
    t.after(() => {
      if (before) Object.defineProperty(globalThis, key, before);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  return () => instance!;
}
const fixture = () => new File(["fixture"], "clip.mp4", { type: "video/mp4" });
const meta = { width: 720, height: 1280, duration: 6 };

test("worker completion releases codecs and ignores late progress", async (t) => {
  const blob = new Blob(["mp4"], { type: "video/mp4" }),
    progress: number[] = [];
  const worker = mockNativeWorker(t, (w) =>
    queueMicrotask(() => {
      w.send({ type: "progress", fraction: 0.5 });
      w.send({ type: "result", blob });
      w.send({ type: "progress", fraction: 0.9 });
    }),
  );
  const result = await exportVideoNative(
    fixture(),
    meta,
    settings,
    new AbortController().signal,
    (p) => progress.push(p),
  );
  assert.equal(result, blob);
  assert.equal(worker().terminated, true);
  assert.deepEqual(progress, [0.5]);
});
test("unsupported native worker releases resources before compatibility fallback", async (t) => {
  const worker = mockNativeWorker(t, (w) =>
    queueMicrotask(() => w.send({ type: "unsupported" })),
  );
  assert.equal(
    await exportVideoNative(
      fixture(),
      meta,
      settings,
      new AbortController().signal,
      () => {},
    ),
    null,
  );
  assert.equal(worker().terminated, true);
});
test("cancelling an active native export terminates its worker immediately", async (t) => {
  const worker = mockNativeWorker(t, () => {}),
    controller = new AbortController();
  const pending = exportVideoNative(
    fixture(),
    meta,
    settings,
    controller.signal,
    () => {},
  );
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(worker().terminated, true);
});
test("a stalled codec falls back after 30 seconds without advancing progress", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"], now: 0 });
  const worker = mockNativeWorker(t, (w) =>
    w.send({ type: "progress", fraction: 0.5 }),
  );
  const pending = exportVideoNative(
    fixture(),
    meta,
    settings,
    new AbortController().signal,
    () => {},
  );
  t.mock.timers.tick(20_000);
  worker().send({ type: "progress", fraction: 0.5 });
  t.mock.timers.tick(10_001);
  assert.equal(await pending, null);
  assert.equal(worker().terminated, true);
});
