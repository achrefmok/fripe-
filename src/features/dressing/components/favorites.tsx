"use client";

import { Heart } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { toggleListingFavorite } from "@/features/marketplace/actions";
import { useRouter } from "@/i18n/navigation";
import { getMyListingFavoriteIds } from "../actions";

type Favorites = {
  has: (listingId: string) => boolean;
  toggle: (listingId: string) => Promise<boolean | null>;
};

const FavoritesContext = createContext<Favorites | null>(null);

// Les cœurs du Vide-Dressing partagent un seul état : les favoris arrivent une fois, après
// l'affichage, et chaque carte se met à jour sans recharger la page.
export function DressingFavorites({ next, children }: { next: string; children: ReactNode }) {
  const t = useTranslations("dressing");
  const router = useRouter();
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyListingFavoriteIds()
      .then((result) => {
        if (cancelled) return;
        setSignedIn(result.signedIn);
        setIds(new Set(result.ids));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    async (listingId: string) => {
      if (signedIn === false) {
        toast(t("signInToFavorite"), {
          action: { label: t("signIn"), onClick: () => router.push({ pathname: "/connexion", query: { next } }) },
        });
        return null;
      }

      const favorite = !ids.has(listingId);
      // Le cœur répond tout de suite ; il revient en arrière si le serveur refuse.
      setIds((current) => {
        const copy = new Set(current);
        if (favorite) copy.add(listingId);
        else copy.delete(listingId);
        return copy;
      });

      const result = await toggleListingFavorite(listingId, favorite);
      if (result.ok) return favorite;

      setIds((current) => {
        const copy = new Set(current);
        if (favorite) copy.delete(listingId);
        else copy.add(listingId);
        return copy;
      });

      if (result.error === "sessionExpired") {
        setSignedIn(false);
        toast(t("signInToFavorite"), {
          action: { label: t("signIn"), onClick: () => router.push({ pathname: "/connexion", query: { next } }) },
        });
      } else {
        toast.error(t("favoriteFailed"));
      }
      return null;
    },
    [ids, next, router, signedIn, t],
  );

  const value = useMemo(() => ({ has: (listingId: string) => ids.has(listingId), toggle }), [ids, toggle]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

// Le cœur d'une carte : il se remplit d'un petit rebond et lâche un anneau d'or.
export function DressingHeart({ listingId, title }: { listingId: string; title: string }) {
  const t = useTranslations("dressing");
  const favorites = useContext(FavoritesContext);
  const reduced = useReducedMotion();
  const [burst, setBurst] = useState(0);
  const active = favorites?.has(listingId) ?? false;

  if (!favorites) return null;

  return (
    <button
      type="button"
      className="vd-heart"
      aria-pressed={active}
      aria-label={t(active ? "favoriteRemove" : "favoriteAdd", { title })}
      onClick={async () => {
        const result = await favorites.toggle(listingId);
        if (result) setBurst((value) => value + 1);
      }}
    >
      <motion.span
        key={active ? "on" : "off"}
        className="grid place-items-center"
        initial={reduced ? false : { scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 14 }}
      >
        <Heart className={active ? "size-[18px] fill-harissa text-harissa" : "size-[18px]"} aria-hidden="true" />
      </motion.span>
      <AnimatePresence>
        {burst && !reduced ? (
          <motion.span
            key={burst}
            className="vd-heart__ring"
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 2.2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
    </button>
  );
}
