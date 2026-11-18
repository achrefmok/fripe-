"use client";

import { Camera, Download, Eye, EyeOff, LoaderCircle, Minus, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";
import { outfitTotal, SLOTS, type Slot, type StyleItem } from "../engine";
import type { Adjust } from "./garments/garment-fitting";
import { type Body, dressBody, getBody, prepareGarment, wornBy } from "./mannequin";
import { type MannequinChoice, setMannequinChoice } from "./mannequin-choice";
import { MORPHS } from "./mannequin/mannequin-types";
import { createFittingScene, type FittingScene } from "./scene/fitting-scene";
import type { View } from "./scene/camera";

const NONE: Adjust = { scale: 1, dy: 0 };

function lowPowerDevice() {
  const navigatorInfo = navigator as Navigator & { deviceMemory?: number };
  return (navigatorInfo.deviceMemory ?? 8) < 4 || (navigator.hardwareConcurrency ?? 8) < 4;
}

// La cabine 3D : le mannequin choisi, habillé des pièces de la tenue, que l'on tourne (±40°), zoome,
// et dont on ajuste chaque pièce. Les vraies pièces, avec leur prix, leur taille et leur boutique.
export function FittingStage({
  pieces,
  cutouts,
  choice,
  onPhoto,
}: {
  pieces: Partial<Record<Slot, StyleItem>>;
  cutouts: Partial<Record<Slot, HTMLCanvasElement>>;
  choice: MannequinChoice & { gender: NonNullable<MannequinChoice["gender"]> };
  onPhoto: () => void;
}) {
  const t = useTranslations("tryon");
  const outfits = useTranslations("outfits");
  const locale = useLocale();
  const holder = useRef<HTMLDivElement>(null);
  const label = useRef(t("mannequinAlt"));
  const scene = useRef<FittingScene | null>(null);
  const [body, setBody] = useState<Body | null>(null);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState<Slot[]>([]);
  const [adjusts, setAdjusts] = useState<Partial<Record<Slot, Adjust>>>({});
  const [selected, setSelected] = useState<Slot | null>(null);

  // Les pièces détourées, prêtes pour la 3D ; leurs textures sont libérées quand elles changent.
  const prepared = useMemo(
    () => SLOTS.flatMap((slot) => (pieces[slot] && cutouts[slot] ? [prepareGarment(slot, pieces[slot], cutouts[slot])] : [])),
    [pieces, cutouts],
  );
  useEffect(() => () => prepared.forEach((garment) => garment.texture.dispose()), [prepared]);
  const { worn, skipped } = wornBy(choice.gender, prepared);

  useEffect(() => {
    const box = holder.current;
    if (!box) return;
    // Une toile neuve à chaque montage : un contexte WebGL libéré ne se réutilise pas.
    const element = document.createElement("canvas");
    element.className = "vt-viewport__canvas";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", label.current);
    box.prepend(element);
    let stage: FittingScene;
    try {
      stage = createFittingScene(element, { lowPower: lowPowerDevice() });
    } catch (error) {
      // Pas de WebGL : on le signale, et la photo reste proposée.
      console.error("Cabine 3D indisponible", error);
      element.remove();
      queueMicrotask(() => setFailed(true));
      return;
    }
    scene.current = stage;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width > 0) stage.resize(width, Math.round(width * 1.3));
    });
    observer.observe(box);
    return () => {
      observer.disconnect();
      stage.dispose();
      element.remove();
      scene.current = null;
    };
  }, []);

  // Le mannequin se construit hors du rendu en cours : l'interface affiche d'abord l'indicateur.
  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      try {
        const next = getBody(choice.gender, choice.morph);
        if (!live) return;
        scene.current?.setBody(next.mannequin);
        setBody(next);
      } catch (error) {
        console.error("Mannequin 3D", error);
        if (live) setFailed(true);
      }
    }, 30);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [choice.gender, choice.morph]);

  useEffect(() => {
    if (!body || !scene.current) return;
    scene.current.setGarments(dressBody(body, worn.filter((garment) => !hidden.includes(garment.slot)), adjusts));
    // `worn` dérive de `prepared` et du mannequin choisi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, prepared, hidden, adjusts]);

  async function save() {
    const blob = await scene.current?.snapshot();
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "essayage-fripe.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  if (failed) {
    return (
      <div className="vt-intro">
        <p>{t("status.mannequinError")}</p>
        <button type="button" className="vt-btn vt-btn--primary" onClick={onPhoto}>
          <Camera className="size-4" aria-hidden="true" />
          {t("choosePhoto")}
        </button>
      </div>
    );
  }

  const listed = SLOTS.flatMap((slot) => (pieces[slot] ? [{ slot, item: pieces[slot] }] : []));
  const views: View[] = ["left", "front", "right"];
  const adjust = selected ? (adjusts[selected] ?? NONE) : NONE;
  const setAdjust = (patch: Partial<Adjust>) => selected && setAdjusts((all) => ({ ...all, [selected]: { ...(all[selected] ?? NONE), ...patch } }));

  return (
    <div className="vt-stage">
      <div className="vt-segments">
        <div className="vt-segment" role="radiogroup" aria-label={t("genderLabel")}>
          {(["femme", "homme"] as const).map((gender) => (
            <button key={gender} type="button" role="radio" aria-checked={choice.gender === gender} className="vt-segment__item" onClick={() => setMannequinChoice({ gender })}>
              {t(`gender.${gender}`)}
            </button>
          ))}
        </div>
        <div className="vt-segment" role="radiogroup" aria-label={t("morphLabel")}>
          {MORPHS.map((morph) => (
            <button key={morph} type="button" role="radio" aria-checked={choice.morph === morph} className="vt-segment__item" onClick={() => setMannequinChoice({ morph })}>
              {t(`morph.${morph}`)}
            </button>
          ))}
        </div>
      </div>

      <div ref={holder} className="vt-viewport">
        {!body ? (
          <p className="vt-viewport__busy" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {t("building")}
          </p>
        ) : null}
      </div>
      <div className="vt-viewport__tools">
        <div className="vt-toolgroup" role="group" aria-label={t("viewLabel")}>
          {views.map((view) => (
            <button key={view} type="button" className="vt-tool" onClick={() => scene.current?.view(view)}>
              {t(`view.${view}`)}
            </button>
          ))}
        </div>
        <div className="vt-toolgroup" role="group" aria-label={t("zoomLabel")}>
          <button type="button" className="vt-tool vt-tool--icon" aria-label={t("zoomOut")} onClick={() => scene.current?.zoom(1.15)}>
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <button type="button" className="vt-tool vt-tool--icon" aria-label={t("zoomIn")} onClick={() => scene.current?.zoom(0.85)}>
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="vt-hint">{t("rotateHint")}</p>

      {skipped.length ? (
        <p className="vt-note">{t("skipped", { pieces: new Intl.ListFormat(locale).format(skipped.map((garment) => garment.item.title)) })}</p>
      ) : null}

      <ul className="vt-pieces" aria-label={t("piecesLabel")}>
        {listed.map(({ slot, item }) => {
          const off = hidden.includes(slot);
          const preparing = !cutouts[slot];
          return (
            <li key={slot} className={cn("vt-piece", selected === slot && "is-selected", off && "is-off")}>
              <span className="vt-piece__photo">
                {item.imagePath ? <Image src={productImageUrl(item.imagePath)} alt="" fill sizes="3rem" className="object-cover" /> : null}
              </span>
              <span className="vt-piece__text">
                <span className="vt-piece__title">{item.title}</span>
                <span className="vt-piece__meta">
                  {outfits(`slots.${slot}`)} · {item.shopName}
                  {item.size ? ` · ${t("sizeLabel", { size: item.size })}` : ""}
                </span>
                <span className="vt-piece__meta">
                  <strong className="tabular-nums">{formatPrice(item.priceMillimes, locale)}</strong> · {t("available")}
                </span>
              </span>
              <span className="vt-piece__actions">
                {preparing ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label={t("preparing")} /> : null}
                <button
                  type="button"
                  className="vt-tool vt-tool--icon"
                  aria-pressed={selected === slot}
                  aria-label={t("adjustPiece", { piece: item.title })}
                  disabled={off || preparing}
                  onClick={() => setSelected(selected === slot ? null : slot)}
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="vt-tool vt-tool--icon"
                  aria-pressed={off}
                  aria-label={off ? t("showPiece", { piece: item.title }) : t("hidePiece", { piece: item.title })}
                  onClick={() => {
                    setHidden((all) => (off ? all.filter((other) => other !== slot) : [...all, slot]));
                    if (selected === slot) setSelected(null);
                  }}
                >
                  {off ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="vt-total">
        {t("total")} <strong className="tabular-nums">{formatPrice(outfitTotal(listed.map(({ item }) => item)), locale)}</strong>
      </p>

      {selected && pieces[selected] ? (
        <div className="vt-adjust">
          <label htmlFor="vt-scale" className="text-sm font-medium">
            {t("size", { piece: pieces[selected].title })}
          </label>
          <input id="vt-scale" type="range" min={0.85} max={1.15} step={0.01} value={adjust.scale} onChange={(event) => setAdjust({ scale: Number(event.target.value) })} />
          <label htmlFor="vt-height" className="text-sm font-medium">
            {t("heightAdjust")}
          </label>
          <input id="vt-height" type="range" min={-0.06} max={0.06} step={0.005} value={adjust.dy} onChange={(event) => setAdjust({ dy: Number(event.target.value) })} />
        </div>
      ) : null}

      <div className="vt-actions">
        <button
          type="button"
          className="vt-btn"
          onClick={() => {
            setAdjusts({});
            setHidden([]);
            setSelected(null);
            scene.current?.reset();
          }}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          {t("reset")}
        </button>
        <button type="button" className="vt-btn" onClick={() => void save()} disabled={!body}>
          <Download className="size-4" aria-hidden="true" />
          {t("save")}
        </button>
        <button type="button" className="vt-btn" onClick={onPhoto}>
          <Camera className="size-4" aria-hidden="true" />
          {t("onMyPhoto")}
        </button>
      </div>
      <p className="vt-warning">{t("mannequinWarning")}</p>
    </div>
  );
}
