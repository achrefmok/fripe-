// Les trois rubriques de FRIPE et la règle qui dit laquelle est ouverte. Sans dépendance au
// navigateur : testé tel quel (tests/unit/navigation.test.ts).
export const UNIVERSES = [
  { key: "marketplace", href: "/marketplace", prefixes: ["/marketplace"] },
  { key: "mode", href: "/catalogue", prefixes: ["/catalogue", "/produit"] },
  { key: "videDressing", href: "/vide-dressing", prefixes: ["/vide-dressing"] },
] as const;

export type UniverseKey = (typeof UNIVERSES)[number]["key"];

export function activeUniverse(pathname: string): UniverseKey | null {
  const found = UNIVERSES.find(({ prefixes }) =>
    prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
  return found?.key ?? null;
}
