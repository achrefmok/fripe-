// Données fictives de préproduction. Ne copie rien de la base locale. Relançable sans doublon.
// Usage : voir docs/staging-plan.md. FRIPE_ENV=staging et FRIPE_SEED_CONFIRM=<hôte Supabase> sont requis.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";
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
  { key: "shopA", slug: "demo-boutique-a", name: "Boutique Démo A", city: "la-marsa", color: [176, 58, 46] },
  { key: "shopB", slug: "demo-boutique-b", name: "Boutique Démo B", city: "sfax-ville", color: [46, 94, 120] },
];

const PIECES = [
  ["Jean droit démo", "jeans", "M", 25000, "good"],
  ["Veste en jean démo", "jeans", "L", 45000, "very_good"],
  ["Pantalon démo", "jeans", "S", 30000, "like_new"],
  ["Jean large démo", "jeans", "XL", 35000, "good"],
];

// Image neutre générée ici : aucune photo réelle, aucune personne.
function placeholderPng([red, green, blue], variant) {
  const width = 480;
  const height = 640;
  const row = Buffer.alloc(1 + width * 3);

  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const band = Math.floor(y / (40 + variant * 12)) % 2 === 0 ? 1 : 0.86;
    for (let x = 0; x < width; x += 1) {
      row[1 + x * 3] = red * band;
      row[2 + x * 3] = green * band;
      row[3 + x * 3] = blue * band;
    }
    rows.push(Buffer.from(row));
  }

  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, checksum]);
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

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

  for (const [index, [title, categorySlug, size, price, condition]] of PIECES.entries()) {
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

    const path = `${shopId}/${product.id}/demo.png`;
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, placeholderPng(shop.color, index), { contentType: "image/png" });

    if (uploadError) throw uploadError;

    const { error: imageError } = await supabase.from("product_images").insert({ product_id: product.id, path });
    if (imageError) throw imageError;
  }
}

const accounts = await ensureAccounts();

for (const shop of SHOPS) {
  const shopId = await ensureShop(shop, accounts[shop.key]);
  await ensurePieces(shop, shopId);
}

console.log(`Données fictives prêtes sur ${host}. Identifiants : ${output}. Le rôle administrateur reste à attribuer après enrôlement.`);
