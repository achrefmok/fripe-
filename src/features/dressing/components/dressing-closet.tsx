"use client";

import { Check, Eye, Plus, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { contactSeller } from "@/features/marketplace/actions";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice, parsePriceToMillimes } from "@/lib/utils/price";
import type { DressingItem } from "../queries";
import { dressingTone } from "../tone";
import { PhotoPlaceholder } from "./dressing-card";
import { Hanger } from "./hanger";

// Au-delà, le message dépasserait la longueur permise ; un lot de douze pièces, c'est déjà un déménagement.
const MAX_LOT = 12;

// Le portant d'un dressing et le lot qu'on y compose : toucher une pièce la décroche dans le lot,
// la retoucher la raccroche. Le lot part en un seul message à la personne, avec le prix proposé.
export function DressingCloset({ sellerId, name, items }: { sellerId: string; name: string; items: DressingItem[] }) {
  const t = useTranslations("dressing");
  const market = useTranslations("market");
  const conditions = useTranslations("conditions");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const reduced = useReducedMotion();
  const offerId = useId();
  const [selected, setSelected] = useState<string[]>([]);
  const [offer, setOffer] = useState("");
  const [pending, startTransition] = useTransition();
  const tone = dressingTone(sellerId);

  const lot = selected.flatMap((id) => items.find((item) => item.id === id) ?? []);
  const subtotal = lot.reduce((sum, item) => sum + item.priceMillimes, 0);
  const offered = parsePriceToMillimes(offer);
  const proposed = offered !== null && offered < subtotal ? offered : subtotal;
  const next = `/vide-dressing/dressing/${sellerId}`;

  function toggle(item: DressingItem) {
    if (item.reserved) return;
    setSelected((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id);
      if (current.length >= MAX_LOT) return current;
      return [...current, item.id];
    });
  }

  function propose() {
    if (!lot.length) return;
    const list = lot.map((item) => `• ${item.title.slice(0, 60)} (${formatPrice(item.priceMillimes, locale)})`).join("\n");
    const body = t("lotMessage", { name, list, subtotal: formatPrice(subtotal, locale), offer: formatPrice(proposed, locale) });

    startTransition(async () => {
      const result = await contactSeller(lot[0].id, body);
      if (result.ok) {
        router.push(`/compte/echanges/${result.data.threadId}`);
        return;
      }
      if (result.error === "sessionExpired") {
        toast(t("lotSignIn"), { action: { label: t("signIn"), onClick: () => router.push({ pathname: "/connexion", query: { next } }) } });
      } else {
        toast.error(errors.has(result.error) ? errors(result.error) : t("lotFailed"));
      }
    });
  }

  return (
    <div className="vd-closet-layout">
      <section className="vd-rack-section" aria-labelledby="vd-rack-title">
        <div className="vd-section__head">
          <h2 id="vd-rack-title" className="vd-section__title">{t("rackTitle")}</h2>
          <p className="vd-section__lead">{t("rackHint")}</p>
        </div>

        <ul className="vd-rack">
          {items.map((item, index) => {
            const on = selected.includes(item.id);
            return (
              <li key={item.id} className="vd-rack__slot" style={{ "--i": index % 8, "--sway-delay": `${(index % 5) * -0.7}s`, "--tone": tone.surface } as CSSProperties}>
                <Hanger className="vd-rack__hanger" />
                <div className={cn("vd-hang", on && "vd-hang--on", item.reserved && "vd-hang--reserved")}>
                  <button
                    type="button"
                    className="vd-hang__pick"
                    aria-pressed={on}
                    disabled={item.reserved}
                    aria-label={t(on ? "removeFromLot" : "addToLot", { title: item.title })}
                    onClick={() => toggle(item)}
                  >
                    <span className="vd-hang__media">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt="" fill unoptimized sizes="(min-width: 1024px) 18vw, 45vw" className="object-cover" />
                      ) : (
                        <PhotoPlaceholder label={market("noPhoto")} />
                      )}
                      <span className="vd-hang__state">{item.reserved ? market("reserved") : conditions(item.condition)}</span>
                      <span className="vd-hang__mark" aria-hidden="true">
                        {on ? <Check className="size-4" /> : <Plus className="size-4" />}
                      </span>
                    </span>
                    <span className="vd-hang__body">
                      <span className="vd-card__brand" dir="auto">{item.brand ?? t("noBrand")}</span>
                      <span className="vd-hang__title" dir="auto">{item.title}</span>
                      <span className="vd-hang__price">
                        {formatPrice(item.priceMillimes, locale)}
                        {item.size ? <span className="vd-card__size" dir="ltr">{t("sizeShort", { size: item.size })}</span> : null}
                      </span>
                    </span>
                  </button>
                  <Link href={`/annonce/${item.id}`} className="vd-hang__see" aria-label={`${t("seePiece")} · ${item.title}`}>
                    <Eye className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="vd-lot" aria-labelledby="vd-lot-title">
        <p className="vd-lot__kicker">{t("lotKicker")}</p>
        <h2 id="vd-lot-title" className="vd-lot__title" dir="auto">{t("lotPanelTitle", { name })}</h2>
        <div className="vd-lot__progress" aria-hidden="true">
          {[0, 1, 2].map((step) => (
            <span key={step} data-on={lot.length > step ? "" : undefined} />
          ))}
        </div>
        <p className="vd-lot__hint" role="status">
          {lot.length === 0 ? t("lotEmpty") : lot.length === 1 ? t("lotHintOne") : t("lotHintMore", { count: lot.length })}
        </p>

        <ul className="vd-lot__lines">
          <AnimatePresence initial={false}>
            {lot.map((item) => (
              <motion.li
                key={item.id}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, y: -14, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="vd-lot__line"
              >
                <span className="truncate" dir="auto">{item.title}</span>
                <span className="vd-lot__amount">{formatPrice(item.priceMillimes, locale)}</span>
                <button type="button" className="vd-lot__remove" onClick={() => toggle(item)} aria-label={t("removeFromLot", { title: item.title })}>
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <dl className="vd-lot__sums">
          <div>
            <dt>{t("subtotal")}</dt>
            <dd>{formatPrice(subtotal, locale)}</dd>
          </div>
        </dl>

        {lot.length > 1 ? (
          <div className="vd-lot__offer">
            <label htmlFor={offerId}>{t("yourOffer")}</label>
            <input
              id={offerId}
              inputMode="decimal"
              autoComplete="off"
              placeholder={String(Math.floor(subtotal / 1000))}
              value={offer}
              onChange={(event) => setOffer(event.target.value.replace(/[^\d.,]/g, "").slice(0, 9))}
            />
            {proposed < subtotal ? <p className="vd-lot__saving">{t("saving", { amount: formatPrice(subtotal - proposed, locale) })}</p> : null}
          </div>
        ) : null}

        <div className="vd-lot__total">
          <span>{t("total")}</span>
          <motion.strong key={proposed} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            {formatPrice(proposed, locale)}
          </motion.strong>
        </div>

        <button type="button" className="vd-lot__cta" disabled={!lot.length || pending} onClick={propose}>
          {t("propose", { name })}
        </button>
        <p className="vd-lot__note">{t("lotNote")}</p>
      </aside>
    </div>
  );
}
