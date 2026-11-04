"use client";

import { Check, Copy, MapPin, Phone, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/format";
import type { getShipment, ShipmentStatus } from "../queries";

type Tracking = Awaited<ReturnType<typeof getShipment>>;

// Le chemin d'un colis. Les étapes du milieu viendront de l'application des livreurs.
const DELIVERY_STEPS: ShipmentStatus[] = ["ordered", "confirmed", "preparing", "handed_over", "out_for_delivery", "delivered"];
const PICKUP_STEPS: ShipmentStatus[] = ["ordered", "confirmed", "preparing", "delivered"];
const RANK: Record<ShipmentStatus, number> = {
  ordered: 0,
  confirmed: 1,
  preparing: 2,
  handed_over: 3,
  in_transit: 3.5,
  out_for_delivery: 4,
  delivered: 5,
  failed: 4,
  returned: 4,
  cancelled: -1,
};

// Le suivi se rafraîchit en direct : un changement de la boutique ou du livreur arrive sans recharger.
export function ShipmentTracking({
  orderId,
  fulfillment,
  tracking,
  compact = false,
}: {
  orderId: string;
  fulfillment: "delivery" | "pickup";
  tracking: Tracking;
  // Côté boutique : le numéro à remettre au livreur et ses informations, sans historique ni direct,
  // la boutique étant elle-même l'auteur des étapes.
  compact?: boolean;
}) {
  const t = useTranslations("tracking");
  const locale = useLocale();
  const router = useRouter();
  const { shipment, events } = tracking;
  const current = events.at(-1)?.status ?? "ordered";
  const steps = fulfillment === "delivery" ? DELIVERY_STEPS : PICKUP_STEPS;
  const reached = (step: ShipmentStatus) => current !== "cancelled" && RANK[current] >= RANK[step];

  // RLS s'applique au temps réel : la session est transmise avant l'abonnement, comme la messagerie.
  useEffect(() => {
    if (compact) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel(`suivi-${orderId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "shipment_events", filter: `order_id=eq.${orderId}` }, () => router.refresh())
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shipments", filter: `order_id=eq.${orderId}` }, () => router.refresh())
        .subscribe();
    });

    // Secours si la connexion en direct tombe : un rafraîchissement discret, onglet visible seulement.
    const timer = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [compact, orderId, router]);

  return (
    <section className="tracking mt-8" aria-labelledby="suivi-titre">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="suivi-titre" className="font-display text-2xl font-extrabold">
          {t("title")}
        </h2>
        {shipment ? (
          <button
            type="button"
            className="tracking__code"
            onClick={() => {
              void navigator.clipboard?.writeText(shipment.tracking_code);
              toast.success(t("copied"));
            }}
            aria-label={t("copyCode", { code: shipment.tracking_code })}
          >
            <span dir="ltr">{shipment.tracking_code}</span>
            <Copy className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {compact ? null : current === "cancelled" ? (
        <p className="mt-3 bg-secondary px-3 py-2 text-sm font-medium" role="status">{t("cancelledNotice")}</p>
      ) : current === "failed" || current === "returned" ? (
        <p className="mt-3 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="status">{t(`notice.${current}`)}</p>
      ) : null}

      {compact ? null : (
      <ol className="tracking__steps" aria-label={t("stepsLabel")}>
        {steps.map((step) => (
          <li key={step} className={cn("tracking__step", reached(step) && "is-done", current === step && "is-current")}>
            <span className="tracking__dot" aria-hidden="true">
              {reached(step) ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
            <span className="tracking__label">{t(fulfillment === "pickup" && step === "delivered" ? "status.collected" : `status.${step}`)}</span>
          </li>
        ))}
      </ol>
      )}

      {shipment && (shipment.courier_name || shipment.eta || shipment.latitude !== null) ? (
        <dl className="mt-5 grid gap-3 border-t pt-4 text-sm">
          {shipment.courier_name ? (
            <div className="flex items-center gap-3">
              <Truck className="size-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-muted-foreground">{t("courier")}</dt>
                <dd className="font-medium">
                  {shipment.courier_name}
                  {shipment.carrier ? ` · ${shipment.carrier}` : ""}
                  {shipment.courier_phone ? (
                    <a href={`tel:${shipment.courier_phone}`} className="ms-2 inline-flex items-center gap-1 underline underline-offset-4" dir="ltr">
                      <Phone className="size-3.5" aria-hidden="true" />
                      {shipment.courier_phone}
                    </a>
                  ) : null}
                </dd>
              </div>
            </div>
          ) : null}
          {shipment.eta ? (
            <div>
              <dt className="text-muted-foreground">{t("eta")}</dt>
              <dd className="font-medium">{formatDateTime(shipment.eta, locale)}</dd>
            </div>
          ) : null}
          {shipment.latitude !== null && shipment.longitude !== null ? (
            <div className="flex items-center gap-3">
              <MapPin className="size-5 shrink-0" aria-hidden="true" />
              <div>
                <dt className="text-muted-foreground">{t("position")}</dt>
                <dd>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${shipment.latitude}&mlon=${shipment.longitude}#map=16/${shipment.latitude}/${shipment.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-4"
                  >
                    {t("openMap")}
                  </a>
                  {shipment.position_at ? <span className="text-muted-foreground"> · {formatDateTime(shipment.position_at, locale)}</span> : null}
                </dd>
              </div>
            </div>
          ) : null}
        </dl>
      ) : null}

      {compact ? null : (
        <>
      <h3 className="mt-6 text-sm font-semibold">{t("history")}</h3>
      <ol className="mt-2 grid gap-2 text-sm">
        {[...events].reverse().map((event) => (
          <li key={event.id} className="flex gap-3">
            <time className="w-32 shrink-0 text-muted-foreground" dateTime={event.created_at}>
              {formatDateTime(event.created_at, locale)}
            </time>
            <span className="min-w-0">
              <span className="font-medium">{t(fulfillment === "pickup" && event.status === "delivered" ? "status.collected" : `status.${event.status}`)}</span>
              <span className="text-muted-foreground"> · {t(`source.${event.source}`)}</span>
              {event.note ? <span className="block text-muted-foreground">{event.note}</span> : null}
            </span>
          </li>
        ))}
      </ol>
        </>
      )}
    </section>
  );
}
