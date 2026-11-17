import { describe, expect, it } from "vitest";
import { categoryScope, subcategoriesOf } from "@/features/catalog/category-scope";

// L'arbre après la migration 20261116000001 : Baskets est rangée sous Sneakers.
const tree = [
  { id: "chaussures", slug: "chaussures", parentId: null },
  { id: "bottes", slug: "bottes", parentId: "chaussures" },
  { id: "sandales", slug: "sandales-claquettes", parentId: "chaussures" },
  { id: "sneakers", slug: "sneakers", parentId: null },
  { id: "baskets", slug: "baskets", parentId: "sneakers" },
  { id: "running", slug: "running-training", parentId: "sneakers" },
  { id: "hauts", slug: "hauts", parentId: null },
  { id: "t-shirts", slug: "t-shirts", parentId: "hauts" },
];

describe("portée d'un filtre de catégorie", () => {
  it("« Chaussures » inclut toujours les baskets, rangées sous Sneakers", () => {
    const scope = categoryScope(tree, "chaussures");
    expect(scope?.ids.sort()).toEqual(["baskets", "bottes", "chaussures", "running", "sandales", "sneakers"]);
  });

  it("« Sneakers » ne montre que ses sous-catégories", () => {
    expect(categoryScope(tree, "sneakers")?.ids.sort()).toEqual(["baskets", "running", "sneakers"]);
  });

  it("une sous-catégorie reste seule, et garde sa racine", () => {
    const scope = categoryScope(tree, "baskets");
    expect(scope?.ids).toEqual(["baskets"]);
    expect(scope?.root.slug).toBe("sneakers");
  });

  it("une racine sans inclusion ne change pas", () => {
    expect(categoryScope(tree, "hauts")?.ids.sort()).toEqual(["hauts", "t-shirts"]);
  });

  it("une catégorie inconnue ne renvoie rien", () => {
    expect(categoryScope(tree, "inconnue")).toBeNull();
  });

  it("sous « Chaussures », les choix proposés comprennent Sneakers et ses sous-catégories", () => {
    expect(subcategoriesOf(tree, tree[0]).map((category) => category.slug)).toEqual([
      "bottes",
      "sandales-claquettes",
      "sneakers",
      "baskets",
      "running-training",
    ]);
  });
});
