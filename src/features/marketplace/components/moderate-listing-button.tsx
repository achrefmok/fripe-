"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NoteDialog } from "@/features/admin/components/admin-actions";
import { useRouter } from "@/i18n/navigation";
import { moderateListing } from "../actions";

// Un retrait se motive toujours : le motif rejoint le journal d'audit.
export function ModerateListingButton({ listingId }: { listingId: string }) {
  const t = useTranslations("market");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" variant="destructive" onClick={() => setOpen(true)}>
        {t("adminModerate")}
      </Button>
      <NoteDialog
        title={t("adminModerate")}
        label={t("adminNote")}
        open={open}
        onOpenChange={setOpen}
        onConfirm={async (note) => {
          const result = await moderateListing(listingId, note);
          if (result.ok) {
            toast.success(t("adminModerated"));
            router.refresh();
          }
          return result;
        }}
      />
    </>
  );
}
