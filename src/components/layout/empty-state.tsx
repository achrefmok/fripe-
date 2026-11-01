import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-y py-10">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      {body ? <p className="mt-2 max-w-md leading-relaxed text-muted-foreground">{body}</p> : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
