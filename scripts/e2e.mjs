// Construit l'application pour le stack de test, puis lance Playwright sur le port 3100.
// Le build de développement doit être refait ensuite : les variables NEXT_PUBLIC y sont figées.
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const env = { ...process.env, ...JSON.parse(readFileSync(".test-stack/env.json", "utf8")) };

function run(args) {
  const result = spawnSync("pnpm", args, { env, stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!process.argv.includes("--no-build")) {
  // Build propre : le cache Turbopack peut resservir une ancienne feuille de style.
  rmSync(".next", { recursive: true, force: true });
  run(["exec", "next", "build"]);
}

const filters = process.argv.slice(2).filter((argument) => argument !== "--no-build");
run(["exec", "playwright", "test", ...filters]);
