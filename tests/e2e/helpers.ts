import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const MAILPIT = process.env.MAILPIT_URL!;
export const PASSWORD = "portant-2026!";

export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
);

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@test.local`;
}

async function searchMail(email: string) {
  const query = encodeURIComponent(`to:${email}`);
  const response = await fetch(`${MAILPIT}/api/v1/search?query=${query}`);
  return (await response.json()).messages ?? [];
}

export async function latestMailLink(email: string, path: string) {
  await expect.poll(async () => (await searchMail(email)).length, { timeout: 10_000 }).toBeGreaterThan(0);

  const [latest] = await searchMail(email);
  const message = await (await fetch(`${MAILPIT}/api/v1/message/${latest.ID}`)).json();
  const link = message.HTML.match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");

  expect(link).toContain(path);
  return link as string;
}

// Le dernier code de connexion reçu, attendu jusqu'à ce qu'un e-mail de plus arrive.
export async function latestMailCode(email: string, previous = 0) {
  await expect.poll(async () => (await searchMail(email)).length, { timeout: 10_000 }).toBeGreaterThan(previous);

  const [latest] = await searchMail(email);
  const message = await (await fetch(`${MAILPIT}/api/v1/message/${latest.ID}`)).json();
  const code = String(message.Text ?? message.HTML).match(/\b([0-9]{6})\b/)?.[1];

  expect(code).toMatch(/^[0-9]{6}$/);
  return code as string;
}

export async function mailCount(email: string) {
  return (await searchMail(email)).length;
}

export async function signUpInUi(page: Page, email: string, name = "Lina Test") {
  await page.goto("/inscription");
  await page.getByLabel("Ton nom").fill(name);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByLabel("Téléphone").fill("22 123 456");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  // Plus de confirmation obligatoire : le compte est ouvert tout de suite.
  await expect(page).toHaveURL(/\/compte$/);
}

export async function createConfirmedUser(prefix: string, name = "Compte Test") {
  const email = uniqueEmail(prefix);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  });

  if (error) throw error;
  return { email, id: data.user.id };
}

// Code TOTP réel (RFC 6238), calculé comme le ferait une application d'authentification.
export function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=+$/, "")]
    .map((character) => alphabet.indexOf(character).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)));

  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));

  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0xf;

  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

const factorSecrets = new Map<string, string>();

// Un administrateur de test passe par le vrai second facteur, comme en usage réel.
export async function createAdminUser() {
  const user = await createConfirmedUser("admin", "Admin Test");

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  await client.auth.signInWithPassword({ email: user.email, password: PASSWORD });

  const { data, error: enrollError } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Test" });
  if (enrollError) throw enrollError;

  const verified = await client.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp(data.totp.secret) });
  if (verified.error) throw verified.error;

  const { error } = await admin.from("platform_admins").insert({ user_id: user.id });
  if (error) throw error;

  factorSecrets.set(user.email, data.totp.secret);

  return { ...user, secret: data.totp.secret };
}

export async function signIn(page: Page, email: string, next?: string) {
  await page.goto(next ? `/connexion?next=${encodeURIComponent(next)}` : "/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.includes("connexion"));

  const secret = factorSecrets.get(email);

  if (secret) {
    await expect(page).toHaveURL(/verification-mfa/);
    await page.getByLabel("Code à 6 chiffres").fill(totp(secret));
    await page.getByRole("button", { name: "Vérifier" }).click();
    await page.waitForURL((url) => !url.pathname.includes("verification-mfa"));
  }
}

export async function fillShopForm(page: Page, name: string) {
  await page.goto("/vendeur/creer-boutique");
  await page.getByLabel("Nom de la boutique").fill(name);
  await page.getByRole("combobox", { name: "Gouvernorat" }).click();
  await page.getByRole("option", { name: "Sfax" }).click();
  await page.getByRole("combobox", { name: "Ville" }).click();
  await page.getByRole("option", { name: "Mahrès" }).click();
  await page.getByRole("button", { name: "Envoyer ma demande" }).click();
}

export async function createShopInUi(page: Page, name: string) {
  await fillShopForm(page, name);
  await expect(page).toHaveURL(/vendeur\/boutique\/[0-9a-f-]{36}/);
  return page.url().split("/").pop() as string;
}
