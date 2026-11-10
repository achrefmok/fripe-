import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { strokeWidth?: number };

// Le cintre de Friptex : le crochet et l'épaule, au même trait que les icônes Lucide.
export function HangerIcon({ strokeWidth = 1.6, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 4.2c1.3 0 2 1.3 1.1 2.2-.6.4-1.1.8-1.1 1.8" />
      <path d="M12 8.2 2.8 15.5h18.4z" />
    </svg>
  );
}

// La cabine d'essayage : une arche et son rideau entrouvert.
export function CabinIcon({ strokeWidth = 1.6, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 21V10a7 7 0 0 1 14 0v11" />
      <path d="M3.5 21h17" />
      <path d="M8 8.5c.6 3.8.2 8.3-1 12.5M16 8.5c-.6 3.8-.2 8.3 1 12.5" />
    </svg>
  );
}
