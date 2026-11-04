"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { placeOrder, quoteDelivery } from "@/features/orders/actions";
import type { LocationOption } from "@/features/shops/queries";
import { Link, useRouter } from "@/i18n/navigation";
import { formatPrice } from "@/lib/utils/price";

type Item = { id: string; title: string; priceMillimes: number; shopId: string; shopName: string };

export function CheckoutForm({
  items,
  locations,
  defaults,
}: {
  items: Item[];
  locations: LocationOption[];
  defaults: { recipientName: string; phone: string; governorateId: string; cityId: string; addressLine: string };
}) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const router = useRouter();

  const shops = [...new Map(items.map((item) => [item.shopId, item.shopName])).entries()];

  const [recipientName, setRecipientName] = useState(defaults.recipientName);
  const [phone, setPhone] = useState(defaults.phone);
  const [governorateId, setGovernorateId] = useState(defaults.governorateId);
  const [cityId, setCityId] = useState(defaults.cityId);
  const [addressLine, setAddressLine] = useState(defaults.addressLine);
  const [pickup, setPickup] = useState<Set<string>>(new Set());
  const [fees, setFees] = useState<Record<string, number>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needsAddress = shops.some(([shopId]) => !pickup.has(shopId));
  const cities = locations.find((location) => String(location.id) === governorateId)?.cities ?? [];
  const label = (item: { nameFr: string; nameAr: string }) =>
    locale === "ar" ? item.nameAr : item.nameFr;

  const subtotal = items.reduce((sum, item) => sum + item.priceMillimes, 0);
  const deliveryShops = shops.filter(([shopId]) => !pickup.has(shopId));
  const feesKnown = !deliveryShops.length || deliveryShops.every(([shopId]) => shopId in fees);
  const deliveryTotal = deliveryShops.reduce((sum, [shopId]) => sum + (fees[shopId] ?? 0), 0);

  function quote(value: string) {
    if (!value) return;
    startTransition(async () => {
      const result = await quoteDelivery(shops.map(([shopId]) => shopId), Number(value));
      if (result.ok) setFees(result.data);
    });
  }

  // L'adresse du profil est déjà là : le prix de livraison s'affiche sans attendre.
  useEffect(() => {
    quote(defaults.governorateId);
    // Une seule fois, à l'arrivée sur la page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeGovernorate(value: string) {
    setGovernorateId(value);
    setCityId("");
    setFees({});
    quote(value);
  }

  function setMethod(shopId: string, isPickup: boolean) {
    const next = new Set(pickup);
    if (isPickup) next.add(shopId);
    else next.delete(shopId);
    setPickup(next);
  }

  return (
    <form
      noValidate
      className="grid grid-cols-[minmax(0,1fr)] gap-7"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setFieldErrors({});

        startTransition(async () => {
          const result = await placeOrder({
            productIds: items.map((item) => item.id),
            pickupShopIds: [...pickup],
            recipientName,
            phone,
            governorateId: governorateId || 0,
            cityId: cityId || 0,
            addressLine,
            needsAddress,
            expectedTotal: feesKnown ? subtotal + deliveryTotal : null,
          });

          if (result.ok) {
            router.push(`/commande/confirmation/${result.data.groupId}`);
          } else if (result.fields) {
            setFieldErrors(result.fields);
          } else {
            setError(result.error);
            if (result.error === "price_changed") router.refresh();
          }
        });
      }}
    >
      <section className="grid gap-4">
        <h2 className="font-display text-xl font-bold">{t("contact")}</h2>
        <Field id="recipient" label={t("recipient")} error={fieldErrors.recipientName}>
          <Input
            id="recipient"
            autoComplete="name"
            value={recipientName}
            onChange={(event) => setRecipientName(event.target.value)}
          />
        </Field>
        <Field id="phone" label={t("phone")} error={fieldErrors.phone}>
          <Input
            id="phone"
            type="tel"
            dir="ltr"
            autoComplete="tel-national"
            className="text-start"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-xl font-bold">{t("fulfillment")}</h2>
        {shops.map(([shopId, shopName]) => {
          const delivered = !pickup.has(shopId);
          const price = shopId in fees ? t("deliveryPrice", { price: formatPrice(fees[shopId], locale) }) : t("deliveryPriceByArea");

          return (
            <fieldset key={shopId} className="border-b pb-3">
              <legend className="font-semibold">{shopName}</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="delivery-toggle">
                  <input
                    type="radio"
                    name={`method-${shopId}`}
                    className="size-5 accent-[var(--harissa)]"
                    checked={delivered}
                    aria-describedby={`price-${shopId}`}
                    onChange={() => setMethod(shopId, false)}
                  />
                  <span className="font-semibold">{t("deliveryToggle")}</span>
                </label>
                <label className="delivery-toggle">
                  <input
                    type="radio"
                    name={`method-${shopId}`}
                    className="size-5 accent-[var(--harissa)]"
                    checked={!delivered}
                    aria-describedby={`pickup-${shopId}`}
                    onChange={() => setMethod(shopId, true)}
                  />
                  <span className="font-semibold">{t("pickup")}</span>
                </label>
              </div>
              <p id={`price-${shopId}`} className={delivered ? "mt-2 text-sm text-muted-foreground" : "sr-only"}>
                {price}
              </p>
              <p id={`pickup-${shopId}`} className={delivered ? "sr-only" : "mt-2 text-sm text-muted-foreground"}>
                {t("pickupFree")}
              </p>
            </fieldset>
          );
        })}
        <p className="text-sm text-muted-foreground">{t("trackingNote")}</p>
      </section>

      {needsAddress ? (
        <section className="grid gap-4">
          <h2 className="font-display text-xl font-bold">{t("address")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field id="governorate" label={t("governorate")}>
              <NativeSelect
                id="governorate"
                value={governorateId}
                onChange={(event) => changeGovernorate(event.target.value)}
              >
                <option value="">{t("choose")}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{label(location)}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="city" label={t("city")} error={fieldErrors.cityId}>
              <NativeSelect
                id="city"
                value={cityId}
                disabled={!cities.length}
                onChange={(event) => setCityId(event.target.value)}
              >
                <option value="">{t("choose")}</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>{label(city)}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field id="address" label={t("addressLine")} error={fieldErrors.addressLine}>
            <Input
              id="address"
              autoComplete="street-address"
              value={addressLine}
              onChange={(event) => setAddressLine(event.target.value)}
            />
          </Field>
        </section>
      ) : null}

      <section>
        <h2 className="font-display text-xl font-bold">{t("summary")}</h2>
        <ul className="mt-2 divide-y border-y text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2">
              <span className="truncate">{item.title}</span>
              <span className="shrink-0 font-medium">{formatPrice(item.priceMillimes, locale)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 grid gap-1">
          <div className="flex justify-between text-sm">
            <dt className="text-muted-foreground">{t("deliveryFee")}</dt>
            <dd>
              {!deliveryShops.length
                ? t("free")
                : feesKnown
                  ? formatPrice(deliveryTotal, locale)
                  : t("deliveryFeePending")}
            </dd>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <dt>{t("total")}</dt>
            <dd>{formatPrice(subtotal + deliveryTotal, locale)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-sm text-muted-foreground">{t("cod")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.rich("salesTerms", {
            sales: (chunks) => <Link href="/cgv" prefetch={false} className="underline underline-offset-2">{chunks}</Link>,
            returns: (chunks) => <Link href="/retours" prefetch={false} className="underline underline-offset-2">{chunks}</Link>,
          })}
        </p>
      </section>

      <FormError error={error} />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
