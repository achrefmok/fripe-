"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import { universeFor } from "../universes";
import { Garment } from "./garment";
import { useUniverse } from "./universe-context";

type Category = { id: string; slug: string; nameFr: string; nameAr: string };
type DoorState = "intro" | "open" | "closed";

const OPENED_KEY = "fripe-dressing-ouvert";

function subscribe() {
  return () => {};
}

function wasOpened() {
  try {
    return sessionStorage.getItem(OPENED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberOpened() {
  try {
    sessionStorage.setItem(OPENED_KEY, "1");
  } catch {
    // Navigation privée stricte : les portes s'ouvriront simplement à nouveau.
  }
}

// La porte est le seul bouton du dressing : on la touche pour ouvrir, on la touche pour refermer.
// La porte gauche porte le nom et l'état pour les lecteurs d'écran ; la droite fait le même geste
// à la souris et au doigt sans doubler l'annonce.
function Door({
  side,
  label,
  expanded,
  onToggle,
}: {
  side: "left" | "right";
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const primary = side === "left";

  return (
    <button
      type="button"
      className={`armoire__door armoire__door--${side}`}
      onClick={onToggle}
      aria-label={primary ? label : undefined}
      aria-expanded={primary ? expanded : undefined}
      aria-controls={primary ? "armoire-interieur" : undefined}
      aria-hidden={primary ? undefined : true}
      tabIndex={primary ? undefined : -1}
    >
      <span className="armoire__face armoire__face--front" aria-hidden="true">
        <span className="armoire__panel" />
        <span className="armoire__handle" />
      </span>
      <span className="armoire__face armoire__face--back" aria-hidden="true">
        {primary ? <span className="armoire__mirror" /> : null}
      </span>
    </button>
  );
}

function Hanging({ category, locale, closed }: { category: Category; locale: string; closed: boolean }) {
  const { select } = useUniverse();
  const universe = universeFor(category.slug);
  const name = locale === "ar" ? category.nameAr : category.nameFr;

  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    select(category.slug, { reveal: true });
  }

  return (
    <Link
      href={{ pathname: "/catalogue", query: { categorie: category.slug } }}
      className="armoire__item"
      onClick={open}
      tabIndex={closed ? -1 : undefined}
    >
      <Garment universe={universe} className="armoire__garment" />
      <span className="armoire__name">{name}</span>
    </Link>
  );
}

// L'accueil s'ouvre sur deux chemins, chiner ou vendre, et sur le dressing. L'armoire s'ouvre à
// l'arrivée, une fois par visite, en CSS : rien n'attend JavaScript.
export function DressingHero({
  categories,
  locale,
  hasRunway,
}: {
  categories: Category[];
  locale: string;
  hasRunway: boolean;
}) {
  const t = useTranslations("home");
  const opened = useSyncExternalStore(subscribe, wasOpened, () => false);
  const [toggled, setToggled] = useState<Exclude<DoorState, "intro"> | null>(null);
  const state: DoorState = toggled ?? (opened ? "open" : "intro");
  const closed = state === "closed";
  const rods = [categories.slice(0, Math.ceil(categories.length / 2)), categories.slice(Math.ceil(categories.length / 2))];
  const doors = useRef<HTMLDivElement>(null);
  const toggle = () => setToggled(closed ? "open" : "closed");

  // L'ouverture peut finir avant que JavaScript arrive, sur un téléphone lent : on lit l'état réel
  // de l'animation plutôt que d'attendre un événement déjà passé.
  useEffect(() => {
    if (state !== "intro" || !doors.current) return;

    let cancelled = false;
    const animations = doors.current.getAnimations({ subtree: true });

    Promise.all(animations.map((animation) => animation.finished))
      .then(() => {
        if (cancelled) return;
        rememberOpened();
        setToggled((current) => current ?? "open");
      })
      .catch(() => {
        // Animation annulée (porte touchée pendant l'ouverture) : le geste du visiteur prime.
      });

    return () => {
      cancelled = true;
    };
  }, [state]);

  return (
    <section className="dressing" aria-labelledby="accueil-titre">
      <div className="dressing__grid mx-auto max-w-7xl px-4 md:px-6">
        <div className="dressing__intro">
          <h1 id="accueil-titre" className="dressing__title">
            {t("tagline")}
          </h1>

          <nav aria-label={t("pathsLabel")} className="paths">
            <Link href="/catalogue" className="path path--chine">
              <span className="path__eyelet" aria-hidden="true" />
              <span className="path__name">{t("tagBuyTitle")}</span>
              <span className="path__body">{t("chineBody")}</span>
              <ArrowRight className="path__arrow rtl:-scale-x-100" aria-hidden="true" />
            </Link>
            <Link href="/vendre" className="path path--vends">
              <span className="path__eyelet" aria-hidden="true" />
              <span className="path__name">{t("tagSellTitle")}</span>
              <span className="path__body">{t("vendsBody")}</span>
              <ArrowRight className="path__arrow rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          </nav>
        </div>

        {categories.length ? (
          <div className="dressing__stage">
            <div className="armoire" data-state={state}>
              <div className="armoire__body">
                <nav id="armoire-interieur" aria-label={t("categoriesTitle")} className="armoire__inside" inert={closed}>
                  {rods.map((rod, rodIndex) => (
                    <div key={rodIndex} className="armoire__shelf">
                      <div className="armoire__rod" aria-hidden="true" />
                      <ul className="armoire__rack">
                        {rod.map((category, index) => (
                          <li key={category.id} style={{ "--i": rodIndex * 3 + index } as CSSProperties}>
                            <Hanging category={category} locale={locale} closed={closed} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </nav>
                <div ref={doors} className="armoire__doors" dir="ltr">
                  <Door side="left" label={closed ? t("heroOpen") : t("heroClose")} expanded={!closed} onToggle={toggle} />
                  <Door side="right" label={closed ? t("heroOpen") : t("heroClose")} expanded={!closed} onToggle={toggle} />
                </div>
              </div>
              <div className="armoire__feet" aria-hidden="true" />
            </div>
            <p className="dressing__hint">
              {closed ? t("heroHintClosed") : t("heroHintOpen")}
              {hasRunway ? (
                <a href="#defile" className="dressing__runway">
                  {t("heroRunway")}
                  <ArrowDown className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
