// Test de toute l'application, sans Docker : `pnpm test:app` (ou `pnpm test:app -- vendeur` pour
// ne parcourir que les pages dont le chemin ou le nom contient « vendeur »).
// Démarre le faux Supabase complet et le site en `next dev`, parcourt toutes les pages en arabe et en
// français, en clair et en sombre, sur téléphone, tablette et ordinateur, puis écrit un PDF dans rapports/.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { startMock } from "./faux-supabase-complet.mjs";
import { CONFIGS, crawl } from "./parcours.mjs";
import { RUNS, runScenarios } from "./scenarios.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MOCK_PORT = 54997;
const SITE_PORT = 3300;
const SITE = `http://localhost:${SITE_PORT}`;
const MOCK = `http://localhost:${MOCK_PORT}`;
const filter = process.argv.slice(2).find((argument) => !argument.startsWith("-"));
const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "h");
const OUT = join(ROOT, "rapports");
const SHOTS = join(OUT, `app-${stamp}`);
mkdirSync(SHOTS, { recursive: true });

let site;
function stop() {
  if (!site || site.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(site.pid), "/T", "/F"], { stdio: "ignore" });
  else site.kill("SIGTERM");
}
process.on("SIGINT", () => {
  stop();
  process.exit(130);
});

async function waitFor(url, timeout = 180_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {
      // Pas encore prêt.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`le site ne répond pas sur ${url}`);
}

const escape = (text) => String(text).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);

const KINDS = {
  erreur: "Erreurs de page",
  rtl: "Sens de lecture (RTL)",
  traduction: "Textes non traduits (pages arabes)",
  contraste: "Contraste insuffisant (champs, options, boutons)",
  débordement: "Débordement horizontal",
  console: "Erreurs dans la console",
};

