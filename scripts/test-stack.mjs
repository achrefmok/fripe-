// Stack Supabase séparé pour les tests : le Supabase de développement et ses données ne sont
// jamais touchés. Il est recréé depuis les migrations, ce qui vérifie aussi leur rejeu complet.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const WORKDIR = ".test-stack";
const EXCLUDED = "vector,logflare,imgproxy,edge-runtime,studio,postgres-meta";

function run(command) {
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function writeConfig() {
  rmSync(`${WORKDIR}/supabase/migrations`, { recursive: true, force: true });
  mkdirSync(`${WORKDIR}/supabase`, { recursive: true });

  for (const entry of ["migrations", "templates", "tests", "seed.sql"]) {
    cpSync(`supabase/${entry}`, `${WORKDIR}/supabase/${entry}`, { recursive: true });
  }

  const config = readFileSync("supabase/config.toml", "utf8")
    .replace(/^project_id = .*/m, 'project_id = "fripe-test"')
    .replace(/\b5432(\d)\b/g, "5532$1")
    .replace(/^site_url = .*/m, 'site_url = "http://localhost:3100"')
    .replace(/^additional_redirect_urls = .*/m, 'additional_redirect_urls = ["http://localhost:3100/**"]')
    .replace(/^sign_in_sign_ups = .*/m, "sign_in_sign_ups = 5000")
    .replace(/^token_verifications = .*/m, "token_verifications = 5000")
    // Rejoue les migrations sans droits par défaut, comme un projet neuf pourrait l'être.
    .replace(
      /^# auto_expose_new_tables = true$/m,
      `auto_expose_new_tables = ${process.env.FRIPE_STRICT_GRANTS ? "false" : "true"}`,
    );

  writeFileSync(`${WORKDIR}/supabase/config.toml`, config);
}

writeConfig();

// Chaque lancement repart d'un stack neuf, sans jamais toucher au projet fripe-local. Le volume est
// retiré même si le stack est déjà arrêté : d'anciennes données fausseraient les tests.
try {
  run(`pnpm exec supabase stop --no-backup --workdir ${WORKDIR}`);
} catch {
  // Rien à arrêter.
}

run(`pnpm exec supabase start -x ${EXCLUDED} --workdir ${WORKDIR}`);

const status = JSON.parse(run(`pnpm exec supabase status -o json --workdir ${WORKDIR}`));

if (!status.API_URL.includes(":55321")) {
  throw new Error("Refus : le stack de test doit utiliser le port 55321.");
}

writeFileSync(
  `${WORKDIR}/env.json`,
  JSON.stringify({
    FRIPE_E2E: "1",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: status.SECRET_KEY,
    MAILPIT_URL: status.MAILPIT_URL,
    MAINTENANCE_TOKEN: randomBytes(24).toString("hex"),
    COURIER_API_TOKEN: randomBytes(24).toString("hex"),
    // Modération des médias : un classifieur de test, piloté par un marqueur placé dans les fichiers.
    MEDIA_MODERATION_PROVIDER: "fixture",
  }),
);

console.log("Stack de test prêt.");
