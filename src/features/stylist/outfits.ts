import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Slot, StyleItem } from "./engine";
import { getStyleCatalog } from "./queries";

export async function listMyOutfits(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outfits")
    .select("id, name, is_public, created_at, outfit_items (slot)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export async function getOutfit(outfitId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outfits")
    .select(
      "id, user_id, name, budget_millimes, is_public, outfit_items (slot, product_id, products (id, title, price_millimes))",
    )
    .eq("id", outfitId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const available = await getStyleCatalog({ ids: data.outfit_items.map((item) => item.product_id) });

  const items = data.outfit_items.flatMap((row) => {
    const item = available.find((candidate) => candidate.id === row.product_id);
    if (!item) return [];
    // Avant les cases « veste » et « robe », ces pièces étaient rangées dans « haut » : elles retrouvent leur case.
    const legacy = row.slot === "top" && (item.slot === "outer" || item.slot === "dress");
    return [{ ...item, slot: legacy ? item.slot : (row.slot as Slot) }];
  });

  const missing = data.outfit_items
    .filter((row) => !available.some((candidate) => candidate.id === row.product_id))
    .map((row) => ({ slot: row.slot, title: row.products?.title ?? "" }));

  return { ...data, items: items as StyleItem[], missing };
}
