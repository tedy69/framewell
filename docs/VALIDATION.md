# Validation and antislop delivery gate

Date: 3 November 2026. Antislop mode: during, explicitly selected by the user. Direction: dark editing studio with a warm orange accent. UI source: shadcn/ui selected from Style UI.

## Executed checks

- Production build: TypeScript and Vite passed. FFmpeg is loaded on export, separately from the initial application bundle. Fonts are self-hosted.
- Unit tests: 4 passed, covering source-size limits, landscape cropping, fit/pad filters, optional audio mapping, and invalid or oversized trim ranges.
- Real portrait export: generated a 360 × 640 WebM test recording with an audio track, exported it through the app, and inspected the resulting blob and media metadata. Output: H.264/AAC MP4, 360 × 640, 1.605 seconds, 57,067 bytes. The source was not enlarged.
- Production-bundle export: recorded a silent 640 × 360 WebM, trimmed 0.2 to 0.9 seconds, and used centered cropping. Output: H.264 MP4, 202 × 358, 0.7 seconds, 8,147 bytes, no audio track. Optional audio mapping did not reject a silent source.
- Browser console: no errors or warnings in the production build after export and interaction tests.
- Viewports: inspected 1440px desktop and 390px phone layouts. At 320px and 390px, document width matched viewport width with no overflowing elements; visible enabled buttons met 44px minimum dimensions.
- Contrast: computed foreground/background contrast for 84 visible text elements in the populated desktop state; no ratio below 4.5:1. Checked guide headings, text, and links separately with no failures.

## Recorded interaction checks

| Control | Observed result |
| --- | --- |
| Video picker wiring | Visible chooser calls the file input; metadata-reading pipeline accepted a real test file. Replace handler was exercised with a picker spy. Native OS file picker itself was not automated. |
| Drag and drop | A second video replaced the source and updated its displayed filename. |
| Remove video | Restored the empty preview and disabled export. |
| Each guide entry | Opened the guide: sidebar, sidebar help, header, and below-workspace control. |
| Guide close and Escape | Closed the dialog; Escape restored focus to the header guide button with a visible outline. |
| Instagram, WhatsApp, TikTok | Each selected the destination and changed its preset. |
| Resolution | Selected 720p maximum and observed the field change. |
| Frame rate | Selected 60 fps and observed the field change. |
| Quality | Selected Smaller file and observed the field change. |
| Fit and crop | Both changed selection; crop changed actual exported framing and dimensions. |
| Safe area | Toggled the guide overlay on the source preview. |
| Audio | Changed the switch and preview mute state. Optional source audio was also checked through an actual AAC export and a silent-source export. |
| Trim fields | Selected 0.2–0.9 seconds and verified a 0.7-second output. An out-of-range start disabled export and displayed a corrective error. |
| Reset clip | Restored the full permitted range and removed the invalid-range message. |
| Video playback | The browser played the video, time advanced, and pause worked. Media controls are supplied by the browser. |
| Original and Export tabs | Switched between the original 640px-wide source and the rendered 202px-wide result. |
| Export | Produced playable MP4 blobs using the production bundle. |
| Cancel | Cancelled first-engine loading and active encoding; retained the original source and showed cancellation feedback. |
| Download MP4 | Triggered a blob download named landscape-silent-tiktok.mp4. |
| Save/share handler | Clicked with a stub at the native sharing boundary; received a video/mp4 File. Unsupported sharing fell back to the download path. Native OS share-sheet interaction was not automated. |
| Setting changes after export | Cleared the stale result so an old file could not be mistaken for the new settings. |
| Unsupported file | A text file produced a clear supported-format error; dismiss removed it. |
| Dismiss feedback | Removed the displayed notification. |
| Navigation | Internal links target the existing workspace. External references use Style UI, WhatsApp Help Center, and TikTok's documented format page. |

## Hard gate

