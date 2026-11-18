// Faux Supabase complet, pour parcourir toute l'application sans Docker ni base réelle.
// Il fabrique, pour chaque requête PostgREST, des lignes qui ont la forme décrite par
// src/types/database.ts : colonnes, enums, relations imbriquées. Les filtres `eq` imposent leur
// valeur (une fiche demandée par son id existe toujours). Il simule aussi une personne connectée
// (jeton HS256 validé par /auth/v1/user) et sert les photos de scripts/seed-photos.
//
// Les textes saisis par les gens (titres, descriptions…) sont en arabe et les champs `*_fr` portent
// un marqueur latin (« NomFR ») : sur une page arabe, tout texte latin restant vient donc de
// l'interface (traduction manquante) ou d'un champ français affiché à tort.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSchema } from "./schema.mjs";

const PORT = Number(process.env.MOCK_PORT ?? 54997);
const BASE = `http://localhost:${PORT}`;
const PHOTOS = fileURLToPath(new URL("../seed-photos/", import.meta.url));
const photos = readdirSync(PHOTOS).filter((file) => file.endsWith(".jpg"));
// Les pièces dessinées pour la cabine (robe, jupe, short, pantalon, manteau) : voir vetements/SOURCES.md.
const DRAWN = fileURLToPath(new URL("./vetements/", import.meta.url));
const drawn = readdirSync(DRAWN).filter((file) => file.endsWith(".jpg"));
const { relations, functions } = loadSchema();

export const USER = {
  id: "0f0f0f0f-1111-4222-8333-444455556666",
  email: "lina@exemple.tn",
  name: "Lina",
};

// --- Valeurs déterministes ---------------------------------------------------------------------

function hash(text) {
  return createHash("sha1").update(text).digest("hex");
}

