"use client";

import { Camera, ImageUp, LoaderCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CSSProperties, type PointerEvent, useEffect, useRef, useState } from "react";
import { cutoutUrl } from "@/lib/ui/cutout";
import { productImageUrl } from "@/lib/utils/storage";
import { SLOTS, type Slot, type StyleItem } from "../engine";
import { detectPose, placeGarments, type Placement } from "./pose";
import "./tryon.css";

// Ordre des calques : le bas, puis les chaussures, puis le haut qui retombe dessus, puis l'accessoire.
const LAYERS: Slot[] = ["bottom", "shoes", "top", "accessory"];

type Status = "intro" | "loading" | "ready" | "manual" | "error";

// L'essayage virtuel : la personne choisit une photo d'elle, l'IA repère ses épaules, ses hanches et
// ses chevilles, et y pose les pièces détourées de la tenue. Tout se passe sur l'appareil : la photo
// n'est jamais envoyée. C'est un aperçu, pas une simulation de taille : la page le dit clairement.
export function VirtualTryOn({ pieces }: { pieces: Partial<Record<Slot, StyleItem>> }) {
  const t = useTranslations("tryon");
  const [status, setStatus] = useState<Status>("intro");
  const [photo, setPhoto] = useState<string | null>(null);
  const [aspect, setAspect] = useState(4 / 3);
  const [garments, setGarments] = useState<Partial<Record<Slot, string>>>({});
  const [placements, setPlacements] = useState<Record<Slot, Placement> | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [scales, setScales] = useState<Partial<Record<Slot, number>>>({});
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ slot: Slot; x: number; y: number; left: number; top: number } | null>(null);
  const worn = SLOTS.filter((slot) => pieces[slot]?.imagePath);

  // Les pièces détourées sont préparées pendant que la personne choisit sa photo.
  useEffect(() => {
    let cancelled = false;
    for (const slot of worn) {
      const source = productImageUrl(pieces[slot]!.imagePath!);
      void cutoutUrl(source).then((cut) => {
        if (!cancelled) setGarments((current) => ({ ...current, [slot]: cut ?? source }));
      });
    }
    return () => {
      cancelled = true;
    };
    // La liste des pièces ne change pas pendant que la fenêtre est ouverte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La photo locale est libérée quand on en change ou qu'on ferme la fenêtre.
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo);
  }, [photo]);

  async function choose(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPhoto(url);
    setSelected(null);
    setScales({});
    setStatus("loading");
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      const ratio = image.naturalHeight / image.naturalWidth;
      setAspect(ratio);
      const pose = await detectPose(image);
      setPlacements(placeGarments(pose, ratio));
      setStatus(pose ? "ready" : "manual");
    } catch {
      // Modèle indisponible ou appareil trop ancien : on garde la photo, placement à la main.
      setPlacements(placeGarments(null, image.naturalHeight / (image.naturalWidth || 1)));
      setStatus("error");
    }
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, slot: Slot) {
    if (!placements) return;
    setSelected(slot);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { slot, x: event.clientX, y: event.clientY, left: placements[slot].left, top: placements[slot].top };
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    const box = stage.current?.getBoundingClientRect();
    if (!current || !box || !placements) return;
    const left = current.left + (event.clientX - current.x) / box.width;
    const top = current.top + (event.clientY - current.y) / box.height;
    setPlacements({ ...placements, [current.slot]: { ...placements[current.slot], left, top } });
  }

  const busy = status === "loading";

  return (
    <div className="vt">
      <p className="vt-disclaimer">
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
        <span>{t("privacy")}</span>
      </p>

      {!photo ? (
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
          {photo ? t("changePhoto") : t("choosePhoto")}
          <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(event) => void choose(event.target.files?.[0])} />
        </label>
        <label className="vt-btn">
          <Camera className="size-4" aria-hidden="true" />
          {t("takePhoto")}
          <input type="file" accept="image/*" capture="user" className="sr-only" disabled={busy} onChange={(event) => void choose(event.target.files?.[0])} />
        </label>
      </div>

      {photo ? (
        <>
          <p role="status" className="vt-status">
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t(`status.${status}`)}
          </p>
          <div ref={stage} className="vt-stage" style={{ aspectRatio: `1 / ${aspect}` } as CSSProperties}>
            {/* eslint-disable-next-line @next/next/no-img-element -- photo locale (blob:), jamais envoyée ni optimisée */}
            <img src={photo} alt={t("photoAlt")} className="vt-photo" />
            {placements && !busy
              ? LAYERS.filter((slot) => garments[slot]).map((slot) => {
                  const place = placements[slot];
                  const scale = scales[slot] ?? 1;
                  return (
                    <button
                      key={slot}
                      type="button"
                      className="vt-garment"
                      data-selected={selected === slot ? "" : undefined}
                      aria-label={t("movePiece", { piece: pieces[slot]!.title })}
                      style={{
                        left: `${(place.left + (place.width * (1 - scale)) / 2) * 100}%`,
                        top: `${place.top * 100}%`,
                        width: `${place.width * scale * 100}%`,
                        transform: `rotate(${place.rotate}deg)`,
                      }}
                      onPointerDown={(event) => startDrag(event, slot)}
                      onPointerMove={moveDrag}
                      onPointerUp={() => (drag.current = null)}
                      onClick={() => setSelected(slot)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- pièce détourée dans le navigateur (data:) */}
                      <img src={garments[slot]} alt="" draggable={false} />
                    </button>
                  );
                })
              : null}
          </div>

          {selected && placements ? (
            <div className="vt-adjust">
              <label htmlFor="vt-size" className="text-sm font-medium">
                {t("size", { piece: pieces[selected]!.title })}
              </label>
              <input
                id="vt-size"
                type="range"
                min={0.6}
                max={1.6}
                step={0.05}
                value={scales[selected] ?? 1}
                onChange={(event) => setScales({ ...scales, [selected]: Number(event.target.value) })}
              />
            </div>
          ) : null}

          {photo && status !== "loading" ? (
            <button
              type="button"
              className="vt-btn vt-btn--ghost"
              onClick={async () => {
                const image = new Image();
                image.src = photo;
                await image.decode().catch(() => undefined);
                setScales({});
                setSelected(null);
                setStatus("loading");
                const pose = await detectPose(image).catch(() => null);
                setPlacements(placeGarments(pose, aspect));
                setStatus(pose ? "ready" : "manual");
              }}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {t("reset")}
            </button>
          ) : null}
        </>
      ) : null}

      <p className="vt-warning">{t("warning")}</p>
    </div>
  );
}
