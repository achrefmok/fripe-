"use client";

import { injectContentsquareScript } from "@contentsquare/tag-sdk";
import { useEffect } from "react";

// Une seule injection par chargement : en développement, React rejoue les effets deux fois.
let injected = false;

// Le tag Contentsquare (analyse des parcours), chargé dans le navigateur seulement, jamais au rendu serveur.
export function Contentsquare() {
  useEffect(() => {
    if (injected) return;
    injected = true;
    injectContentsquareScript({ clientId: "7e0d37ffe51e8" });
  }, []);

  return null;
}
