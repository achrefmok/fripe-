"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { closeStockRequest, offerProduct } from "@/features/inventory/actions";
import { useRouter } from "@/i18n/navigation";

export function OfferForm({
  shopId,
  requestId,
  products,
}: {
  shopId: string;
  requestId: string;
  products: { id: string; label: string }[];
}) {
  const t = useTranslations("sellerShop");
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);

        startTransition(async () => {
          const result = await offerProduct(shopId, { requestId, productId, message });

          if (result.ok) {
            toast.success(t("offerSent"));
            setProductId("");
            setMessage("");
            router.refresh();
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <NativeSelect
        aria-label={t("offerProduct")}
        value={productId}
        onChange={(event) => setProductId(event.target.value)}
      >
        <option value="">{t("offerProduct")}</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>{product.label}</option>
        ))}
      </NativeSelect>
      <Input
        aria-label={t("offerMessage")}
        placeholder={t("offerMessage")}
        maxLength={300}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <FormError error={error} />
      <Button type="submit" size="sm" disabled={pending || !productId} className="justify-self-start">
        {t("offerSend")}
      </Button>
    </form>
  );
}

export function CloseRequestButton({ requestId }: { requestId: string }) {
  const t = useTranslations("requests");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="justify-self-start text-sm font-medium underline underline-offset-4"
      onClick={() =>
        startTransition(async () => {
          const result = await closeStockRequest(requestId);
          if (result.ok) router.refresh();
        })
      }
    >
      {t("close")}
    </button>
  );
}
