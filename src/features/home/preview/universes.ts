// Les univers de l'accueil : chacun regroupe des catégories racines réelles. Un univers n'est montré
// que si au moins une de ses racines existe et est active ; Sneakers, Livres et Enfants apparaissent
// donc dès que la migration 20261116000001 est appliquée, sans changer ce fichier.

export type UniverseKey = "mode" | "sneakers" | "maison" | "tech" | "sport" | "loisirs" | "enfants" | "accessoires";
export type UniverseIcon = "shirt" | "footprints" | "sofa" | "laptop" | "dumbbell" | "book" | "baby" | "watch";

export type UniverseDefinition = {
  key: UniverseKey;
  icon: UniverseIcon;
  // Où mènent la carte et ses puces : le catalogue des boutiques (mode) ou la Marketplace (objets).
  catalog: "/catalogue" | "/marketplace";
  roots: string[];
};

export const UNIVERSES: UniverseDefinition[] = [
  { key: "mode", icon: "shirt", catalog: "/catalogue", roots: ["hauts", "bas", "vestes-manteaux", "robes", "chaussures"] },
  { key: "sneakers", icon: "footprints", catalog: "/catalogue", roots: ["sneakers"] },
  { key: "maison", icon: "sofa", catalog: "/marketplace", roots: ["mobilier", "maison-decoration", "electromenager", "bricolage-jardinage"] },
  { key: "tech", icon: "laptop", catalog: "/marketplace", roots: ["informatique-electronique"] },
  { key: "sport", icon: "dumbbell", catalog: "/marketplace", roots: ["sport-loisirs", "velos-mobilite"] },
  { key: "loisirs", icon: "book", catalog: "/marketplace", roots: ["livres", "jeux-jouets"] },
  { key: "enfants", icon: "baby", catalog: "/marketplace", roots: ["enfants"] },
  { key: "accessoires", icon: "watch", catalog: "/catalogue", roots: ["accessoires"] },
];
