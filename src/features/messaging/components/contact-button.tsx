"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NoteDialog } from "@/features/admin/components/admin-actions";
import { contactRequestClient, startConversation } from "@/features/messaging/actions";
import { Link, useRouter } from "@/i18n/navigation";

type ContactButtonProps = {
  signedIn?: boolean;
  next?: string;
  label?: string;
  shopId?: string;
  productId?: string;
  requestId?: string;
  sellerShopId?: string;
};

export function ContactButton({
  signedIn = true,
  next = "/compte/messages",
  label,
  shopId,
  productId,
  requestId,
  sellerShopId,
}: ContactButtonProps) {
  const t = useTranslations("messaging");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const text = label ?? t("contact");

  if (!signedIn) {
    return (
      <Button asChild variant="ghost">
        <Link href={{ pathname: "/connexion", query: { next } }}>
          <MessageCircle />
          {text}
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <MessageCircle />
        {text}
      </Button>
      <NoteDialog
        title={text}
        label={t("placeholder")}
        open={open}
        onOpenChange={setOpen}
        onConfirm={async (body) => {
          const result = sellerShopId
            ? await contactRequestClient(requestId ?? "", body)
            : await startConversation({ shopId: shopId ?? "", productId, requestId, body });

          if (!result.ok) return result;

          router.push(
            sellerShopId
              ? `/vendeur/boutique/${sellerShopId}/messages/${result.data.conversationId}`
              : `/compte/messages/${result.data.conversationId}`,
          );

          return { ok: true, data: undefined };
        }}
      />
    </>
  );
}
