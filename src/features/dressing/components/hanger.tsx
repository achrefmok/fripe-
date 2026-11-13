import { cn } from "@/lib/utils";

// Le cintre doré du Vide-Dressing : un crochet, une épaule. Il pend au-dessus des pièces du portant.
export function Hanger({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 40" className={cn("vd-hanger", className)} aria-hidden="true" focusable="false">
      <path d="M50 3c4 0 6 4 3 7-2 1-3 2-3 5" />
      <path d="M50 15 8 36h84z" />
    </svg>
  );
}
