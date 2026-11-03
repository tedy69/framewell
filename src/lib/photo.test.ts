import { test } from "node:test";
import assert from "node:assert/strict";
import {
  photoLayout,
  validatePhotoDimensions,
  isAnimatedPhoto,
  photoFilename,
  type PhotoSettings,
} from "./photo.ts";
test("photo canvases have exact 9:16 proportions and never enlarge source pixels", () => {
  for (const source of [
    { width: 4032, height: 3024 },
    { width: 1200, height: 1600 },
    { width: 360, height: 640 },
    { width: 32, height: 32 },
    { width: 401, height: 1033 },
  ])
    for (const framing of ["fit", "crop"] as const) {
      const l = photoLayout(source, 1080, framing);
      assert.equal(l.width / l.height, 9 / 16);
      assert.ok(l.width <= 1080);
      assert.ok(l.drawWidth <= source.width + 1e-8);
      assert.ok(l.drawHeight <= source.height + 1e-8);
      if (framing === "fit") {
        assert.ok(l.x >= -1e-8 && l.y >= -1e-8);
      } else {
        assert.ok(l.x <= 1e-8 && l.y <= 1e-8);
      }
    }
});
test("fit centers the entire photograph and crop fills the frame", () => {
  const source = { width: 4000, height: 3000 };
  const fit = photoLayout(source, 1080, "fit");
  assert.deepEqual(fit, {
    width: 1080,
    height: 1920,
    x: 0,
    y: 555,
    drawWidth: 1080,
    drawHeight: 810,
  });
  const crop = photoLayout(source, 1080, "crop");
  assert.equal(crop.height, 1920);
  assert.ok(crop.x < 0);
  assert.equal(crop.y, 0);
});
test("unsafe dimensions and unreadable sources are rejected", () => {
  assert.equal(validatePhotoDimensions({ width: 4032, height: 3024 }), null);
  for (const dimensions of [
    { width: 0, height: 640 },
    { width: Infinity, height: 100 },
    { width: 20, height: 20 },
    { width: 20000, height: 4000 },
    { width: 10000, height: 7000 },
  ])
    assert.ok(validatePhotoDimensions(dimensions));
});
test("animated PNG and WebP are identified through their actual chunks", () => {
  const png = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 97, 99, 84, 76, 0, 0, 0, 0,
  ]);
  assert.equal(isAnimatedPhoto(png), true);
  const webp = new Uint8Array(22);
  webp.set(new TextEncoder().encode("RIFF"), 0);
  webp.set(new TextEncoder().encode("WEBPVP8X"), 8);
  webp[16] = 1;
  webp[20] = 2;
  assert.equal(isAnimatedPhoto(webp), true);
  assert.equal(isAnimatedPhoto(new Uint8Array([255, 216, 255])), false);
  assert.equal(isAnimatedPhoto(new Uint8Array()), false);
});
test("output names use the destination, actual extension, and a safe stem", () => {
  const settings: PhotoSettings = {
    platform: "whatsapp",
    resolution: 1080,
    framing: "fit",
    format: "jpeg",
    quality: "high",
    background: "black",
  };
  assert.equal(
    photoFilename("my photo.png", settings),
    "my_photo-whatsapp.jpg",
  );
  assert.equal(
    photoFilename("photo.heic", {
      ...settings,
      format: "png",
      platform: "instagram",
    }),
    "photo-instagram.png",
  );
});
