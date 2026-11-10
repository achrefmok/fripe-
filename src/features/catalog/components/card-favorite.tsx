"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleFavorite } from "@/features/catalog/actions";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Le cœur posé sur la photo : un geste pour garder une pièce, sans quitter la liste.
export function CardFavorite({ productId, title, className }: { productId: string; title: string; className?: string }) {
  const t = useTranslations("product");
  const router = useRouter();
  const pathname = usePathname();
  const [favorite, setFavorite] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label={t(favorite ? "unfavoriteNamed" : "favoriteNamed", { title })}
      aria-pressed={favorite}
      disabled={pending}
      className={cn("card-heart", className)}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleFavorite(productId);
          if (result.ok) {
            setFavorite(result.data.favorite);
            toast.success(t(result.data.favorite ? "favoriteAdded" : "favoriteRemoved"));
          } else if (result.error === "sessionExpired") {
            router.push({ pathname: "/connexion", query: { next: pathname } });
          } else toast.error(t("favoriteFailed"));
        })
      }
    >
      <Heart className={cn("size-4", favorite && "fill-current")} strokeWidth={1.8} />
    </button>
  );
}