async function writePdf(issues, scenarios, pageCount, seconds) {
  const browser = await chromium.launch();
  const when = new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
  const total = pageCount * CONFIGS.length;
  const failing = new Set(issues.map((issue) => `${issue.config}|${issue.path}`)).size;
  const sections = Object.entries(KINDS)
    .map(([kind, title]) => {
      const list = issues.filter((issue) => issue.kind === kind);
      if (!list.length) return `<h2>${title}</h2><p class="ok">Aucun problème.</p>`;
      // Un même problème vu sur plusieurs pages ou configurations n'est listé qu'une fois.
      const grouped = new Map();
      for (const issue of list) {
        const key = issue.detail;
        const entry = grouped.get(key) ?? { detail: issue.detail, where: new Set() };
        entry.where.add(`${issue.page} (${issue.config})`);
        grouped.set(key, entry);
      }
      return `<h2>${title} — ${list.length}</h2><table>${[...grouped.values()]
        .map((entry) => `<tr><td>${escape(entry.detail)}</td><td class="where">${escape([...entry.where].slice(0, 6).join(", "))}${entry.where.size > 6 ? ` … +${entry.where.size - 6}` : ""}</td></tr>`)
        .join("")}</table>`;
    })
    .join("");
  const steps = scenarios.flatMap((result) => result.steps);
  const failedSteps = steps.filter((step) => !step.ok);
  const scenarioRows = scenarios
    .map((result) => {
      const failed = result.steps.filter((step) => !step.ok);
      const detail = failed.length
        ? failed.map((step) => `${step.name}${step.detail ? ` (${step.detail})` : ""}`).join(" ; ")
        : result.steps.map((step) => step.name).join(" · ");
      return `<tr><td class="${failed.length ? "ko" : "ok"}">${failed.length ? "ÉCHEC" : "OK"}</td><td>${escape(result.scenario)}</td><td class="where">${escape(result.run)}</td><td>${escape(detail)}</td></tr>`;
    })
    .join("");
  const pictures = readdirSync(SHOTS)
    .filter((file) => file.endsWith(".png") && /^(ar-desktop-clair|ar-mobile-sombre)--/.test(file))
    .slice(0, 40)
    .map((file) => `<figure class="${file.includes("mobile") ? "phone" : ""}"><img src="data:image/png;base64,${readFileSync(join(SHOTS, file)).toString("base64")}"><figcaption>${escape(file.replace(".png", "").replace("--", " · "))}</figcaption></figure>`)
    .join("");

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 15mm 13mm; }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #241a17; font-size: 10.5pt; }
    h1 { font-family: Georgia, serif; font-weight: 400; font-size: 24pt; margin: 0; }
    h2 { font-family: Georgia, serif; font-weight: 400; font-size: 14pt; margin: 20px 0 6px; border-bottom: 1px solid #e5d9c6; padding-bottom: 3px; }
    .meta { color: #6b5d55; }
    .score { display: inline-block; padding: 9px 14px; border-radius: 10px; font-weight: 600; background: ${issues.length ? "#f7e3e0; color: #7a1f16" : "#e7f2e4; color: #24572a"}; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    td { padding: 4px 5px; border-bottom: 1px solid #eee4d6; vertical-align: top; }
    td.where { width: 38%; color: #6b5d55; }
    .ok { color: #24572a; }
    .ko { color: #9b2116; font-weight: 700; }
    ul { padding-inline-start: 18px; }
    figure { display: inline-block; width: 48%; margin: 0 1% 12px; vertical-align: top; page-break-inside: avoid; }
    figure img { width: 100%; border: 1px solid #e5d9c6; border-radius: 6px; }
    figure.phone img { width: 60%; }
    figcaption { font-size: 8pt; color: #6b5d55; }
  </style></head><body>
    <h1>Rapport de test — application Friptex</h1>
    <p class="meta">${escape(when)} · ${seconds} s · Playwright (Chromium)</p>
    <p class="score">${pageCount} pages × ${CONFIGS.length} configurations = ${total} affichages · ${failing} avec au moins un problème · ${issues.length} problème(s)</p>
    <p class="score">Scénarios d'utilisation : ${steps.length - failedSteps.length} / ${steps.length} étapes réussies (${RUNS.map((run) => run.key).join(", ")})</p>
    <p class="meta">Configurations du parcours : ${CONFIGS.map((config) => escape(config.label)).join(" ; ")}.</p>
    <p class="meta">Le site tourne en local sur un faux Supabase qui fabrique des données d'exemple à partir des types de la base
      (textes saisis en arabe, champs <code>*_fr</code> marqués « NomFR ») et simule une personne connectée, vendeuse et administratrice.
      Sur une page arabe, un texte latin signale donc une traduction manquante ou un champ français affiché à tort.
      Les envois réels (paiement, messages, téléversements) ne sont pas exécutés.</p>
    <h2>Scénarios d'utilisation (clics, saisie, menus, formulaires)</h2>
    <table>${scenarioRows || "<tr><td>Non lancés (parcours filtré).</td></tr>"}</table>
    ${sections}
    <h2 style="page-break-before: always">Captures (arabe)</h2>
    ${pictures}
  </body></html>`;

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const file = join(OUT, `rapport-application-${stamp}.pdf`);
  await page.pdf({ path: file, format: "A4", printBackground: true });
  await browser.close();
  return file;
}

const began = Date.now();
let code = 0;
try {
  console.log("1/4  Faux Supabase complet…");
  const mock = await startMock(MOCK_PORT);

  console.log(`2/4  Site en mode dev sur ${SITE} (chaque page compile au premier passage)…`);
  const windows = process.platform === "win32";
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: MOCK, NEXT_PUBLIC_SITE_URL: SITE };
  const launch = async () => {
    site = windows
      ? spawn(`pnpm exec next dev -p ${SITE_PORT}`, { cwd: ROOT, env, shell: true })
      : spawn("pnpm", ["exec", "next", "dev", "-p", String(SITE_PORT)], { cwd: ROOT, env });
    site.stdout?.resume();
    site.stderr?.resume();
    await waitFor(`${SITE}/connexion`);
  };
  // Relance du serveur dev quand il cesse de répondre en plein parcours.
  const revive = async () => {
    stop();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await launch();
  };
  await launch();

  console.log("3/4  Parcours de toutes les pages, puis scénarios d'utilisation…");
  const { issues, pages } = await crawl({ site: SITE, mock: MOCK, filter, shots: SHOTS, revive });
  const scenarios = filter ? [] : await runScenarios({ site: SITE, shots: SHOTS, revive });
  writeFileSync(join(OUT, `rapport-application-${stamp}.json`), JSON.stringify({ issues, scenarios }, null, 2));

  console.log("4/4  PDF…");
  const file = await writePdf(issues, scenarios, pages, Math.round((Date.now() - began) / 1000));
  const failedSteps = scenarios.flatMap((result) => result.steps).filter((step) => !step.ok).length;
  console.log(`\n${issues.length} problème(s) sur ${pages} pages × ${CONFIGS.length} configurations · ${failedSteps} étape(s) de scénario en échec.\nRapport : ${file}`);
  if (issues.length || failedSteps) code = 1;
  mock.close();
} catch (error) {
  console.error(`\nLe rapport n'a pas pu être produit : ${error.message}`);
  code = 1;
} finally {
  stop();
}
process.exit(code);
