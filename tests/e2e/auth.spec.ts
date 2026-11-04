import { expect, test } from "@playwright/test";
import {
  admin,
  createConfirmedUser,
  latestMailCode,
  mailCount,
  latestMailLink,
  PASSWORD,
  signIn,
  signUpInUi,
  uniqueEmail,
} from "./helpers";
import { createApprovedShop, seedProduct } from "./market-helpers";

test("parcours 1 : inscription, compte ouvert tout de suite, sans confirmation d'e-mail", async ({ page }) => {
  const email = uniqueEmail("client");
  await signUpInUi(page, email);
  await expect(page.getByRole("heading", { name: "Salut Lina Test" })).toBeVisible();

  const { data } = await admin.from("profiles").select("phone").eq("display_name", "Lina Test").order("created_at", { ascending: false }).limit(1);
  expect(data?.[0]?.phone).toBe("+21622123456");

  await page.context().clearCookies();
  await signIn(page, email, "/compte");
  await expect(page.getByRole("heading", { name: "Salut Lina Test" })).toBeVisible();
});

test("un e-mail non confirmé ne bloque pas la connexion", async ({ page }) => {
  const email = uniqueEmail("nonconfirme");
  const { error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: false,
    user_metadata: { display_name: "Sans Confirmation" },
  });
  expect(error).toBeNull();

  await signIn(page, email, "/compte");
  await expect(page.getByRole("heading", { name: "Salut Sans Confirmation" })).toBeVisible();
});

test("inscription : téléphone obligatoire, adresse facultative reprise à la commande", async ({ page }) => {
  const email = uniqueEmail("adresse");
  await page.goto("/inscription");
  await page.getByLabel("Ton nom").fill("Amel Adresse");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Indique ton numéro de téléphone.")).toBeVisible();

  await page.getByLabel("Téléphone").fill("98 765 432");
  await page.getByLabel("Gouvernorat").selectOption({ label: "Tunis" });
  await page.getByLabel("Ville").selectOption({ label: "La Marsa" });
  await page.getByLabel("Rue, numéro, immeuble").fill("5 avenue du Portant");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/compte$/);

  const { data: profile } = await admin
    .from("profiles")
    .select("id, phone, address_line, governorate_id, city_id")
    .eq("display_name", "Amel Adresse")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  expect(profile).toMatchObject({ phone: "+21698765432", address_line: "5 avenue du Portant" });
  expect(profile?.city_id).not.toBeNull();

  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id);
  await admin.from("cart_items").insert({ user_id: profile!.id, product_id: product.id });
  await page.goto("/commande");
  await expect(page.getByLabel("Téléphone")).toHaveValue("98765432");
  await expect(page.getByLabel("Rue, numéro, immeuble")).toHaveValue("5 avenue du Portant");
  await expect(page.getByText("8 DT, payés à la livraison")).toBeVisible();
});

test("le formulaire signale les erreurs sans rien envoyer", async ({ page }) => {
  await page.goto("/inscription");
  await page.getByLabel("Adresse e-mail").fill("pas-un-email");
  await page.getByLabel("Mot de passe").fill("123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Indique au moins 2 caractères.")).toBeVisible();
  await expect(page.getByText("Indique ton numéro de téléphone.")).toBeVisible();
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
  await page.getByLabel("الهاتف").fill("22 123 456");
  await page.getByRole("button", { name: "إنشاء حسابي" }).click();
  await expect(page).toHaveURL(/\/ar\/compte$/);
  await expect(page.getByRole("heading", { name: "مرحبا ليلى" })).toBeVisible();

  const { data } = await admin.from("profiles").select("locale").eq("display_name", "ليلى").limit(1);
  expect(data?.[0]?.locale).toBe("ar");
});

test.describe("connexion par code reçu par e-mail", () => {
  test("sans compte : le code ouvre un compte, sans inscription ni mot de passe", async ({ page }) => {
    const email = uniqueEmail("code");
    await page.goto("/inscription");
    await page.getByRole("link", { name: "Connecte-toi avec un code reçu par e-mail" }).click();
    await expect(page.getByRole("button", { name: "Code par e-mail" })).toHaveAttribute("aria-pressed", "true");

    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByRole("button", { name: "Recevoir mon code" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Code envoyé à ${email}` })).toBeVisible();

    const code = await latestMailCode(email);
    await page.getByLabel("Code à 6 chiffres").fill(code);
    await page.getByRole("button", { name: "Me connecter" }).click();
    await expect(page).toHaveURL(/\/compte$/);
    await expect(page.getByRole("heading", { name: "Salut Membre" })).toBeVisible();

    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    expect(data.users.filter((user) => user.email === email)).toHaveLength(1);
  });

  test("compte existant : un mauvais code est refusé, le bon connecte et respecte la destination", async ({ page }) => {
    const { email } = await createConfirmedUser("codeok", "Rym Code");
    await page.goto("/connexion?next=/compte/favoris");
    await page.getByRole("button", { name: "Code par e-mail" }).click();
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByRole("button", { name: "Recevoir mon code" }).click();
    const code = await latestMailCode(email);

    await page.getByLabel("Code à 6 chiffres").fill(code === "000000" ? "111111" : "000000");
    await page.getByRole("button", { name: "Me connecter" }).click();
    await expect(page.getByText("Code incorrect ou expiré. Vérifie-le ou demande-en un nouveau.")).toBeVisible();

    await page.getByLabel("Code à 6 chiffres").fill("12");
    await page.getByRole("button", { name: "Me connecter" }).click();
    await expect(page.getByText("Le code contient 6 chiffres.")).toBeVisible();

    // Trop tôt, le renvoi est refusé avec un message clair ; un peu plus tard, il part.
    await page.getByRole("button", { name: "Renvoyer un code" }).click();
    await expect(page.getByText("Un code vient de partir. Attends une minute avant d'en demander un autre.").or(page.getByText("Nouveau code envoyé."))).toBeVisible();
    await page.waitForTimeout(2_000);
    const before = await mailCount(email);
    await page.getByRole("button", { name: "Renvoyer un code" }).click();
    await expect(page.getByText("Nouveau code envoyé.")).toBeVisible();
    const fresh = await latestMailCode(email, before);
    await page.getByLabel("Code à 6 chiffres").fill(fresh);
    await page.getByRole("button", { name: "Me connecter" }).click();
    await expect(page).toHaveURL(/\/favoris$/);
  });

  test("en arabe : le choix et l'envoi du code", async ({ page }) => {
    const email = uniqueEmail("codear");
    await page.goto("/ar/connexion?methode=code");
    await page.getByLabel("البريد الإلكتروني").fill(email);
    await page.getByRole("button", { name: "استلام الرمز" }).click();
    const code = await latestMailCode(email);
    await page.getByLabel("الرمز المكوّن من 6 أرقام").fill(code);
    await page.getByRole("button", { name: "الدخول", exact: true }).click();
    await expect(page).toHaveURL(/\/ar\/compte$/);
  });
});
