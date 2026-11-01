import type { ReactNode } from "react";
import { HangTag } from "@/components/layout/hang-tag";

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
    <HangTag string="2.25rem" swing="0.8deg" bodyClassName="bg-card text-card-foreground shadow-tag">
      <div className="px-6 pb-8 pt-14 md:px-8">
        <h1 className="font-display text-3xl leading-tight font-extrabold">{title}</h1>
        {lead ? <p className="mt-2 leading-relaxed text-muted-foreground">{lead}</p> : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </HangTag>
  );
}
