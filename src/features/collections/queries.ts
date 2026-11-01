import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { getReferences } from "@/features/catalog/queries";
import { createClient } from "@/lib/supabase/server";

export async function listShopCollections(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .select("id, name, description, is_published, collection_products (count)")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export async function getShopCollection(shopId: string, collectionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .select("id, name, description, is_published, collection_products (product_id)")
    .eq("id", collectionId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function listCollectionCandidates(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, title, publication_status")
    .eq("shop_id", shopId)
    .neq("publication_status", "archived")
    .neq("status", "sold")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) throw error;

  const references = await getReferences(data.map((product) => product.id));
  return data.map((product) => ({ ...product, reference: references.get(product.id) ?? "" }));
}

export async function listPublicShopCollections(shopId: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("collections")
    .select("id, name, collection_products (count)")
    .eq("shop_id", shopId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}