- R-02 PASS: source scan found no em dash in app copy.
- R-03 PASS: 320px and 390px viewport checks found no horizontal overflow; enabled button touch targets met 44px.
- R-17 PASS: displayed media measurements come from the input file, export blob, or explicit export settings; no invented product metrics.
- R-18 PASS: no testimonials, customer identities, or invented reviews.
- R-23 PASS: text product name and relevant interface icons only; no assumed avatars, logos, or photographic assets. The user selected the studio direction.
- R-24 PASS: internal navigation resolves to the workspace; guide controls open a real dialog.
- R-25 PASS: populated state and dialog contrast checks found no text below 4.5:1.
- R-26 PASS: controls have implemented behaviors; the interaction results and native-boundary limits are recorded above.
- R-27 PASS: empty picker, metadata loading, export loading/progress, cancellation, completion, and recoverable errors exist and were exercised.
- R-28 PASS: no fabricated FAQ section.
- R-32 PASS: native controls and Radix primitives supply keyboard operation; Escape and focus restoration were exercised, and focus styling is visible.
- R-33 PASS: features were authored in source with patches; no external string-replacement scripts implement UI behavior. Prettier was used only for formatting.
- R-34 PASS: one fixed dark theme, explicitly selected by the user; no broken alternative theme is exposed.
- R-35 PASS: built and ran the production application, exercised the listed controls, encoded actual video, and checked the console. Native picker and native share-sheet limits are explicit.
- R-36 PASS: no guarantee of platform quality, invented security certification, fabricated customers, or unmeasured performance score.
- R-37 PASS: user direction and design dials were declared before implementation and recorded in DESIGN.md.
- R-38 PASS: starts empty; no fabricated users, history, demo footage, or live-looking sample data ships.
- R-39 PASS: controls use native elements or accessible Radix primitives, named fields, pointer cursors, focus/hover/disabled states, landmarks, title, language, and unrestricted viewport zoom.
- R-40 PASS: preview media dimensions and stage space are reserved; no render-blocking third-party script, lazy hero image, or invented performance measurement.

## Purpose gate

- R-01 PASS: charcoal keeps attention on footage; orange identifies selected destination and export. Reasons are in DESIGN.md.
- R-04 PASS: relevant Phosphor video, framing, audio, upload, and download symbols describe their actions.
- R-06 PASS: Plus Jakarta Sans supplies a human creator-tool voice; monospace is limited to time and measurements.
- R-07 PASS: no decorative grid or blueprint background.
- R-08 PASS: directional marks identify upload/download; the guide uses one directional cue rather than arrows on every action.
- R-09 PASS: the aspect marker is a real canvas measurement; no marketing status capsules.
- R-10 PASS: no glassmorphism.
- R-12 PASS: shadow is limited to dialog elevation.
- R-13 PASS: no decorative glow.
- R-14 PASS: two workflow panels have distinct preview and inspector roles; there is no feature-card grid.
- R-19 PASS: short control transitions acknowledge state; reduced-motion removes transitions, and media has pause controls.
- R-22 PASS: no generic illustrations or unrelated imagery.

## Liveliness

- Dials PASS: ENERGY 2 / RHYTHM 2 / MOTION 1, declared before implementation.
- Consistency PASS: an editorial heading leads into a practical, asymmetric editing workspace and a short upload note.
- Focal point PASS: the empty stage asks for a video; populated state centers the footage and export action.
- Whitespace PASS: the open stage and compact inspector separate visual inspection from settings.
- Accent PASS: warm orange highlights active selection and the export moment.
- Identity PASS: crop-corner framing, restrained editorial type, and creator-specific copy recur through the workspace.
- Design read PASS: recorded in DESIGN.md with reasons for palette, layout, typography, spacing, surfaces, icons, and motion.

## Craftsmanship and quality locks

- C-1 PASS: major visual decisions have written reasons in DESIGN.md.
- C-2 PASS: implemented control actions are recorded above; native OS boundaries are identified.
- C-3 PASS: the workspace serves source selection, framing, export, and posting guidance; no filler sections.
- C-4 PASS: empty/populated/loading/error states, phone widths, and keyboard dialog use were exercised.
- C-5 PASS: claims are bounded by implementation and official platform guidance.
- R-05 PASS: composition follows the video-preparation task, with no hero/feature-card marketing template or invented dashboard metrics.
- R-11 PASS: modest panel/control radii differ from the functional switch track.
- R-15 PASS: actions say Choose a video, Export video, Download MP4, and Cancel export.
- R-16 PASS: no generic AI marketing buzzwords.
- R-20 PASS: the studio composition, crop-frame motif, editorial copy, and warm accent form a consistent identity.
- R-21 PASS: dark studio theme was the user's explicit choice.
- R-29 PASS: charcoal/warm gray surfaces and one orange action accent; error colors communicate actual errors.
- R-30 PASS: uses a component library selected from Style UI, without cloning another product's full visual identity.
- R-31 PASS: written design rationale accompanies the source.
- UI supplement PASS: checked palette, restrained accent, relevant icons, task-led composition, honest data, useful state copy, reduced motion, sized media, and responsive controls.

## Verification limits

Mobile checks used Chrome viewport emulation, not physical iOS/Android devices or their memory limits. Native file-picker and native share-sheet operation were checked at their application boundary, not through OS automation. No video was posted to TikTok, WhatsApp, or Instagram, so quality after their processing was not measured. HDR tone mapping is not implemented. The app exports files for the user to post manually; it cannot bypass platform compression or reconstruct detail lost in the source.
