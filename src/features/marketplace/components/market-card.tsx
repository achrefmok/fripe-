import { UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/price";
import type { MarketItem } from "../queries";

// Même carte que la mode, avec l'identité du vendeur : un particulier ou une boutique, au premier coup d'œil.
export function MarketCard({ item, className }: { item: MarketItem; className?: string }) {
  const t = useTranslations("market");
  const conditions = useTranslations("conditions");
  const locale = useLocale();
  const firstName = item.sellerName.split(" ")[0];

  return (
    <article className={cn("card-rise group min-w-0", className)}>
      <Link href={item.href} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              unoptimized
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("noPhoto")}</span>
          )}
          <span className="price-tag absolute bottom-3 start-0">{formatPrice(item.priceMillimes, locale)}</span>
          {item.reserved ? (
            <span className="status-tag absolute end-2 top-2 bg-kraft text-[oklch(0.2_0.014_55)]">{t("reserved")}</span>
          ) : null}
        </div>
        <h3 className="mt-2 truncate text-sm font-semibold">{item.title}</h3>
        {item.condition ? <p className="truncate text-sm text-muted-foreground">{conditions(item.condition)}</p> : null}
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs font-semibold">
          {item.sellerType === "pro" ? (
            <>
              <ShopMark name={item.sellerName} logoPath={item.shopLogoPath} size="xs" />
              <span className="truncate">{item.sellerName}</span>
            </>
          ) : (
            <>
              <span className="seller-person" aria-hidden="true">
                <UserRound className="size-3" strokeWidth={2.4} />
              </span>
              <span className="truncate">
                {t("particulierBadge")}
                {firstName ? ` · ${firstName}` : ""}
              </span>
            </>
          )}
        </p>
      </Link>
    </article>
  );
}

export function MarketGrid({ items }: { items: MarketItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <MarketCard key={`${item.kind}-${item.id}`} item={item} />
      ))}
    </div>
  );
}

export function MarketRail({ items }: { items: MarketItem[] }) {
  return (
    <div className="rail-scroll -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
      {items.map((item) => (
        <MarketCard key={`${item.kind}-${item.id}`} item={item} className="w-40 shrink-0 snap-start md:w-52" />
      ))}
    </div>
  );
}
