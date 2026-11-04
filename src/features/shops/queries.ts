import "server-only";
import { createClient } from "@/lib/supabase/server";

export type LocationOption = {
  id: number;
  nameFr: string;
  nameAr: string;
  cities: { id: number; nameFr: string; nameAr: string }[];
};

export async function getLocations(): Promise<LocationOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("governorates")
    .select("id, name_fr, name_ar, cities (id, name_fr, name_ar)")
    .eq("cities.is_active", true)
    .order("name_fr");

  if (error) throw error;

  return data.map((governorate) => ({
    id: governorate.id,
    nameFr: governorate.name_fr,
    nameAr: governorate.name_ar,
    cities: governorate.cities
      .map((city) => ({ id: city.id, nameFr: city.name_fr, nameAr: city.name_ar }))
      .sort((a, b) => a.nameFr.localeCompare(b.nameFr)),
  }));
}

const SHOP_COLUMNS =
  "id, slug, name, description, phone, status, review_note, logo_path, governorate_id, city_id, governorates (name_fr, name_ar), cities (name_fr, name_ar)";

export async function getMyShops(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_members")
    .select(`role, shops (${SHOP_COLUMNS})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.flatMap((membership) =>
    membership.shops ? [{ ...membership.shops, role: membership.role }] : [],
  );
}

export async function getShop(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function getShopStats(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shop_stats", { p_shop_id: shopId }).single();

  if (error) throw error;

  return data;
}


export async function getShopLogoUrl(path: string | null) {
  if (!path) return null;

  const supabase = await createClient();
  return supabase.storage.from("shop-assets").getPublicUrl(path).data.publicUrl;
}
