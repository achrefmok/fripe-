// Faux Supabase local pour tester le Vide-Dressing sans Docker : il répond aux requêtes PostgREST
// lues par les pages avec des données d'exemple, et sert les photos de scripts/seed-photos.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.MOCK_PORT ?? 54998);
const PHOTOS = process.argv[2] ?? fileURLToPath(new URL("../seed-photos/", import.meta.url));
const hours = (h) => new Date(Date.now() - h * 3600_000).toISOString();

const sellers = {
  karim: { id: "11111111-1111-4111-8111-111111111111", name: "Karim Saidi", gov: { name_fr: "Sousse", name_ar: "سوسة" } },
  sarra: { id: "22222222-2222-4222-8222-222222222222", name: "Sarra Ben Ali", gov: { name_fr: "Tunis", name_ar: "تونس" } },
  youssef: { id: "33333333-3333-4333-8333-333333333333", name: "Youssef Trabelsi", gov: { name_fr: "Sfax", name_ar: "صفاقس" } },
  ines: { id: "44444444-4444-4444-8444-444444444444", name: "Ines Mansour", gov: { name_fr: "Nabeul", name_ar: "نابل" } },
};

let n = 0;
const piece = (seller, title, price, photo, extra = {}) => {
  n += 1;
  const s = sellers[seller];
  return {
    id: `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`,
    seller_id: s.id,
    seller_name: s.name,
    title,
    brand: extra.brand ?? null,
    size: extra.size ?? null,
    condition: extra.condition ?? "very_good",
    price_millimes: price * 1000,
    status: extra.status ?? "available",
    favorite_count: extra.likes ?? 0,
    published_at: hours(extra.age ?? n * 5),
    category_id: "c-hauts",
    section: "vide_dressing",
    publication_status: "published",
    governorates: s.gov,
    listing_images: photo ? [{ path: `demo/${photo}`, position: 0 }] : [],
  };
};

const listings = [
  piece("karim", "Sac à main rouge", 60, "sac-rouge.jpg", { size: "Unique", likes: 4, age: 2 }),
  piece("karim", "Chaussures en cuir", 70, "chaussures-cuir.jpg", { size: "42", likes: 2, age: 6 }),
  piece("karim", "Sac à dos bleu marine", 35, "sac-a-dos.jpg", { condition: "good", size: "Unique", age: 9 }),
  piece("karim", "Veste en cuir", 95, "veste-cuir.jpg", { brand: "Mango", size: "L", condition: "like_new", likes: 7, age: 30 }),
  piece("sarra", "Veste en jean oversize", 45, "chemise-jean.jpg", { brand: "Levi's", size: "M", condition: "like_new", likes: 5, age: 4 }),
  piece("sarra", "Escarpins fleuris", 28, "escarpins-fleuris.jpg", { brand: "Zara", size: "38", condition: "new_with_tags", likes: 3, age: 12 }),
  piece("youssef", "Baskets colorées", 80, "baskets-couleurs.jpg", { brand: "Nike", size: "40", condition: "good", age: 20 }),
  piece("youssef", "Pull en laine", 22, null, { size: "M", age: 26 }),
  piece("youssef", "Jean brut", 30, "jean-brut.jpg", { brand: "Levi's", size: "32", age: 40 }),
  piece("ines", "Poncho en crochet", 50, "poncho-crochet.jpg", { condition: "new_with_tags", size: "S", likes: 1, age: 3 }),
  piece("ines", "Sac en osier", 18, "sac-osier.jpg", { size: "Unique", age: 50 }),
  piece("ines", "T-shirt noir", 12, "tshirt-noir.jpg", { brand: "Zara", size: "M", status: "reserved", age: 60 }),
];

const categories = [
  { id: "c-hauts", slug: "hauts", name_fr: "Hauts", name_ar: "قطع علوية", parent_id: null, section: "mode", position: 1 },
  { id: "c-bas", slug: "bas", name_fr: "Bas", name_ar: "سراويل", parent_id: null, section: "mode", position: 2 },
  { id: "c-chaussures", slug: "chaussures", name_fr: "Chaussures", name_ar: "أحذية", parent_id: null, section: "mode", position: 3 },
  { id: "c-accessoires", slug: "accessoires", name_fr: "Accessoires", name_ar: "إكسسوارات", parent_id: null, section: "mode", position: 4 },
];

const governorates = [
  { id: 1, name_fr: "Tunis", name_ar: "تونس", cities: [] },
  { id: 2, name_fr: "Sousse", name_ar: "سوسة", cities: [] },
  { id: 3, name_fr: "Sfax", name_ar: "صفاقس", cities: [] },
];

function filterRows(rows, params) {
  let out = [...rows];
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "offset"].includes(key) || key.includes(".")) continue;
    const [op, ...rest] = raw.split(".");
    const value = rest.join(".");
    if (op === "eq") out = out.filter((row) => String(row[key]) === value);
    if (op === "neq") out = out.filter((row) => String(row[key]) !== value);
    if (op === "gte") out = out.filter((row) => Number(row[key]) >= Number(value));
    if (op === "lte") out = out.filter((row) => Number(row[key]) <= Number(value));
    if (op === "in") out = out.filter((row) => value.replace(/[()]/g, "").split(",").includes(String(row[key])));
    if (op === "ilike") {
      const needle = value.replace(/\*/g, "").replace(/%/g, "").toLowerCase();
      const field = key === "search_text" ? (row) => `${row.title} ${row.brand ?? ""}` : (row) => String(row[key] ?? "");
      out = out.filter((row) => field(row).toLowerCase().includes(needle));
    }
  }
  const order = params.get("order");
  if (order?.startsWith("price_millimes")) out.sort((a, b) => (order.includes("desc") ? b.price_millimes - a.price_millimes : a.price_millimes - b.price_millimes));
  else if (order?.startsWith("published_at")) out.sort((a, b) => b.published_at.localeCompare(a.published_at));
  return out;
}

const unknown = new Set();

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };

  if (path.startsWith("/storage/v1/object/public/")) {
    const file = join(PHOTOS, path.split("/").pop());
    if (existsSync(file)) {
      res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "max-age=3600" });
      return res.end(readFileSync(file));
    }
    return send(404, {});
  }

  if (path.startsWith("/auth/v1/")) return send(401, { message: "no session" });

  if (path.startsWith("/rest/v1/")) {
    const table = path.slice("/rest/v1/".length);
    const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    let rows;
    if (table === "listings") rows = filterRows(listings, url.searchParams);
    else if (table === "categories") rows = filterRows(categories, url.searchParams);
    else if (table === "governorates") rows = governorates;
    else {
      if (!unknown.has(table)) console.log(`[mock] table inconnue : ${req.method} ${table}`);
      unknown.add(table);
      rows = [];
    }

    if (req.method !== "GET" && req.method !== "HEAD") return send(200, table.startsWith("rpc/") ? null : []);
    const total = rows.length;
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 1000);
    const range = req.headers.range?.match(/(\d+)-(\d+)/);
    const from = range ? Number(range[1]) : offset;
    const to = range ? Number(range[2]) : offset + limit - 1;
    const page = rows.slice(from, to + 1);
    const headers = { "content-range": `${from}-${from + page.length - 1}/${total}` };
    if (single) return page[0] ? send(200, page[0], headers) : send(406, { code: "PGRST116", message: "no rows" });
    return send(200, page, headers);
  }

  send(404, {});
}).listen(PORT, () => console.log(`[faux-supabase] prêt sur http://localhost:${PORT}`));
