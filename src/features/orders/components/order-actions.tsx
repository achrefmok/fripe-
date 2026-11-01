"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NoteDialog } from "@/features/admin/components/admin-actions";
import { cancelOrder, updateOrderStatus } from "@/features/orders/actions";
import { cancelReservation } from "@/features/reservations/actions";
import { useRouter } from "@/i18n/navigation";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>{t("cancel")}</Button>
      <NoteDialog
        title={t("cancelTitle")}
        label={t("cancelReason")}
        open={open}
        onOpenChange={setOpen}
        onConfirm={async (reason) => {
          const result = await cancelOrder({ orderId, reason });

          if (result.ok) {
            toast.success(t("cancelled"));
            router.refresh();
          }

          return result;
        }}
      />
    </>
  );
}

export function OrderActions({
  orderId,
  next,
  canCancel,
}: {
  orderId: string;
  next: string | null;
  canCancel: boolean;
}) {
  const t = useTranslations("orders");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {next ? (
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateOrderStatus(orderId, next as "confirmed");

              if (result.ok) {
                toast.success(t("updated"));
                router.refresh();
              } else {
                toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
              }
            })
          }
        >
          {t(`advance.${next}`)}
        </Button>
      ) : null}
      {canCancel ? <CancelOrderButton orderId={orderId} /> : null}
    </div>
  );
}

export function ReleaseReservationButton({ reservationId }: { reservationId: string }) {
  const t = useTranslations("sellerShop");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelReservation(reservationId);
          if (result.ok) router.refresh();
        })
      }
    >
      {t("reservationRelease")}
    </Button>
  );
}
