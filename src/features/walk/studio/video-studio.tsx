"use client";

import { Check, Mic, Music, Play, RotateCcw, Sparkles, Square, Trash2, Type } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useStepLabel } from "@/features/walk/components/video-uploader";
import { publishVideoFile } from "@/features/walk/publish-video";
import { inspectVideo, MAX_VIDEO_SECONDS } from "@/features/walk/video-file";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/price";
import { CameraCapture } from "./camera-capture";
import { StudioEngine, studioSupported, type Overlay, type Volumes } from "./engine";
import { renderTrack, TRACKS, type TrackId } from "./music";

type Step = "capture" | "review" | "edit" | "publish";
export type StudioProduct = { id: string; title: string; priceMillimes: number | null };

const STEPS: Step[] = ["capture", "review", "edit", "publish"];
const noSubscribe = () => () => {};

// Une adresse locale par fichier, libérée quand le fichier change ou que le studio se ferme.
function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

// Le studio : filmer, revoir, monter (musique, voix, textes, nom et prix), puis publier.
export function VideoStudio({ shopId, products }: { shopId: string; products: StudioProduct[] }) {
  const t = useTranslations("studio");
  const stepLabel = useStepLabel();
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = useState<Step>("capture");
  const [clip, setClip] = useState<File | null>(null);
  const [final, setFinal] = useState<File | null>(null);
  const clipUrl = useObjectUrl(clip);
  const finalUrl = useObjectUrl(final);
  const [clipError, setClipError] = useState<string | null>(null);
  // Lu après hydratation : le serveur ne connaît ni MediaRecorder ni AudioContext.
  const canEdit = useSyncExternalStore(noSubscribe, studioSupported, () => false);

  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<StudioEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [track, setTrack] = useState<TrackId | "">("");
  const [busy, setBusy] = useState<"music" | "voice" | "render" | null>(null);
  const [progress, setProgress] = useState(0);
  const [voiceSeconds, setVoiceSeconds] = useState<number | null>(null);
  const [volumes, setVolumes] = useState<Volumes>({ original: 1, music: 0.6, voice: 1 });
  const [overlay, setOverlay] = useState<Overlay>({ caption: "", productName: "", price: "", showProduct: true });
  const [productId, setProductId] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [linkProduct, setLinkProduct] = useState(true);
  const [publishStep, setPublishStep] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, startPublish] = useTransition();

  // Le moteur suit les réglages ; le dessin se met à jour aussitôt quand rien ne joue.
  useEffect(() => {
    const current = engine.current;
    if (!current) return;
    current.overlay = overlay;
    current.volumes = volumes;
    current.applyVolumes();
    if (!current.playing) current.draw();
  }, [overlay, volumes, ready]);

  useEffect(() => () => engine.current?.dispose(), []);

  async function acceptClip(file: File) {
    setClipError(null);
    setClip(file);
    setFinal(null);
    setStep("review");
    try {
      const info = await inspectVideo(file);
      if (info.duration > MAX_VIDEO_SECONDS + 0.5) setClipError("video_too_long");
    } catch {
      setClipError("invalidVideo");
    }
  }

  function restart() {
    engine.current?.dispose();
    engine.current = null;
    setReady(false);
    setClip(null);
    setFinal(null);
    setTrack("");
    setVoiceSeconds(null);
    setStep("capture");
  }

  function onVideoReady() {
    if (!video.current || !canvas.current || engine.current) return;
    const font = getComputedStyle(document.body).getPropertyValue("--font-title").trim() || "sans-serif";
    engine.current = new StudioEngine(video.current, canvas.current, font);
    engine.current.overlay = overlay;
    engine.current.volumes = volumes;
    engine.current.draw();
    setReady(true);
  }

  async function chooseTrack(id: TrackId | "") {
    setTrack(id);
    if (!engine.current) return;
    if (!id) {
      engine.current.music = null;
      return;
    }
    setBusy("music");
    try {
      engine.current.music = await renderTrack(id, engine.current.duration || 15);
    } finally {
      setBusy(null);
    }
  }

  async function preview() {
    if (!engine.current) return;
    if (engine.current.playing) {
      engine.current.stop();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    await engine.current.play();
    setPlaying(false);
  }

  async function recordVoice() {
    if (!engine.current) return;
    if (busy === "voice") {
      engine.current.stop();
      return;
    }
    setEditError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setBusy("voice");
      setPlaying(true);
      setVoiceSeconds(Math.round(await engine.current.recordVoice(stream)));
    } catch {
      setEditError("micDenied");
    } finally {
      setBusy(null);
      setPlaying(false);
    }
  }

  function chooseProduct(id: string) {
    setProductId(id);
    const product = products.find((entry) => entry.id === id);
    setOverlay((current) => ({
      ...current,
      productName: product?.title ?? "",
      price: product?.priceMillimes ? formatPrice(product.priceMillimes, locale) : "",
    }));
    if (product && !description) {
      setDescription(product.priceMillimes ? `${product.title} · ${formatPrice(product.priceMillimes, locale)}` : product.title);
    }
  }

  async function renderFinal() {
    if (!engine.current) return;
    setEditError(null);
    setBusy("render");
    setProgress(0);
    try {
      setFinal(await engine.current.render(setProgress));
      setStep("publish");
    } catch {
      setEditError("renderFailed");
    } finally {
      setBusy(null);
    }
  }

  function skipEditing() {
    setFinal(clip);
    setStep("publish");
  }

  function publish() {
    const file = final ?? clip;
    if (!file) return;
    setPublishError(null);
    startPublish(async () => {
      try {
        const result = await publishVideoFile(shopId, file, {
          description,
          productIds: linkProduct && productId ? [productId] : [],
          onStep: (current) => setPublishStep(stepLabel(current)),
        });
        if ("error" in result) {
          setPublishError(result.error);
          return;
        }
        toast.success(t("published"));
        router.push(`/vendeur/boutique/${shopId}/videos`);
        router.refresh();
      } catch {
        setPublishError("invalidVideo");
      } finally {
        setPublishStep(null);
      }
    });
  }

  const locked = busy !== null || playing;

  return (
    <div className="studio">
      <ol className="studio-steps" aria-label={t("stepsLabel")}>
        {STEPS.map((entry, index) => (
          <li key={entry} aria-current={entry === step ? "step" : undefined} className={cn(STEPS.indexOf(step) > index && "is-done")}>
            <span aria-hidden="true">{STEPS.indexOf(step) > index ? <Check className="size-3.5" /> : index + 1}</span>
            {t(`step.${entry}`)}
          </li>
        ))}
      </ol>

      {step === "capture" ? <CameraCapture onDone={(file) => void acceptClip(file)} /> : null}

      {step === "review" && clipUrl ? (
        <div className="grid gap-4">
          <div className="studio-screen">
            <video src={clipUrl} controls playsInline aria-label={t("reviewLabel")} />
          </div>
          <FormError error={clipError} />
          <div className="studio-controls">
            <Button type="button" variant="outline" size="lg" onClick={restart}>
              <RotateCcw aria-hidden="true" />
              {t("redo")}
            </Button>
            <Button type="button" size="lg" disabled={Boolean(clipError)} onClick={() => setStep(canEdit ? "edit" : "publish")}>
              <Check aria-hidden="true" />
              {t("validate")}
            </Button>
          </div>
          {!canEdit ? <p className="text-sm text-muted-foreground">{t("editUnsupported")}</p> : null}
        </div>
      ) : null}

      {step === "edit" && clipUrl ? (
        <div className="studio-edit">
          <div className="grid content-start gap-3">
            <div className="studio-screen">
              <canvas ref={canvas} aria-label={t("previewLabel")} role="img" />
              <video
                ref={video}
                src={clipUrl}
                playsInline
                preload="auto"
                className="studio-source"
                onLoadedData={onVideoReady}
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
            <Button type="button" variant="outline" size="lg" disabled={!ready || (busy !== null && busy !== "voice")} onClick={() => void preview()}>
              {playing && busy !== "voice" ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
              {playing && busy !== "voice" ? t("stopPreview") : t("preview")}
            </Button>
          </div>

          <div className="grid content-start gap-6">
            <section className="grid gap-2" aria-labelledby="studio-music">
              <h3 id="studio-music" className="studio-panel-title"><Music className="size-4" aria-hidden="true" />{t("music")}</h3>
              <div role="radiogroup" aria-label={t("music")} className="chips">
                {(["", ...TRACKS] as const).map((id) => (
                  <label key={id || "none"} className={cn("chip", track === id && "is-checked")}>
                    <input type="radio" name="track" className="sr-only" checked={track === id} disabled={locked} onChange={() => void chooseTrack(id)} />
                    {t(`track.${id || "none"}`)}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{busy === "music" ? t("composing") : t("musicNote")}</p>
            </section>

            <section className="grid gap-2" aria-labelledby="studio-voice">
              <h3 id="studio-voice" className="studio-panel-title"><Mic className="size-4" aria-hidden="true" />{t("voice")}</h3>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={busy === "voice" ? "default" : "outline"} disabled={!ready || (locked && busy !== "voice")} onClick={() => void recordVoice()}>
                  {busy === "voice" ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
                  {busy === "voice" ? t("voiceStop") : voiceSeconds ? t("voiceRedo") : t("voiceRecord")}
                </Button>
                {voiceSeconds && busy !== "voice" ? (
                  <Button type="button" variant="ghost" disabled={locked} onClick={() => {
                    if (engine.current) engine.current.voice = null;
                    setVoiceSeconds(null);
                  }}>
                    <Trash2 aria-hidden="true" />
                    {t("voiceDelete")}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground" role="status">
                {busy === "voice" ? t("voiceRecording") : voiceSeconds ? t("voiceReady", { seconds: voiceSeconds }) : t("voiceNote")}
              </p>
            </section>

            <section className="grid gap-3" aria-labelledby="studio-volumes">
              <h3 id="studio-volumes" className="studio-panel-title">{t("volumes")}</h3>
              {(["original", "music", "voice"] as const).map((key) => (
                <label key={key} className="grid gap-1 text-sm">
                  <span className="flex justify-between font-medium">
                    {t(`volume.${key}`)}
                    <span className="tabular-nums text-muted-foreground">{Math.round(volumes[key] * 100)} %</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    aria-label={t(`volume.${key}`)}
                    value={Math.round(volumes[key] * 100)}
                    onChange={(event) => setVolumes((current) => ({ ...current, [key]: Number(event.target.value) / 100 }))}
                    className="accent-[var(--harissa)]"
                  />
                </label>
              ))}
            </section>

            <section className="grid gap-3" aria-labelledby="studio-text">
              <h3 id="studio-text" className="studio-panel-title"><Type className="size-4" aria-hidden="true" />{t("texts")}</h3>
              <Field id="studio-caption" label={t("caption")} optional>
                <Input id="studio-caption" maxLength={60} value={overlay.caption} placeholder={t("captionPlaceholder")} onChange={(event) => setOverlay((current) => ({ ...current, caption: event.target.value }))} />
              </Field>
              <Field id="studio-product" label={t("product")} optional>
                <NativeSelect id="studio-product" value={productId} onChange={(event) => chooseProduct(event.target.value)}>
                  <option value="">{t("noProduct")}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.title}
                      {product.priceMillimes ? ` · ${formatPrice(product.priceMillimes, locale)}` : ""}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="studio-name" label={t("productName")} optional>
                  <Input id="studio-name" maxLength={60} value={overlay.productName} onChange={(event) => setOverlay((current) => ({ ...current, productName: event.target.value }))} />
                </Field>
                <Field id="studio-price" label={t("price")} optional>
                  <Input id="studio-price" maxLength={20} value={overlay.price} onChange={(event) => setOverlay((current) => ({ ...current, price: event.target.value }))} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="size-5 accent-[var(--harissa)]" checked={overlay.showProduct} onChange={(event) => setOverlay((current) => ({ ...current, showProduct: event.target.checked }))} />
                {t("showProduct")}
              </label>
            </section>

            <FormError error={editError} />
            {busy === "render" ? (
              <div role="status" className="grid gap-1.5">
                <span className="text-sm font-semibold">{t("rendering", { percent: Math.round(progress * 100) })}</span>
                <span className="studio-progress"><span style={{ width: `${Math.round(progress * 100)}%` }} /></span>
                <span className="text-xs text-muted-foreground">{t("renderNote")}</span>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" size="lg" className="h-14 text-base" disabled={!ready || locked} onClick={() => void renderFinal()}>
                <Sparkles aria-hidden="true" />
                {t("render")}
              </Button>
              <Button type="button" variant="outline" size="lg" className="h-14" disabled={locked} onClick={skipEditing}>
                {t("skipEditing")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {step === "publish" && (finalUrl || clipUrl) ? (
        <div className="studio-edit">
          <div className="studio-screen">
            <video src={finalUrl ?? clipUrl ?? undefined} controls playsInline aria-label={t("finalLabel")} />
          </div>
          <div className="grid content-start gap-4">
            <Field id="studio-description" label={t("description")} optional>
              <Textarea id="studio-description" maxLength={300} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
            {productId ? (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="size-5 accent-[var(--harissa)]" checked={linkProduct} onChange={(event) => setLinkProduct(event.target.checked)} />
                {t("linkProduct", { product: products.find((product) => product.id === productId)?.title ?? "" })}
              </label>
            ) : (
              <p className="text-sm text-muted-foreground">{t("linkLater")}</p>
            )}
            <FormError error={publishError} />
            {publishStep ? <p role="status" className="text-sm text-muted-foreground">{publishStep}</p> : null}
            <Button type="button" size="lg" className="h-14 text-base" disabled={publishing} onClick={publish}>
              {t("publish")}
            </Button>
            <div className="flex flex-wrap gap-2">
              {canEdit && clip ? (
                <Button type="button" variant="outline" disabled={publishing} onClick={() => {
                  // Un nouveau montage repart des réglages de texte ; musique et voix sont à rechoisir.
                  engine.current?.dispose();
                  engine.current = null;
                  setReady(false);
                  setTrack("");
                  setVoiceSeconds(null);
                  setStep("edit");
                }}>
                  {t("backToEdit")}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" disabled={publishing} onClick={restart}>
                <RotateCcw aria-hidden="true" />
                {t("redo")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
