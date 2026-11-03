import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  ArrowDownIcon,
  ArrowCounterClockwiseIcon,
  CheckIcon,
  CheckCircleIcon,
  CropIcon,
  DownloadSimpleIcon,
  FrameCornersIcon,
  ImageIcon,
  InfoIcon,
  PlusIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { bytes, type Framing } from "@/lib/video";
import {
  PHOTO_PRESETS,
  photoLayout,
  readPhoto,
  renderPhoto,
  type PhotoFormat,
  type PhotoPlatform,
  type PhotoSettings,
} from "@/lib/photo";

type PhotoSource = Awaited<ReturnType<typeof readPhoto>>;
type PhotoResult = { file: File; url: string; width: number; height: number };
export default function PhotoStudio({
  onBusyChange,
}: {
  onBusyChange: (busy: boolean) => void;
}) {
  const [source, setSource] = useState<PhotoSource | null>(null);
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [platform, setPlatform] = useState<PhotoPlatform>("instagram");
  const [resolution, setResolution] = useState(1080);
  const [framing, setFraming] = useState<Framing>("fit");
  const [format, setFormat] = useState<PhotoFormat>("jpeg");
  const [quality, setQuality] = useState<"high" | "balanced">("high");
  const [background, setBackground] = useState<"black" | "white">("black");
  const [view, setView] = useState("original");
  const [guide, setGuide] = useState(false);
  const [job, setJob] = useState<"reading" | "exporting" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const busy = job !== null;
  const layout = photoLayout(source, resolution, framing);
  const showingExport = view === "export" && !!result;
  const preset = PHOTO_PRESETS[platform];

  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(
    () => () => {
      if (source) {
        source.image.removeAttribute("src");
        URL.revokeObjectURL(source.url);
      }
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
      controller.current?.abort();
    },
    [],
  );
  function invalidate() {
    setResult(null);
    setView("original");
    setNotice("");
    setError("");
  }
  async function load(file?: File) {
    if (!file || busy) return;
    const id = ++operation.current;
    const abort = new AbortController();
    controller.current = abort;
    invalidate();
    setJob("reading");
    try {
      const next = await readPhoto(file, abort.signal);
      if (id !== operation.current) {
        next.image.removeAttribute("src");
        URL.revokeObjectURL(next.url);
        return;
      }
      setSource(next);
    } catch (error) {
      if (id === operation.current)
        setError(
          error instanceof Error ? error.message : "Could not open this photo.",
        );
    } finally {
      if (id === operation.current) {
        setJob(null);
        controller.current = null;
      }
    }
  }
  function cancel() {
    operation.current++;
    controller.current?.abort();
    controller.current = null;
    setJob(null);
    setNotice("Cancelled. Your original photo is unchanged.");
  }
  function reset() {
    if (busy) return;
    setSource(null);
    invalidate();
    if (input.current) input.current.value = "";
  }
  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void load(event.dataTransfer.files[0]);
  }
  async function exportPhoto() {
    if (!source || busy) return;
    const id = ++operation.current;
    const settings: PhotoSettings = {
      platform,
      resolution,
      framing,
      format,
      quality,
      background,
    };
    invalidate();
    setJob("exporting");
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (id !== operation.current) return;
      const next = await renderPhoto(source, settings);
      if (id !== operation.current) return;
      setResult({ ...next, url: URL.createObjectURL(next.file) });
      setView("export");
      setNotice(
        "Your photo is ready. Preview the export, then save it to your gallery.",
      );
    } catch (error) {
      if (id === operation.current)
        setError(
          error instanceof Error
            ? error.message
            : "Photo export failed. Try another original photo.",
        );
    } finally {
      if (id === operation.current) setJob(null);
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
      "Download requested. Upload the saved photo directly from your gallery.",
    );
  }
  async function share() {
    if (!result) return;
    try {
      if (navigator.canShare?.({ files: [result.file] })) {
        await navigator.share({ files: [result.file], title: "My photo" });
        setNotice("Finish sharing in your chosen app.");
      } else download();
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError")
        setError("Sharing is unavailable. Use the download button instead.");
    }
  }

  return (
    <div className="photo-studio">
      <div className="workspace-grid">
        <section className="preview-panel" aria-label="Photo preview">
          <div className="panel-toolbar">
            <div className="panel-heading">
              <span className="step-number">01</span>
              <h2>Your photo</h2>
            </div>
            <div className="preview-tabs">
              <Tabs value={view} onValueChange={setView}>
                <TabsList aria-label="Photo preview version">
                  <TabsTrigger value="original" disabled={busy}>
                    Original
                  </TabsTrigger>
                  <TabsTrigger value="export" disabled={!result || busy}>
                    Export
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
          <input
            ref={input}
            className="sr-only"
            tabIndex={-1}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            aria-label="Choose a photo"
            disabled={busy}
            onChange={(event) => {
              void load(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div
            className={`preview-stage photo-stage ${dragging ? "is-dragging" : ""} ${source ? "has-photo" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node))
                setDragging(false);
            }}
            onDrop={drop}
          >
            {source ? (
              <>
                <div
                  className="video-canvas photo-canvas"
                  style={{ aspectRatio: "9/16", background }}
                >
                  <img
                    src={showingExport ? result.url : source.url}
                    alt={
                      showingExport
                        ? "Exported portrait photo"
                        : "Your photo with the selected framing"
                    }
                    width={layout.width}
                    height={layout.height}
                    style={{
                      objectFit: showingExport
                        ? "contain"
                        : framing === "crop"
                          ? "cover"
                          : "contain",
                    }}
                  />
                  {guide && (
                    <div className="safe-area" aria-hidden="true">
                      <span>Composition guide</span>
                    </div>
                  )}
                </div>
                <span className="canvas-label">
                  {showingExport ? "EXPORTED PHOTO" : "FRAMING PREVIEW"}{" "}
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
                  <ImageIcon size={42} weight="light" />
                  <div className="empty-frame-line" />
                </div>
                <h3>A moment worth keeping clear.</h3>
                <p>Drop an original photo into the studio.</p>
                <Button
                  variant="secondary"
                  onClick={() => input.current?.click()}
                  disabled={busy}
                >
                  <PlusIcon size={18} />
                  Choose a photo
                </Button>
                <span className="upload-formats">
                  JPEG, PNG, WebP <span>·</span> Up to 30 MB
                </span>
              </div>
            )}
            {job === "reading" && (
              <div className="stage-loading" role="status">
                Reading your photo…
              </div>
            )}
            {dragging && (
              <div className="drop-overlay">
                <ImageIcon size={36} />
                <span>Drop to open your photo</span>
              </div>
            )}
          </div>
          <div className="preview-bottom">
            <div className="preview-time">
              <ImageIcon size={17} />
              <span>
                {source
                  ? `${showingExport ? result.width : source.width} × ${showingExport ? result.height : source.height}`
                  : "9:16 portrait canvas"}
              </span>
            </div>
            <div className="safe-area-control">
              <label htmlFor="photo-guide">Composition guide</label>
              <Switch
                id="photo-guide"
                checked={guide}
                onCheckedChange={setGuide}
              />
            </div>
          </div>
          {source ? (
            <div className="file-strip">
              <div className="file-icon">
                <ImageIcon size={24} />
              </div>
              <div className="file-details">
                <strong title={source.file.name}>{source.file.name}</strong>
                <span>
                  {bytes(source.file.size)} <span>·</span> Original photo
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Replace photo"
                title="Replace photo"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                <ArrowCounterClockwiseIcon size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove photo"
                title="Remove photo"
                disabled={busy}
                onClick={reset}
              >
                <XIcon size={18} />
              </Button>
            </div>
          ) : (
            <div className="source-hint">
              <ShieldCheckIcon size={18} />
              <span>Your photos stay on this device.</span>
            </div>
          )}
          <div className="photo-source-note">
            <InfoIcon size={16} />
            <p>
              Use the original camera photo. An export cannot restore detail
              lost in a screenshot or a downloaded copy.
            </p>
          </div>
        </section>
        <section className="settings-panel" aria-label="Photo export settings">
          <div className="panel-toolbar">
            <div className="panel-heading">
              <span className="step-number">02</span>
              <h2>Ready for your story</h2>
            </div>
            <SlidersHorizontalIcon size={19} className="muted" />
          </div>
          <div className="settings-body">
            <div className="field-heading">
              <h3>Where’s it going?</h3>
              <span>Select a destination</span>
            </div>
            <Tabs
              value={platform}
              onValueChange={(value) => {
                setPlatform(value as PhotoPlatform);
                invalidate();
              }}
            >
              <TabsList
                className="platform-tabs"
                aria-label="Photo destination"
              >
                {(Object.keys(PHOTO_PRESETS) as PhotoPlatform[]).map((key) => (
                  <TabsTrigger key={key} value={key} disabled={busy}>
                    <span className="platform-letter">
                      {key === "instagram" ? "ig" : "wa"}
                    </span>
                    {PHOTO_PRESETS[key].short}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <p className="preset-description">{preset.description}</p>
            <div className="export-format">
              <div className="format-icon">
                <ImageIcon size={25} />
              </div>
              <div>
                <strong>{preset.name}</strong>
                <span>
                  {format === "jpeg" ? "JPEG photo" : "PNG photo"}{" "}
                  <span>·</span> 9:16
                </span>
              </div>
              <CheckCircleIcon size={22} weight="fill" />
            </div>
            <div className="settings-row">
              <label htmlFor="photo-resolution">
                Resolution<span>No artificial upscaling</span>
              </label>
              <select
                id="photo-resolution"
                disabled={busy}
                value={resolution}
                onChange={(event) => {
                  setResolution(+event.target.value);
                  invalidate();
                }}
              >
                <option value={1080}>1080p maximum</option>
                <option value={720}>720p maximum</option>
              </select>
            </div>
            <div className="framing-section">
              <div className="field-heading">
                <h3>Framing</h3>
                <span>Keep your subject in view</span>
              </div>
              <Tabs
                value={framing}
                onValueChange={(value) => {
                  setFraming(value as Framing);
                  invalidate();
                }}
              >
                <TabsList className="framing-tabs" aria-label="Photo framing">
                  <TabsTrigger value="fit" disabled={busy}>
                    <FrameCornersIcon size={18} />
                    Fit full photo
                  </TabsTrigger>
                  <TabsTrigger value="crop" disabled={busy}>
                    <CropIcon size={18} />
                    Fill & crop
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="framing-note">
                {framing === "fit"
                  ? "Keeps the full photo. Adds your chosen background."
                  : "A centered crop fills the portrait canvas and cuts the edges."}
              </p>
            </div>
            <div className="settings-row">
              <label htmlFor="photo-format">
                File format<span>JPEG for photos, PNG for graphics</span>
              </label>
              <select
                id="photo-format"
                disabled={busy}
                value={format}
                onChange={(event) => {
                  setFormat(event.target.value as PhotoFormat);
                  invalidate();
                }}
              >
                <option value="jpeg">JPEG</option>
                <option value="png">Lossless PNG</option>
              </select>
            </div>
            <div className="settings-row">
              <label htmlFor="photo-quality">
                JPEG quality
                <span>
                  {format === "png"
                    ? "PNG keeps the rendered pixels"
                    : "Encode once from your original"}
                </span>
              </label>
              <select
                id="photo-quality"
                disabled={busy || format === "png"}
                value={quality}
                onChange={(event) => {
                  setQuality(event.target.value as "high" | "balanced");
                  invalidate();
                }}
              >
                <option value="high">High detail</option>
                <option value="balanced">Smaller file</option>
              </select>
            </div>
            <div className="settings-row">
              <label htmlFor="photo-background">
                Background<span>For borders and transparency</span>
              </label>
              <select
                id="photo-background"
                disabled={busy}
                value={background}
                onChange={(event) => {
                  setBackground(event.target.value as "black" | "white");
                  invalidate();
                }}
              >
                <option value="black">Black</option>
                <option value="white">White</option>
              </select>
            </div>
            <div className="quality-note">
              <InfoIcon size={17} />
              <p>
                {platform === "whatsapp"
                  ? "WhatsApp does not support HD media for Status. Even a clear original may look softer after posting."
                  : "Instagram may resize or recompress the photo. Use the highest upload quality available in your app."}
              </p>
            </div>
            <div className="export-summary">
              <span>YOUR PHOTO EXPORT</span>
              <strong>
                {layout.width} × {layout.height}
                <span>{format === "jpeg" ? "JPEG" : "PNG"} / sRGB canvas</span>
              </strong>
              <p>
                <CheckIcon size={14} /> No watermark <span>·</span> No
                artificial upscaling
              </p>
            </div>
            {source && layout.width < 720 && (
              <p className="photo-small-source">
                Limited by your original. A larger camera photo provides more
                detail.
              </p>
            )}
            {job ? (
              <div className="job-progress" role="status" aria-live="polite">
                <div>
                  <strong>
                    {job === "reading"
                      ? "Reading your photo…"
                      : "Rendering your photo…"}
                  </strong>
                </div>
                <progress aria-label="Photo processing" />
                <Button variant="outline" onClick={cancel}>
                  Cancel photo processing
                </Button>
              </div>
            ) : result ? (
              <div className="download-actions">
                <Button className="export-button" onClick={download}>
                  <DownloadSimpleIcon size={20} />
                  Download {format === "jpeg" ? "JPEG" : "PNG"}
                  <span>{bytes(result.file.size)}</span>
                </Button>
                <Button variant="outline" onClick={() => void share()}>
                  Save or share photo
                </Button>
              </div>
            ) : (
              <Button
                className="export-button"
                disabled={!source || busy}
                onClick={() => void exportPhoto()}
              >
                <ArrowDownIcon size={20} />
                Export photo<span>{format === "jpeg" ? "JPEG" : "PNG"}</span>
              </Button>
            )}
            <p className="export-footnote">
              {source
                ? "Processed here, in your browser."
                : "Add a photo to begin your export."}
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
              aria-label="Dismiss photo error"
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
              aria-label="Dismiss photo notification"
              onClick={() => setNotice("")}
            >
              <XIcon size={17} />
            </button>
          </div>
        )}
      </div>
      <section className="upload-note">
        <div className="upload-note-icon">
          <ImageIcon size={24} />
        </div>
        <div>
          <h2>From this preview to your gallery.</h2>
          <p>
            Download the exported photo, then post it in{" "}
            {platform === "whatsapp" ? "WhatsApp Status" : "Instagram Stories"}.
            Both apps can apply their own compression. The preview here shows
            your export, not the final posted image.{" "}
            <a
              href="https://faq.whatsapp.com/759301289012856"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp quality guidance
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
