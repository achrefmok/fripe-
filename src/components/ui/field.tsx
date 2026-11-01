"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

type FieldProps = {
  id: string;
  label: string;
  hint?: ReactNode;
  optional?: boolean;
  error?: string;
  children: ReactNode;
};

export function Field({ id, label, hint, optional, error, children }: FieldProps) {
  const validation = useTranslations("validation");
  const errors = useTranslations("errors");
  const common = useTranslations("common");

  const message = !error
    ? null
    : validation.has(error)
      ? validation(error)
      : errors.has(error)
        ? errors(error)
        : errors("unexpected");

  return (
    <div className="grid gap-0.5">
      <Label htmlFor={id} className="text-[0.8rem] font-semibold">
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground"> · {common("optional")}</span>
        ) : null}
      </Label>
      {children}
      {message ? (
        <p id={`${id}-error`} role="alert" className="pt-1 text-[0.8rem] font-medium text-destructive">
          {message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="pt-1 text-[0.8rem] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ error }: { error: string | null }) {
  const errors = useTranslations("errors");

  if (!error) return null;

  return (
    <p role="alert" className="bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
      {errors.has(error) ? errors(error) : errors("unexpected")}
    </p>
  );
}
