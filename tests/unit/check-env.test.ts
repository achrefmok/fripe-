import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SECRET = "sb_secret_valeur_de_test_jamais_affichee";

const staging = {
  NEXT_PUBLIC_FRIPE_ENV: "staging",
  NEXT_PUBLIC_SITE_URL: "https://fripe-staging.vercel.app",
  NEXT_PUBLIC_SUPABASE_URL: "https://nouveauprojet.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_valeur",
  SUPABASE_SECRET_KEY: SECRET,
  MAINTENANCE_TOKEN: "m".repeat(40),
  FRIPE_STAGING_REF: "nouveauprojet",
};

function check(target: string, env: Record<string, string>) {
  const base = { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "" };
  return spawnSync("node", ["scripts/check-env.mjs", target], { env: { ...base, ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });
}

describe("contrôle des variables", () => {
  it("accepte une préproduction complète, sans afficher de valeur", () => {
    const result = check("staging", staging);

    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain(SECRET);
  });

  it.each([
    ["variable absente", { MAINTENANCE_TOKEN: "" }, "MAINTENANCE_TOKEN"],
    ["jeton court", { MAINTENANCE_TOKEN: "court" }, "32 caractères"],
    ["URL locale", { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }, "HTTPS"],
    ["site en HTTP", { NEXT_PUBLIC_SITE_URL: "http://fripe.test" }, "HTTPS"],
    ["mauvais environnement", { NEXT_PUBLIC_FRIPE_ENV: "production" }, "staging"],
    ["clé publique à la place de la clé secrète", { SUPABASE_SECRET_KEY: "sb_publishable_x" }, "clé secrète"],
    ["clé secrète publiée", { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: SECRET }, "clé secrète"],
    ["secret public", { NEXT_PUBLIC_SECRET_KEY: "x" }, "NEXT_PUBLIC_"],
    ["ancien projet", { FRIPE_FORBIDDEN_SUPABASE_REFS: "nouveauprojet" }, "projet interdit"],
    ["cible différente", { FRIPE_STAGING_REF: "autreprojet" }, "projet attendu"],
    ["cible non déclarée", { FRIPE_STAGING_REF: "" }, "FRIPE_STAGING_REF"],
  ])("refuse : %s", (_label, change, message) => {
    const result = check("staging", { ...staging, ...change });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(result.stderr).not.toContain(SECRET);
  });

  it("refuse une URL distante en environnement local", () => {
    const result = check("local", { ...staging, NEXT_PUBLIC_FRIPE_ENV: "" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("locale");
  });

  it("refuse une cible inconnue", () => {
    expect(check("cloud", staging).status).toBe(1);
  });
});
