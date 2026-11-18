"use client";

// Le mannequin choisi (femme ou homme) et sa morphologie, gardés pendant la session : la cabine et le
// rail de pièces s'en souviennent jusqu'à la fermeture de l'onglet.
import { useSyncExternalStore } from "react";
import type { Gender, Morph } from "./mannequin/mannequin-types";

export type MannequinChoice = { gender: Gender | null; morph: Morph };

const KEY = "fripe:mannequin";
const EVENT = "fripe:mannequin";
const EMPTY: MannequinChoice = { gender: null, morph: "standard" };
let cache: { raw: string | null; value: MannequinChoice } = { raw: null, value: EMPTY };

function read(): MannequinChoice {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    // Stockage indisponible (navigation privée stricte) : le choix vit le temps de la page.
    return memory;
  }
  if (raw === cache.raw) return cache.value;
  let value = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && (parsed.gender === "femme" || parsed.gender === "homme" || parsed.gender === null) && ["mince", "standard", "large"].includes(parsed.morph)) value = parsed;
  } catch {
    value = EMPTY;
  }
  cache = { raw, value };
  return value;
}

let memory: MannequinChoice = EMPTY;

export function setMannequinChoice(next: Partial<MannequinChoice>) {
  const value = { ...read(), ...next };
  memory = value;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Voir read().
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

export function useMannequinChoice() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
