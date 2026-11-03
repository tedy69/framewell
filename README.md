# Framewell

A browser-local photo and video export studio. Prepare videos for TikTok, WhatsApp Status, and Instagram Stories, or still photos for WhatsApp Status and Instagram Stories.

## Run

Requires Node 22 or newer.

```sh
npm ci
npm run dev
```

`npm run build` checks TypeScript and builds `dist/`. `npm test` checks photo/video output sizing, source limits, animation detection, framing, trim validation, and audio arguments.

## Deploy to Cloudflare Pages

Live app: [framewell-studio.pages.dev](https://framewell-studio.pages.dev/).

The app is entirely static. To deploy your own copy, choose a project name in `wrangler.jsonc` and set `CLOUDFLARE_ACCOUNT_ID` in your shell to your intended Cloudflare account. Use `main` as the production branch.

```sh
npx wrangler@4.157.0 login --scopes account:read user:read pages:write
npm run build
# Run once if the project does not already exist in your account:
npx wrangler@4.157.0 pages project create framewell-studio --production-branch main --force
npx wrangler@4.157.0 pages deploy dist --project-name framewell-studio --branch main
```

Pages sites are public by default unless Cloudflare Access is separately configured. With this Wrangler version, `--force` is needed only for initial Pages project creation to bypass its default Workers delegation. Do not use it for subsequent deployments. Replace `framewell-studio` in the commands when deploying a differently named project.

## What it does

- Reads still JPEG, PNG, and WebP photos up to 30 MB and 60 megapixels. Camera orientation follows the browser's image decoder.
- Exports photos as high-detail JPEG or lossless PNG on an sRGB 9:16 canvas, with fit/crop framing and black/white backgrounds. Transparent input areas are flattened onto that background.
- Uses 1080p maximum for both photo destinations, adapts to smaller originals, and does not enlarge source pixels. PNG preserves rendered canvas pixels; platforms may still re-encode the file.
- Keeps independent photo and video sessions while switching between the two tabs.

- Reads a local browser-playable MP4, MOV, or WebM up to 250 MB.
- Exports a selected clip up to 180 seconds as H.264 MP4 with optional AAC audio.
- Provides 720p and 1080p maximum portrait canvases, adapting dimensions to avoid enlarging the source.
- Offers full-frame letterboxing or centered cropping, 24/30/60 fps, and two CRF quality settings.
- Previews the export, downloads it, or opens the device share sheet when file sharing is supported.
- Processes media in browser memory with a single-thread FFmpeg WebAssembly worker. The first export downloads the pinned FFmpeg core from jsDelivr, about 31 MB. No video is sent to an application server.

## Limits

Exports are for manual posting in the destination app. This project does not connect social accounts, post automatically, bypass compression, or recover missing source detail. WhatsApp explicitly states that HD media is not supported for Status. The presets are tool defaults rather than official platform specifications. Browser memory limits and performance vary, particularly on phones. SDR source footage is recommended; HDR tone mapping is not implemented. HEIC and animated images are not supported; export a still JPEG/PNG/WebP first. Photo inputs must be at least 32 × 32 pixels and no more than 16,384 pixels on either edge. Photos are rendered with the browser's canvas encoder, without downloading FFmpeg.

## Design and provenance

The interface uses a dark editing studio with a warm orange accent. shadcn/ui was selected from the [Style UI catalog](https://style.ai.id/ui-components). Button, tabs, switch, and dialog components are adapted from the official shadcn/ui new-york registry and backed by Radix primitives. Typography is self-hosted Plus Jakarta Sans under the included OFL license. Action icons are Phosphor. See [DESIGN.md](DESIGN.md) for the design reasons, [photo verification](docs/PHOTO-VALIDATION.md) for the photo extension and video regression checks, and [initial video verification](docs/VALIDATION.md) for the baseline.

Sources: [Style UI](https://github.com/miqdadbadjuber/style-ui), [shadcn/ui](https://ui.shadcn.com), [FFmpeg usage](https://ffmpegwasm.netlify.app/docs/getting-started/usage/), [TikTok formats](https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide), [WhatsApp HD limitations](https://faq.whatsapp.com/759301289012856).
