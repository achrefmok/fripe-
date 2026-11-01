import { expect, test } from "@playwright/test";
import {
  admin,
  createConfirmedUser,
  latestMailLink,
  PASSWORD,
  signIn,
  signUpInUi,
  uniqueEmail,
} from "./helpers";

test("parcours 1 : inscription, confirmation par e-mail, connexion", async ({ page }) => {
  const email = uniqueEmail("client");
  await signUpInUi(page, email);

  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Confirme d'abord");

  await page.goto(await latestMailLink(email, "/auth/confirm"));
  await expect(page).toHaveURL(/\/compte$/);
  await expect(page.getByRole("heading", { name: "Salut Lina Test" })).toBeVisible();
});

test("le lien de confirmation fonctionne dans un autre navigateur", async ({ page, browser }) => {
  const email = uniqueEmail("mobile");
  await signUpInUi(page, email);
  const link = await latestMailLink(email, "/auth/confirm");

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(link);
  await expect(otherPage).toHaveURL(/\/compte$/);
  await other.close();
});

test("un lien de confirmation déjà utilisé est refusé", async ({ page }) => {
  const email = uniqueEmail("reuse");
  await signUpInUi(page, email);
  const link = await latestMailLink(email, "/auth/confirm");

  await page.goto(link);
  await expect(page).toHaveURL(/\/compte$/);
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/lien-invalide/);
});

test("le formulaire signale les erreurs sans rien envoyer", async ({ page }) => {
  await page.goto("/inscription");
  await page.getByLabel("Adresse e-mail").fill("pas-un-email");
  await page.getByLabel("Mot de passe").fill("123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Indique au moins 2 caractères.")).toBeVisible();
  await expect(page.getByText("Cette adresse e-mail n'est pas valide.")).toBeVisible();
  await expect(page.getByText("Utilise au moins 8 caractères.")).toBeVisible();
});

test("un mauvais mot de passe est refusé", async ({ page }) => {
  const { email } = await createConfirmedUser("wrong");
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("E-mail ou mot de passe incorrect");
});

test("une page protégée renvoie vers la connexion puis y revient", async ({ page }) => {
  const { email } = await createConfirmedUser("next");
  await page.goto("/compte/profil");
  await expect(page).toHaveURL(/connexion\?next=%2Fcompte%2Fprofil/);

  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/compte\/profil$/);
});

test("une redirection externe après connexion est ignorée", async ({ page }) => {
  const { email } = await createConfirmedUser("open");
  await signIn(page, email, "https://example.com/piege");
  await expect(page).toHaveURL(/localhost:3100\/compte$/);
});

test("réinitialisation du mot de passe par e-mail", async ({ page }) => {
  const { email } = await createConfirmedUser("reset");
  await page.goto("/mot-de-passe-oublie");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByRole("status")).toContainText("le lien vient de partir", {
    timeout: 15_000,
  });

  await page.goto(await latestMailLink(email, "type=recovery"));
  await expect(page).toHaveURL(/nouveau-mot-de-passe/);
  await page.getByLabel("Mot de passe").fill("nouveau-portant-2026");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page).toHaveURL(/\/compte$/);

  await page.context().clearCookies();
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("nouveau-portant-2026");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/compte$/);
});

test("le profil se modifie et persiste en base", async ({ page }) => {
  const { email } = await createConfirmedUser("profile");
  await signIn(page, email, "/compte/profil");

  await page.getByLabel("Téléphone").fill("22 123 456");
  await page.getByLabel("Ton nom").fill("Nom Modifié");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modifications enregistrées")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Ton nom")).toHaveValue("Nom Modifié");
  await expect(page.getByLabel("Téléphone")).toHaveValue("22123456");
});

test("la déconnexion ferme la session", async ({ page }) => {
  const { email } = await createConfirmedUser("logout");
  await signIn(page, email);
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/localhost:3100\/$/);
  await page.goto("/compte");
  await expect(page).toHaveURL(/connexion/);
});

test("inscription en arabe : langue du profil et retour sur l'interface arabe", async ({ page }) => {
  const email = uniqueEmail("arabe");
  await page.goto("/ar/inscription");
  await page.getByLabel("اسمك").fill("ليلى");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة السر").fill("قصير");
  await page.getByRole("button", { name: "إنشاء حسابي" }).click();
  await expect(page.getByText("استعمل 8 أحرف على الأقل.")).toBeVisible();

  await page.getByLabel("كلمة السر").fill(PASSWORD);
  await page.getByRole("button", { name: "إنشاء حسابي" }).click();
  await expect(page).toHaveURL(/\/ar\/verification-email/);

  await page.goto(await latestMailLink(email, "/auth/confirm"));
  await expect(page).toHaveURL(/\/ar\/compte$/);
  await expect(page.getByRole("heading", { name: "مرحبا ليلى" })).toBeVisible();

  const { data } = await admin.from("profiles").select("locale").eq("display_name", "ليلى").limit(1);
  expect(data?.[0]?.locale).toBe("ar");
});
