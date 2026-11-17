// Ce que couvre un filtre de catégorie, dans le catalogue des boutiques, le Vide-Dressing et la
// Marketplace : la catégorie choisie et ses sous-catégories.
//
// Une racine peut en englober une autre. Depuis la migration 20261116000001, les baskets sont rangées
// dans l'univers Sneakers ; le filtre général « Chaussures » doit pourtant continuer à les montrer.

type ScopeCategory = { id: string; slug: string; parentId: string | null };

export const INCLUDED_ROOTS: Record<string, string[]> = {
  chaussures: ["sneakers"],
};

export function categoryScope<T extends ScopeCategory>(categories: T[], slug: string) {
  const selected = categories.find((category) => category.slug === slug);
  if (!selected) return null;

  const root = categories.find((category) => category.id === selected.parentId) ?? selected;
  // Une racine choisie entraîne les racines qu'elle englobe ; une sous-catégorie reste seule.
  const included = selected.parentId ? [] : categories.filter((category) => !category.parentId && (INCLUDED_ROOTS[selected.slug] ?? []).includes(category.slug));
  const parents = new Set([selected.id, ...included.map((category) => category.id)]);
  const ids = categories.filter((category) => parents.has(category.id) || (category.parentId !== null && parents.has(category.parentId))).map((category) => category.id);

  return { selected, root, included, ids };
}

// Les choix proposés sous une racine : ses sous-catégories, puis les racines qu'elle englobe et les
// leurs (sous « Chaussures » : Bottes, Sandales…, puis Sneakers, Baskets, Running…).
export function subcategoriesOf<T extends ScopeCategory>(categories: T[], root: T) {
  const included = categories.filter((category) => !category.parentId && (INCLUDED_ROOTS[root.slug] ?? []).includes(category.slug));
  return [
    ...categories.filter((category) => category.parentId === root.id),
    ...included.flatMap((other) => [other, ...categories.filter((category) => category.parentId === other.id)]),
  ];
}
