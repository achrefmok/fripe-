// Nomme un administrateur : pnpm admin:grant <email> <empreinte>.
// L'empreinte s'affiche sur /preparation-admin et doit être transmise en personne ou par un canal
// de confiance : elle prouve que le facteur enregistré est bien celui du titulaire.
import { createClient } from "@supabase/supabase-js";

const [email, fingerprint] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!email || !fingerprint || !url || !key) {
  throw new Error("Usage : pnpm admin:grant <email> <empreinte> (avec .env.local renseigné).");
}

if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url) && process.env.FRIPE_CONFIRM_REMOTE !== email) {
  throw new Error("Refus : hors local, FRIPE_CONFIRM_REMOTE doit reprendre cet e-mail.");
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;

const user = data.users.find((candidate) => candidate.email === email.toLowerCase());
if (!user) throw new Error(`Aucun compte pour ${email}.`);

const { data: factors, error: listError } = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
if (listError) throw listError;

const verified = factors.factors.filter((factor) => factor.status === "verified");
if (!verified.length) throw new Error("Aucun facteur vérifié : passer d'abord par /preparation-admin.");

if (!verified.some((factor) => factor.id.startsWith(fingerprint))) {
  throw new Error("Empreinte inconnue : ne pas accorder le rôle, et vérifier ce compte.");
}

const { error: insertError } = await supabase.from("platform_admins").upsert({ user_id: user.id });
if (insertError) throw insertError;

console.log(`${email} est administrateur. Se reconnecter pour obtenir une session valable.`);
