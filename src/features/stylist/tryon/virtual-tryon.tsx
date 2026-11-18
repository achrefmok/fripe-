"use client";

import { Camera, Download, ImageUp, LoaderCircle, PersonStanding, RotateCcw, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { productImageUrl } from "@/lib/utils/storage";
import { SLOTS, type Slot, type StyleItem } from "../engine";
import { type Adjust, hitTest, maskCanvas, render } from "./compositor";
import { detectPose, fitFrames, type Frame, placeGarments } from "./pose";
import { FittingStage } from "./fitting-stage";
import { useMannequinChoice } from "./mannequin-choice";
import { MannequinChooser } from "./mannequin-chooser";
import { garmentCutout } from "./segment";
import "./tryon.css";

type Status = "loading" | "ready" | "manual" | "error";
const MAX_SIDE = 1080;
const NONE: Adjust = { dx: 0, dy: 0, scale: 1 };

// Sans silhouette détectée : les positions par défaut, en pixels, que l'on ajuste à la main.
function fallbackFrames(width: number, height: number): Partial<Record<Slot, Frame>> {
  const placed = placeGarments(null, height / width);
  return Object.fromEntries(
    SLOTS.map((slot) => {
      const place = placed[slot];
      return [slot, { x: place.left * width, y: place.top * height, width: place.width * width, height: place.width * width * 1.3, rotate: 0, fit: false, clip: false }];
    }),
  );
}

// L'essayage virtuel, en deux modes. Sur le mannequin 3D (femme ou homme, au choix) : la tenue
// s'enroule sur la silhouette (fitting-stage.tsx). Sur sa propre photo : l'IA repère la pose et la
// silhouette, étire chaque vêtement entre épaules, hanches et chevilles, le découpe selon le corps et
// y reporte la lumière. L'IA détoure chaque pièce pour les deux modes. Tout se passe sur l'appareil.
export function VirtualTryOn({ pieces }: { pieces: Partial<Record<Slot, StyleItem>> }) {
  const t = useTranslations("tryon");
  const [status, setStatus] = useState<Status | null>(null);
  const [garments, setGarments] = useState<Partial<Record<Slot, HTMLCanvasElement>>>({});
  const [weak, setWeak] = useState<Slot[]>([]);
  const [failed, setFailed] = useState<Slot[]>([]);
  const [frames, setFrames] = useState<Partial<Record<Slot, Frame>>>({});
  const [adjusts, setAdjusts] = useState<Partial<Record<Slot, Adjust>>>({});
  const [selected, setSelected] = useState<Slot | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const photo = useRef<HTMLCanvasElement | null>(null);
  const body = useRef<HTMLCanvasElement | null>(null);
  const choice = useMannequinChoice();
  const [mode, setMode] = useState<"mannequin" | "photo">("mannequin");
  const drag = useRef<{ slot: Slot; x: number; y: number; dx: number; dy: number } | null>(null);
  const worn = SLOTS.filter((slot) => pieces[slot]?.imagePath);

  // Les pièces sont détourées une à une (un seul modèle) pendant que la personne choisit sa photo.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const slot of worn) {
        const result = await garmentCutout(productImageUrl(pieces[slot]!.imagePath!)).catch(() => null);
        if (cancelled) return;
        if (!result) {
          // Photo introuvable : la pièce est laissée de côté, la préparation ne reste pas bloquée.
          setFailed((current) => [...current, slot]);
          continue;
        }
        setGarments((current) => ({ ...current, [slot]: result.canvas }));
        if (result.quality === "photo") setWeak((current) => [...current, slot]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // La liste des pièces ne change pas pendant que la fenêtre est ouverte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le rendu suit chaque changement : pièces détourées, cadres, réglages, pièce choisie.
  useEffect(() => {
    const target = canvas.current;
    if (mode !== "photo" || !target || !photo.current || status === "loading") return;
    if (target.width !== photo.current.width || target.height !== photo.current.height) {
      target.width = photo.current.width;
      target.height = photo.current.height;
    }
    render(target, photo.current, body.current, garments, frames, adjusts, selected);
  }, [garments, frames, adjusts, selected, status, mode, hasPhoto]);

  async function choose(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setStatus("loading");
    setHasPhoto(true);
    setMode("photo");
    setSelected(null);
    setAdjusts({});
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
      const source = document.createElement("canvas");
      source.width = Math.round(image.naturalWidth * scale);
      source.height = Math.round(image.naturalHeight * scale);
      source.getContext("2d")!.drawImage(image, 0, 0, source.width, source.height);
      photo.current = source;
      if (canvas.current) {
        canvas.current.width = source.width;
        canvas.current.height = source.height;
      }
      try {
        const { pose, mask } = await detectPose(source);
        body.current = mask ? maskCanvas(mask, source.width, source.height) : null;
        const fitted = fitFrames(pose, source.width, source.height);
        setFrames({ ...fallbackFrames(source.width, source.height), ...fitted });
        setStatus(pose ? "ready" : "manual");
      } catch {
        // IA indisponible sur cet appareil : la photo reste, placement à la main.
        body.current = null;
        setFrames(fallbackFrames(source.width, source.height));
        setStatus("error");
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * event.currentTarget.width, y: ((event.clientY - box.top) / box.height) * event.currentTarget.height };
  }

  function down(event: PointerEvent<HTMLCanvasElement>) {
    const { x, y } = point(event);
    const slot = hitTest(x, y, garments, frames, adjusts);
    setSelected(slot);
    if (!slot) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const adjust = adjusts[slot] ?? NONE;
    drag.current = { slot, x, y, dx: adjust.dx, dy: adjust.dy };
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const current = drag.current;
    if (!current) return;
    const { x, y } = point(event);
    setAdjusts((all) => ({ ...all, [current.slot]: { ...(all[current.slot] ?? NONE), dx: current.dx + x - current.x, dy: current.dy + y - current.y } }));
  }

  function save() {
    canvas.current?.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "essayage-fripe.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, "image/png");
  }

  const busy = status === "loading";
  const preparing = worn.some((slot) => !garments[slot] && !failed.includes(slot));

  const onMannequin = mode === "mannequin";
  const gender = choice.gender;

  return (
    <div className="vt">
      <p className="vt-disclaimer">
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
        <span>{t("privacy")}</span>
      </p>

      {onMannequin ? (
        gender ? (
          <FittingStage pieces={pieces} cutouts={garments} choice={{ ...choice, gender }} onPhoto={() => setMode("photo")} />
        ) : (
          <MannequinChooser onPhoto={() => setMode("photo")} />
        )
      ) : (
        <>
          {!hasPhoto ? (
            <div className="vt-intro">
              <p>{t("intro")}</p>
              <ul className="vt-tips">
                <li>{t("tipFull")}</li>
                <li>{t("tipLight")}</li>
                <li>{t("tipAlone")}</li>
              </ul>
            </div>
          ) : null}

          <div className="vt-actions">
            <label className="vt-btn vt-btn--primary">
              <ImageUp className="size-4" aria-hidden="true" />
              {hasPhoto ? t("changePhoto") : t("choosePhoto")}
              <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(event) => void choose(event.target.files?.[0])} />
            </label>
            <label className="vt-btn">
              <Camera className="size-4" aria-hidden="true" />
              {t("takePhoto")}
              <input type="file" accept="image/*" capture="user" className="sr-only" disabled={busy} onChange={(event) => void choose(event.target.files?.[0])} />
            </label>
            <button type="button" className="vt-btn" disabled={busy} onClick={() => setMode("mannequin")}>
              <PersonStanding className="size-4" aria-hidden="true" />
              {t("useMannequin")}
            </button>
          </div>

          {preparing ? (
            <p className="vt-status">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              {t("preparing")}
            </p>
          ) : null}

          {hasPhoto ? (
            <>
              {status ? (
                <p role="status" className="vt-status">
                  {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {t(`status.${status}`)}
                </p>
              ) : null}
              <canvas
                ref={canvas}
                className="vt-canvas"
                role="img"
                aria-label={t("photoAlt")}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
              />

              {selected ? (
                <div className="vt-adjust">
                  <label htmlFor="vt-size" className="text-sm font-medium">
                    {t("size", { piece: pieces[selected]!.title })}
                  </label>
                  <input
                    id="vt-size"
                    type="range"
                    min={0.6}
                    max={1.6}
                    step={0.02}
                    value={adjusts[selected]?.scale ?? 1}
                    onChange={(event) => setAdjusts({ ...adjusts, [selected]: { ...(adjusts[selected] ?? NONE), scale: Number(event.target.value) } })}
                  />
                </div>
              ) : null}

              {!busy ? (
                <div className="vt-actions">
                  <button type="button" className="vt-btn" onClick={() => setAdjusts({})}>
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {t("reset")}
                  </button>
                  <button type="button" className="vt-btn" onClick={save}>
                    <Download className="size-4" aria-hidden="true" />
                    {t("save")}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
          <p className="vt-warning">{t("warning")}</p>
        </>
      )}

      {weak.length ? <p className="vt-note">{t("weakCutout")}</p> : null}
    </div>
  );
}
