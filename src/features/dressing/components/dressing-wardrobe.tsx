"use client";

import { ArrowRight, X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { type CSSProperties, useEffect, useRef, useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/utils/price";
import type { DressingItem } from "../queries";
import { DressingHeart } from "./favorites";
import { Hanger } from "./hanger";
import "../wardrobe.css";

export type Rayon = "vetements" | "chaussures" | "accessoires" | "autres";
const RAYONS: Rayon[] = ["vetements", "chaussures", "accessoires", "autres"];

// La pièce ouverte et le rayon choisi vivent dans l'adresse (?piece=…&rayon=…) : en revenant d'une
// annonce, l'armoire se rouvre exactement là où on l'avait laissée.
const CHANGE = "vw:change";
const subscribeUrl = (callback: () => void) => {
  addEventListener("popstate", callback);
  addEventListener(CHANGE, callback);
  return () => {
    removeEventListener("popstate", callback);
    removeEventListener(CHANGE, callback);
  };
};
const readParam = (key: string) => () => new URLSearchParams(location.search).get(key);
const readPiece = readParam("piece");
const readRayon = readParam("rayon");
function writeParams(changes: Record<string, string | null>) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(changes)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  history.replaceState(history.state, "", url);
  dispatchEvent(new Event(CHANGE));
}

// L'ouverture en relief n'est jouée que sur un appareil assez puissant, sans « réduire les animations ».
// Ailleurs, les portes s'effacent simplement : même armoire, sans calcul 3D.
const noSubscribe = () => () => {};
const readDepth = () => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return "flat";
  const cores = navigator.hardwareConcurrency ?? 2;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  return cores >= 4 && memory >= 4 ? "3d" : "flat";
};

