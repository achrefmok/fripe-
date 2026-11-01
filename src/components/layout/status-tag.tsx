import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TONES = {
  pending: "bg-secondary text-secondary-foreground",
  approved: "bg-foreground text-background",
  rejected: "bg-harissa text-harissa-ink",
  suspended: "bg-harissa text-harissa-ink",
  closed: "bg-secondary text-secondary-foreground",
  active: "bg-foreground text-background",
  accountSuspended: "bg-harissa text-harissa-ink",
} as const;

export function StatusTag({ status }: { status: keyof typeof TONES }) {
  const t = useTranslations("status");

  return <span className={cn("status-tag", TONES[status])}>{t(status)}</span>;
}
