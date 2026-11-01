// N'accepte qu'un chemin interne : empêche les redirections ouvertes après connexion.
export function safeInternalPath(value: unknown, fallback = "/compte"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
