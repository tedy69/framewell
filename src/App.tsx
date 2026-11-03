import { useEffect, useRef, useState, type DragEvent } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowCounterClockwiseIcon,
  CheckIcon,
  CheckCircleIcon,
  CropIcon,
  DownloadSimpleIcon,
  FileVideoIcon,
  FilmStripIcon,
  FrameCornersIcon,
  HardDrivesIcon,
  InfoIcon,
  ImageIcon,
  LockSimpleIcon,
  PlusIcon,
  QuestionIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SpeakerHighIcon,
  UploadSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PhotoStudio from "./PhotoStudio";
import { exportVideoNative } from "./lib/native-video";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  bytes,
  exportArgs,
  outputSize,
  PRESETS,
  time,
  validateRange,
  type ExportSettings,
  type Framing,
  type Platform,
  type VideoMeta,
} from "@/lib/video";

interface Source extends VideoMeta {
  file: File;
  url: string;
}
interface Result {
  url: string;
  file: File;
  width: number;
  height: number;
  duration: number;
  platform: Platform;
}
type Job = {
  phase: "loading" | "encoding";
  percent: number;
  label: string;
} | null;

function Guide({ children }: { children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogTitle className="dialog-title">
          A better file. A better starting point.
        </DialogTitle>
        <DialogDescription className="dialog-intro">
          Framewell prepares your photos and videos before you upload them. The
          final quality still depends on the platform.
        </DialogDescription>
        <div className="guide-content">
          <h3>Start with your original</h3>
          <p>
            Use the original camera file, rather than a copy downloaded from a
            chat or another social app. Lost detail cannot be restored by
            exporting at a higher resolution.
          </p>
          <h3>Export once, then upload</h3>
          <p>
            Choose a destination, check the framing, and export. Upload the
            saved file from your gallery. Repeated downloads, edits, and exports
            can lose detail.
          </p>
          <h3>About WhatsApp Status</h3>
          <p>
            WhatsApp says HD media is not supported for Status. Even a clear
            source may look softer after posting.{" "}
            <a
              href="https://faq.whatsapp.com/759301289012856"
              target="_blank"
              rel="noreferrer"
            >
              Read WhatsApp’s explanation
            </a>
            .
          </p>
          <h3>What happens to your video?</h3>
          <p>
            Your files stay on this device. Videos use your browser’s built-in
            encoder when supported. Otherwise, a compatibility engine runs
            locally and is downloaded from jsDelivr on its first use (about 31
            MB). Photos use a local sRGB canvas and need no video engine.
            Reloading clears your working session.
          </p>
          <h3>Practical limits</h3>
          <p>
            Choose a browser-playable MP4, MOV, or WebM up to 250 MB. Export up
            to 3 minutes per clip. Use an SDR source for predictable colors;
            this tool does not tone-map HDR. Longer or 4K videos can be slow on
            phones.
          </p>
          <h3>Photo exports</h3>
          <p>
            Choose a still JPEG, PNG, or WebP up to 30 MB and 60 megapixels.
            HEIC and animated images are not supported. Export JPEG for photos
            or PNG to keep rendered pixels lossless. Transparent areas are
            filled with your chosen background. Camera orientation is handled by
            your browser. Neither format can bypass the destination app’s
            compression.
          </p>
          <p className="guide-footnote">
            These presets are starting points chosen for this tool, not official
            platform requirements.{" "}
            <a
              href="https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide"
              target="_blank"
              rel="noreferrer"
            >
              TikTok format guidance
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function App() {
  const [mediaType, setMediaType] = useState("video");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [source, setSource] = useState<Source | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [view, setView] = useState("original");
  const [framing, setFraming] = useState<Framing>("fit");
  const [resolution, setResolution] = useState(1080);
  const [fps, setFps] = useState(30);
  const [quality, setQuality] = useState<"high" | "balanced">("balanced");
  const [audio, setAudio] = useState(true);
  const [safeArea, setSafeArea] = useState(false);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [position, setPosition] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [job, setJob] = useState<Job>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const ffmpeg = useRef<FFmpeg | null>(null);
  const controller = useRef<AbortController | null>(null);
  const operation = useRef(0);
  const analysisOperation = useRef(0);
  const activeVideo = useRef<HTMLVideoElement | null>(null);
  const preset = PRESETS[platform];
  const size = outputSize(source, resolution, framing);
  const rangeError = source ? validateRange(start, end, source.duration) : null;
  const busy = !!job || analyzing;

  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source.url);
    },
    [source],
  );
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );
  useEffect(
    () => () => {
      operation.current++;
      analysisOperation.current++;
      controller.current?.abort();
      ffmpeg.current?.terminate();
      if (activeVideo.current) {
        activeVideo.current.removeAttribute("src");
        activeVideo.current.load();
      }
    },
    [],
  );

  function invalidate() {
    setResult(null);
    setView("original");
    setNotice("");
  }
  function changePlatform(value: string) {
    setPlatform(value as Platform);
    setResolution(PRESETS[value as Platform].resolution);
    invalidate();
  }
  async function loadFile(file?: File) {
    if (!file || busy) return;
    setError("");
    setNotice("");
    if (!/\.(mp4|mov|webm)$/i.test(file.name)) {
      setError(
        "Choose an MP4, MOV, or WebM video. Other file types are not supported.",
      );
      return;
    }
    if (file.size > 250 * 1024 * 1024) {
      setError(
        "This file is over 250 MB. Choose a shorter or smaller original recording.",
      );
      return;
    }
    const id = ++analysisOperation.current;
    setAnalyzing(true);
    invalidate();
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    activeVideo.current = probe;
    probe.preload = "metadata";
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          probe.onloadedmetadata = null;
          probe.onerror = null;
          reject(
            new Error(
              "Reading the video took too long. Try an MP4 encoded with H.264.",
            ),
          );
        }, 20000);
        probe.onloadedmetadata = () => {
          clearTimeout(timer);
          resolve();
        };
        probe.onerror = () => {
          clearTimeout(timer);
          reject(
            new Error(
              "Your browser cannot open this video. Try an MP4 encoded with H.264, or a different browser.",
            ),
          );
        };
        probe.src = url;
      });
      if (id !== analysisOperation.current) {
        URL.revokeObjectURL(url);
        return;
      }
      if (
        !Number.isFinite(probe.duration) ||
        probe.duration < 0.1 ||
        !probe.videoWidth ||
        !probe.videoHeight
      )
        throw new Error(
          "This video has no readable video track or duration. Try another original file.",
        );
      setSource({
        file,
        url,
        width: probe.videoWidth,
        height: probe.videoHeight,
        duration: probe.duration,
      });
      setStart(0);
      setEnd(Math.floor(Math.min(probe.duration, 180) * 100) / 100);
      setPosition(0);
      setView("original");
      if (probe.duration > 180)
        setNotice(
          "The first 3 minutes are selected. Adjust the clip below before exporting.",
        );
    } catch (e) {
      URL.revokeObjectURL(url);
      if (id === analysisOperation.current)
        setError(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      probe.removeAttribute("src");
      probe.load();
      activeVideo.current = null;
      if (id === analysisOperation.current) setAnalyzing(false);
    }
  }
  function drop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!busy) {
      if (e.dataTransfer.files.length > 1)
        setNotice("One video at a time. The first file was selected.");
      void loadFile(e.dataTransfer.files[0]);
    }
  }
  function reset() {
    if (busy) return;
    setSource(null);
    invalidate();
    setStart(0);
    setEnd(0);
    setPosition(0);
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }
  function cancel() {
    operation.current++;
    controller.current?.abort();
    ffmpeg.current?.terminate();
    ffmpeg.current = null;
    setJob(null);
    setNotice("Export cancelled. Your original video is unchanged.");
  }
  async function createExport() {
    if (!source || busy) return;
    if (rangeError) {
      setError(rangeError);
      return;
    }
    const settings: ExportSettings = {
      platform,
      resolution,
      fps,
      framing,
      quality,
      audio,
      start,
      end,
    };
    const selectedSource = source;
    video.current?.pause();
    setError("");
    setNotice("");
    invalidate();
    const id = ++operation.current;
    const abort = new AbortController();
    controller.current = abort;
    const coreUrls: string[] = [];
    let engine: FFmpeg | null = null;
    let logTail = "";
    setJob({
      phase: "loading",
      percent: 0,
      label: "Checking your video…",
    });
    const complete = (contents: BlobPart) => {
      if (id !== operation.current) return;
      const cleanName = selectedSource.file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 80);
      const file = new File(
        [contents],
        `${cleanName}-${settings.platform}.mp4`,
        { type: "video/mp4" },
      );
      setResult({
        file,
        url: URL.createObjectURL(file),
        ...outputSize(selectedSource, settings.resolution, settings.framing),
        duration: settings.end - settings.start,
        platform: settings.platform,
      });
      setView("export");
      setPosition(0);
      setNotice("Your MP4 is ready. Preview it, then save it to your device.");
    };
    try {
      let lastProgress = -Infinity;
      const native = await exportVideoNative(
        selectedSource.file,
        selectedSource,
        settings,
        abort.signal,
        (fraction) => {
          const now = performance.now();
          if (
            id === operation.current &&
            (now - lastProgress >= 100 || fraction === 1)
          ) {
            lastProgress = now;
            setJob({
              phase: "encoding",
              percent: Math.min(99, Math.max(0, Math.round(fraction * 100))),
              label: "Preparing your MP4…",
            });
          }
        },
      );
      if (id !== operation.current) return;
      if (native) {
        complete(native);
        return;
      }
      setJob({
        phase: "loading",
        percent: 0,
        label: ffmpeg.current?.loaded
          ? "Reading your video…"
          : "Loading the compatibility engine…",
      });
      if (!ffmpeg.current?.loaded) {
        const { FFmpeg } = await import("@ffmpeg/ffmpeg");
        if (id !== operation.current) return;
        const fresh = new FFmpeg();
        ffmpeg.current = fresh;
        engine = fresh;
        const base =
          "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
        async function coreBlob(path: string, type: string) {
          const res = await fetch(`${base}/${path}`, { signal: abort.signal });
          if (!res.ok)
            throw new Error(
              "The export engine could not be downloaded. Check your connection and retry.",
            );
          const url = URL.createObjectURL(
            new Blob([await res.arrayBuffer()], { type }),
          );
          coreUrls.push(url);
          return url;
        }
        const [coreURL, wasmURL] = await Promise.all([
          coreBlob("ffmpeg-core.js", "text/javascript"),
          coreBlob("ffmpeg-core.wasm", "application/wasm"),
        ]);
        if (id !== operation.current) return;
        await fresh.load({ coreURL, wasmURL }, { signal: abort.signal });
      }
      engine = ffmpeg.current;
      if (!engine || id !== operation.current) return;
      const progress = ({ time: microseconds }: { time: number }) => {
        if (id === operation.current)
          setJob({
            phase: "encoding",
            percent: Math.min(
              99,
              Math.max(
                0,
                Math.round(
                  (microseconds / 1000000 / (settings.end - settings.start)) *
                    100,
                ),
              ),
            ),
            label: "Preparing your MP4…",
          });
      };
      const log = ({ message }: { message: string }) => {
        logTail = (logTail + "\n" + message).slice(-2500);
      };
      engine.on("progress", progress);
      engine.on("log", log);
      const ext =
        selectedSource.file.name.split(".").pop()?.toLowerCase() || "mp4";
      const input = `source.${ext}`;
      try {
        await engine.writeFile(
          input,
          new Uint8Array(await selectedSource.file.arrayBuffer()),
          { signal: abort.signal },
        );
        setJob({ phase: "encoding", percent: 0, label: "Preparing your MP4…" });
        const status = await engine.exec(
          exportArgs(input, selectedSource, settings),
          -1,
          { signal: abort.signal },
        );
        if (status !== 0)
          throw new Error(
            /memory|allocation|out of bounds/i.test(logTail)
              ? "Your browser ran out of memory. Try a shorter clip or a 720p export."
              : "This video could not be exported. Try a shorter clip, 720p, or another source file.",
          );
        const data = await engine.readFile("output.mp4", undefined, {
          signal: abort.signal,
        });
        if (id !== operation.current) return;
        if (typeof data === "string" || data.byteLength === 0)
          throw new Error("The export was empty. Please try another video.");
        complete(new Uint8Array(data));
      } finally {
        engine.off("progress", progress);
        engine.off("log", log);
        if (engine.loaded) {
          await engine.deleteFile(input).catch(() => {});
          await engine.deleteFile("output.mp4").catch(() => {});
        }
      }
    } catch (e) {
      if (id === operation.current) {
        setError(
          e instanceof Error
            ? e.message
            : "Export failed. Please try a shorter clip.",
        );
        ffmpeg.current?.terminate();
        ffmpeg.current = null;
      }
    } finally {
      coreUrls.forEach((url) => URL.revokeObjectURL(url));
      if (id === operation.current) {
        setJob(null);
        controller.current = null;
      }
    }
  }
  function download() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setNotice(
      "Download requested. Check your browser’s downloads, then upload the file from your gallery.",
    );
  }
  async function share() {
    if (!result) return;
    try {
      if (navigator.canShare?.({ files: [result.file] })) {
        await navigator.share({ files: [result.file], title: "My video" });
        setNotice(
          "Share sheet opened. Choose an app and finish posting there.",
        );
      } else download();
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError")
        setError(
          "Sharing is unavailable in this browser. Use Download MP4 instead.",
        );
    }
  }
  const showingExport = view === "export" && !!result;
  const videoUrl = showingExport ? result.url : source?.url;

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Studio utilities">
        <a href="#workspace" className="wordmark">
          framewell<span className="wordmark-period">.</span>
        </a>
        <p className="sidebar-caption">A little care for every frame.</p>
        <nav aria-label="Workspace">
          <a href="#workspace" className="nav-item active">
            <FrameCornersIcon size={20} weight="duotone" />
            <span>Media studio</span>
          </a>
          <Guide>
            <button className="nav-item">
              <SlidersHorizontalIcon size={20} />
              <span>Upload guide</span>
            </button>
          </Guide>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <HardDrivesIcon size={22} />
            <p>
              Made on your device.<span>Your files stay with you.</span>
            </p>
          </div>
          <Guide>
            <button className="help-button">
              <QuestionIcon size={19} /> A hand with your export?
            </button>
          </Guide>
          <div className="sidebar-credit">
            Your footage. A considered export.
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="mobile-wordmark">framewell.</span>
            <span className="desktop-crumb">
              Workspace <span>/</span> <strong>Media studio</strong>
            </span>
          </div>
          <span className="local-indicator">
            <LockSimpleIcon size={14} /> Local processing
          </span>
          <Guide>
            <Button variant="ghost" className="topbar-guide">
              <QuestionIcon size={17} /> Guide
            </Button>
          </Guide>
        </header>
        <main id="workspace">
          <div className="page-heading">
            <div>
              <p className="section-kicker">THE MEDIA STUDIO</p>
              <h1>
                {mediaType === "photo"
                  ? "Good photos deserve"
                  : "Good footage deserves"}
                <br className="desktop-break" /> a good upload<span>.</span>
              </h1>
              <p className="page-description">
                Prepare your {mediaType === "photo" ? "photo" : "video"} for its
                next screen. Keep the detail that matters.
              </p>
            </div>
            <div className="heading-aside">
              <FrameCornersIcon size={26} />
              <span>
                From your camera
                <br />
                to their feed.
              </span>
            </div>
          </div>
          <Tabs
            value={mediaType}
            onValueChange={(value) => {
              video.current?.pause();
              setMediaType(value);
            }}
          >
            <div className="media-toolbar">
              <TabsList className="media-tabs" aria-label="Media type">
                <TabsTrigger value="video" disabled={busy || photoBusy}>
                  <FilmStripIcon size={18} />
                  Video
                </TabsTrigger>
                <TabsTrigger value="photo" disabled={busy || photoBusy}>
                  <ImageIcon size={18} />
                  Photo
                </TabsTrigger>
              </TabsList>
              <span>One original. A considered export.</span>
            </div>
            <TabsContent
              value="video"
              forceMount
              hidden={mediaType !== "video"}
            >
              <div className="workspace-grid">
                <section className="preview-panel" aria-label="Video preview">
                  <div className="panel-toolbar">
                    <div className="panel-heading">
                      <span className="step-number">01</span>
                      <h2>Your footage</h2>
                    </div>
                    <div className="preview-tabs">
                      <Tabs
                        value={view}
                        onValueChange={(value) => {
                          setView(value);
                          setPosition(0);
                        }}
                      >
                        <TabsList aria-label="Preview version">
                          <TabsTrigger value="original" disabled={busy}>
                            Original
                          </TabsTrigger>
                          <TabsTrigger
                            value="export"
                            disabled={!result || busy}
                          >
                            Export
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </div>
                  <input
                    ref={fileInput}
                    className="sr-only"
                    tabIndex={-1}
                    type="file"
                    accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
                    aria-label="Choose a video"
                    disabled={busy}
                    onChange={(e) => {
                      void loadFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <div
                    className={`preview-stage ${dragging ? "is-dragging" : ""} ${source ? "has-video" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!busy) setDragging(true);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node))
                        setDragging(false);
                    }}
                    onDrop={drop}
                  >
                    {videoUrl ? (
                      <>
                        <div
                          className={`video-canvas ${framing} ${safeArea ? "show-safe-area" : ""}`}
                          style={{
                            aspectRatio: `${size.width}/${size.height}`,
                          }}
                        >
                          <video
                            key={videoUrl}
                            ref={video}
                            src={videoUrl}
                            controls
                            playsInline
                            preload="metadata"
                            width={size.width}
                            height={size.height}
                            style={{
                              objectFit: showingExport
                                ? "contain"
                                : framing === "crop"
                                  ? "cover"
                                  : "contain",
                            }}
                            onTimeUpdate={(e) =>
                              setPosition(e.currentTarget.currentTime)
                            }
                            onError={() =>
                              setError(
                                "Playback failed. Your browser may not support this video codec. Try an H.264 MP4.",
                              )
                            }
                            muted={!audio}
                          />
                          {safeArea && (
                            <div className="safe-area" aria-hidden="true">
                              <span>Keep key details inside</span>
                            </div>
                          )}
                        </div>
                        <span className="canvas-label">
                          {showingExport ? "EXPORTED MP4" : "FRAMING PREVIEW"}{" "}
                          <span>9:16</span>
                        </span>
                      </>
                    ) : (
                      <div className="empty-upload">
                        <div className="empty-frame">
                          <span />
                          <span />
                          <span />
                          <span />
                          <FileVideoIcon size={42} weight="light" />
                          <div className="empty-frame-line" />
                        </div>
                        <h3>
                          {analyzing
                            ? "Reading your video…"
                            : "A great video starts here."}
                        </h3>
                        <p>
                          {analyzing
                            ? "Checking the size, duration, and preview."
                            : "Drop your original video into the studio."}
                        </p>
                        <Button
                          variant="secondary"
                          onClick={() => fileInput.current?.click()}
                          disabled={busy}
                        >
                          <PlusIcon size={18} />
                          {analyzing ? "Reading file…" : "Choose a video"}
                        </Button>
                        <span className="upload-formats">
                          MP4, MOV, WebM <span>·</span> Up to 250 MB
                        </span>
                      </div>
                    )}
                    {analyzing && source && (
                      <div className="stage-loading" role="status">
                        Reading your next video…
                      </div>
                    )}
                    {dragging && (
                      <div className="drop-overlay">
                        <UploadSimpleIcon size={36} />
                        <span>Drop to open your video</span>
                      </div>
                    )}
                  </div>
                  <div className="preview-bottom">
                    <div className="preview-time">
                      <FilmStripIcon size={17} />
                      <span>
                        {time(position)}{" "}
                        <span>
                          /{" "}
                          {time(
                            showingExport
                              ? result.duration
                              : source?.duration || 0,
                          )}
                        </span>
                      </span>
                    </div>
                    <span className="preview-aspect">
                      {source
                        ? `${showingExport ? result.width : source.width} × ${showingExport ? result.height : source.height}`
                        : "9:16 portrait canvas"}
                    </span>
                    <div className="safe-area-control">
                      <label htmlFor="safe-area">Safe area</label>
                      <Switch
                        id="safe-area"
                        checked={safeArea}
                        onCheckedChange={setSafeArea}
                      />
                    </div>
                  </div>
                  {source ? (
                    <div className="file-strip">
                      <div className="file-icon">
                        <FileVideoIcon size={24} />
                      </div>
                      <div className="file-details">
                        <strong title={source.file.name}>
                          {source.file.name}
                        </strong>
                        <span>
                          {bytes(source.file.size)} <span>·</span>{" "}
                          {time(source.duration)} <span>·</span> Original source
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        onClick={() => fileInput.current?.click()}
                        aria-label="Replace video"
                        title="Replace video"
                      >
                        <ArrowCounterClockwiseIcon size={18} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        onClick={reset}
                        aria-label="Remove video"
                        title="Remove video"
                      >
                        <XIcon size={18} />
                      </Button>
                    </div>
                  ) : (
                    <div className="source-hint">
                      <ShieldCheckIcon size={18} />
                      <span>
                        Only on your device. No video uploads to our servers.
                      </span>
                    </div>
                  )}
                  {source && (
                    <div className="trim-section">
                      <div className="trim-title">
                        <h3>Choose your clip</h3>
                        <span>{(end - start).toFixed(1)}s selected</span>
                      </div>
                      <div className="trim-fields">
                        <label htmlFor="clip-start">
                          Start{" "}
                          <div>
                            <input
                              id="clip-start"
                              type="number"
                              min="0"
                              max={source.duration}
                              step="any"
                              value={start}
                              disabled={busy}
                              onChange={(e) => {
                                setStart(
                                  e.target.value === ""
                                    ? 0
                                    : e.target.valueAsNumber,
                                );
                                invalidate();
                              }}
                            />
                            <span>sec</span>
                          </div>
                        </label>
                        <span className="trim-separator">to</span>
                        <label htmlFor="clip-end">
                          End{" "}
                          <div>
                            <input
                              id="clip-end"
                              type="number"
                              min="0.1"
                              max={source.duration}
                              step="any"
                              value={end}
                              disabled={busy}
                              onChange={(e) => {
                                setEnd(
                                  e.target.value === ""
                                    ? 0
                                    : e.target.valueAsNumber,
                                );
                                invalidate();
                              }}
                            />
                            <span>sec</span>
                          </div>
                        </label>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            setStart(0);
                            setEnd(
                              Math.floor(Math.min(source.duration, 180) * 100) /
                                100,
                            );
                            invalidate();
                          }}
                          aria-label="Reset clip range"
                        >
                          <ArrowCounterClockwiseIcon size={17} />
                        </Button>
                      </div>
                      {rangeError && (
                        <p className="field-error" role="alert">
                          {rangeError}
                        </p>
                      )}
                    </div>
                  )}
                </section>
                <section
                  className="settings-panel"
                  aria-label="Export settings"
                >
                  <div className="panel-toolbar">
                    <div className="panel-heading">
                      <span className="step-number">02</span>
                      <h2>Make it upload-ready</h2>
                    </div>
                    <SlidersHorizontalIcon size={19} className="muted" />
                  </div>
                  <div className="settings-body">
                    <div className="field-heading">
                      <h3>Where’s it going?</h3>
                      <span>Select a destination</span>
                    </div>
                    <Tabs value={platform} onValueChange={changePlatform}>
                      <TabsList
                        className="platform-tabs"
                        aria-label="Destination platform"
                      >
                        {(Object.keys(PRESETS) as Platform[]).map((key) => (
                          <TabsTrigger value={key} key={key} disabled={busy}>
                            <span className="platform-letter">
                              {key === "instagram"
                                ? "ig"
                                : key === "whatsapp"
                                  ? "wa"
                                  : "tk"}
                            </span>
                            {PRESETS[key].short}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                    <p className="preset-description">{preset.description}</p>
                    <div className="export-format">
                      <div className="format-icon">
                        <FileVideoIcon size={25} />
                      </div>
                      <div>
                        <strong>{preset.name}</strong>
                        <span>
                          MP4 <span>·</span> H.264 <span>·</span> 9:16
                        </span>
                      </div>
                      <CheckCircleIcon size={22} weight="fill" />
                    </div>
                    <div className="settings-row">
                      <label htmlFor="resolution">
                        Resolution<span>Adapts to your source</span>
                      </label>
                      <select
                        id="resolution"
                        disabled={busy}
                        value={resolution}
                        onChange={(e) => {
                          setResolution(+e.target.value);
                          invalidate();
                        }}
                      >
                        <option value={1080}>1080p maximum</option>
                        <option value={720}>720p maximum</option>
                      </select>
                    </div>
                    <div className="settings-row">
                      <label htmlFor="framerate">
                        Frame rate<span>Frames per second</span>
                      </label>
                      <select
                        id="framerate"
                        disabled={busy}
                        value={fps}
                        onChange={(e) => {
                          setFps(+e.target.value);
                          invalidate();
                        }}
                      >
                        <option value={24}>24 fps</option>
                        <option value={30}>30 fps</option>
                        <option value={60}>60 fps</option>
                      </select>
                    </div>
                    <div className="framing-section">
                      <div className="field-heading">
                        <h3>Framing</h3>
                        <span>Keep your subject in view</span>
                      </div>
                      <Tabs
                        value={framing}
                        onValueChange={(v) => {
                          setFraming(v as Framing);
                          invalidate();
                        }}
                      >
                        <TabsList
                          className="framing-tabs"
                          aria-label="Video framing"
                        >
                          <TabsTrigger value="fit" disabled={busy}>
                            <FrameCornersIcon size={18} />
                            <span>Fit full video</span>
                          </TabsTrigger>
                          <TabsTrigger value="crop" disabled={busy}>
                            <CropIcon size={18} />
                            <span>Fill & crop</span>
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <p className="framing-note">
                        {framing === "fit"
                          ? "Preserves every edge. Adds black space when needed."
                          : "Fills the vertical frame. Crops the center of your video."}
                      </p>
                    </div>
                    <div className="settings-row">
                      <label htmlFor="quality">
                        Export quality<span>Detail and file size</span>
                      </label>
                      <select
                        id="quality"
                        disabled={busy}
                        value={quality}
                        onChange={(e) => {
                          setQuality(e.target.value as "high" | "balanced");
                          invalidate();
                        }}
                      >
                        <option value="balanced">Balanced · smaller</option>
                        <option value="high">High detail</option>
                      </select>
                    </div>
                    <p className="framing-note">
                      {quality === "balanced"
                        ? "Recommended for Stories and Status. Uses less data while keeping your selected resolution."
                        : "Keeps more fine detail, especially in motion. Files can be much larger."}
                    </p>
                    <div className="settings-row audio-row">
                      <label htmlFor="audio">
                        <SpeakerHighIcon size={18} /> Keep original audio
                      </label>
                      <Switch
                        id="audio"
                        checked={audio}
                        disabled={busy}
                        onCheckedChange={(v) => {
                          setAudio(v);
                          invalidate();
                        }}
                      />
                    </div>
                    <div className="quality-note">
                      <InfoIcon size={17} />
                      <p>
                        {platform === "whatsapp"
                          ? "WhatsApp compresses Status videos. A clear export helps, but HD Status quality is not guaranteed."
                          : "A good export gives your upload a better starting point. Platforms still apply their own compression."}
                      </p>
                    </div>
                    <div className="export-summary">
                      <span>YOUR EXPORT</span>
                      <strong>
                        {size.width} × {size.height}
                        <span>MP4 / {fps} fps</span>
                      </strong>
                      <p>
                        <CheckIcon size={14} /> No watermark <span>·</span> No
                        artificial upscaling
                      </p>
                    </div>
                    {job ? (
                      <div
                        className="job-progress"
                        role="status"
                        aria-live="polite"
                      >
                        <div>
                          <strong>{job.label}</strong>
                          <span>
                            {job.phase === "encoding"
                              ? `${job.percent}%`
                              : "First export may take a moment"}
                          </span>
                        </div>
                        <progress
                          max={100}
                          value={
                            job.phase === "encoding" ? job.percent : undefined
                          }
                        />
                        <Button variant="outline" onClick={cancel}>
                          Cancel export
                        </Button>
                      </div>
                    ) : result ? (
                      <div className="download-actions">
                        <Button onClick={download} className="export-button">
                          <DownloadSimpleIcon size={20} /> Download MP4{" "}
                          <span>{bytes(result.file.size)}</span>
                        </Button>
                        <Button variant="outline" onClick={() => void share()}>
                          Save or share on your device
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => void createExport()}
                        disabled={!source || busy || !!rangeError}
                        className="export-button"
                      >
                        <ArrowDownIcon size={20} />
                        {analyzing ? "Reading your video…" : "Export video"}
                        <span>MP4</span>
                      </Button>
                    )}
                    <p className="export-footnote">
                      {job
                        ? "Keep this tab open while exporting."
                        : source
                          ? "Processed here, in your browser."
                          : "Add a video to begin your export."}
                    </p>
                  </div>
                </section>
              </div>
              <div className="feedback-area" aria-live="polite">
                {error && (
                  <div className="feedback error" role="alert">
                    <InfoIcon size={20} />
                    <span>{error}</span>
                    <button
                      aria-label="Dismiss error"
                      onClick={() => setError("")}
                    >
                      <XIcon size={17} />
                    </button>
                  </div>
                )}
                {notice && (
                  <div className="feedback notice">
                    <CheckCircleIcon size={20} />
                    <span>{notice}</span>
                    <button
                      aria-label="Dismiss notification"
                      onClick={() => setNotice("")}
                    >
                      <XIcon size={17} />
                    </button>
                  </div>
                )}
              </div>
              <section className="upload-note">
                <div className="upload-note-icon">
                  <UploadSimpleIcon size={24} />
                </div>
                <div>
                  <h2>The last step happens in your app.</h2>
                  <p>
                    Download your export, then upload it from your gallery.{" "}
                    {preset.note}
                  </p>
                </div>
                <Guide>
                  <Button variant="ghost">
                    Upload guide{" "}
                    <ArrowUpIcon size={16} className="guide-arrow" />
                  </Button>
                </Guide>
              </section>
            </TabsContent>
            <TabsContent
              value="photo"
              forceMount
              hidden={mediaType !== "photo"}
            >
              <PhotoStudio onBusyChange={setPhotoBusy} />
            </TabsContent>
          </Tabs>
        </main>
        <footer>
          <span>Made for the moments you want to share.</span>
          <a
            href="https://style.ai.id/ui-components"
            target="_blank"
            rel="noreferrer"
          >
            UI selected with Style UI
          </a>
          <span>framewell.</span>
        </footer>
      </div>
    </div>
  );
}
