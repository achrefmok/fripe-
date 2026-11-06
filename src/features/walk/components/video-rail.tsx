import { Play } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/utils/price";
import { publicVideoUrl } from "@/lib/utils/storage";
import type { WalkItem } from "../queries";

// La découverte par la vidéo, en vedette sur l'accueil : les dernières vidéos publiées,
// en écrans verticaux. Chacune ouvre Fripe Walk sur elle-même.
export function VideoRail({ items, locale, playLabel }: { items: WalkItem[]; locale: string; playLabel: string }) {
  return (
    <ul className="video-rail rail-scroll">
      {items.map((item) => {
        const piece = item.products[0];

        return (
          <li key={item.id}>
            <Link href={{ pathname: "/walk", query: { v: item.id } }} className="video-rail__item" aria-label={`${playLabel} · ${item.shop.name}`}>
              <span className="video-rail__screen">
                <Image src={publicVideoUrl(item.thumbnailPath)} alt="" fill unoptimized sizes="10rem" className="object-cover" />
                <span className="video-rail__play" aria-hidden="true">
                  <Play className="size-5 fill-current" />
                </span>
                {piece ? (
                  <span className="video-rail__price" dir="auto">
                    {formatPrice(piece.priceMillimes, locale)}
                  </span>
                ) : null}
              </span>
              <span className="mt-2 block truncate text-sm font-semibold" dir="auto">{item.shop.name}</span>
              {item.description ? (
                <span className="block truncate text-sm text-muted-foreground" dir="auto">{item.description}</span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
