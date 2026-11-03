"use client";

import { ArrowDown, DoorClosed, DoorOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Wordmark } from "@/components/layout/brand";
import { Link } from "@/i18n/navigation";
import { universeFor } from "../universes";
import { Garment } from "./garment";
import { useUniverse } from "./universe-context";

type Category = { id: string; slug: string; nameFr: string; nameAr: string };

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

function Door({ side }: { side: "left" | "right" }) {
  return (
    <div className={`armoire__door armoire__door--${side}`}>
      <div className="armoire__face armoire__face--front">
        <span className="armoire__panel" />
        <span className="armoire__handle" />
      </div>
      <div className="armoire__face armoire__face--back">{side === "left" ? <span className="armoire__mirror" /> : null}</div>
    </div>
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

// L'armoire s'ouvre à l'arrivée, une fois par visite, en CSS : rien n'attend JavaScript et les
// portes ne bloquent jamais un clic. Le bouton la referme et la rouvre à la demande.
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
  const [toggled, setToggled] = useState<"open" | "closed" | null>(null);
  const state = toggled ?? (opened ? "open" : "intro");
  const closed = state === "closed";
  const rods = [categories.slice(0, Math.ceil(categories.length / 2)), categories.slice(Math.ceil(categories.length / 2))];
  const doors = useRef<HTMLDivElement>(null);

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
        // Animation annulée (bouton pressé pendant l'ouverture) : l'état choisi par le visiteur prime.
      });

    return () => {
      cancelled = true;
    };
  }, [state]);

  return (
    <section className="dressing">
      <div className="mx-auto grid max-w-7xl items-center gap-x-12 gap-y-10 px-4 pt-8 pb-12 md:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:pt-12 lg:pb-16">
        <div>
          <h1 aria-label="FRIPE" className="dressing__title">
            <Wordmark className="inline-block" />
          </h1>
          <p className="mt-5 max-w-md font-display text-2xl leading-tight font-bold md:text-3xl">{t("tagline")}</p>
          <p className="mt-3 max-w-sm text-base leading-relaxed opacity-90">{t("heroLead")}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            {hasRunway ? (
              <a href="#defile" className="dressing__button dressing__button--solid">
                {t("heroRunway")}
                <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            ) : null}
            {categories.length ? (
              <button
                type="button"
                className="dressing__button"
                aria-controls="armoire-interieur"
                aria-expanded={!closed}
                onClick={() => setToggled(closed ? "open" : "closed")}
              >
                {closed ? <DoorOpen className="size-4" aria-hidden="true" /> : <DoorClosed className="size-4" aria-hidden="true" />}
                {closed ? t("heroOpen") : t("heroClose")}
              </button>
            ) : null}
          </div>
        </div>

        {categories.length ? (
          <div>
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
                <div ref={doors} className="armoire__doors" aria-hidden="true" dir="ltr">
                  <Door side="left" />
                  <Door side="right" />
                </div>
              </div>
              <div className="armoire__feet" aria-hidden="true" />
            </div>
            <p className="mt-6 text-center text-sm font-medium opacity-90">{t("heroHint")}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
