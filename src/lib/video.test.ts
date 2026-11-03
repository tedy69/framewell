import { test } from "node:test";
import assert from "node:assert/strict";
import {
  outputSize,
  exportArgs,
  validateRange,
  type ExportSettings,
} from "./video.ts";
test("portrait source is never upscaled to the larger preset", () => {
  assert.deepEqual(
    outputSize({ width: 720, height: 1280, duration: 5 }, 1080, "fit"),
    { width: 720, height: 1280 },
  );
});
test("landscape crop stays within available vertical source pixels", () => {
  const size = outputSize(
    { width: 1920, height: 1080, duration: 5 },
    1080,
    "crop",
  );
  assert.ok(size.height <= 1080);
  assert.ok(size.width % 2 === 0 && size.height % 2 === 0);
});
test("fit preserves the full frame and crop fills the canvas", () => {
  const m = { width: 1920, height: 1080, duration: 10 };
  const s: ExportSettings = {
    platform: "tiktok",
    resolution: 1080,
    fps: 30,
    framing: "fit",
    quality: "high",
    audio: true,
    start: 1,
    end: 5,
  };
  const fit = exportArgs("source.mp4", m, s);
  assert.ok(fit[fit.indexOf("-vf") + 1].includes("pad="));
  const crop = exportArgs("source.mp4", m, {
    ...s,
    framing: "crop",
    audio: false,
  });
  assert.ok(crop[crop.indexOf("-vf") + 1].includes("crop="));
  assert.ok(crop.includes("-an"));
  assert.ok(!crop.includes("0:a:0?"));
  assert.equal(fit[fit.indexOf("-t") + 1], "4");
  assert.ok(fit.includes("0:a:0?"));
});
test("invalid or oversized trim ranges cannot be exported", () => {
  for (const [start, end] of [
    [NaN, 2],
    [0, Infinity],
    [-1, 5],
    [4, 2],
    [0, 301],
    [0, 0],
  ])
    assert.ok(validateRange(start, end, 300));
  assert.equal(validateRange(0, 30, 60), null);
});
