import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

const MIN_TOKEN_LENGTH = 32;

// Comparaison à empreintes égales : ni le contenu ni la longueur du jeton ne fuient.
export function isCourierAuthorized(header: string | null) {
  const token = process.env.COURIER_API_TOKEN;

  if (!token || token.length < MIN_TOKEN_LENGTH) return false;

  const hash = (value: string) => createHash("sha256").update(value).digest();

  return timingSafeEqual(hash(header ?? ""), hash(`Bearer ${token}`));
}
