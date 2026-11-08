import { Link } from "@/i18n/navigation";
import { ShopMark } from "./shop-mark";

// Une boutique en un coup d'œil : son logo ou son monogramme, son nom, sa ville et ses pièces.
// Compacte, pour une rangée de boutiques sur l'accueil.
export function ShopBadge({ name, slug, logoPath, place, pieces }: { name: string; slug: string; logoPath: string | null; place: string; pieces: string }) {
  return (
    <Link href={`/boutique/${slug}`} className="shop-badge">
      <ShopMark name={name} logoPath={logoPath} size="md" className="shop-badge__mark" />
      <span className="min-w-0">
        <span className="block truncate font-display text-base font-bold" dir="auto">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {place} · <span className="tabular-nums">{pieces}</span>
        </span>
      </span>
    </Link>
  );
}
