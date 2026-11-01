"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  deleteDropAlert,
  markNotificationsRead,
  saveDropAlert,
  savePreferences,
  setDropAlertActive,
  toggleFollow,
} from "@/features/social/actions";
import { Link, useRouter } from "@/i18n/navigation";

export function FollowButton({
  shopId,
  slug,
  signedIn,
  initialFollowing,
  initialCount,
}: {
  shopId: string;
  slug: string;
  signedIn: boolean;
  initialFollowing: boolean;
  initialCount: number;
}) {
  const t = useTranslations("social");
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  const label = <span className="text-sm text-muted-foreground">{t("followers", { count })}</span>;

  if (!signedIn) {
    return (
      <div className="flex items-center gap-3">
        <Button asChild variant="outline">
          <Link href={{ pathname: "/connexion", query: { next: `/boutique/${slug}` } }}>{t("follow")}</Link>
        </Button>
        {label}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={following ? "secondary" : "outline"}
        aria-pressed={following}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await toggleFollow(shopId);

            if (result.ok) {
              setFollowing(result.data.following);
              setCount(count + (result.data.following ? 1 : -1));
            }
          })
        }
      >
        {following ? t("unfollow") : t("follow")}
      </Button>
      {label}
    </div>
  );
}

export function PreferencesForm({
  defaults,
}: {
  defaults: { inAppEnabled: boolean; maxPerDay: number };
}) {
  const t = useTranslations("social");
  const common = useTranslations("common");
  const [inAppEnabled, setInAppEnabled] = useState(defaults.inAppEnabled);
  const [maxPerDay, setMaxPerDay] = useState(String(defaults.maxPerDay));
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(async () => {
          const result = await savePreferences({ inAppEnabled, maxPerDay });
          if (result.ok) toast.success(common("saved"));
        });
      }}
    >
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 accent-[var(--harissa)]"
          checked={inAppEnabled}
          onChange={(event) => setInAppEnabled(event.target.checked)}
        />
        {t("inApp")}
      </label>
      <Field id="max-per-day" label={t("maxPerDay")} hint={t("pushLater")}>
        <Input
          id="max-per-day"
          inputMode="numeric"
          className="w-24"
          value={maxPerDay}
          onChange={(event) => setMaxPerDay(event.target.value)}
        />
      </Field>
      <Button type="submit" variant="outline" disabled={pending} className="justify-self-start">
        {common("save")}
      </Button>
    </form>
  );
}

export function AlertForm({
  categories,
  followedShops,
}: {
  categories: { id: string; name: string }[];
  followedShops: { id: string; name: string }[];
}) {
  const t = useTranslations("social");
  const router = useRouter();
  const empty = { name: "", sizes: "", brands: "", budget: "", followedOnly: false };
  const [values, setValues] = useState(empty);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [shopIds, setShopIds] = useState<string[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((value) => value !== id) : [...list, id];

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setFields({});
        setError(null);

        startTransition(async () => {
          const result = await saveDropAlert({ ...values, categoryIds, shopIds });

          if (result.ok) {
            toast.success(t("alertSaved"));
            setValues(empty);
            setCategoryIds([]);
            setShopIds([]);
            router.refresh();
          } else if (result.fields) {
            setFields(result.fields);
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <Field id="alert-name" label={t("alertName")} error={fields.name}>
        <Input
          id="alert-name"
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="alert-sizes" label={t("alertSizes")} hint={t("alertListHint")}>
          <Input
            id="alert-sizes"
            value={values.sizes}
            onChange={(event) => setValues({ ...values, sizes: event.target.value })}
          />
        </Field>
        <Field id="alert-brands" label={t("alertBrands")} hint={t("alertListHint")}>
          <Input
            id="alert-brands"
            value={values.brands}
            onChange={(event) => setValues({ ...values, brands: event.target.value })}
          />
        </Field>
      </div>
      <Field id="alert-budget" label={t("alertBudget")} error={fields.budget}>
        <Input
          id="alert-budget"
          inputMode="decimal"
          value={values.budget}
          onChange={(event) => setValues({ ...values, budget: event.target.value })}
        />
      </Field>
      <fieldset>
        <legend className="text-[0.8rem] font-semibold">{t("alertCategories")}</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--harissa)]"
                checked={categoryIds.includes(category.id)}
                onChange={() => setCategoryIds(toggle(categoryIds, category.id))}
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>
      {followedShops.length ? (
        <fieldset>
          <legend className="text-[0.8rem] font-semibold">{t("alertShops")}</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {followedShops.map((shop) => (
              <label key={shop.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--harissa)]"
                  checked={shopIds.includes(shop.id)}
                  onChange={() => setShopIds(toggle(shopIds, shop.id))}
                />
                {shop.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 accent-[var(--harissa)]"
          checked={values.followedOnly}
          onChange={(event) => setValues({ ...values, followedOnly: event.target.checked })}
        />
        {t("alertFollowedOnly")}
      </label>
      <FormError error={error} />
      <Button type="submit" disabled={pending} className="justify-self-start">{t("alertCreate")}</Button>
    </form>
  );
}

export function AlertRowActions({ alertId, isActive }: { alertId: string; isActive: boolean }) {
  const t = useTranslations("social");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-3 text-sm font-medium">
      <button
        type="button"
        disabled={pending}
        className="underline underline-offset-4"
        onClick={() =>
          startTransition(async () => {
            await setDropAlertActive(alertId, !isActive);
            router.refresh();
          })
        }
      >
        {isActive ? t("alertPause") : t("alertResume")}
      </button>
      <button
        type="button"
        disabled={pending}
        className="underline underline-offset-4"
        onClick={() =>
          startTransition(async () => {
            await deleteDropAlert(alertId);
            router.refresh();
          })
        }
      >
        {t("alertDelete")}
      </button>
    </div>
  );
}

export function MarkAllRead() {
  const t = useTranslations("social");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationsRead();
          router.refresh();
        })
      }
    >
      {t("markAllRead")}
    </Button>
  );
}
