// Génère .env.local depuis le Supabase LOCAL uniquement. N'affiche jamais les clés.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const status = JSON.parse(execSync("pnpm exec supabase status -o json", { encoding: "utf8" }));

if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(status.API_URL)) {
  throw new Error("Refus : cette commande ne s'applique qu'au Supabase local.");
}

writeFileSync(
  ".env.local",
  [
    "NEXT_PUBLIC_SITE_URL=http://localhost:3000",
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}`,
    `SUPABASE_SECRET_KEY=${status.SECRET_KEY}`,
    "",
  ].join("\n"),
);

console.log(".env.local écrit pour le Supabase local.");
