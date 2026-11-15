"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import type { GarmentShape, LandingData, LandingPiece } from "../data";
import "../landing.css";

const RackFilm = dynamic(() => import("./rack-film").then((module) => module.RackFilm), { ssr: false });

const INTRO_KEY = "ld:intro";
const noSubscribe = () => () => {};
const subscribeMotion = (callback: () => void) => {
  const query = matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const readMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const readIntroSeen = () => {
  try {
    return sessionStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

// Les silhouettes de secours, quand une pièce n'a pas encore de photo.
function GarmentSymbols() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <symbol id="ld-g-hook" viewBox="0 0 158 200">
          <path d="M75 6c0-5 8-5 8 0 0 4-4 5-4 9v7" fill="none" stroke="#cca45e" strokeWidth="3" strokeLinecap="round" />
          <path d="M79 22 20 48h118z" fill="none" stroke="#cca45e" strokeWidth="3" strokeLinejoin="round" />
        </symbol>
        <symbol id="ld-g-tee" viewBox="0 0 158 200"><path fill="currentColor" d="M50 44 22 56 10 92l24 8 8-20v110h74V80l8 20 24-8-12-36-28-12c-4 10-14 16-29 16s-25-6-29-16z" /></symbol>
        <symbol id="ld-g-dress" viewBox="0 0 158 200"><path fill="currentColor" d="M58 44h42l-4 24c6 6 10 14 10 22l30 100H22L52 90c0-8 4-16 10-22z" /></symbol>
        <symbol id="ld-g-jacket" viewBox="0 0 158 200"><path fill="currentColor" d="M48 44 18 58 6 170l26 4 10-80v100h76V94l10 80 26-4-12-112-30-14-31 52z" /></symbol>
        <symbol id="ld-g-sweat" viewBox="0 0 158 200"><path fill="currentColor" d="M52 44 20 58 8 150l22 6 12-60v94h76V96l12 60 22-6-12-92-32-14c-4 8-14 12-28 12s-24-4-28-12z" /></symbol>
        <symbol id="ld-g-skirt" viewBox="0 0 158 200"><path fill="currentColor" d="M52 52h56l6 16 26 112H20L46 68z" /></symbol>
        <symbol id="ld-g-bag" viewBox="0 0 158 200"><path fill="none" stroke="currentColor" strokeWidth="9" d="M52 92c0-36 54-36 54 0" /><path fill="currentColor" d="M26 90h106l12 96H14z" /></symbol>
        <symbol id="ld-g-cap" viewBox="0 0 158 200"><path fill="currentColor" d="M34 128c0-38 22-56 50-56s50 18 50 56zM14 128h124v8c0 6-6 10-14 10H24c-6 0-10-4-10-10z" /></symbol>
        <symbol id="ld-g-shoe" viewBox="0 0 158 200"><path fill="currentColor" d="M14 152c30 0 52-30 72-42 10 20 32 30 56 30v22H88c-22 0-44 10-74 10zM130 160l4 34h8l-1-34z" /></symbol>
        <symbol id="ld-g-belt" viewBox="0 0 158 200"><path fill="currentColor" d="M8 92h142v18H8z" /><path fill="none" stroke="#cca45e" strokeWidth="6" d="M40 86h30v30H40z" /></symbol>
      </defs>
    </svg>
  );
}

function Garment({ shape, color, hook, className, width }: { shape: GarmentShape; color: string; hook?: boolean; className?: string; width?: number }) {
  return (
    <svg viewBox="0 0 158 200" width={width} className={className} style={{ color }} aria-hidden="true">
      {hook ? <use href="#ld-g-hook" /> : null}
      <use href={`#ld-g-${shape}`} />
    </svg>
  );
}

// La photo de la pièce, ou sa silhouette sur un aplat de la même famille.
function PieceVisual({ piece, sizes }: { piece: LandingPiece; sizes: string }) {
  return piece.imageUrl ? (
    <Image src={piece.imageUrl} alt="" fill unoptimized sizes={sizes} className="object-cover" />
  ) : (
    <span className="ld-ph" style={{ background: piece.tone.ground }}>
      <Garment shape={piece.garment} color={piece.tone.cloth} />
    </span>
  );
}

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M20 4c-3 0-5 2-5 4.5S17 12 20 13v4L4 30h32L20 17" fill="none" stroke="#cca45e" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Landing({ data }: { data: LandingData }) {
  const t = useTranslations("landing");
  const nav = useTranslations("nav");
  const footer = useTranslations("footer");
  const common = useTranslations("common");
  const locale = useLocale();
  const rtl = locale === "ar";
  const other = rtl ? { locale: "fr", label: "Français", dir: "ltr" as const } : { locale: "ar", label: "العربية", dir: "rtl" as const };

  const reduced = useSyncExternalStore(subscribeMotion, readMotion, () => false);
  const introSeen = useSyncExternalStore(noSubscribe, readIntroSeen, () => false);
  const [noGl, setNoGl] = useState(false);
  const [set, setSet] = useState<"buy" | "sell">("buy");
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const onUnsupported = useCallback(() => setNoGl(true), []);

  const em = (chunks: ReactNode) => <em>{chunks}</em>;
  const br = () => <br />;

  // L'ouverture ne se joue qu'une fois par visite.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(INTRO_KEY, "1");
      } catch {}
    }, 2600);
    return () => clearTimeout(timer);
  }, []);

  // Le défilement pilote le film, le téléphone et le manifeste ; tout est écrit directement dans le DOM
  // pour ne pas refaire le rendu de la page à chaque image.
  useEffect(() => {
    const page = root.current;
    if (!page) return;
    const $ = <T extends Element>(selector: string) => page.querySelector<T>(selector)!;
    const $$ = <T extends Element>(selector: string) => [...page.querySelectorAll<T>(selector)];
    const navBar = $<HTMLElement>(".ld-nav");
    const film = $<HTMLElement>(".ld-film");
    const chapters = $$<HTMLElement>(".ld-ch");
    const bars = $$<HTMLElement>(".ld-bar");
    const bar = $<HTMLElement>(".ld-progress i");
    const timecode = $<HTMLElement>(".ld-tc");
    const sceneLabel = $<HTMLElement>(".ld-scene");
    const cue = $<HTMLElement>(".ld-cue");
    const app = $<HTMLElement>(".ld-app");
    const feats = $$<HTMLElement>(".ld-feats li");
    const screens = $$<HTMLElement>(".ld-scr");
    const phone = $<HTMLElement>(".ld-phone");
    const manifesto = $<HTMLElement>(".ld-mani");
    const words = $$<HTMLElement>(".ld-mani .w");
    const scenes = [t("scene1"), t("scene2"), t("scene3")];
    const ranges = [
      [-0.1, 0, 0.26, 0.33],
      [0.33, 0.4, 0.6, 0.67],
      [0.67, 0.74, 1.1, 1.2],
    ];
    const sectionProgress = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return clamp(-box.top / (box.height - innerHeight));
    };
    let lastStep = -1;
    let frame = 0;

    const update = () => {
      frame = 0;
      navBar.classList.toggle("is-scrolled", scrollY > 30);
      const p = sectionProgress(film);
      progress.current = p;
      const wide = innerWidth > 760;
      chapters.forEach((chapter, index) => {
        const [a, b, d, e] = ranges[index];
        let opacity = p < a || p > e ? 0 : p < b ? (p - a) / (b - a) : p > d ? 1 - (p - d) / (e - d) : 1;
        if (index === 0 && p <= 0.01) opacity = 1;
        chapter.style.opacity = String(opacity);
        chapter.style.transform = `translateY(calc(${wide ? "-50%" : "0%"} + ${(1 - opacity) * 30}px))`;
        chapter.classList.toggle("is-on", opacity > 0.5);
        chapter.inert = opacity <= 0.5;
      });
      const height = Math.sin(Math.PI * clamp((p - 0.05) / 0.9)) * 7;
      bars.forEach((element) => (element.style.height = `${height}vh`));
      bar.style.width = `${p * 100}%`;
      const frames = Math.floor(p * 48 * 25);
      timecode.textContent = `00:00:${String(Math.floor(frames / 25)).padStart(2, "0")}:${String(frames % 25).padStart(2, "0")}`;
      sceneLabel.textContent = scenes[p < 0.33 ? 0 : p < 0.67 ? 1 : 2];
      cue.style.opacity = p > 0.03 ? "0" : "1";

      const q = sectionProgress(app);
      const step = Math.min(3, Math.floor(q * 4));
      if (step !== lastStep) {
        lastStep = step;
        feats.forEach((item, index) => item.classList.toggle("is-on", index === step));
        screens.forEach((screen, index) => {
          screen.classList.toggle("is-on", index === step);
          screen.classList.toggle("is-past", index < step);
        });
      }
      const turn = rtl ? -1 : 1;
      phone.style.setProperty("--ry", `${(-22 + q * 44) * turn}deg`);
      phone.style.setProperty("--rx", `${8 - q * 10}deg`);
      phone.style.setProperty("--rz", `${(3 - q * 6) * turn}deg`);

      const box = manifesto.getBoundingClientRect();
      const lit = Math.round(clamp((innerHeight * 0.85 - box.top) / (box.height + innerHeight * 0.35)) * words.length);
      words.forEach((word, index) => word.classList.toggle("is-lit", index < lit));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    update();

    // Apparition des blocs à l'entrée dans l'écran.
    const reveal = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          reveal.unobserve(entry.target);
        }),
      { threshold: 0.12 },
    );
    $$<HTMLElement>(".ld-rv").forEach((element, index) => {
      element.style.transitionDelay = `${(index % 3) * 90}ms`;
      reveal.observe(element);
    });

    // Cartes de l'univers : inclinaison et reflet qui suivent le pointeur.
    const cleanups: (() => void)[] = [];
    for (const card of $$<HTMLElement>(".ld-card")) {
      const move = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        const box = card.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width;
        const y = (event.clientY - box.top) / box.height;
        card.style.setProperty("--ry", `${(x - 0.5) * 10}deg`);
        card.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
        card.style.setProperty("--mx", `${x * 100}%`);
        card.style.setProperty("--my", `${y * 100}%`);
      };
      const leave = () => {
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--rx", "0deg");
      };
      card.addEventListener("pointermove", move);
      card.addEventListener("pointerleave", leave);
      cleanups.push(() => {
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerleave", leave);
      });
    }

    // Sur écran tactile, le rideau de la cabine s'ouvre quand la carte entre dans l'écran.
    const cabin = $<HTMLElement>(".ld-c2");
    const curtain = new IntersectionObserver(([entry]) => {
      if (matchMedia("(hover: none)").matches) cabin.classList.toggle("is-open", entry.isIntersecting);
    }, { threshold: 0.6 });
    curtain.observe(cabin);

    // L'étiquette qui suit la souris au-dessus des cartes.
    const label = $<HTMLElement>(".ld-cur");
    const follow = (event: PointerEvent) => {
      label.style.left = `${event.clientX}px`;
      label.style.top = `${event.clientY}px`;
    };
    addEventListener("pointermove", follow);
    for (const element of $$<HTMLElement>("[data-cur]")) {
      const enter = () => {
        label.textContent = element.dataset.cur ?? "";
        label.classList.add("is-on");
      };
      const exit = () => label.classList.remove("is-on");
      element.addEventListener("pointerenter", enter);
      element.addEventListener("pointerleave", exit);
      cleanups.push(() => {
        element.removeEventListener("pointerenter", enter);
        element.removeEventListener("pointerleave", exit);
      });
    }

    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      removeEventListener("pointermove", follow);
      reveal.disconnect();
      curtain.disconnect();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [rtl, t]);

  // Le mur a besoin d'assez de cartes pour boucler sans trou : on répète les pièces au besoin. Sans
  // pièce publiée (ou base injoignable), il montre les catégories, ou à défaut de simples silhouettes.
  const shapes = ["tee", "skirt", "jacket", "dress", "shoe", "bag"] as const;
  const cloths = ["#b25634", "#3d5a80", "#cca45e", "#c4566e", "#6b7b5e", "#b8925a"];
  const wallSource: LandingPiece[] = data.pieces.length
    ? data.pieces
    : (data.categories.length ? data.categories.slice(0, 6) : shapes.map(() => ({ slug: "", name: "" }))).map((category, index) => ({
        id: `categorie-${category.slug || index}`,
        title: category.name,
        meta: "",
        price: "",
        imageUrl: null,
        garment: shapes[index % 6],
        tone: { cloth: cloths[index % 6], ground: "#f2eadd" },
      }));
  const fill = (list: LandingPiece[], size: number) => (list.length ? Array.from({ length: Math.max(size, list.length) }, (_, index) => list[index % list.length]) : []);
  const wallRows = [fill(wallSource.slice(0, 7), 7), fill(wallSource.slice(7).length ? wallSource.slice(7) : wallSource, 7), fill([...wallSource].reverse(), 7)];
  const pieceHref = (piece: LandingPiece) => {
    if (!piece.id.startsWith("categorie-")) return `/produit/${piece.id}`;
    const slug = data.categories.length ? piece.id.slice(10) : "";
    return slug ? `/catalogue?categorie=${slug}` : "/catalogue";
  };
  const manifestoWords = t("maniText").split(" ");
  const steps = {
    buy: [1, 2, 3].map((n) => ({ title: t(`buy${n}Title`), body: t(`buy${n}Body`) })),
    sell: [1, 2, 3].map((n) => ({ title: t(`sell${n}Title`), body: t(`sell${n}Body`) })),
  };
  const stepIcons = {
    buy: [
      <Garment key="g" shape="dress" color="#b25634" width={34} />,
      <svg key="c" width="30" viewBox="0 0 24 24" fill="none" stroke="#120f0c" strokeWidth="1.8" aria-hidden="true"><path d="M4 3h16v18H4zM12 3v18" /></svg>,
      <svg key="r" width="30" viewBox="0 0 24 24" fill="none" stroke="#120f0c" strokeWidth="1.8" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>,
    ],
    sell: [
      <svg key="p" width="30" viewBox="0 0 24 24" fill="none" stroke="#120f0c" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></svg>,
      <svg key="h" width="34" viewBox="0 0 158 200" aria-hidden="true"><use href="#ld-g-hook" /></svg>,
      <svg key="l" width="30" viewBox="0 0 24 24" fill="none" stroke="#120f0c" strokeWidth="1.8" aria-hidden="true"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" /></svg>,
    ],
  };
  const features = [
    { title: t.rich("feat1Title", { em }), body: t("feat1Body"), href: data.shop ? `/boutique/${data.shop.slug}` : "/boutiques", link: t("feat1Link") },
    { title: t("feat2Title"), body: t("feat2Body"), href: "/compte/favoris", link: t("feat2Link") },
    { title: t("feat3Title"), body: t("feat3Body"), href: "/catalogue", link: t("feat3Link") },
    { title: t("feat4Title"), body: t("feat4Body"), href: "/compte/alertes", link: t("feat4Link") },
  ];
  // Sans pièce à montrer, le téléphone reprend les silhouettes du mur plutôt que d'afficher un écran vide.
  const phonePieces = data.searchPieces.length ? data.searchPieces : wallSource.slice(0, 6);
  const phoneFavorites = data.favorites.length ? data.favorites : wallSource.slice(0, 4);
  const tiles = (list: LandingPiece[]) =>
    list.map((piece, index) => (
      <span key={`${piece.id}-${index}`} className="ld-tile">
        <PieceVisual piece={piece} sizes="90px" />
      </span>
    ));

  return (
    <div ref={root} className="ld" data-intro={introSeen || reduced ? "skip" : "play"} data-nogl={noGl ? "" : undefined}>
      <GarmentSymbols />
      <a href="#ld-film" className="ld-skip">{common("skipToContent")}</a>

      <div className="ld-intro" aria-hidden="true">
        <div className="ld-intro__half ld-intro__half--top" />
        <div className="ld-intro__half ld-intro__half--bottom" />
        <div className="ld-intro__mark">
          <svg viewBox="0 0 110 90">
            <path d="M55 8c-6 0-10 4-10 9s4 8 10 10v8L8 76h94L55 35" fill="none" stroke="#cca45e" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div className="ld-intro__word" dir="ltr">FRIPE</div>
          <div className="ld-intro__sub">{t("introSub")}</div>
        </div>
      </div>

      <header className="ld-nav">
        <div className="ld-wrap ld-nav__in">
          <Link href="/" className="ld-logo" dir="ltr">
            <Mark className="ld-logo__mark" />
            FRIPE
          </Link>
          <nav className="ld-nav__links" aria-label={t("navLabel")}>
            <a href="#pepites">{t("navPieces")}</a>
            <a href="#comment">{t("navHow")}</a>
            <a href="#application">{t("navApp")}</a>
            <a href="#univers">{t("navUniverse")}</a>
          </nav>
          <div className="ld-nav__end">
            <Link href="/decouvrir" locale={other.locale} lang={other.locale} dir={other.dir} hrefLang={other.locale} className="ld-nav__lang">
              {other.label}
            </Link>
            <Link href="/" className="ld-btn ld-btn--gold ld-btn--sm">{t("navEnter")}</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="ld-film" id="ld-film" aria-label={t("filmLabel")}>
          <div className="ld-stage">
            {noGl ? null : <RackFilm progress={progress} heroImage={data.hero?.imageUrl ?? null} rtl={rtl} reduced={reduced} onUnsupported={onUnsupported} />}
            <div className="ld-scrim" />
            <div className="ld-bar ld-bar--top" />
            <div className="ld-bar ld-bar--bottom" />

            <div className="ld-ch is-on">
              <div className="ld-eyebrow">{t("ch1Kicker")}</div>
              <h1>
                <span className="ld-ln"><span>{t("ch1Line1")}</span></span>
                <span className="ld-ln"><span>{t("ch1Line2")}</span></span>
                <span className="ld-ln"><span>{t.rich("ch1Line3", { em })}</span></span>
              </h1>
              <p>{t("ch1Body")}</p>
              <div className="ld-ctas">
                <Link href="/catalogue" className="ld-btn ld-btn--gold"><span className="ld-dot" />{t("ctaBuy")}</Link>
                <Link href="/vendre" className="ld-btn ld-btn--cream"><span className="ld-dot" />{t("ctaSell")}</Link>
              </div>
            </div>
            <div className="ld-ch">
              <div className="ld-eyebrow">{t("ch2Kicker")}</div>
              <h2>{t.rich("ch2Title", { em, br })}</h2>
              <p>{t("ch2Body")}</p>
              <div className="ld-chips">
                {data.categories.map((category) => (
                  <Link key={category.slug} href={`/catalogue?categorie=${category.slug}`}>{category.name}</Link>
                ))}
              </div>
            </div>
            <div className="ld-ch">
              <div className="ld-eyebrow">{t("ch3Kicker")}</div>
              <h2>{t.rich("ch3Title", { em, br })}</h2>
              <p>{t("ch3Body")}</p>
              {data.hero ? (
                <Link href={`/produit/${data.hero.id}`} className="ld-pricetag">
                  <span>
                    <small>{[t("unique"), data.hero.meta].filter(Boolean).join(" · ")}</small>
                    <span dir="auto">{data.hero.title}</span>
                  </span>
                  <b>{data.hero.price}</b>
                </Link>
              ) : (
                <Link href="/catalogue" className="ld-btn ld-btn--gold">{t("ctaBuy")}</Link>
              )}
            </div>

            <div className="ld-cue" aria-hidden="true"><span>{t("scroll")}</span><i /></div>
            <div className="ld-hud ld-hud--start ld-scene" aria-hidden="true">{t("scene1")}</div>
            <div className="ld-hud ld-hud--end" aria-hidden="true"><span className="ld-rec" /><span className="ld-tc" dir="ltr">00:00:00:00</span></div>
            <div className="ld-progress" aria-hidden="true"><i /></div>
          </div>
        </section>

        <section className="ld-wallsec" id="pepites" aria-labelledby="ld-pepites-titre">
          <div className="ld-motif" />
          <div className="ld-wrap">
            <div className="ld-head ld-rv">
              <div className="ld-eyebrow">{t("wallKicker")}</div>
              <h2 id="ld-pepites-titre">{t.rich("wallTitle", { em })}</h2>
              <p>{t("wallBody")}</p>
            </div>
          </div>
          <div className="ld-wall">
            <div className="ld-wall__in" dir="ltr">
              {wallRows.map((row, rowIndex) => (
                <div key={rowIndex} className={`ld-row${rowIndex === 1 ? " ld-row--rev" : rowIndex === 2 ? " ld-row--slow" : ""}`}>
                  {[0, 1].map((copy) =>
                    row.map((piece, index) => (
                      <Link
                        key={`${copy}-${piece.id}-${index}`}
                        href={pieceHref(piece)}
                        className="ld-pc"
                        aria-hidden={copy === 1 || undefined}
                        tabIndex={copy === 1 || rowIndex > 0 ? -1 : undefined}
                        aria-label={piece.title ? undefined : t("wallCta")}
                      >
                        <span className="ld-pc__ph"><PieceVisual piece={piece} sizes="200px" /></span>
                        {piece.title || piece.price ? (
                          <span className="ld-pc__in" dir="auto">
                            {piece.price ? <span className="ld-pc__pr">{piece.price}</span> : null}
                            <small>{[piece.title, piece.meta].filter(Boolean).join(" · ")}</small>
                          </span>
                        ) : null}
                      </Link>
                    )),
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="ld-wrap ld-center">
            <Link href="/catalogue" className="ld-btn ld-btn--gold">{t("wallCta")} <span className="ld-arrow" aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className="ld-paper ld-sec" id="comment" aria-labelledby="ld-comment-titre">
          <div className="ld-wrap">
            <div className="ld-head ld-rv">
              <div className="ld-eyebrow ld-eyebrow--ink">{t("howKicker")}</div>
              <h2 id="ld-comment-titre">{t.rich("howTitle", { em })}</h2>
              <p>{t("howBody")}</p>
            </div>
            <div className="ld-switch ld-rv" role="tablist" aria-label={t("howKicker")} data-set={set}>
              <span className="ld-switch__pill" aria-hidden="true" />
              {(["buy", "sell"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`ld-tab-${key}`}
                  aria-selected={set === key}
                  aria-controls="ld-steps"
                  className={set === key ? "is-on" : undefined}
                  onClick={() => setSet(key)}
                >
                  {key === "buy" ? t("ctaBuy") : t("ctaSell")}
                </button>
              ))}
            </div>
            <div key={set} id="ld-steps" role="tabpanel" aria-labelledby={`ld-tab-${set}`} className="ld-steps">
              {steps[set].map((step, index) => (
                <div key={step.title} className="ld-step">
                  <div className="ld-step__n" aria-hidden="true">0{index + 1}</div>
                  <div className="ld-step__ic">{stepIcons[set][index]}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
            <div className="ld-steps__go">
              <Link href={set === "buy" ? "/catalogue" : "/vendre"} className="ld-btn ld-btn--ink">
                {set === "buy" ? t("howGoBuy") : t("howGoSell")} <span className="ld-arrow" aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="ld-app" id="application" aria-labelledby="ld-app-titre">
          <div className="ld-app__stage">
            <div>
              <div className="ld-eyebrow ld-app__kicker" id="ld-app-titre">{t("appKicker")}</div>
              <ul className="ld-feats">
                {features.map((feature, index) => (
                  <li key={feature.href} className={index === 0 ? "is-on" : undefined}>
                    <h3>{feature.title}</h3>
                    <p>{feature.body}</p>
                    <Link href={feature.href} className="ld-feats__go">{feature.link} <span className="ld-arrow" aria-hidden="true">→</span></Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="ld-phone-wrap" aria-hidden="true">
              <div className="ld-phone">
                <div className="ld-glare" />
                <div className="ld-screens">
                  <div className="ld-scr is-on">
                    {data.shop ? (
                      <>
                        <div className="ld-prof">
                          <div className="ld-av">{data.shop.name.charAt(0).toUpperCase()}</div>
                          <div>
                            <b dir="auto">{data.shop.name}</b>
                            <div className="ld-stats">
                              <span><b>{data.shop.count}</b>{t("phonePieces")}</span>
                              <span><b>{data.shop.city}</b>{t("phoneCity")}</span>
                            </div>
                          </div>
                        </div>
                        <div className="ld-follow">{t("phoneFollow")}</div>
                        <div className="ld-grid3">
                          {data.shop.previews.map((url) => (
                            <span key={url} className="ld-tile"><Image src={url} alt="" fill unoptimized sizes="90px" className="object-cover" /></span>
                          ))}
                          {tiles(phonePieces.slice(0, Math.max(0, 6 - data.shop.previews.length)))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="ld-scr__t">{t("phoneShopsTitle")}</div>
                        <div className="ld-grid3">{tiles(phonePieces)}</div>
                      </>
                    )}
                  </div>
                  <div className="ld-scr">
                    <div className="ld-scr__t">{t("phoneFavorites")}</div>
                    {phoneFavorites.map((piece) => (
                      <div key={piece.id} className="ld-fav">
                        <span className="ld-tile"><PieceVisual piece={piece} sizes="56px" /></span>
                        <div dir="auto">{piece.title}<br /><small>{piece.meta}</small></div>
                        <b>{piece.price}</b>
                      </div>
                    ))}
                  </div>
                  <div className="ld-scr">
                    <div className="ld-search">⌕ {t("phoneSearch")}</div>
                    <div className="ld-chipz">
                      {data.categories.map((category, index) => (
                        <span key={category.slug} className={index === 0 ? "is-on" : undefined}>{category.name}</span>
                      ))}
                    </div>
                    <div className="ld-grid2">{tiles(phonePieces)}</div>
                  </div>
                  <div className="ld-scr">
                    <div className="ld-scr__t">{t("phoneNotifications")}</div>
                    {data.notifications.length ? (
                      data.notifications.map((notification) => (
                        <div key={notification.href} className="ld-notif">
                          <i style={{ background: notification.kind === "walk" ? "#3d5a80" : "#b25634" }}>{notification.kind === "walk" ? "▶" : "✦"}</i>
                          <div>{notification.text}<small>{notification.when}</small></div>
                        </div>
                      ))
                    ) : (
                      <p className="ld-notif__empty">{t("phoneNoNotifications")}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ld-sec" id="univers" aria-labelledby="ld-univers-titre">
          <div className="ld-wrap">
            <div className="ld-head ld-rv">
              <div className="ld-eyebrow">{t("uniKicker")}</div>
              <h2 id="ld-univers-titre">{t.rich("uniTitle", { em })}</h2>
              <p>{t("uniBody")}</p>
            </div>
            <div className="ld-bento">
              <Link href="/chine" className="ld-card ld-c1 ld-rv" data-cur={t("c1Cur")}>
                <span className="ld-shine" />
                <span className="ld-minirack" aria-hidden="true">
                  {data.rackPhotos.length >= 2
                    ? data.rackPhotos.map((url) => (
                        <span key={url} className="ld-minirack__piece">
                          <svg viewBox="0 0 158 50" className="ld-minirack__hook"><use href="#ld-g-hook" /></svg>
                          <span className="ld-minirack__photo"><Image src={url} alt="" fill unoptimized sizes="110px" className="object-cover" /></span>
                        </span>
                      ))
                    : (["jacket", "dress", "tee", "sweat"] as const).map((shape, index) => (
                        <Garment key={shape} shape={shape} hook color={["#6b7b5e", "#b25634", "#f2eadd", "#3d5a80"][index]} className="ld-minirack__svg" />
                      ))}
                </span>
                <span className="ld-go" aria-hidden="true">↗</span>
                <span className="ld-eyebrow">{t("c1Kicker")}</span>
                <span className="ld-card__title">{t("c1Title")}</span>
                <span className="ld-card__body">{t("c1Body")}</span>
              </Link>
              <Link href="/tenues/nouvelle" className="ld-card ld-c2 ld-rv" data-cur={t("c2Cur")}>
                <span className="ld-shine" />
                <span className="ld-rod" />
                <span className="ld-cabin" aria-hidden="true">
                  <span className="ld-cabin__look">
                    {data.cabinPhotos.length === 2 ? (
                      data.cabinPhotos.map((url) => (
                        <span key={url} className="ld-cabin__photo"><Image src={url} alt="" fill unoptimized sizes="110px" className="object-cover" /></span>
                      ))
                    ) : (
                      <>
                        <Garment shape="jacket" color="#cca45e" width={90} />
                        <Garment shape="skirt" color="#f2eadd" width={80} />
                      </>
                    )}
                  </span>
                </span>
                <span className="ld-curtain ld-curtain--start" />
                <span className="ld-curtain ld-curtain--end" />
                <span className="ld-go" aria-hidden="true">↗</span>
                <span className="ld-eyebrow">{nav("outfitBuilder")}</span>
                <span className="ld-card__title">{t("c2Title")}</span>
                <span className="ld-card__body">{t("c2Body")}</span>
              </Link>
              <Link href="/walk" className="ld-card ld-c3 ld-rv" data-cur={t("c3Cur")}>
                <span className="ld-shine" />
                {data.walkThumb ? (
                  <span className="ld-c3__thumb" aria-hidden="true"><Image src={data.walkThumb} alt="" fill unoptimized sizes="(min-width: 960px) 33vw, 100vw" className="object-cover" /></span>
                ) : null}
                <span className="ld-play" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 20 20" className="rtl:-scale-x-100"><path d="M6 3l11 7-11 7z" fill="#f6f1e7" /></svg>
                </span>
                <span className="ld-go" aria-hidden="true">↗</span>
                <span className="ld-eyebrow" dir="ltr">Fripe Walk</span>
                <span className="ld-card__title">{t("c3Title")}</span>
                <span className="ld-card__body">{t("c3Body")}</span>
              </Link>
              <Link href="/vendre" className="ld-card ld-c4 ld-rv" data-cur={t("c4Cur")}>
                <span className="ld-shine" />
                <span className="ld-c4__big" aria-hidden="true">{t("c4Big")}</span>
                <span className="ld-go" aria-hidden="true">↗</span>
                <span className="ld-eyebrow">{nav("videDressing")}</span>
                <span className="ld-card__title">{t("c4Title")}</span>
                <span className="ld-card__body">{t("c4Body")}</span>
              </Link>
              <Link href="/boutiques" className="ld-card ld-c5 ld-rv" data-cur={t("c5Cur")}>
                <span className="ld-shine" />
                <span className="ld-stores" aria-hidden="true">
                  {data.shops.map((shop, index) => (
                    <i key={shop.slug} style={{ background: ["#b25634", "#120f0c", "#835a20", "#6b7b5e"][index % 4] }}>
                      {shop.logoUrl ? <Image src={shop.logoUrl} alt="" fill unoptimized sizes="44px" className="object-cover" /> : shop.initial}
                    </i>
                  ))}
                  <i style={{ background: "#3d5a80" }}>+</i>
                </span>
                <span className="ld-go" aria-hidden="true">↗</span>
                <span className="ld-eyebrow ld-eyebrow--ink">{nav("marketplace")}</span>
                <span className="ld-card__title">{t("c5Title")}</span>
                <span className="ld-card__body">{data.cities.length ? t("c5Body", { cities: new Intl.ListFormat(rtl ? "ar" : "fr", { type: "conjunction" }).format(data.cities) }) : t("c5BodyEmpty")}</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="ld-manifesto" aria-labelledby="ld-mani-titre">
          <div className="ld-motif" />
          <div className="ld-wrap ld-relative">
            <h2 className="ld-eyebrow ld-manifesto__kicker" id="ld-mani-titre">{t("maniKicker")}</h2>
            <p className="ld-mani">
              {manifestoWords.map((word, index) => (
                <span key={index}>
                  <span className="w">{word}</span>{index < manifestoWords.length - 1 ? " " : ""}
                </span>
              ))}
            </p>
            <div className="ld-values">
              {[1, 2, 3].map((n) => (
                <div key={n} className="ld-rv">
                  <h3>{t(`value${n}Title`)}</h3>
                  <p>{t(`value${n}Body`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="ld-wrap">
          <section className="ld-final ld-rv" aria-labelledby="ld-final-titre">
            <div className="ld-motif" />
            <Garment shape="tee" hook color="#f2eadd" className="ld-float ld-float--a" />
            <Garment shape="jacket" hook color="#120f0c" className="ld-float ld-float--b" />
            <h2 id="ld-final-titre">{t.rich("finalTitle", { em, br })}</h2>
            <p>{t("finalBody")}</p>
            <div className="ld-ctas ld-ctas--center">
              <Link href="/catalogue" className="ld-btn ld-btn--ink">{t("finalBuy")}</Link>
              <Link href="/vendre" className="ld-btn ld-btn--cream">{t("finalSell")}</Link>
            </div>
          </section>
        </div>
      </main>

      <footer className="ld-footer">
        <div className="ld-wrap">
          <div className="ld-fcols">
            <div>
              <Link href="/" className="ld-logo ld-logo--small" dir="ltr">FRIPE</Link>
              <p>{t("footTagline")}</p>
            </div>
            <nav aria-label={t("footBuy")}>
              <h2>{t("footBuy")}</h2>
              {data.categories.map((category) => (
                <Link key={category.slug} href={`/catalogue?categorie=${category.slug}`}>{category.name}</Link>
              ))}
            </nav>
            <nav aria-label={footer("explore")}>
              <h2 dir="ltr">FRIPE</h2>
              <Link href="/chine">{t("c1Title")}</Link>
              <Link href="/tenues/nouvelle">{nav("outfitBuilder")}</Link>
              <Link href="/walk">{nav("walk")}</Link>
              <Link href="/vide-dressing">{nav("videDressing")}</Link>
              <Link href="/marketplace">{nav("marketplace")}</Link>
            </nav>
            <nav aria-label={footer("help")}>
              <h2>{footer("help")}</h2>
              <Link href="/support">{footer("support")}</Link>
              <Link href="/cgu">{footer("terms")}</Link>
              <Link href="/confidentialite">{footer("privacy")}</Link>
              <Link href="/mentions-legales">{footer("legal")}</Link>
              <Link href="/decouvrir" locale={other.locale} lang={other.locale} dir={other.dir} hrefLang={other.locale}>{other.label}</Link>
            </nav>
          </div>
          <div className="ld-fbot">
            <span>© {data.year} <span dir="ltr">FRIPE</span> · {t("introSub")}</span>
            <span>{t("madeIn")}</span>
          </div>
        </div>
      </footer>
      <div className="ld-cur" aria-hidden="true" />
    </div>
  );
}
