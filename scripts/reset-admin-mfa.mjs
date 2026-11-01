// Dernier recours : un administrateur a perdu tous ses appareils. Voir docs/administration-mfa.md.
// Usage : pnpm admin:mfa-reset <email> "<opérateur>" "<motif>"
import { createClient } from "@supabase/supabase-js";

const [email, operator, reason] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!email || !operator || !reason || reason.length < 3 || !url || !key) {
  throw new Error('Usage : pnpm admin:mfa-reset <email> "<opérateur>" "<motif>" (avec .env.local renseigné).');
}

if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url) && process.env.FRIPE_CONFIRM_REMOTE !== email) {
  throw new Error("Refus : hors local, FRIPE_CONFIRM_REMOTE doit reprendre cet e-mail.");
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;

const user = data.users.find((candidate) => candidate.email === email.toLowerCase());
if (!user) throw new Error(`Aucun compte pour ${email}.`);

const { data: admin } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
if (!admin) throw new Error("Ce compte n'est pas administrateur.");

// Le rôle et les sessions d'abord : même si la suite échoue, l'accès est déjà coupé.
const { error: resetError } = await supabase.rpc("reset_admin_access", {
  p_user_id: user.id,
  p_operator: operator,
  p_reason: reason,
});

if (resetError) throw resetError;

const { data: factors, error: listError } = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
if (listError) throw listError;

for (const factor of factors.factors) {
  const { error: deleteError } = await supabase.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id });
  if (deleteError) throw deleteError;
}

console.log(`Accès retiré, ${factors.factors.length} facteur(s) supprimé(s). Refaire la procédure de nomination.`);
