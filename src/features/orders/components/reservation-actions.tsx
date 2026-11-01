"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addToCart } from "@/features/orders/actions";
import { cancelReservation } from "@/features/reservations/actions";
import { useRouter } from "@/i18n/navigation";

export function ReservationActions({
  reservationId,
  productId,
}: {
  reservationId: string;
  productId: string;
}) {
  const t = useTranslations("reservations");
  const product = useTranslations("product");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await addToCart(productId);
            if (result.ok) router.push("/commande");
          })
        }
      >
        {t("order")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelReservation(reservationId);

            if (result.ok) {
              toast.success(product("reservationCancelled"));
              router.refresh();
            }
          })
        }
      >
        {product("cancelReservation")}
      </Button>
    </div>
  );
}
