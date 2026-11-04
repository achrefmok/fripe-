// Données fictives de préproduction. Ne copie rien de la base locale. Relançable sans doublon.
// Usage : voir docs/staging-plan.md. FRIPE_ENV=staging et FRIPE_SEED_CONFIRM=<hôte Supabase> sont requis.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const output = process.env.FRIPE_SEED_OUT ?? ".staging-accounts.local.json";

if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY sont requis.");

const host = new URL(url).host;

if (process.env.FRIPE_ENV !== "staging") throw new Error("Refus : FRIPE_ENV doit valoir staging.");
if (process.env.FRIPE_SEED_CONFIRM !== host) throw new Error("Refus : FRIPE_SEED_CONFIRM doit reprendre l'hôte Supabase.");
if (/^(127\.0\.0\.1|localhost):54321$/.test(host)) throw new Error("Refus : la base locale n'est jamais une cible.");

const supabase = createClient(url, key, { auth: { persistSession: false } });

const ACCOUNTS = [
  ["admin", "admin.demo@example.com", "Admin Démo"],
  ["shopA", "boutique.a@example.com", "Vendeur Démo A"],
  ["shopB", "boutique.b@example.com", "Vendeur Démo B"],
  ["clientA", "client.a@example.com", "Client Démo A"],
  ["clientB", "client.b@example.com", "Client Démo B"],
];

const SHOPS = [
  { key: "shopA", slug: "demo-boutique-a", name: "Boutique Démo A", city: "la-marsa" },
  { key: "shopB", slug: "demo-boutique-b", name: "Boutique Démo B", city: "sfax-ville" },
];

// Huit pièces par boutique, réparties dans les rayons. Les photos sont des vêtements seuls, sans
// personne ni marque visible, sous licence Unsplash : voir scripts/seed-photos/SOURCES.md.
const PIECES = {
  shopA: [
    ["Jean brut démo", "jeans", "M", 25000, "good", "jean-brut"],
    ["Veste en cuir démo", "vestes-sport", "L", 85000, "very_good", "veste-cuir"],
    ["Chemise en jean démo", "chemises", "M", 22000, "like_new", "chemise-jean"],
    ["Sweat blanc démo", "pulls-sweats", "L", 28000, "good", "sweat-blanc"],
    ["Bottines en cuir démo", "bottes", "42", 65000, "very_good", "bottines-cuir"],
    ["Sac en osier démo", "sacs", "TU", 38000, "like_new", "sac-osier"],
    ["Casquette délavée démo", "casquettes-bonnets", "TU", 12000, "good", "casquette-grise"],
    ["Ceinture en cuir démo", "ceintures", "90", 15000, "very_good", "ceinture-cuir"],
  ],
  shopB: [
    ["Jean délavé démo", "jeans", "S", 30000, "good", "jeans-delaves"],
    ["T-shirt noir démo", "t-shirts", "M", 12000, "very_good", "tshirt-noir"],
    ["Poncho en crochet démo", "pulls-sweats", "TU", 35000, "like_new", "poncho-crochet"],
    ["Escarpins fleuris démo", "chaussures", "38", 45000, "very_good", "escarpins-fleuris"],
    ["Baskets colorées démo", "baskets", "41", 55000, "good", "baskets-couleurs"],
    ["Sac rose démo", "sacs", "TU", 32000, "like_new", "sac-rose"],
    ["Sac à fleurs démo", "sacs", "TU", 48000, "very_good", "sac-fleuri"],
    ["Casquette blanche démo", "casquettes-bonnets", "TU", 10000, "good", "casquette-blanche"],
  ],
};

// Chaque boutique présente un look, que l'accueil fait défiler.
const LOOK_SIZE = 3;

