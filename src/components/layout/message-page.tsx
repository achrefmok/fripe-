import type { ReactNode } from "react";
import { HangTag } from "./hang-tag";

export function MessagePage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-16">
      <div className="rail text-foreground" aria-hidden="true" />
      <HangTag string="2.5rem" swing="1.5deg" bodyClassName="bg-card text-card-foreground shadow-tag">
        <div className="grid gap-3 px-6 pb-7 pt-14">
          <h1 className="font-display text-3xl leading-tight font-extrabold">{title}</h1>
          <p className="leading-relaxed text-muted-foreground">{body}</p>
          {children ? <div className="mt-2">{children}</div> : null}
        </div>
      </HangTag>
    </div>
  );
}
