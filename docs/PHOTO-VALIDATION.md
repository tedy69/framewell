# Photo support verification

Date: 3 November 2026. Antislop during mode; existing dark studio direction retained. Public source is a clean snapshot rather than the history of the original private hosting project.

## Executed checks

- A fresh dependency installation, TypeScript/Vite production build, and all 9 unit tests passed in the public-source checkout.
- Photo unit tests cover exact 9:16 geometry, fit/crop positioning, no source enlargement, dimension limits, animated PNG/WebP detection, and output filenames. Existing video tests also passed.
- An actual JPEG export of a 1200 × 800 PNG produced a 1080 × 1920 JPEG, 16,684 bytes.
- A PNG export produced 720 × 1280 pixels with the selected white background. Decoded sample pixels were exactly white `[255,255,255,255]`, red `[255,0,0,255]`, and green `[0,255,0,255]` at the sampled positions.
- Center cropping of the same landscape source produced 450 × 800 pixels without enlarging source pixels.
- A camera JPEG with EXIF orientation 6 decoded as 200 × 400 from a 400 × 200 stored image. The preview used that decoded orientation.
- Transparent PNG input was flattened to the chosen white background. An exported transparent-area sample was `[255,255,255,255]`.
- A noisy photo exported from the production bundle produced a 558,138-byte high-detail JPEG and a 361,755-byte smaller-file JPEG at 639 × 1136. These are test-file results, not general compression or quality promises.
- Photo-only use did not request the FFmpeg core. Video export still works: the production bundle produced a playable 360 × 640 H.264/AAC MP4, 1.174667 seconds, 39,914 bytes.
- Chrome's production-build console had no warnings or errors after photo and video exports.
- Desktop text contrast: 76 visible text elements checked, none below 4.5:1. Disabled controls were excluded from contrast requirements.
- Layout checked at 1440px, 390px, and 320px. No horizontal overflow. Visible enabled buttons met 44px touch-target dimensions. A 390px emulated phone exported a 360 × 640 JPEG successfully.

## Interaction record

| Control or state | Observed result |
| --- | --- |
| Photo / Video tabs | Changed workflows; ArrowLeft and ArrowRight also worked with visible focus. Photo results persisted across switches. |
| Photo chooser / replacement | Chooser handler invoked the file input; real JPEG, PNG, and WebP files were decoded. The replacement picker boundary was checked with a spy. |
| Drag and drop | Replaced the source photo and updated its name. |
| Destination | Instagram and WhatsApp changed the selected preset and guidance. |
| Resolution | Selected 720p and verified an actual 720 × 1280 output. |
| Fit / crop | Fit retained the full photo; crop produced the centered portrait output. |
| Format | JPEG and PNG outputs had the matching MIME type and filename extension. |
| JPEG quality | High detail and Smaller file produced different actual encoder results. PNG disabled the JPEG-only field. |
| Background | White was reflected in both preview and exported pixels, including transparent input regions. |
| Composition guide | Switched the overlay on and off. It is an editing aid, not an official platform safe-area guarantee. |
| Original / Export | Switched between the source dimensions and actual rendered output. |
| Export / loading | Created a local photo file, then displayed the result and download controls. |
| Cancel | With a delayed canvas callback, cancellation cleared processing and ignored the late result while preserving the original. |
| Download | Requested `original-landscape-instagram.png` through a blob download. |
| Share | Clicked with a native-boundary stub and received an image/png File; unsupported sharing used download instead. |
| Error recovery | HEIC, disguised GIF bytes, corrupt images, and animated PNG input produced corrective errors. A previous valid source remained usable. |
| Dismiss | Removed photo error and notification feedback. |
| Guide / Escape | Opened the updated guide, closed it with Escape, and restored visible focus to its trigger. |
| Existing video export | Produced a playable MP4 from the same production bundle after adding the photo workflow. |

## Antislop delivery gate

### Hard gate

