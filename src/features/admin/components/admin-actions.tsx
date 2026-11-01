"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { reviewShop, setUserStatus } from "@/features/admin/actions";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/utils/action-result";
import type { Database } from "@/types/database";

type ShopStatus = Database["public"]["Enums"]["shop_status"];

export function NoteDialog({
  title,
  label,
  open,
  onOpenChange,
  onConfirm,
}: {
  title: string;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note: string) => Promise<ActionResult>;
}) {
  const t = useTranslations("admin");
  const common = useTranslations("common");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Field id="note" label={label} error={fieldError}>
          <Textarea
            id="note"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <FormError error={error} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {common("cancel")}
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setFieldError(undefined);
                setError(null);

                const result = await onConfirm(note);
                if (result.ok) {
                  setNote("");
                  onOpenChange(false);
                  return;
                }

                const fieldMessage = Object.values(result.fields ?? {})[0];
                if (fieldMessage) setFieldError(fieldMessage);
                else setError(result.error);
              })
            }
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ShopReviewActions({
  shopId,
  shopName,
  status,
}: {
  shopId: string;
  shopName: string;
  status: ShopStatus;
}) {
  const t = useTranslations("admin");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [noteFor, setNoteFor] = useState<"rejected" | "suspended" | null>(null);

  async function decide(nextStatus: "approved" | "rejected" | "suspended", note: string) {
    const result = await reviewShop({ shopId, status: nextStatus, note });
    if (result.ok) {
      toast.success(t("actionDone"));
      router.refresh();
    }
    return result;
  }

  function approve() {
    startTransition(async () => {
      const result = await decide("approved", "");
      if (!result.ok) toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" || status === "suspended" ? (
        <Button size="sm" disabled={pending} onClick={approve}>
          {status === "pending" ? t("approve") : t("reinstate")}
        </Button>
      ) : null}
      {status === "pending" ? (
        <Button size="sm" variant="outline" onClick={() => setNoteFor("rejected")}>
          {t("reject")}
        </Button>
      ) : null}
      {status === "approved" ? (
        <Button size="sm" variant="outline" onClick={() => setNoteFor("suspended")}>
          {t("suspend")}
        </Button>
      ) : null}
      <NoteDialog
        title={
          noteFor === "suspended"
            ? t("noteTitleSuspended", { name: shopName })
            : t("noteTitleRejected", { name: shopName })
        }
        label={t("noteLabel")}
        open={noteFor !== null}
        onOpenChange={(open) => !open && setNoteFor(null)}
        onConfirm={(note) => decide(noteFor ?? "rejected", note)}
      />
    </div>
  );
}

export function UserStatusAction({
  userId,
  userName,
  status,
}: {
  userId: string;
  userName: string;
  status: Database["public"]["Enums"]["account_status"];
}) {
  const t = useTranslations("admin");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  async function change(nextStatus: "active" | "suspended", reason: string) {
    const result = await setUserStatus({ userId, status: nextStatus, reason });
    if (result.ok) {
      toast.success(t("actionDone"));
      router.refresh();
    }
    return result;
  }

  if (status === "suspended") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await change("active", "");
            if (!result.ok) toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
          })
        }
      >
        {t("reactivateUser")}
      </Button>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t("suspendUser")}
      </Button>
      <NoteDialog
        title={t("noteTitleUser", { name: userName })}
        label={t("reasonLabel")}
        open={open}
        onOpenChange={setOpen}
        onConfirm={(reason) => change("suspended", reason)}
      />
    </>
  );
}
