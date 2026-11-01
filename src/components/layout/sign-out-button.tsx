"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";

export function SignOutButton() {
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();

  return (
    <Button variant="ghost" disabled={pending} onClick={() => startTransition(() => signOut())}>
      <LogOut className="rtl:-scale-x-100" />
      {t("signOut")}
    </Button>
  );
}
