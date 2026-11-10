"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import { universeFor } from "../universes";
import { Garment } from "./garment";

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

// Une porte de l'arche : la face aux filets d'or, le dos au miroir. La porte gauche porte le nom et
// l'état pour les lecteurs d'écran ; la droite fait le même geste sans doubler l'annonce.
function Door({ side, label, expanded, onToggle }: { side: "left" | "right"; label: string; expanded: boolean; onToggle: () => void }) {
  const primary = side === "left";

  return (
    <button
      type="button"
      className={`arch__door arch__door--${side}`}
      onClick={onToggle}
      aria-label={primary ? label : undefined}
      aria-expanded={primary ? expanded : undefined}
      aria-controls={primary ? "armoire-interieur" : undefined}
      aria-hidden={primary ? undefined : true}
      tabIndex={primary ? undefined : -1}
    >
      <span className="arch__face arch__face--front" aria-hidden="true">
        <span className="arch__trim" />
        <span className="arch__hinge" />
        <span className="arch__knob" />
      </span>
      <span className="arch__face arch__face--back" aria-hidden="true">
        {primary ? <span className="arch__mirror" /> : null}
      </span>
    </button>
  );
}

// Le haut de l'accueil : la nuit, l'or, la phrase, les deux chemins et le dressing en arche tunisienne.
export function DressingHero({ categories, locale }: { categories: Category[]; locale: string }) {
  const t = useTranslations("home");
  const opened = useSyncExternalStore(subscribe, wasOpened, () => false);
  const [toggled, setToggled] = useState<Exclude<DoorState, "intro"> | null>(null);
  const state: DoorState = toggled ?? (opened ? "open" : "intro");
  const closed = state === "closed";
  const rods = [categories.slice(0, 3), categories.slice(3, 6)];
  const doors = useRef<HTMLDivElement>(null);
  const toggle = () => setToggled(closed ? "open" : "closed");

  // L'ouverture peut finir avant que JavaScript arrive : on lit l'état réel de l'animation.
  useEffect(() => {
    if (state !== "intro" || !doors.current) return;

    let cancelled = false;
    Promise.all(doors.current.getAnimations({ subtree: true }).map((animation) => animation.finished))
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

  // Le projecteur suit la souris ; l'arche se tourne légèrement vers elle.
  function follow(event: MouseEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${((event.clientX - box.left) / box.width) * 100}%`);
    event.currentTarget.style.setProperty("--my", `${((event.clientY - box.top) / box.height) * 100}%`);
    event.currentTarget.style.setProperty("--tilt", `${((event.clientX - box.left) / box.width - 0.5) * 14}deg`);
  }

  return (
    <section className="lx-hero" onMouseMove={follow} aria-labelledby="accueil-titre">
      <div className="lx-hero__inner">
        <div className="lx-hero__intro">
          <span className="lx-hero__kicker">{t("heroKicker")}</span>
          <h1 id="accueil-titre" className="lx-hero__title">
            {t.rich("heroTitle", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
          <p className="lx-hero__lead">{t("heroLead")}</p>
          <nav aria-label={t("pathsLabel")} className="flex flex-wrap gap-3 pt-1.5">
            <Link href="/catalogue" className="lx-tag lx-tag--gold">{t("chine")}</Link>
            <Link href="/vendre" className="lx-tag lx-tag--cream">{t("vends")}</Link>
          </nav>
        </div>

        {categories.length ? (
          <div className="lx-hero__stage">
            <div className="arch" data-state={state}>
              <div className="arch__frame">
                <nav id="armoire-interieur" aria-label={t("categoriesTitle")} className="arch__inside" inert={closed}>
                  <span className="arch__light" aria-hidden="true" />
                  {rods.map((rod, rodIndex) => (
                    <div key={rodIndex} className="arch__shelf">
                      <span className="arch__rod" aria-hidden="true" />
                      <ul className="arch__rack">
                        {rod.map((category, index) => (
                          <li key={category.id} style={{ "--i": rodIndex * 3 + index } as CSSProperties}>
                            <Link href={{ pathname: "/catalogue", query: { categorie: category.slug } }} className="arch__item" tabIndex={closed ? -1 : undefined}>
                              <Garment universe={universeFor(category.slug)} className="arch__garment" />
                              <span className="arch__name">{locale === "ar" ? category.nameAr : category.nameFr}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </nav>
                <div ref={doors} className="arch__doors" dir="ltr">
                  <Door side="left" label={closed ? t("heroOpen") : t("heroClose")} expanded={!closed} onToggle={toggle} />
                  <Door side="right" label={closed ? t("heroOpen") : t("heroClose")} expanded={!closed} onToggle={toggle} />
                </div>
              </div>
              <span className="arch__feet" aria-hidden="true">
                <span />
                <span />
              </span>
            </div>
            <p className="lx-hero__hint">{closed ? t("heroHintClosed") : t("heroHintOpen")}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
