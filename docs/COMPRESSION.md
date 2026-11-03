# Smaller video exports

Measured 3 November 2026 in desktop Chrome. Phone viewport emulation checks layout, not iPhone encoding performance. No physical iPhone or social-platform upload was tested.

## Behavior

Balanced is now the default video quality. It uses H.264 variable-bitrate encoding rather than an explicit quantizer. In Mediabunny, an explicit quantizer takes precedence over the bitrate fallback, so the old Smaller file setting did not actually constrain native output to its bitrate budget. See [Mediabunny's encoding quality documentation](https://mediabunny.dev/guide/supported-formats-and-codecs#encoding-quality).

The Balanced budget starts at 4 Mbps for 720 × 1280 at 30 fps, scales with actual output pixels and the square root of frame rate, and has a 250 kbps floor. Destination ceilings are 4 Mbps for WhatsApp, 8 Mbps for Instagram, and 10 Mbps for TikTok. These are product defaults, not official platform specifications or hard file-size limits. Variable bitrate, keyframes, audio, and container overhead affect actual size.

Balanced uses 128 kbps AAC audio. It retains the selected resolution, framing, trim, frame rate, and audio switch. High detail retains quantizer 18 where supported and 192 kbps AAC; the interface explains that files can be much larger. Both choices retain the native worker and compatibility fallback. No additional media upload or second encoding pass was added.

The FFmpeg fallback keeps CRF 23 for Balanced and CRF 18 for High detail, but now shares the destination/pixel/frame-rate bitrate budget and audio rate. Its VBV buffer is twice the video bitrate. Native VBR targets and FFmpeg CRF/VBV can produce different sizes and pixels.

## Same-file comparisons

Two deterministic six-second H.264/AAC fixtures were generated locally at 720 × 1280 and 30 fps. Both contain gradients, text, fine lines, a moving circle, and an audio tone. The motion fixture additionally contains dense moving colored tiles. Source encoding used quantizer 12. Each identical File was reused across configurations; output was trimmed to 0–6 seconds with fit framing. Instagram's 1080p maximum correctly adapted to the 720p source.

All sizes below are decimal bytes. The comparison is the previous **default High detail** against the new **default Balanced**. High detail remains available.

| Fixture | Source | Previous default | New default | Change versus previous default |
| --- | ---: | ---: | ---: | --- |
| Dense moving detail | 16,823,801 | 10,993,455 | 3,060,305 | 72.2% smaller |
| Calm gradient and text | 688,482 | 347,538 | 504,871 | 45.3% larger, but still smaller than the source |

Simple scenes may already compress extremely well with a quantizer target. Balanced does not guarantee a smaller file than every source or every High detail result. It avoids the large-file behavior on detailed scenes without reducing the selected resolution. These synthetic fixtures do not establish a universal saving for camera footage.

### Detail comparison

Six corresponding decoded frames at 0.5, 1.5, 2.5, 3.5, 4.5, and 5.5 seconds were compared with the decoded source. Metrics use Rec.709 luma from browser-decoded canvas pixels. The SSIM column is a simple unweighted 8 × 8 block implementation, not a standardized perceptual test or a platform-upload score.

| Fixture / setting | Mean luma PSNR | Mean block SSIM |
| --- | ---: | ---: |
| Motion / previous High detail | 48.13 dB | 0.9979 |
| Motion / candidate 2.5 Mbps | 29.02 dB | 0.8965 |
| Motion / selected 4 Mbps | 34.49 dB | 0.9678 |
| Calm / previous High detail | 45.17 dB | 0.9975 |
| Calm / selected 4 Mbps | 46.01 dB | 0.9990 |

A side-by-side visual review at 360px display width and a 100% text crop found the selected 4 Mbps text readable with the circle and line structure retained. Fine moving tiles show compression and some color/detail loss. The more aggressive candidate was rejected because the tiles became visibly softer. Compression is lossy; neither setting promises identical pixels or unchanged quality after posting.

### Experiment ledger

| Attempt | Result on motion fixture | Decision |
| --- | --- | --- |
| 2.5 Mbps VBR + 128 kbps AAC | 2,123,650 bytes; block SSIM 0.8965 | Rejected as the default because fine moving detail softened too much |
| 4 Mbps VBR + 128 kbps AAC | 3,060,305 bytes; block SSIM 0.9678 | Kept as the 720p/30 baseline; better detail/size balance |
| Keep quantizer 18 as an optional High detail setting | 10,993,455 bytes; block SSIM 0.9979 | Kept as an explicit larger-file choice |

## Verification

- TypeScript/Vite production build and all 18 unit tests passed. Compression tests guard scaling, destination ceilings, tiny sources, higher frame rates, absence of a Balanced quantizer override, shared FFmpeg budgets, and audio rates. Existing tests cover sizing, trim, track retention, cancellation, late progress, cleanup, codec stalls, and photos.
- Four real UI native exports of the motion source returned identical 3,060,305-byte files. First run: 0.719 seconds; warm runs: 0.645, 0.656, 0.615 seconds; warm median: 0.645 seconds. Timed from Export click until download controls appeared. This is a desktop measurement, not an iPhone promise.
- Native output: H.264/AAC MP4, 720 × 1280, 180 packets at 30 fps, 6.036 seconds including AAC padding. The WhatsApp destination also returned the same 720p Balanced output with audio retained.
- Forced native API unavailability exercised the actual FFmpeg worker. A selected two-second WhatsApp clip produced a 1,094,246-byte H.264/AAC MP4, 720 × 1280, 60 packets at 30 fps, exactly two seconds. Actual encoding may exceed the nominal average budget over a short clip due to the VBV buffer.
- Changing quality updates its explanation, clears an old result, and retains the source. Existing destination, trim, resolution, export, preview, and download controls remain usable. Native cancellation and fallback lifecycle tests remain green.
- Populated phone layout and quality copy were inspected at 390px. The 320px layout also had no horizontal overflow. Native select labels fit their controls. No warnings/errors appeared in the browser console after exports.
- Photo code is unchanged and its five unit tests remain green. Earlier full studio interaction checks are recorded in [initial validation](VALIDATION.md), [photo validation](PHOTO-VALIDATION.md), and [native export validation](../PERF.md).
- The built production preview also exported a 35,111-byte VP8/Opus fixture to a 15,104-byte H.264/AAC MP4 at 360 × 640. Balanced was selected on first load, the native worker loaded successfully, no WASM was requested, and the 320px layout had no overflow.

To repeat, generate or save one detailed source and one simple source, retain the exact Files, compare both defaults at the same trim/dimensions/frame rate, inspect decoded matching frames, and verify required tracks. Measure warm UI times separately from first initialization. Check real camera footage on the target iPhone before generalizing these results. Temporary fixtures were kept only in a local test IndexedDB and removed after validation.

## Antislop gate

- **Hard gate PASS.** Reviewed all hard-gate questions: no em dash in rendered copy, overflow, fabricated claims/assets, broken links, inert controls, missing states, or new accessibility/media-layout issues. Existing color, focus, keyboard-native select behavior, contrast, touch sizes, reduced-motion behavior, landmarks, and zoom remain intact. Actual build and export checks completed. Unchanged controls retain their previously recorded interaction coverage.
- **Purpose gate PASS.** Existing studio typography, useful media/action icons, and orange action accent retain the reasons in [DESIGN.md](../DESIGN.md). No new visual techniques or decorative elements. The added note explains the real size/detail choice at the quality control.
- **Liveliness PASS.** Existing declared ENERGY 2 / RHYTHM 2 / MOTION 1 and approved dark studio direction retained. Export remains the focal action; structural spacing, one orange accent, and the framing motif remain consistent.
- **Craftsmanship PASS.** All C-1 through C-5 and consistency locks reviewed: no template sections, invented evidence, new visual defaults, or unfinished behavior. Labels fit phone widths, quality changes invalidate stale exports, both encoders were exercised, and the smaller-file benefit and detail tradeoff are recorded with their limits.
