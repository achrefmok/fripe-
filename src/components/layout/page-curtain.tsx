"use client";

import { useState } from "react";
import { usePathname } from "@/i18n/navigation";

// Les espaces de travail enchaînent les tâches : pas de rideau.
const WORKSPACES = new Set(["vendeur", "admin"]);

// Friptex Luxe : quand on change de rubrique, un rideau de nuit portant « Friptex » se lève sur la
// nouvelle page. Il ne retarde pas la navigation, ne capte aucun clic et n'apparaît ni au premier
// chargement, ni pour un filtre, un onglet ou une page suivante dans la même rubrique.
export function PageCurtain() {
  const section = usePathname().split("/")[1] ?? "";
  const [previous, setPrevious] = useState(section);
  const [run, setRun] = useState(0);

  if (previous !== section) {
    setPrevious(section);
    setRun(run + 1);
  }

  if (!run || WORKSPACES.has(section)) return null;

  return (
    <div key={run} className="lx-curtain" aria-hidden="true">
      <span>Friptex</span>
    </div>
  );
}
