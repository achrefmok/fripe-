// Ouvrir le site sans Docker : `pnpm apercu`, puis http://localhost:3300 dans le navigateur.
// Le faux Supabase du banc de test fournit des données d'exemple (photos de scripts/seed-photos,
// vrai arbre de catégories relu dans les migrations). Rien n'est écrit dans une vraie base.
// Tourne à côté de `pnpm dev` : dossier de build et tsconfig séparés. Ctrl+C pour arrêter.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startMock } from "./faux-supabase-complet.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MOCK = "http://localhost:54997";
const SITE = "http://localhost:3300";

const NEXT_ENV = join(ROOT, "next-env.d.ts");
let nextEnv = null;
try {
  nextEnv = readFileSync(NEXT_ENV, "utf8");
} catch {
  // Pas encore généré.
}

const mock = await startMock(54997);
writeFileSync(
  join(ROOT, "tsconfig.test.json"),
  `${JSON.stringify({ extends: "./tsconfig.json", include: ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next-test/types/**/*.ts", ".next-test/dev/types/**/*.ts"], exclude: ["node_modules"] }, null, 2)}\n`,
);
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: MOCK, NEXT_PUBLIC_SITE_URL: SITE, FRIPE_DIST_DIR: ".next-test" };
const site =
  process.platform === "win32"
    ? spawn("pnpm exec next dev -p 3300", { cwd: ROOT, env, shell: true, stdio: "inherit" })
    : spawn("pnpm", ["exec", "next", "dev", "-p", "3300"], { cwd: ROOT, env, stdio: "inherit" });

console.log(`\nAperçu sans Docker : ${SITE}/accueil-preview (en arabe : ${SITE}/ar/accueil-preview)`);
console.log("Données d'exemple seulement. Ctrl+C pour arrêter.\n");

function stop() {
  if (nextEnv !== null) writeFileSync(NEXT_ENV, nextEnv);
  mock.close();
  if (site.exitCode === null) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(site.pid), "/T", "/F"], { stdio: "ignore" });
    else site.kill("SIGTERM");
  }
}
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
site.on("exit", () => {
  stop();
  process.exit(0);
});