// L'armoire d'un dressing : les vêtements sur la tringle, les chaussures et les accessoires sur les
// étagères. Toucher une pièce ouvre sa fiche à côté, avec les autres pièces de la même personne.
export function DressingWardrobe({ name, items, rayons }: { name: string; items: DressingItem[]; rayons: Record<string, Rayon> }) {
  const t = useTranslations("dressing");
  const conditions = useTranslations("conditions");
  const locale = useLocale();
  const depth = useSyncExternalStore(noSubscribe, readDepth, () => "flat");
  const pieceId = useSyncExternalStore(subscribeUrl, readPiece, () => null);
  const rayonParam = useSyncExternalStore(subscribeUrl, readRayon, () => null);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  const counts = Object.fromEntries(RAYONS.map((rayon) => [rayon, items.filter((item) => rayons[item.id] === rayon).length])) as Record<Rayon, number>;
  const tabs = (["tout", ...RAYONS] as const).filter((tab) => tab === "tout" || counts[tab] > 0);
  const active = tabs.includes(rayonParam as (typeof tabs)[number]) ? (rayonParam as (typeof tabs)[number]) : "tout";
  const visible = active === "tout" ? items : items.filter((item) => rayons[item.id] === active);
  const hanging = visible.filter((item) => rayons[item.id] === "vetements" || rayons[item.id] === "autres");
  const shelved = visible.filter((item) => rayons[item.id] === "chaussures" || rayons[item.id] === "accessoires");
  const selected = items.find((item) => item.id === pieceId) ?? null;
  const others = selected ? items.filter((item) => item.id !== selected.id).slice(0, 8) : [];

  // À l'ouverture de la fiche, le focus y entre ; à la fermeture, il revient sur la pièce touchée.
  useEffect(() => {
    if (selected) panel.current?.focus();
  }, [selected]);

  const open = (item: DressingItem, button: HTMLButtonElement | null) => {
    opener.current = button;
    writeParams({ piece: item.id });
  };
  const close = () => {
    writeParams({ piece: null });
    opener.current?.focus();
  };

  const piece = (item: DressingItem, index: number) => (
    <li key={item.id} className="vw-piece" style={{ "--i": index } as CSSProperties}>
      <button
        type="button"
        className="vw-piece__button"
        aria-pressed={selected?.id === item.id}
        aria-label={t("wardrobeOpenPiece", { title: item.title, price: formatPrice(item.priceMillimes, locale) })}
        onClick={(event) => open(item, event.currentTarget)}
      >
        {rayons[item.id] === "vetements" || rayons[item.id] === "autres" ? <Hanger className="vw-piece__hanger" /> : null}
        <span className="vw-piece__photo">
          {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="9rem" className="object-cover" /> : <span className="vw-piece__empty" aria-hidden="true" />}
        </span>
        <span className="vw-piece__price">{formatPrice(item.priceMillimes, locale)}</span>
      </button>
    </li>
  );

  return (
    <section className="vw" data-depth={depth} aria-labelledby="vw-title">
      <div className="vw-head">
        <h2 id="vw-title" className="vw-head__title">{t("wardrobeTitle", { name })}</h2>
        <p className="vw-head__body">{t("wardrobeBody")}</p>
      </div>

      <div className="vw-stage">
        <div className="vw-cabinet">
          <span className="vw-door vw-door--start" aria-hidden="true" />
          <span className="vw-door vw-door--end" aria-hidden="true" />
          <div key={active} className="vw-inside">
            {hanging.length ? (
              <div className="vw-rail">
                <span className="vw-rail__rod" aria-hidden="true" />
                <ul className="vw-rail__pieces" aria-label={t("rayon.vetements")}>
                  {hanging.map(piece)}
                </ul>
              </div>
            ) : null}
            {shelved.length ? (
              <div className="vw-shelves">
                <ul className="vw-shelf" aria-label={`${t("rayon.chaussures")}, ${t("rayon.accessoires")}`}>
                  {shelved.map(piece)}
                </ul>
              </div>
            ) : null}
            {!hanging.length && !shelved.length ? <p className="vw-empty">{t("wardrobeEmpty")}</p> : null}
          </div>
        </div>

        {selected ? (
          <div ref={panel} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby="vw-panel-title" className="vw-panel" onKeyDown={(event) => event.key === "Escape" && close()}>
            <div className="vw-panel__head">
              <p className="vw-panel__kicker">{t("wardrobePanelKicker")}</p>
              <button type="button" className="vw-panel__close" aria-label={t("wardrobeClose")} onClick={close}>
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="vw-panel__piece">
              <span className="vw-panel__photo">
                {selected.imageUrl ? <Image src={selected.imageUrl} alt={selected.title} fill sizes="12rem" className="object-cover" /> : null}
                <span className="absolute end-2 top-2">
                  <DressingHeart listingId={selected.id} title={selected.title} />
                </span>
              </span>
              <div className="min-w-0">
                <h3 id="vw-panel-title" className="vw-panel__title" dir="auto">{selected.title}</h3>
                <p className="vw-panel__price">{formatPrice(selected.priceMillimes, locale)}</p>
                <p className="vw-panel__meta">
                  {[conditions(selected.condition), selected.size && t("wardrobeSize", { size: selected.size }), selected.brand].filter(Boolean).join(" · ")}
                </p>
                {selected.reserved ? <p className="vw-panel__reserved">{t("wardrobeReserved")}</p> : null}
                <div className="vw-panel__actions">
                  <Link href={`/annonce/${selected.id}`} className="vw-panel__cta">
                    {t("wardrobeSee")} <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                  </Link>
                  <Link href={`/annonce/${selected.id}#contact`} className="vw-panel__ghost">{t("wardrobeOffer")}</Link>
                </div>
              </div>
            </div>
            {others.length ? (
              <>
                <p className="vw-panel__others-title">{t("wardrobeOthers", { name })}</p>
                <ul className="vw-panel__others">
                  {others.map((item) => (
                    <li key={item.id}>
                      <button type="button" className="vw-panel__other" aria-label={t("wardrobeOpenPiece", { title: item.title, price: formatPrice(item.priceMillimes, locale) })} onClick={(event) => open(item, event.currentTarget)}>
                        {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="5rem" className="object-cover" /> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {tabs.length > 2 ? (
        <div role="tablist" aria-label={t("wardrobeRayons")} className="vw-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active === tab}
              className="vw-tab"
              onClick={() => writeParams({ rayon: tab === "tout" ? null : tab })}
            >
              {t(`rayon.${tab}`)}
              <span className="vw-tab__count">{tab === "tout" ? items.length : counts[tab]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
