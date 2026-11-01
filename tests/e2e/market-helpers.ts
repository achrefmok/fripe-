import { createClient } from "@supabase/supabase-js";
import { admin, createConfirmedUser, PASSWORD } from "./helpers";

export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

let counter = 0;

export function unique(prefix: string) {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

async function category(slug: string) {
  const { data } = await admin.from("categories").select("id").eq("slug", slug).single();
  return data!.id;
}

async function location(slug: string) {
  const { data } = await admin.from("cities").select("id, governorate_id").eq("slug", slug).single();
  return data!;
}

export async function createApprovedShop(citySlug = "la-marsa") {
  const owner = await createConfirmedUser("vendeur", "Vendeur Test");
  const city = await location(citySlug);
  const slug = unique("boutique-");

  const { data: shop, error } = await admin
    .from("shops")
    .insert({
      name: `Boutique ${slug}`,
      slug,
      governorate_id: city.governorate_id,
      city_id: city.id,
      status: "approved",
    })
    .select("id, name, slug")
    .single();

  if (error) throw error;

  await admin.from("shop_members").insert({ shop_id: shop.id, user_id: owner.id, role: "owner" });

  return { ...shop, owner };
}

export async function seedProduct(
  shopId: string,
  overrides: {
    title?: string;
    price?: number;
    brand?: string;
    size?: string;
    categorySlug?: string;
    condition?: "good" | "very_good" | "like_new";
  } = {},
) {
  const title = overrides.title ?? `Piece ${unique("x")}`;

  const { data, error } = await admin
    .from("products")
    .insert({
      shop_id: shopId,
      reference: "",
      title,
      price_millimes: overrides.price ?? 30000,
      brand: overrides.brand,
      size: overrides.size,
      condition: overrides.condition ?? "good",
      category_id: await category(overrides.categorySlug ?? "jeans"),
      publication_status: "published",
      published_at: new Date().toISOString(),
    })
    .select("id, title")
    .single();

  if (error) throw error;

  await admin.from("product_images").insert({ product_id: data.id, path: `${shopId}/${data.id}/test.png` });

  return data;
}

export async function clientFor(email: string) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;

  return client;
}

export async function productStatus(productId: string) {
  const { data } = await admin.from("products").select("status").eq("id", productId).single();
  return data!.status;
}