async function ensureAccounts() {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const ids = {};
  const created = existsSync(output) ? JSON.parse(readFileSync(output, "utf8")) : {};

  for (const [name, email, displayName] of ACCOUNTS) {
    const existing = data.users.find((user) => user.email === email);

    if (existing) {
      ids[name] = existing.id;
      continue;
    }

    const password = randomBytes(18).toString("base64url");
    const { data: user, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (createError) throw createError;

    ids[name] = user.user.id;
    created[name] = { email, password };
  }

  writeFileSync(output, JSON.stringify(created, null, 2), { mode: 0o600 });

  return ids;
}

async function ensureShop(shop, ownerId) {
  const { data: existing } = await supabase.from("shops").select("id").eq("slug", shop.slug).maybeSingle();
  if (existing) return existing.id;

  const { data: city, error: cityError } = await supabase
    .from("cities")
    .select("id, governorate_id")
    .eq("slug", shop.city)
    .single();

  if (cityError) throw cityError;

  const { data: created, error } = await supabase
    .from("shops")
    .insert({
      slug: shop.slug,
      name: shop.name,
      description: "Boutique fictive pour les tests. Aucune vente réelle.",
      governorate_id: city.governorate_id,
      city_id: city.id,
      status: "approved",
      approved_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;

  const { error: memberError } = await supabase
    .from("shop_members")
    .insert({ shop_id: created.id, user_id: ownerId, role: "owner" });

  if (memberError) throw memberError;

  return created.id;
}

async function ensurePieces(shop, shopId) {
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shopId);
  if (count) return;

  for (const [title, categorySlug, size, price, condition, photo] of PIECES[shop.key]) {
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .single();

    if (categoryError) throw categoryError;

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        shop_id: shopId,
        reference: "",
        title,
        description: "Pièce fictive pour les tests.",
        size,
        category_id: category.id,
        condition,
        price_millimes: price,
        publication_status: "published",
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;

    const path = `${shopId}/${product.id}/${photo}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, readFileSync(new URL(`./seed-photos/${photo}.jpg`, import.meta.url)), { contentType: "image/jpeg" });

    if (uploadError) throw uploadError;

    const { error: imageError } = await supabase.from("product_images").insert({ product_id: product.id, path });
    if (imageError) throw imageError;
  }
}

async function ensureLook(shop, shopId) {
  const name = `Look démo ${shop.name.slice(-1)}`;
  const { data: existing } = await supabase.from("collections").select("id").eq("shop_id", shopId).eq("name", name).maybeSingle();
  if (existing) return;

  const { data: pieces, error: piecesError } = await supabase
    .from("products")
    .select("id")
    .eq("shop_id", shopId)
    .eq("publication_status", "published")
    .order("created_at")
    .limit(LOOK_SIZE);

  if (piecesError) throw piecesError;
  if (!pieces.length) return;

  const { data: look, error } = await supabase
    .from("collections")
    .insert({ shop_id: shopId, name, description: "Collection fictive pour les tests.", is_published: true })
    .select("id")
    .single();

  if (error) throw error;

  const { error: linkError } = await supabase
    .from("collection_products")
    .insert(pieces.map((piece, position) => ({ collection_id: look.id, product_id: piece.id, position })));

  if (linkError) throw linkError;
}

// Annonces de particuliers : des objets dans la Marketplace, des vêtements dans le Vide-Dressing.
const LISTINGS = {
  clientA: [
    ["marketplace", "Vélo de ville démo", "velos", 180000, "good", "velo-orange", { type_velo: "ville" }],
    ["marketplace", "Vélo de route démo", "velos", 650000, "very_good", "velo-route", { type_velo: "route", taille_cadre: "m" }],
    ["marketplace", "Réfrigérateur vintage démo", "refrigerateurs", 420000, "good", "refrigerateur-vintage", {}],
    ["marketplace", "Canapé velours démo", "canapes", 750000, "very_good", "canape-vert", { matiere: "tissu" }],
    ["marketplace", "Lampadaire démo", "luminaires", 90000, "like_new", "lampadaire", {}],
    ["marketplace", "Casque audio démo", "audio-photo", 120000, "like_new", "casque-audio", {}],
    ["vide_dressing", "Sac à main rouge démo", "sacs", 60000, "very_good", "sac-rouge", {}],
  ],
  clientB: [
    ["marketplace", "Chaise scandinave démo", "chaises", 45000, "good", "chaise-noire", { matiere: "plastique" }],
    ["marketplace", "Tabouret en bois démo", "chaises", 30000, "good", "tabouret-bois", { matiere: "bois" }],
    ["marketplace", "Fauteuil capitonné démo", "canapes", 280000, "very_good", "fauteuil-blanc", { matiere: "tissu" }],
    ["marketplace", "Suspension démo", "luminaires", 40000, "like_new", "suspension", {}],
    ["marketplace", "Plante en pot démo", "decoration", 15000, "good", "plante", {}],
    ["vide_dressing", "Sac à dos démo", "sacs", 35000, "good", "sac-a-dos", {}],
    ["vide_dressing", "Chaussures en cuir démo", "chaussures", 70000, "very_good", "chaussures-cuir", {}],
  ],
};

async function ensureListings(key, sellerId, cityId, governorateId) {
  const { count } = await supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", sellerId);
  if (count) return;

  for (const [section, title, categorySlug, price, condition, photo, attributes] of LISTINGS[key]) {
    const { data: category, error: categoryError } = await supabase.from("categories").select("id").eq("slug", categorySlug).single();
    if (categoryError) throw categoryError;

    const { data: listing, error } = await supabase
      .from("listings")
      .insert({
        seller_id: sellerId,
        section,
        category_id: category.id,
        title,
        description: "Annonce fictive pour les tests. Aucune vente réelle.",
        condition,
        price_millimes: price,
        governorate_id: governorateId,
        city_id: cityId,
        attributes,
      })
      .select("id")
      .single();

    if (error) throw error;

    const path = `${sellerId}/${listing.id}/${photo}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("listing-images")
      .upload(path, readFileSync(new URL(`./seed-photos/${photo}.jpg`, import.meta.url)), { contentType: "image/jpeg" });

    if (uploadError) throw uploadError;

    const { error: imageError } = await supabase.from("listing_images").insert({ listing_id: listing.id, path });
    if (imageError) throw imageError;
  }
}

const accounts = await ensureAccounts();

for (const shop of SHOPS) {
  const shopId = await ensureShop(shop, accounts[shop.key]);
  await ensurePieces(shop, shopId);
  await ensureLook(shop, shopId);
}

for (const [key, citySlug] of [["clientA", "la-marsa"], ["clientB", "sfax-ville"]]) {
  const { data: city, error } = await supabase.from("cities").select("id, governorate_id").eq("slug", citySlug).single();
  if (error) throw error;
  await ensureListings(key, accounts[key], city.id, city.governorate_id);
}

console.log(`Données fictives prêtes sur ${host}. Identifiants : ${output}. Le rôle administrateur reste à attribuer après enrôlement.`);
