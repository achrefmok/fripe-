"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Crosshair, Link2, LoaderCircle, MapPin, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { removeShopLocation, saveShopLocation } from "@/features/shops/actions";
import type { LocationOption } from "@/features/shops/queries";
import { shopLocationSchema } from "@/features/shops/schemas";
import { useFormAction } from "@/hooks/use-form-action";
import { useRouter } from "@/i18n/navigation";
import { inTunisia, mapEmbedUrl, parseCoordinates, roundCoordinates } from "../location";

type Values = { addressLine: string; governorateId: string; cityId: string; latitude: string; longitude: string };

// Réglages : où se trouve la boutique. L'adresse écrite sert à tous ; la position GPS rend le guidage
// exact. Elle se règle sur place (« Utiliser ma position ») ou en collant un lien de carte.
export function ShopLocationForm({ shopId, locations, defaults, saved }: { shopId: string; locations: LocationOption[]; defaults: Values; saved: boolean }) {
  const t = useTranslations("shopLocation");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [pasted, setPasted] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [removing, startRemoving] = useTransition();

  const form = useForm<Values>({ resolver: zodResolver(shopLocationSchema) as never, defaultValues: defaults });
  const { submit, pending, error } = useFormAction(
    form,
    (values) => saveShopLocation(shopId, values),
    () => {
      toast.success(common("saved"));
      router.refresh();
    },
  );
  const { errors } = form.formState;
  const [governorateId, latitude, longitude] = useWatch({ control: form.control, name: ["governorateId", "latitude", "longitude"] });
  const cities = locations.find((location) => String(location.id) === String(governorateId))?.cities ?? [];
  const label = (option: { nameFr: string; nameAr: string }) => (locale === "ar" ? option.nameAr : option.nameFr);
  const point = latitude && longitude && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) ? { latitude: Number(latitude), longitude: Number(longitude) } : null;
  const valid = point && inTunisia(point);

  function setPoint(coordinates: { latitude: number; longitude: number }) {
    const rounded = roundCoordinates(coordinates);
    form.setValue("latitude", String(rounded.latitude), { shouldDirty: true, shouldValidate: true });
    form.setValue("longitude", String(rounded.longitude), { shouldDirty: true, shouldValidate: true });
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setHint(t("geoUnavailable"));
      return;
    }
    setLocating(true);
    setHint(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setPoint({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setHint(t("geoDone", { meters: Math.round(position.coords.accuracy) }));
      },
      (failure) => {
        setLocating(false);
        setHint(failure.code === failure.PERMISSION_DENIED ? t("geoDenied") : t("geoFailed"));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function readPasted() {
    const coordinates = parseCoordinates(pasted);
    if (!coordinates) {
      setHint(t("pasteFailed"));
      return;
    }
    setPoint(coordinates);
    setPasted("");
    setHint(inTunisia(coordinates) ? t("pasteDone") : null);
  }

  function remove() {
    startRemoving(async () => {
      const result = await removeShopLocation(shopId);
      if (result.ok) {
        toast.success(t("removed"));
        form.reset({ ...defaults, addressLine: "", latitude: "", longitude: "" });
        router.refresh();
      } else toast.error(t("removeFailed"));
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field id="addressLine" label={t("address")} hint={t("addressHint")} error={errors.addressLine?.message}>
        <Input id="addressLine" autoComplete="street-address" dir="auto" {...form.register("addressLine")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="locationGovernorate" label={t("governorate")} error={errors.governorateId?.message}>
          <NativeSelect id="locationGovernorate" {...form.register("governorateId", { onChange: () => form.setValue("cityId", "") })}>
            <option value="">{t("choose")}</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {label(location)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="locationCity" label={t("city")} error={errors.cityId?.message}>
          <NativeSelect id="locationCity" disabled={!cities.length} {...form.register("cityId")}>
            <option value="">{t("choose")}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {label(city)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <fieldset className="grid gap-3 rounded-2xl border p-4">
        <legend className="px-1 text-sm font-semibold">
          {t("position")} <span className="font-normal text-muted-foreground">· {t("positionOptional")}</span>
        </legend>
        <p className="text-sm text-muted-foreground">{t("positionLead")}</p>
        <Button type="button" variant="outline" className="justify-self-start" onClick={locate} disabled={locating}>
          {locating ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Crosshair className="size-4" aria-hidden="true" />}
          {t("useMyPosition")}
        </Button>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-0 flex-[1_1_240px] gap-1">
            <label htmlFor="locationPaste" className="text-sm font-medium">
              {t("paste")}
            </label>
            <Input id="locationPaste" dir="ltr" inputMode="url" placeholder="https://maps.google.com/…" value={pasted} onChange={(event) => setPasted(event.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={readPasted} disabled={!pasted.trim()}>
            <Link2 className="size-4" aria-hidden="true" />
            {t("pasteRead")}
          </Button>
        </div>
        {hint ? (
          <p role="status" className="text-sm text-muted-foreground">
            {hint}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <Field id="latitude" label={t("latitude")} error={errors.latitude?.message}>
            <Input id="latitude" dir="ltr" inputMode="decimal" {...form.register("latitude")} />
          </Field>
          <Field id="longitude" label={t("longitude")} error={errors.longitude?.message}>
            <Input id="longitude" dir="ltr" inputMode="decimal" {...form.register("longitude")} />
          </Field>
        </div>
        {valid ? (
          showMap ? (
            <iframe
              title={t("mapTitle")}
              src={mapEmbedUrl(point)}
              className="aspect-[4/3] w-full rounded-xl border"
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <Button type="button" variant="ghost" className="justify-self-start" onClick={() => setShowMap(true)}>
              <MapPin className="size-4" aria-hidden="true" />
              {t("checkOnMap")}
            </Button>
          )
        ) : null}
      </fieldset>

      <FormError error={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {common("save")}
        </Button>
        {saved ? (
          <Button type="button" variant="ghost" onClick={remove} disabled={removing}>
            <Trash2 className="size-4" aria-hidden="true" />
            {t("remove")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
