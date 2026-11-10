"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// « Sbah el khir » et le prénom, lu dans la session du navigateur : l'accueil reste mis en cache.
export function HomeGreeting() {
  const t = useTranslations("home");
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!document.cookie.includes("sb-")) return;
    let cancelled = false;
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        const value = data.user?.user_metadata?.display_name;
        if (!cancelled && typeof value === "string" && value.trim()) setName(value.trim().split(/\s+/)[0]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hour = new Date().getHours();

  return (
    <div>
      <p className="luxe-kicker">{t(hour < 12 ? "greetMorning" : hour < 18 ? "greetDay" : "greetEvening")}</p>
      <p className="mt-0.5 font-display text-[28px] leading-tight" dir="auto">{name ?? t("greetGuest")}</p>
    </div>
  );
}
