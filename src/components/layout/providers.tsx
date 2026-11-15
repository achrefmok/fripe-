"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { useTranslations } from "next-intl";
import { ThemeProvider } from "next-themes";
import { Direction } from "radix-ui";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ dir, children }: { dir: "ltr" | "rtl"; children: ReactNode }) {
  const t = useTranslations("common");

  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV !== "production"}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <Direction.Provider dir={dir}>
          {children}
          <Toaster position="top-center" dir={dir} containerAriaLabel={t("notifications")} />
        </Direction.Provider>
      </ThemeProvider>
    </SerwistProvider>
  );
}
