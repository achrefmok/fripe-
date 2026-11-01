"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { emergencyTakedown, moderateVideo } from "@/features/admin/actions";
import { moderateProduct } from "@/features/catalog/actions";
import { cancelOrder } from "@/features/orders/actions";
import { useRouter } from "@/i18n/navigation";
import { NoteDialog } from "./admin-actions";

export function ModerateProductButton({ productId, title }: { productId: string; title: string }) {
  const t = useTranslations("adminMarket");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t("moderate")}</Button>
      <NoteDialog
        title={t("moderateTitle", { title })}
        label={t("moderateReason")}
        open={open}
        onOpenChange={setOpen}
        onConfirm={async (reason) => {
          const result = await moderateProduct(productId, reason);

          if (result.ok) {
            toast.success(t("moderated"));
            router.refresh();
          }

          return result;
        }}
      />
    </>
  );
}

export function EmergencyTakedownButton({ shopId, name }: { shopId: string; name: string }) {
  const t = useTranslations("adminMarket");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>{t("takedown")}</Button>
      <NoteDialog
        title={t("takedownTitle", { name })}
        label={t("takedownReason")}
        open={open}
        onOpenChange={setOpen}
        onConfirm={async (reason) => {
          const result = await emergencyTakedown(shopId, reason);

          if (result.ok) {
            toast.success(t("takedownDone"));
            router.refresh();
          }

          return result;
        }}
      />
    </>
  );
}

export function ModerateVideoButton({ videoId }: { videoId: string }) {
  const t = useTranslations("adminMarket");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t("moderate")}</Button>
      <NoteDialog
        title={t("moderateVideoTitle")}
        label={t("moderateReason")}
        open={open}
        onOpenChange={setOpen}
        onConfirm={async (reason) => {
          const result = await moderateVideo(videoId, reason);

          if (result.ok) {
            toast.success(t("moderated"));
            router.refresh();
          }

          return result;
        }}
      />
    </>
  );
}

export function AdminCancelOrderButton({ orderId }: { orderId: string }) {
  const t = useTranslations("adminMarket");
  const orders = useTranslations("orders");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{orders("cancel")}</Button>
      <NoteDialog
        title={orders("cancelTitle")}
        label={t("cancelReason")}
        open={open}
        onOpenChange={setOpen}
        onConfirm={async (reason) => {
          const result = await cancelOrder({ orderId, reason });

          if (result.ok) {
            toast.success(orders("cancelled"));
            router.refresh();
          }

          return result;
        }}
      />
    </>
  );
}
