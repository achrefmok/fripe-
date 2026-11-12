// Vérifie les variables d'un environnement sans jamais afficher leur valeur.
// Usage : pnpm env:check local|staging|production (les variables viennent de l'environnement).
const target = process.argv[2];
const env = process.env;
const problems = [];

if (!["local", "staging", "production"].includes(target)) {
  console.error("Usage : pnpm env:check local|staging|production");
  process.exit(1);
}

const remote = target !== "local";
const required = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  ...(remote ? ["NEXT_PUBLIC_FRIPE_ENV", "MAINTENANCE_TOKEN"] : []),
];

for (const name of required) {
  if (!env[name]) problems.push(`${name} manquante`);
}

for (const [name, value] of Object.entries(env)) {
  if (name.startsWith("NEXT_PUBLIC_") && /secret|service|token|password/i.test(name)) {
    problems.push(`${name} : un secret ne doit jamais porter le préfixe NEXT_PUBLIC_`);
  }

  if (name.startsWith("NEXT_PUBLIC_") && value?.startsWith("sb_secret_")) {
    problems.push(`${name} contient une clé secrète`);
  }
}

if (env.SUPABASE_SECRET_KEY && !env.SUPABASE_SECRET_KEY.startsWith("sb_secret_")) {
  problems.push("SUPABASE_SECRET_KEY n'a pas la forme d'une clé secrète");
}

if (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_")) {
  problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY n'a pas la forme d'une clé publique");
}

if (env.COURIER_API_TOKEN && env.COURIER_API_TOKEN.length < 32) {
  problems.push("COURIER_API_TOKEN : 32 caractères au moins");
}

if (env.MAINTENANCE_TOKEN && env.MAINTENANCE_TOKEN.length < 32) {
  problems.push("MAINTENANCE_TOKEN : 32 caractères au moins");
}

if (Boolean(env.CLOUDFLARE_TURN_KEY_ID) !== Boolean(env.CLOUDFLARE_TURN_API_TOKEN)) {
  problems.push("CLOUDFLARE_TURN_KEY_ID et CLOUDFLARE_TURN_API_TOKEN vont ensemble");
}

const staticTurn = [env.TURN_URLS, env.TURN_USERNAME, env.TURN_PASSWORD].filter(Boolean).length;
if (staticTurn > 0 && staticTurn < 3) {
  problems.push("TURN_URLS, TURN_USERNAME et TURN_PASSWORD vont ensemble");
}

if (env.TURN_URLS && env.TURN_URLS.split(",").some((url) => !/^(turns?:)?[\w.-]+:\d+(\?transport=(udp|tcp))?$/.test(url.trim()))) {
  problems.push("TURN_URLS : adresses de la forme turn:hôte:port, séparées par des virgules");
}

const isLocalUrl = (value) => /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(value ?? "");

if (remote) {
  if (env.NEXT_PUBLIC_FRIPE_ENV !== target) problems.push(`NEXT_PUBLIC_FRIPE_ENV doit valoir ${target}`);

  for (const name of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    if (env[name] && (isLocalUrl(env[name]) || !env[name].startsWith("https://"))) {
      problems.push(`${name} doit être en HTTPS et distante`);
    }
  }

  // Cible attendue : la référence du projet de cet environnement, vérifiée en positif.
  const expected = env.FRIPE_STAGING_REF;

  if (target === "staging" && expected && env.NEXT_PUBLIC_SUPABASE_URL !== `https://${expected}.supabase.co`) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL ne désigne pas le projet attendu");
  }

  if (target === "staging" && !expected) problems.push("FRIPE_STAGING_REF manquante : la cible n'est pas vérifiée");

  // Liste des anciens projets, à renseigner : un projet existant ne doit jamais être visé.
  const forbidden = (env.FRIPE_FORBIDDEN_SUPABASE_REFS ?? "").split(",").filter(Boolean);

  if (forbidden.some((ref) => env.NEXT_PUBLIC_SUPABASE_URL?.includes(ref))) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL désigne un projet interdit");
  }
} else if (env.NEXT_PUBLIC_SUPABASE_URL && !isLocalUrl(env.NEXT_PUBLIC_SUPABASE_URL)) {
  problems.push("En local, NEXT_PUBLIC_SUPABASE_URL doit rester locale");
}

if (problems.length) {
  console.error(`Environnement ${target} invalide :`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Environnement ${target} valide (${required.length} variables contrôlées).`);
}