function uuid(seed) {
  const h = hash(seed);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const PREFERRED = ["active", "published", "approved", "available", "confirmed", "live", "mode", "fr", "open", "delivered", "paid", "pending"];
const ago = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();

function valueFor(table, column, spec, index) {
  if (spec.array && spec.kind !== "object") return [];
  const name = column.toLowerCase();
  // Les pièces de boutique : un public cohérent avec leur catégorie (cabine d'essayage).
  if (table === "products" && name === "attributes") {
    const genre = wardrobeFor(SHOP_CATEGORIES[(index * 3) % SHOP_CATEGORIES.length].id, index).genre;
    return genre ? { genre } : {};
  }
  switch (spec.kind) {
    case "enum": {
      const preferred = PREFERRED.find((value) => spec.values.includes(value));
      return preferred ?? spec.values[0];
    }
    case "boolean":
      return /^(is_active|active|is_published|published|enabled|visible|is_visible|accepts_|delivery_enabled|pickup_enabled)/.test(name);
    case "json":
      return name.includes("attribute") ? {} : name.endsWith("s") ? [] : {};
    case "number": {
      if (name.includes("millimes") || name.includes("price") || name.includes("amount") || name.includes("total") || name.includes("budget")) return 45_000 + index * 5_000;
      if (name.includes("rating") || name.includes("stars")) return 4;
      if (name.includes("position") || name.includes("rank")) return index;
      if (name.includes("percent") || name.includes("discount")) return 10;
      if (name.includes("stock") || name.includes("quantity") || name.includes("count") || name.includes("views")) return 3;
      if (name === "id" || name.endsWith("_id")) return index + 1;
      if (name.includes("lat")) return 36.8;
      if (name.includes("lng") || name.includes("lon")) return 10.18;
      return 2;
    }
    case "object":
      return makeRow(`${table}.${column}`, spec.columns, index);
    default:
      break;
  }

  // Texte
  if (name === "id") return uuid(`${table}:${index}`);
  if (name === "user_id" || name === "buyer_id" || name === "client_id" || name === "owner_id" || name === "author_id") return USER.id;
  if (name === "category_id" && table === "products") return SHOP_CATEGORIES[(index * 3) % SHOP_CATEGORIES.length].id;
  if (name === "category_id" && table === "listings") return LEAVES[(index * 7 + 23) % LEAVES.length].id;
  if (name.endsWith("_id")) return uuid(`${name.replace(/_id$/, "")}:${index}`);
  if (name.endsWith("_at") || name.endsWith("_on") || name === "date" || name.endsWith("_date") || name.includes("expires")) return ago(index * 6 + 2);
  if (name.includes("email")) return `client${index + 1}@exemple.tn`;
  if (name.includes("phone") || name.includes("whatsapp")) return `+2162000000${index}`;
  if (name.includes("slug")) return `${table.replace(/_/g, "-")}-${index + 1}`;
  if (name.endsWith("_fr")) return `NomFR${index + 1}`;
  if (name.endsWith("_ar")) return `اسم ${index + 1}`;
  if (name.includes("path") || name.includes("image") || name.includes("photo") || name.includes("logo") || name.includes("cover") || name.includes("avatar") || name.includes("poster") || name.includes("thumbnail")) {
    return `demo/${photos[(hash(`${table}${index}`).charCodeAt(0) + index) % photos.length]}`;
  }
  if (name.includes("url") || name.includes("link") || name.includes("website")) return "https://exemple.tn";
  if (name.includes("color") || name.includes("colour")) return "Noir";
  if (name === "size" || name.endsWith("_size")) return "M";
  if (name.includes("reference") || name === "code" || name.includes("tracking")) return `R-00${index + 1}`;
  if (name.includes("token") || name.includes("secret") || name.includes("hash")) return hash(`${table}${column}${index}`).slice(0, 16);
  if (name.includes("search")) return "";
  if (name.includes("brand")) return "ماركة";
  if (name.includes("name") || name.includes("title") || name.includes("label")) return `${table === "profiles" || name.includes("display") ? "سلمى" : "قطعة"} ${index + 1}`;
  return `نص تجريبي ${index + 1}`;
}

// --- Catégories : le vrai arbre, relu dans les migrations ---------------------------------------
// Les univers de l'accueil reposent sur les vrais slugs (hauts, mobilier, sneakers…) : un arbre inventé
// les masquerait tous. On lit les insertions de `public.categories`, puis les déplacements de la
// migration des univers (Baskets sous Sneakers, Livres en racine, Puériculture sous Enfants).
function loadCategories() {
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  const sql = readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(new URL(file, dir), "utf8"))
    .join("\n");
  const blocks = [...sql.matchAll(/insert into public\.categories[\s\S]*?;/g)].map((match) => match[0]);
  const text = (value) => value.replace(/''/g, "'");
  const tree = new Map();
  for (const block of blocks) {
    for (const [, slug, fr, ar, position, section] of block.matchAll(/^\s*\('([a-z0-9-]+)', '((?:[^']|'')+)', '((?:[^']|'')+)', (\d+)(?:, '(mode|marketplace)')?\)/gm)) {
      if (!tree.has(slug)) tree.set(slug, { slug, parent: null, name_fr: text(fr), name_ar: text(ar), position: Number(position), section: section ?? "mode" });
    }
    for (const [, parent, slug, fr, ar, position] of block.matchAll(/^\s*\('([a-z0-9-]+)', '([a-z0-9-]+)', '((?:[^']|'')+)', '((?:[^']|'')+)', (\d+)\)/gm)) {
      if (!tree.has(slug)) tree.set(slug, { slug, parent, name_fr: text(fr), name_ar: text(ar), position: Number(position), section: null });
    }
  }
  const moves = { baskets: "sneakers", livres: null, puericulture: "enfants" };
  for (const [slug, parent] of Object.entries(moves)) {
    if (tree.has(slug) && (parent === null || tree.has(parent))) tree.get(slug).parent = parent;
  }
  if (tree.get("livres")?.parent === null) tree.get("livres").section = "marketplace";
  return [...tree.values()].map((entry) => ({
    id: uuid(`category:${entry.slug}`),
    parent_id: entry.parent ? uuid(`category:${entry.parent}`) : null,
    slug: entry.slug,
    name_fr: entry.name_fr,
    name_ar: entry.name_ar,
    position: entry.position,
    is_active: true,
    section: entry.section ?? tree.get(entry.parent)?.section ?? "mode",
    created_at: ago(400),
    updated_at: ago(400),
  }));
}
const CATEGORIES = loadCategories();
const LEAVES = CATEGORIES.filter((category) => category.parent_id);
// Les produits de boutique sont toujours de la mode, comme en vrai ; les annonces vont partout.
// Les catégories où l'on range une pièce de mode : les feuilles, et les racines sans sous-catégorie (Robes).
const SHOP_CATEGORIES = CATEGORIES.filter((category) => category.section === "mode" && !CATEGORIES.some((child) => child.parent_id === category.id));

