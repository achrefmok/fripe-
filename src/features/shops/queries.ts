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

export type ShopLocation = {
  addressLine: string;
  governorateId: number;
  cityId: number;
  governorate: { name_fr: string; name_ar: string } | null;
  city: { name_fr: string; name_ar: string } | null;
  coordinates: { latitude: number; longitude: number } | null;
};

// L'adresse principale d'une boutique (lisible par tous tant que la boutique est visible : RLS).
export async function getShopLocation(shopId: string): Promise<ShopLocation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_addresses")
    .select("address_line, governorate_id, city_id, latitude, longitude, governorates (name_fr, name_ar), cities (name_fr, name_ar)")
    .eq("shop_id", shopId)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const latitude = data.latitude === null ? null : Number(data.latitude);
  const longitude = data.longitude === null ? null : Number(data.longitude);
  return {
    addressLine: data.address_line,
    governorateId: data.governorate_id,
    cityId: data.city_id,
    governorate: data.governorates,
    city: data.cities,
    coordinates: latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null,
  };
}
