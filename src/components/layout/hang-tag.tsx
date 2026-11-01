import type { CSSProperties, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type HangTagProps = {
  href?: string;
  className?: string;
  bodyClassName?: string;
  string?: string;
  delay?: number;
  swing?: string;
  children: ReactNode;
};

// L'étiquette volante : signature de FRIPE. Elle pend d'un fil et se balance au survol.
export function HangTag({
  href,
  className,
  bodyClassName,
  string,
  delay,
  swing,
  children,
}: HangTagProps) {
  const style = {
    ...(string ? { "--tag-string": string } : {}),
    ...(delay ? { "--tag-delay": `${delay}ms` } : {}),
    ...(swing ? { "--tag-swing": swing } : {}),
  } as CSSProperties;

  const body = <span className={cn("hangtag__body", bodyClassName)}>{children}</span>;

  return href ? (
    <Link href={href} className={cn("hangtag", className)} style={style}>
      {body}
    </Link>
  ) : (
    <div className={cn("hangtag", className)} style={style}>
      {body}
    </div>
  );
}
