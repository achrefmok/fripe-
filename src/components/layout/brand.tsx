import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Le nom reste en latin dans les deux langues : c'est une marque, pas un mot traduit.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span dir="ltr" className={cn("font-wordmark font-extrabold tracking-[-0.04em]", className)}>
      FRIPE
    </span>
  );
}

export function BrandLink({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center", className)} aria-label="FRIPE">
      <Wordmark className="text-2xl leading-none" />
    </Link>
  );
}
