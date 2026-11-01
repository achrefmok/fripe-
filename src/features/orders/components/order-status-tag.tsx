import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  confirmed: "bg-kraft text-[oklch(0.2_0.014_55)]",
  preparing: "bg-kraft text-[oklch(0.2_0.014_55)]",
  shipped: "bg-kraft text-[oklch(0.2_0.014_55)]",
  delivered: "bg-foreground text-background",
  cancelled: "bg-harissa text-harissa-ink",
};

export function OrderStatusTag({
  status,
}: {
  status: "pending" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled";
}) {
  const t = useTranslations("orderStatus");

  return <span className={cn("status-tag", TONES[status])}>{t(status)}</span>;
}