// La garde-robe de démonstration : pour chaque catégorie, des pièces au vrai nom et à la vraie photo
// (photos Unsplash de seed-photos, ou pièces dessinées de vetements/). [intitulé, photo, public]
const WARDROBE = {
  "t-shirts": [["T-shirt noir en coton", "tshirt-noir.jpg"]],
  chemises: [["Chemise en jean", "chemise-jean.jpg"]],
  "pulls-sweats": [["Sweat blanc", "sweat-blanc.jpg"]],
  "vestes-sport": [["Veste en cuir", "veste-cuir.jpg"]],
  "vestes-jean": [["Veste en cuir vintage", "veste-cuir.jpg"]],
  manteaux: [["Manteau camel", "manteau-camel.jpg", "homme"]],
  robes: [["Robe d'été à pois", "robe-ete.jpg", "femme"]],
  jeans: [["Jean brut", "jean-brut.jpg"], ["Jean délavé", "jeans-delaves.jpg"]],
  pantalons: [["Pantalon chino", "pantalon-chino.jpg"]],
  "jupes-shorts": [["Jupe plissée", "jupe-plissee.jpg", "femme"], ["Short en lin", "short-lin.jpg"]],
  bottes: [["Bottines en cuir", "bottines-cuir.jpg"]],
  "sandales-claquettes": [["Escarpins fleuris", "escarpins-fleuris.jpg", "femme"]],
  "chaussures-ville": [["Chaussures en cuir", "chaussures-cuir.jpg"]],
  baskets: [["Baskets colorées", "baskets-couleurs.jpg"]],
  "running-training": [["Baskets de running", "baskets-couleurs.jpg"]],
  "basketball-skate": [["Baskets montantes", "baskets-couleurs.jpg"]],
  "sneakers-collection": [["Sneakers de collection", "baskets-couleurs.jpg"]],
  sacs: [["Sac rouge", "sac-rouge.jpg", "femme"], ["Sac en osier", "sac-osier.jpg"]],
  "casquettes-bonnets": [["Casquette grise", "casquette-grise.jpg"]],
  ceintures: [["Ceinture en cuir", "ceinture-cuir.jpg"]],
};

function wardrobeFor(categoryId, index) {
  const slug = CATEGORIES.find((category) => category.id === categoryId)?.slug;
  const pieces = WARDROBE[slug];
  if (!pieces) return { title: `قطعة ${index + 1}`, photo: null, genre: null };
  const [title, photo, genre] = pieces[Math.floor(index / SHOP_CATEGORIES.length) % pieces.length];
  return { title, photo, genre: genre ?? null };
}

function categoryRows(params) {
  return CATEGORIES.filter((row) => {
    for (const [key, raw] of params) {
      if (!(key in row) || !raw) continue;
      if (raw.startsWith("eq.") && String(row[key]) !== raw.slice(3)) return false;
      if (raw === "is.null" && row[key] !== null) return false;
      if (raw === "not.is.null" && row[key] === null) return false;
    }
    return true;
  }).sort((a, b) => a.position - b.position);
}

function makeRow(table, columns, index) {
  const row = {};
  for (const [column, spec] of Object.entries(columns)) {
    row[column] = spec.nullable && /(deleted|moderated|cancelled|canceled|rejected|blocked|suspended|closed|hidden|ended|refunded|failed|_reason|_note|error)/.test(column) ? null : valueFor(table, column, spec, index);
  }
  return row;
}

// --- Lecture de `select=` -------------------------------------------------------------------------

