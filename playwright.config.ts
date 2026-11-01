import { defineConfig, devices } from "@playwright/test";

// Le stack de test est imposé : ces tests créent des données et ne doivent jamais viser
// le Supabase de développement. Lancer avec `pnpm test:e2e`.
if (process.env.FRIPE_E2E !== "1" || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(":55321")) {
  throw new Error("Refus : lancer les tests avec `pnpm test:e2e` (stack de test isolé).");
}

// Sur le build de production : le service worker n'est actif que là.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  // Une action serveur peut dépasser 5 s quand toute la suite charge le poste.
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    locale: "fr-FR",
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "pnpm exec next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