- R-02 PASS: app copy contains no em dash.
- R-03 PASS: 320px and 390px checks found no horizontal overflow; enabled buttons met 44px dimensions.
- R-17 PASS: source dimensions, file sizes, and export properties come from actual files or explicit settings.
- R-18 PASS: no testimonials, fabricated people, or customer counts.
- R-23 PASS: the existing user-approved design was retained; relevant photo controls were added, with no unapproved branded assets or fabricated sample media shipped.
- R-24 PASS: navigation targets the workspace and working guide; external references are real source pages.
- R-25 PASS: 76 visible text elements met 4.5:1 contrast in the populated photo state.
- R-26 PASS: the control-by-control interaction record above shows implemented behavior and identifies native OS boundaries.
- R-27 PASS: empty, loading, invalid input, cancellation, completion, and recoverable error states were exercised.
- R-28 PASS: no template FAQ.
- R-32 PASS: keyboard mode switching, dialog Escape, focus restoration, and visible outlines were checked.
- R-33 PASS: features were authored directly in source; no external source-replacement script implements the UI.
- R-34 PASS: the existing user-selected dark theme is the only exposed theme.
- R-35 PASS: fresh production build, all 9 tests, actual photo/video exports, click-through record, and console checks completed.
- R-36 PASS: no guarantee of unchanged post-upload quality or fabricated performance claims.
- R-37 PASS: the existing direction and ENERGY 2 / RHYTHM 2 / MOTION 1 dials were retained and documented.
- R-38 PASS: empty initial state; generated test fixtures were not shipped as user or demo data.
- R-39 PASS: named fields, native controls, Radix tabs, image alt text, sized media, pointer cursors, focus states, disabled states, and reduced-motion support are present.
- R-40 PASS: preview space and image dimensions are reserved; no added third-party blocking script or unmeasured performance score.

### Purpose gate

- R-01 PASS: charcoal keeps attention on media; orange identifies active controls and export.
- R-04 PASS: photo and framing icons describe their actual actions.
- R-06 PASS: existing creator-tool typography retained; measurements remain secondary.
- R-07 PASS: no decorative grid or blueprint texture.
- R-08 PASS: direction marks indicate download rather than decorating every action.
- R-09 PASS: displayed aspect and format labels describe real output settings.
- R-10 PASS: no glassmorphism.
- R-12 PASS: shadows remain limited to dialog elevation.
- R-13 PASS: no glow decorations.
- R-14 PASS: source preview and export inspector have distinct workflow roles; no feature-card grid.
- R-19 PASS: short state transitions only; reduced-motion handling remains active.
- R-22 PASS: no unrelated illustrations or fabricated photographs.

### Liveliness

- Dials PASS: ENERGY 2 / RHYTHM 2 / MOTION 1 remain explicit in DESIGN.md.
- Consistency PASS: the photo workflow uses the same studio language and asymmetric preview/inspector composition.
- Focal point PASS: the source-selection stage leads the empty view; the photograph leads the populated view.
- Whitespace PASS: open preview space separates the image from the compact export choices.
- Accent PASS: one warm orange accent highlights selection and export.
- Identity PASS: crop corners, editorial typography, and practical media copy recur.
- Design read PASS: retained direction and the photo extension are recorded in DESIGN.md.

### Craftsmanship and quality locks

- C-1 PASS: design reasons accompany the source.
- C-2 PASS: functional controls and external OS boundaries are recorded above.
- C-3 PASS: the addition serves photo selection, framing, format choice, and export.
- C-4 PASS: empty/populated/error/cancel states, responsive layouts, and keyboard operation were checked.
- C-5 PASS: output measurements are from actual test files; platform compression limits remain explicit.
- R-05 PASS: the extension follows the existing editing workflow, without marketing-template sections.
- R-11 PASS: existing panel, button, input, and switch radii remain consistent.
- R-15 PASS: actions say Choose a photo, Export photo, Download JPEG/PNG, and Cancel photo processing.
- R-16 PASS: no generic AI marketing language.
- R-20 PASS: the existing studio identity remains coherent across both workflows.
- R-21 PASS: the user-selected dark theme is retained.
- R-29 PASS: palette remains charcoal/warm gray with one orange accent and functional error colors.
- R-30 PASS: the UI extends its own existing design using shadcn/ui selected from Style UI.
- R-31 PASS: the photo extension has written design rationale.

## Limits

Mobile checks used Chrome emulation, not physical devices. Native OS file pickers and share sheets were tested at their application boundaries, not through OS automation. No image was posted to WhatsApp or Instagram, so final platform-processed quality was not measured. JPEG export is lossy; PNG preserves the rendered canvas pixels, and either format may be recompressed by the destination app. HEIC, animated images, HDR tone mapping, and automatic social posting are not implemented.
