import { z } from "zod";

// « Pour qui » : le filtre Femme, Homme, Enfant de la recherche. Il lit l'attribut « genre » déjà saisi
// par les vendeurs (catégories de mode, voir 20261108000001_mode_attributes.sql), avec la même règle
// que la cabine (suitsGender) : une pièce mixte convient à une femme comme à un homme, pas à un enfant.
export const AUDIENCES = ["femme", "homme", "enfant"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_ATTRIBUTE = "genre";

const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);

// Le paramètre « pour » de l'adresse : toute valeur inconnue est ignorée, jamais une erreur.
export const audienceParam = z.preprocess(firstValue, z.enum(AUDIENCES).optional().catch(undefined));

// Les valeurs de l'attribut « genre » retenues pour un public donné.
export function audienceValues(audience: Audience): string[] {
  return audience === "enfant" ? ["enfant"] : [audience, "mixte"];
}

// Filtre de requête PostgREST sur l'attribut JSON : attributes->>genre in (…).
export const AUDIENCE_COLUMN = `attributes->>${AUDIENCE_ATTRIBUTE}` as const;

export function matchesAudience(attributes: Record<string, unknown> | null | undefined, audience: Audience | undefined) {
  if (!audience) return true;
  const value = attributes?.[AUDIENCE_ATTRIBUTE];
  return typeof value === "string" && audienceValues(audience).includes(value);
}

// Le Vide-Dressing ne garde que le « Pour qui » parmi les caractéristiques : c'est la seule que la
// recherche y propose. La Marketplace garde toutes celles de sa catégorie.
export function sectionAttributes<T extends { key: string }>(section: "marketplace" | "vide_dressing", attributes: T[]): T[] {
  return section === "marketplace" ? attributes : attributes.filter((attribute) => attribute.key === AUDIENCE_ATTRIBUTE);
}

export function sectionAttributeValues(section: "marketplace" | "vide_dressing", values: Record<string, string>) {
  if (section === "marketplace") return values;
  const audience = values[AUDIENCE_ATTRIBUTE];
  return audience ? { [AUDIENCE_ATTRIBUTE]: audience } : {};
}
