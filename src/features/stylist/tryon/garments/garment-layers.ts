// L'ordre dans lequel on s'habille : le bas, la robe, les chaussures, le haut (par-dessus le bas), la
// veste (par-dessus le haut), puis ce qu'on tient à la main. Les épaisseurs (garment-config.ts) font
// le reste : chaque couche passe au-dessus de la précédente, sans flotter.
import type { Slot } from "../../engine";

export const LAYER_ORDER: Slot[] = ["bottom", "dress", "shoes", "top", "outer", "accessory"];
