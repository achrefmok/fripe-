"use client";

import { Copy, LoaderCircle, MapPin, Navigation } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { directionsLinks, distanceKm, mapEmbedUrl, mapPageUrl, type Coordinates } from "../location";

// « Où nous trouver » : l'adresse, le guidage vers la boutique dans l'application de navigation du
// client, la distance depuis sa position (calculée sur son appareil, jamais envoyée) et la carte,
// chargée seulement à la demande.
export function ShopLocation({ shopName, address, place, coordinates }: { shopName: string; address: string; place: string; coordinates: Coordinates | null }) {
  const t = useTranslations("shopLocation");
  const locale = useLocale();
  const [showMap, setShowMap] = useState(false);
  const [distance, setDistance] = useState<{ state: "idle" | "busy" | "done" | "denied" | "failed"; km?: number }>({ state: "idle" });
  const fullAddress = [address, place].filter(Boolean).join(", ");
  const links = directionsLinks({ coordinates, address: `${fullAddress}, Tunisie` });

  function measure() {
    if (!coordinates || !("geolocation" in navigator)) return;
    setDistance({ state: "busy" });
    navigator.geolocation.getCurrentPosition(
      (position) => setDistance({ state: "done", km: distanceKm({ latitude: position.coords.latitude, longitude: position.coords.longitude }, coordinates) }),
      (failure) => setDistance({ state: failure.code === failure.PERMISSION_DENIED ? "denied" : "failed" }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullAddress);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  const km = distance.km ?? 0;
  const formatted = new Intl.NumberFormat(locale === "ar" ? "ar-TN" : "fr-TN", { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km);

  return (
    <section id="adresse" className="mt-10 scroll-mt-20" aria-labelledby="adresse-titre">
      <h2 id="adresse-titre" className="font-display text-2xl">
        {t("title")}
      </h2>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-4 rounded-2xl border p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="grid min-w-0 content-start gap-3">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-goldink" aria-hidden="true" />
            <span>
              <span className="block font-medium" dir="auto">
                {address}
              </span>
              <span className="block text-sm text-muted-foreground">{place}</span>
            </span>
          </p>

          <div className="flex flex-wrap gap-2" role="group" aria-label={t("directionsLabel", { shop: shopName })}>
            <Button asChild>
              <a href={links.google} target="_blank" rel="noopener noreferrer">
                <Navigation className="size-4" aria-hidden="true" />
                {t("directions")}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={links.waze} target="_blank" rel="noopener noreferrer">
                Waze
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={links.apple} target="_blank" rel="noopener noreferrer">
                {t("appleMaps")}
              </a>
            </Button>
            <Button type="button" variant="ghost" onClick={() => void copy()}>
              <Copy className="size-4" aria-hidden="true" />
              {t("copy")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("directionsNote")}</p>

          {coordinates ? (
            <div className="text-sm" aria-live="polite">
              {distance.state === "done" ? (
                <p className="font-medium">{t("distance", { km: formatted })}</p>
              ) : distance.state === "denied" ? (
                <p className="text-muted-foreground">{t("distanceDenied")}</p>
              ) : distance.state === "failed" ? (
                <p className="text-muted-foreground">{t("distanceFailed")}</p>
              ) : (
                <Button type="button" variant="link" className="h-auto p-0" onClick={measure} disabled={distance.state === "busy"}>
                  {distance.state === "busy" ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {t("howFar")}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noPosition")}</p>
          )}
        </div>

        {coordinates ? (
          <div className="grid min-w-0 content-start gap-2">
            {showMap ? (
              <>
                <iframe
                  title={t("mapOf", { shop: shopName })}
                  src={mapEmbedUrl(coordinates)}
                  className="aspect-[4/3] w-full rounded-xl border"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin"
                />
                <a href={mapPageUrl(coordinates)} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">
                  {t("biggerMap")}
                </a>
              </>
            ) : (
              <button type="button" onClick={() => setShowMap(true)} className="grid aspect-[4/3] w-full place-items-center rounded-xl border border-dashed bg-secondary text-sm font-medium hover:bg-cream">
                <span className="grid justify-items-center gap-2 px-4 text-center">
                  <MapPin className="size-6 text-goldink" aria-hidden="true" />
                  {t("showMap")}
                  <span className="text-xs font-normal text-muted-foreground">{t("mapPrivacy")}</span>
                </span>
              </button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
