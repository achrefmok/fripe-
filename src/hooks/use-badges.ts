"use client";

import { useEffect, useState } from "react";
import { usePathname } from "@/i18n/navigation";

// Lu seulement pour une session ouverte : les pages publiques restent statiques et sans appel.
export function useBadges() {
  const pathname = usePathname();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!document.cookie.includes("sb-")) return;

    let cancelled = false;

    fetch("/api/badges", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { total: 0 }))
      .then((data: { total: number }) => {
        if (!cancelled) setTotal(data.total);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return total;
}
