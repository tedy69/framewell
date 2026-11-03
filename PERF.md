# Video export performance

Measured on 3 November 2026. The reported slow device was Safari on an iPhone 17 Pro. The measurements below were made in local desktop Chrome with a 390px emulated phone viewport, not on that physical phone.

## Bottleneck and change

The original app always transcoded with single-threaded FFmpeg WebAssembly, including when the browser had native codec support. Warm runs stayed slow, so the engine download was not the main bottleneck.

Video export now tries native WebCodecs through Mediabunny in a dedicated worker. It reads the local File lazily, converts to H.264/AAC MP4, and retains the requested trim, dimensions, frame rate, framing, and audio selection. Codec support is checked through the actual conversion, including verifying that required audio and video tracks were retained. Unsupported sources and browsers use the existing FFmpeg path.

Native jobs run in their own worker so cancelling can stop processing immediately. A codec that stops advancing for 30 seconds while the page is visible is terminated before the compatibility fallback starts. Background-tab time does not count as a stall. This also bounds the effect of native browser codec stalls such as those described in [WebKit's codec release notes](https://webkit.org/blog/18420/release-notes-for-safari-technology-preview-254/).

## Before and after

Fixture: one locally generated 3,761,635-byte VP8/Opus WebM, 720 × 1280, 6.069668 seconds. The exact same File was reused for both implementations. Selected clip: 0 to 6.06 seconds, Instagram, 1080p maximum adapting to 720 × 1280, 30 fps, fit, High detail, original audio retained.

Timed from the UI export click until download controls appeared. The fixture was generated once and stored locally for reuse. Startup runs are reported separately; compare the three repeated warm runs on the same machine and browser. Output was fetched using the assigned `video.src`, and its metadata was awaited before validating dimensions. `currentSrc` may briefly be empty immediately after React mounts a new preview, so it must not be used to fetch the output at that instant.

| Implementation | First measured run | Repeated runs | Repeated median |
| --- | ---: | --- | ---: |
| Original FFmpeg-only app | 17.415 s | 17.043, 17.123, 17.677 s | 17.123 s |
| Final native-worker app | 1.076 s | 0.739, 0.810, 0.821 s | 0.810 s |

This fixture's repeated median was about 21 times faster. That is a synthetic desktop result, not an iPhone performance guarantee. Native runs did not request the FFmpeg core. Input dimensions, requested frame rate, selected audio, and high-detail intent were retained.

### Quality and file-size limits

At this initial native release, the high-detail target used quantizer 18 where supported, and Smaller file used quantizer 23 or a bitrate fallback. The subsequent [compression update](docs/COMPRESSION.md) makes bitrate-based Balanced the default. High detail still uses quantizer 18 where supported and can create large files. Quantizer-based encoding and FFmpeg CRF are different controls; their numerical values do not imply identical pixels or compression efficiency.

For this deliberately detailed, moving test fixture, the original output was 8,395,087 bytes and the native output was 14,546,161 bytes. Native high-detail exports can therefore be larger. Native and compatibility encoders may produce different-looking results; no perceptual quality score or platform-processed upload quality was measured. The existing SDR/HDR limitation remains.

### Experiment ledger

| Idea | Result | Decision |
| --- | --- | --- |
| Reuse the already loaded original engine | Warm median still 17.123 s | Identified CPU encoding as the main bottleneck; no cache-only claim |
| Force hardware for both decoding and encoding | The VP8 test source could not initialize on this Apple desktop | Removed the forced hint; let the browser choose acceleration per codec |
| Native conversion on the UI thread | Approximately 0.87 s repeated UI median | Demonstrated the native codec benefit; moved execution into a worker for responsiveness and reliable cancellation |
| Native worker with high-detail settings | 0.810 s repeated UI median | Kept; preserves the selected operations and has compatibility fallback |

## Verification

- Production TypeScript/Vite build and all 17 unit tests passed.
- Unit tests cover native support fallback, selected-track retention, quality budgets, immediate cancellation, late-message rejection, worker cleanup, and 30-second no-progress fallback, plus the existing photo/video cases.
- Real native exports produced playable MP4 files with H.264 video and AAC audio.
- A rotated H.264/AAC MOV fixture was read as 1280 × 720. Native fit export produced 720 × 1280, 2 seconds, 48 video packets at 24 fps, with rotation baked into the image and black letterboxing (sample `[1,1,1,255]`).
- Native crop export produced 404 × 718, 2 seconds, 120 video packets at 60 fps. Muting removed the audio track.
- With the native API disabled, the actual compatibility worker produced H.264/AAC MP4 at the selected crop size and 60 fps. Requested audio was retained.
- Cancelling an actual native job left the source available and produced no late output.
- Photo JPEG export still produced a valid 360 × 640 file after the video changes.
- The populated phone layout had no horizontal overflow. No new interactive controls were added; the existing controls were exercised through the native and compatibility flows.
- Console checks after successful native exports found no warnings or errors.
- The main bundle remained approximately 124 KB gzipped. The approximately 192 KB gzipped media library is loaded only for video processing in the worker; it is not part of the initial page script. Native jobs avoid the roughly 31 MB compatibility core download.

## Repeating the benchmark

Use the same saved source clip across both versions, on the same device and browser. Run one startup export and at least three repeated exports without changing settings. Time the export click to the enabled download controls, exclude the startup run from the warm median, and inspect the actual output file's codec, audio, dimensions, and duration. A faster result that drops a selected track or operation is a regression.

As a regression check on this fixture and machine, require the supported native path to avoid the compatibility-core request and its warm median to stay below the six-second source duration. Use relative medians on other devices rather than treating these desktop millisecond values as a universal threshold. Source files and timings are not sent to a monitoring service.

## Antislop gate for this change

- Hard gate PASS: no new controls or fabricated UI claims; actual exports, cancellation, fallback, errors, mobile layout, and keyboard-capable existing controls retain their behavior. Source copy has no em dash. Build and tests completed.
- Purpose gate PASS: existing studio styling retained; the changed loading text and keep-tab-open hint explain real processing states.
- Liveliness PASS: existing ENERGY 2 / RHYTHM 2 / MOTION 1 direction, focal point, accent, and framing motif retained.
- Craftsmanship PASS: before/after timings, real output checks, fallback and resource-cleanup tests, and the larger-file tradeoff are recorded above. This was not tested on a physical iPhone or by posting files to social platforms.