function splitTop(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const character of text) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += character;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseSelect(text) {
  return splitTop(text ?? "*").map((item) => {
    const open = item.indexOf("(");
    if (open === -1) {
      const [left, right] = item.split(":").map((part) => part.trim());
      const column = (right ?? left).split("::")[0].split("->")[0];
      return { kind: "column", alias: right ? left : column, column };
    }
    let head = item.slice(0, open).trim();
    const inner = item.slice(open + 1, item.lastIndexOf(")"));
    const spread = head.startsWith("...");
    if (spread) head = head.slice(3);
    let alias = null;
    if (head.includes(":")) [alias, head] = head.split(":").map((part) => part.trim());
    const [relation, hint] = head.split("!").map((part) => part.trim());
    return { kind: "embed", alias: alias ?? relation, relation, hint, inner, spread };
  });
}

// La table visée par un embed, et s'il donne un objet (clé étrangère chez nous) ou une liste.
function resolveEmbed(table, embed) {
  const own = relations[table]?.relationships ?? [];
  let target = relations[embed.relation] ? embed.relation : null;
  if (!target) {
    const viaColumn = own.find((link) => link.columns.includes(embed.relation) || link.key === embed.relation);
    if (viaColumn) target = viaColumn.referenced;
  }
  if (!target) return null;
  const hint = embed.hint && !["inner", "left"].includes(embed.hint) ? embed.hint : null;
  const forward = own.find((link) => link.referenced === target && (!hint || link.key === hint || link.columns.includes(hint)));
  const backward = (relations[target]?.relationships ?? []).find((link) => link.referenced === table && (!hint || link.key === hint || link.columns.includes(hint)));
  return { target, one: Boolean(forward) && !(hint && backward && !forward) };
}

function project(table, row, select, index, depth = 0) {
  const columns = relations[table]?.columns ?? {};
  const out = {};
  for (const item of select) {
    if (item.kind === "column") {
      if (item.column === "*") Object.assign(out, row);
      else if (item.column === "count") out.count = 3;
      else out[item.alias] = item.column in row ? row[item.column] : columns[item.column] ? valueFor(table, item.column, columns[item.column], index) : `${item.column}`;
      continue;
    }
    const resolved = resolveEmbed(table, item);
    const inner = parseSelect(item.inner);
    if (!resolved || depth > 3) {
      out[item.alias] = item.inner.trim() === "count" ? [{ count: 3 }] : null;
      continue;
    }
    if (item.inner.trim() === "count") {
      out[item.alias] = [{ count: 3 }];
      continue;
    }
    const make = (position) => project(resolved.target, makeRow(resolved.target, relations[resolved.target].columns, position), inner, position, depth + 1);
    const value = resolved.one ? make(index) : [make(0), make(1)];
    // La photo d'une pièce de boutique est celle de sa garde-robe de démonstration.
    const photo = table === "products" && resolved.target === "product_images" ? wardrobeFor(row.category_id, index).photo : null;
    if (photo && Array.isArray(value)) value.forEach((image) => "path" in image && (image.path = `demo/${photo}`));
    if (item.spread && resolved.one) Object.assign(out, value);
    else out[item.alias] = value;
  }
  return out;
}

// --- Filtres : la valeur demandée devient vraie ------------------------------------------------------

function applyFilters(table, row, params) {
  const columns = relations[table]?.columns ?? {};
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key) || key.includes(".")) continue;
    if (!raw || key === "or" || key === "and") continue;
    const negated = raw.startsWith("not.");
    const [operator, ...rest] = (negated ? raw.slice(4) : raw).split(".");
    let value = rest.join(".");
    const spec = columns[key];
    const cast = (text) => (spec?.kind === "number" ? Number(text) : spec?.kind === "boolean" ? text === "true" : text);
    if (negated) {
      if (operator === "is" && value === "null" && row[key] === null) row[key] = spec ? valueFor(table, key, { ...spec, nullable: false }, 0) : "x";
      continue;
    }
    if (operator === "eq") row[key] = cast(value);
    else if (operator === "in") {
      value = value.replace(/^\(|\)$/g, "").split(",")[0]?.replace(/"/g, "");
      if (value) row[key] = cast(value);
    } else if (operator === "is") row[key] = value === "null" ? null : value === "true";
    else if (operator === "neq" && String(row[key]) === value) {
      row[key] = spec?.kind === "enum" ? spec.values.find((option) => option !== value) : `${value}x`;
    } else if ((operator === "gte" || operator === "gt") && spec?.kind === "number" && row[key] < Number(value)) row[key] = Number(value) + (operator === "gt" ? 1 : 0);
    else if ((operator === "lte" || operator === "lt") && spec?.kind === "number" && row[key] > Number(value)) row[key] = Number(value) - (operator === "lt" ? 1 : 0);
    else if ((operator === "gte" || operator === "gt") && spec?.kind === "string" && /_at$/.test(key)) row[key] = new Date(Date.parse(value) + 3_600_000).toISOString();
    else if ((operator === "lte" || operator === "lt") && spec?.kind === "string" && /_at$/.test(key)) row[key] = new Date(Date.parse(value) - 3_600_000).toISOString();
  }
  return row;
}

