import type { ProductCondition } from "./constants";

export type GarmentSuggestion = {
  title?: string;
  categorySlug?: string;
  brand?: string;
  color?: string;
  condition?: ProductCondition;
};

// Point d'extension pour une future reconnaissance automatique des vêtements.
export interface GarmentRecognizer {
  analyze(image: Uint8Array, mime: string): Promise<GarmentSuggestion | null>;
}

// Aucun modèle n'est branché : les brouillons restent vides et le vendeur les complète lui-même.
export function getGarmentRecognizer(): GarmentRecognizer | null {
  return null;
}
