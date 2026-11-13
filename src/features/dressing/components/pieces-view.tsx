"use client";

import { GalleryVerticalEnd, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

type View = "grid" | "rack";
const KEY = "vd:view";
const listeners = new Set<() => void>();
let chosen: View | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readView(): View {
  if (chosen) return chosen;
  try {
    return localStorage.getItem(KEY) === "rack" ? "rack" : "grid";
  } catch {
    return "grid";
  }
}

function writeView(view: View) {
  chosen = view;
  try {
    localStorage.setItem(KEY, view);
  } catch {
    // Navigation privée stricte : le choix vaut pour cette page seulement.
  }
  for (const listener of listeners) listener();
}

// Grille ou portant : les mêmes cartes, rangées autrement. Le choix suit la personne d'une visite à
// l'autre ; le changement passe par une transition de vue quand le navigateur la connaît.
export function PiecesView({ children }: { children: ReactNode }) {
  const t = useTranslations("dressing");
  const view = useSyncExternalStore(subscribe, readView, () => "grid" as View);

  function choose(next: View) {
    if (next === view) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const swap = () => writeView(next);
    if (!reduced && "startViewTransition" in document) (document as Document & { startViewTransition: (run: () => void) => unknown }).startViewTransition(swap);
    else swap();
  }

  return (
    <div className="vd-pieces" data-view={view}>
      <div className="vd-view" role="group" aria-label={t("viewLabel")}>
        <button type="button" className="vd-view__option" aria-pressed={view === "grid"} onClick={() => choose("grid")}>
          <LayoutGrid className="size-4" aria-hidden="true" />
          {t("viewGrid")}
        </button>
        <button type="button" className="vd-view__option" aria-pressed={view === "rack"} onClick={() => choose("rack")}>
          <GalleryVerticalEnd className="size-4" aria-hidden="true" />
          {t("viewRack")}
        </button>
      </div>
      {children}
    </div>
  );
}
