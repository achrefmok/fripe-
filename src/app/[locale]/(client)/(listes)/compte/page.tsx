import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";

export async function generateMetadata() {
  const t = await getTranslations("account");
  return { title: t("title") };
}

export default async function AccountPage() {
  const viewer = await requireViewer("/compte");
  const [t, orders, reservations, favorites, requests, messaging, social, outfits, market] = await Promise.all([
    getTranslations("account"),
    getTranslations("orders"),
    getTranslations("reservations"),
    getTranslations("favorites"),
    getTranslations("requests"),
    getTranslations("messaging"),
    getTranslations("social"),
    getTranslations("outfits"),
    getTranslations("market"),
  ]);

  const links = [
    { href: "/compte/annonces", label: market("myListingsLink"), hint: market("myListingsHint") },
    { href: "/compte/echanges", label: market("threadsLink"), hint: market("threadsHint") },
    { href: "/compte/commandes", label: orders("title"), hint: orders("emptyBody") },
    { href: "/compte/reservations", label: reservations("title"), hint: reservations("emptyBody") },
    { href: "/compte/favoris", label: favorites("title"), hint: favorites("emptyBody") },
    { href: "/compte/demandes", label: requests("title"), hint: requests("emptyBody") },
    { href: "/compte/messages", label: messaging("title"), hint: t("messagesHint") },
    { href: "/compte/notifications", label: social("notificationsTitle"), hint: t("notificationsHint") },
    { href: "/compte/alertes", label: social("alertsTitle"), hint: t("alertsHint") },
    { href: "/compte/suivis", label: social("followingTitle"), hint: t("followingHint") },
    { href: "/compte/blocages", label: messaging("blocksTitle"), hint: t("blocksHint") },
    { href: "/tenues", label: outfits("title"), hint: t("outfitsHint") },
    { href: "/compte/profil", label: t("profileLink"), hint: t("profileHint") },
    {
      href: "/vendeur",
      label: t("sellLink"),
      hint: viewer.shopCount ? t("sellHint", { count: viewer.shopCount }) : t("sellHintNone"),
    },
    ...(viewer.isAdmin
      ? [
          { href: "/admin", label: t("adminLink"), hint: t("adminHint") },
          { href: "/compte/securite", label: t("securityLink"), hint: t("securityHint") },
        ]
      : []),
  ];

  return (
    <>
      <h1 className="font-display text-4xl leading-tight font-extrabold">
        {t("greeting", { name: viewer.displayName })}
      </h1>
      <p className="mt-1 text-muted-foreground">{viewer.email}</p>

      <ul className="mt-8 divide-y border-y">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="group flex items-center gap-3 py-4">
              <span className="flex-1">
                <span className="block font-semibold">{link.label}</span>
                <span className="block text-sm text-muted-foreground">{link.hint}</span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 -ms-3">
        <SignOutButton />
      </div>
    </>
  );
}
