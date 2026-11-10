import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import logoDark from "../../../public/brand/friptex-logo-dark.png";
import logo from "../../../public/brand/friptex-logo.png";

// Le nom reste en latin dans les deux langues : c'est une marque, pas un mot traduit.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span dir="ltr" className={cn("font-wordmark font-extrabold tracking-[-0.04em]", className)}>
      FRIPE
    </span>
  );
}

// Le logo des barres de navigation. En thème sombre, le bordeaux passe en crème pour rester lisible.
// Sur un aplat harissa, il se pose sur une étiquette papier : son orange se perdrait sur le rouge.
export function BrandLink({ className, onHarissa = false }: { className?: string; onHarissa?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("inline-flex shrink-0 items-center", onHarissa && "rounded-[2px] bg-paper px-2 py-1", className)}
    >
      <Image src={logo} alt="Friptex" priority className={cn("h-9 w-auto", !onHarissa && "dark:hidden")} />
      {onHarissa ? null : <Image src={logoDark} alt="Friptex" priority className="hidden h-9 w-auto dark:block" />}
    </Link>
  );
}
