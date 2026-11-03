"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type UniverseState = {
  selected: string | null;
  select: (slug: string, options?: { reveal?: boolean }) => void;
};

const UniverseContext = createContext<UniverseState | null>(null);

export const SHOWCASE_ID = "univers";

// Le dressing et la vitrine des univers partagent la catégorie choisie : toucher un vêtement
// dans l'armoire ouvre son univers plus bas, sans quitter l'accueil.
export function UniverseProvider({ initial, children }: { initial: string | null; children: ReactNode }) {
  const [selected, setSelected] = useState(initial);

  const select = useCallback((slug: string, options?: { reveal?: boolean }) => {
    setSelected(slug);
    if (!options?.reveal) return;

    const showcase = document.getElementById(SHOWCASE_ID);
    if (!showcase) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    showcase.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    // Le focus suit le regard, pour le clavier et les lecteurs d'écran.
    window.requestAnimationFrame(() => {
      document.getElementById(`univers-onglet-${slug}`)?.focus({ preventScroll: true });
    });
  }, []);

  const value = useMemo(() => ({ selected, select }), [selected, select]);

  return <UniverseContext.Provider value={value}>{children}</UniverseContext.Provider>;
}

export function useUniverse() {
  const context = useContext(UniverseContext);
  if (!context) throw new Error("useUniverse doit être utilisé dans UniverseProvider.");
  return context;
}