// Une requête qui vise une fiche précise (id, slug…) ne rend qu'une ligne : maybeSingle() l'exige.
function targetsOne(params) {
  for (const [key, raw] of params) {
    if (!raw?.startsWith("eq.")) continue;
    if (["id", "slug", "user_id", "token", "email", "code"].includes(key)) return true;
  }
  return false;
}

function rowsFor(table, url, accept) {
  const columns = relations[table]?.columns;
  if (!columns) return null;
  const params = url.searchParams;
  const select = parseSelect(params.get("select"));
  const single = accept.includes("vnd.pgrst.object");
  const limit = Number(params.get("limit") ?? 0);
  if (table === "categories") {
    const tree = categoryRows(params);
    return (single ? tree.slice(0, 1) : tree).map((row, index) => project(table, row, select, index));
  }
  // Le catalogue de la cabine (limite large) reçoit une pièce de chaque catégorie, deux fois.
  const wide = table === "products" && limit >= 500 && !single && !targetsOne(params);
  const count = wide ? SHOP_CATEGORIES.length * 2 : single || targetsOne(params) ? 1 : Math.max(1, Math.min(limit || 3, 3));
  const rows = Array.from({ length: count }, (_, index) => project(table, applyFilters(table, makeRow(table, columns, index), params), select, index));
  // Dans le catalogue de la cabine seulement, les pièces portent leur vrai nom (T-shirt, Robe…) ; ailleurs
  // les titres restent ceux par défaut, pour que les pages en arabe le restent entièrement.
  if (wide) rows.forEach((row, index) => "title" in row && (row.title = wardrobeFor(row.category_id ?? SHOP_CATEGORIES[(index * 3) % SHOP_CATEGORIES.length].id, index).title));
  return rows;
}

function rpcResult(name) {
  const spec = functions[name];
  if (!spec || spec.kind === "void") return undefined;
  if (spec.kind === "object") {
    const rows = Array.from({ length: spec.array ? 3 : 1 }, (_, index) => makeRow(`rpc_${name}`, spec.columns, index));
    return spec.array ? rows : rows[0];
  }
  if (spec.array) return [];
  return valueFor(`rpc_${name}`, name.includes("count") ? "count" : name.endsWith("_id") ? "id" : "value", spec, 0);
}

// --- Authentification simulée --------------------------------------------------------------------

const b64url = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

