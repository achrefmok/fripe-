import type { ReactNode } from "react";

// Le formulaire d'authentification : un titre en Bodoni, une phrase, puis les champs soulignés.
export function AuthCard({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <div className="lx-authform">
      <h1 className="font-display text-[clamp(30px,4vw,44px)] font-normal leading-tight">{title}</h1>
      {lead ? <p className="mt-2 leading-relaxed text-muted-foreground">{lead}</p> : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
