import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

const MIN_TOKEN_LENGTH = 32;

// Empreintes de même longueur : la comparaison ne révèle ni le contenu ni la taille du jeton.
export function isMaintenanceAuthorized(header: string | null) {
  const token = process.env.MAINTENANCE_TOKEN;

  if (!token || token.length < MIN_TOKEN_LENGTH) return false;

  const hash = (value: string) => createHash("sha256").update(value).digest();

  return timingSafeEqual(hash(header ?? ""), hash(`Bearer ${token}`));
}
