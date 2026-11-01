import "server-only";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ShopRole = Database["public"]["Enums"]["shop_role"];

export type Viewer = {
  id: string;
  email: string | null;
  displayName: string;
  phone: string | null;
  locale: "fr" | "ar";
  status: "active" | "suspended";
  isAdmin: boolean;
  aal: string | null;
  shopCount: number;
};

// Mis en cache pour la durée d'une requête : layout et page partagent le même résultat.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    return null;
  }

  const [profile, admin, memberships] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", claims.sub).maybeSingle(),
    supabase.from("platform_admins").select("user_id").eq("user_id", claims.sub).maybeSingle(),
    supabase
      .from("shop_members")
      .select("shop_id", { count: "exact", head: true })
      .eq("user_id", claims.sub),
  ]);

  // Une session encore valide ne fait pas revivre un compte supprimé.
  if (!profile.data || profile.data.status === "deleted") {
    return null;
  }

  return {
    id: claims.sub,
    email: claims.email ?? null,
    displayName: profile.data.display_name,
    phone: profile.data.phone,
    locale: profile.data.locale,
    status: profile.data.status,
    isAdmin: Boolean(admin.data),
    aal: typeof claims.aal === "string" ? claims.aal : null,
    shopCount: memberships.count ?? 0,
  };
});

export async function requireViewer(next: string): Promise<Viewer> {
  const viewer = await getViewer();
  const locale = await getLocale();

  if (!viewer) {
    return redirect({ href: { pathname: "/connexion", query: { next } }, locale });
  }

  if (viewer.status === "suspended") {
    return redirect({ href: "/compte-suspendu", locale });
  }

  return viewer;
}

// Un non-admin reçoit un 404 : l'espace d'administration ne révèle pas son existence.
export async function requireAdmin(next: string): Promise<Viewer> {
  const viewer = await requireViewer(next);

  if (!viewer.isAdmin) {
    notFound();
  }

  // Confort d'interface : la vraie barrière est is_platform_admin(), dans la base.
  if (viewer.aal !== "aal2") {
    return redirect({ href: { pathname: "/verification-mfa", query: { next } }, locale: await getLocale() });
  }

  return viewer;
}

const SHOP_ROLES: ShopRole[] = ["owner", "manager", "staff"];

// Garde commune aux pages vendeur : un membre d'une autre boutique reçoit un 404.
export async function requireShopAccess(shopId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(shopId)) {
    notFound();
  }

  return requireShopRole(shopId, SHOP_ROLES, `/vendeur/boutique/${shopId}`);
}

export async function requireShopRole(shopId: string, roles: ShopRole[], next: string) {
  const viewer = await requireViewer(next);
  const supabase = await createClient();

  const { data } = await supabase
    .from("shop_members")
    .select("role")
    .eq("shop_id", shopId)
    .eq("user_id", viewer.id)
    .maybeSingle();

  if (!data || !roles.includes(data.role)) {
    notFound();
  }

  return { viewer, role: data.role };
}