export function makeAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: USER.id,
    email: USER.email,
    role: "authenticated",
    aud: "authenticated",
    aal: "aal2",
    amr: [{ method: "totp", timestamp: now }, { method: "password", timestamp: now }],
    session_id: uuid("session"),
    iss: `${BASE}/auth/v1`,
    iat: now,
    exp: now + 30 * 24 * 3600,
  };
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.${b64url("signature")}`;
}

function authUser() {
  return {
    id: USER.id,
    aud: "authenticated",
    role: "authenticated",
    email: USER.email,
    email_confirmed_at: ago(500),
    phone: "",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { display_name: USER.name },
    factors: [{ id: uuid("factor"), factor_type: "totp", status: "verified", friendly_name: "app", created_at: ago(400), updated_at: ago(400) }],
    created_at: ago(500),
    updated_at: ago(1),
  };
}

export function makeSession() {
  const token = makeAccessToken();
  return {
    access_token: token,
    refresh_token: "refresh-factice",
    token_type: "bearer",
    expires_in: 30 * 24 * 3600,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
    user: authUser(),
  };
}

// --- Serveur -------------------------------------------------------------------------------------

const unknown = new Set();

async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export function startMock(port = PORT) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, BASE);
    const path = url.pathname;
    const accept = request.headers.accept ?? "";
    const send = (status, payload, headers = {}) => {
      response.writeHead(status, { "content-type": "application/json", ...headers });
      response.end(payload === undefined ? "" : JSON.stringify(payload));
    };

    try {
      if (path.startsWith("/storage/v1/object/public/") || path.startsWith("/storage/v1/object/sign/") || path.startsWith("/storage/v1/render/")) {
        if (request.method === "POST") return send(200, { signedURL: `/storage/v1/object/public/demo/${photos[0]}` });
        const name = path.split("/").pop();
        const file = drawn.includes(name) ? join(DRAWN, name) : join(PHOTOS, photos.includes(name) ? name : photos[parseInt(hash(path).slice(0, 4), 16) % photos.length]);
        if (/\.(mp4|webm)$/.test(path)) return send(404, {});
        // Comme le Storage public de Supabase : lisible par un canvas (texture 3D de la page Découvrir).
        response.writeHead(200, { "content-type": "image/jpeg", "cache-control": "max-age=3600", "access-control-allow-origin": "*" });
        return response.end(readFileSync(file));
      }
      if (path.startsWith("/storage/v1/")) return send(200, request.method === "GET" ? [] : { Key: "demo/upload.jpg", Id: uuid("upload") });

      if (path.startsWith("/auth/v1/")) {
        const signedIn = (request.headers.authorization ?? "").includes(makeAccessToken().split(".")[1].slice(0, 20));
        if (path === "/auth/v1/user") return signedIn || request.method === "PUT" ? send(200, authUser()) : send(401, { code: 401, error_code: "no_authorization", msg: "no session" });
        if (path === "/auth/v1/token") return send(200, makeSession());
        if (path === "/auth/v1/logout") return send(204);
        if (path === "/auth/v1/signup") return send(200, { ...authUser(), email_confirmed_at: null, identities: [{}] });
        if (path.startsWith("/auth/v1/factors")) return send(200, { id: uuid("factor"), type: "totp", totp: { qr_code: "", secret: "ABC", uri: "" } });
        if (path === "/auth/v1/verify" || path === "/auth/v1/otp") return send(200, makeSession());
        if (path === "/auth/v1/settings") return send(200, { external: { email: true }, disable_signup: false });
        return send(200, {});
      }

      if (path.startsWith("/rest/v1/rpc/")) {
        await body(request);
        const result = rpcResult(path.slice("/rest/v1/rpc/".length));
        return result === undefined ? send(204) : send(200, result);
      }

      if (path.startsWith("/rest/v1/")) {
        const table = path.slice("/rest/v1/".length);
        if (!relations[table]) {
          if (!unknown.has(table)) console.log(`[faux-supabase] table inconnue : ${table}`);
          unknown.add(table);
          return send(200, []);
        }
        if (request.method === "GET" || request.method === "HEAD") {
          const rows = rowsFor(table, url, accept);
          const headers = { "content-range": `0-${rows.length - 1}/${rows.length}` };
          if (request.method === "HEAD") return send(200, undefined, headers);
          return send(200, accept.includes("vnd.pgrst.object") ? rows[0] : rows, headers);
        }
        const payload = await body(request);
        const wantsRows = (request.headers.prefer ?? "").includes("return=representation");
        if (!wantsRows) return send(request.method === "POST" ? 201 : 204);
        const input = Array.isArray(payload) ? payload : [payload ?? {}];
        const rows = input.map((entry, index) => project(table, { ...makeRow(table, relations[table].columns, index), ...entry }, parseSelect(url.searchParams.get("select")), index));
        return send(request.method === "POST" ? 201 : 200, accept.includes("vnd.pgrst.object") ? rows[0] : rows);
      }

      send(404, {});
    } catch (error) {
      console.log(`[faux-supabase] erreur sur ${request.method} ${request.url} : ${error.message}`);
      send(500, { message: error.message });
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await startMock();
  console.log(`[faux-supabase] prêt sur ${BASE}`);
}
