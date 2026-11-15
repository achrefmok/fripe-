"use client";

import { useTranslations } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";
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

  // Le champ annonce son erreur (ou son aide) aux lecteurs d'écran, et se déclare invalide.
  const described = message ? `${id}-error` : hint ? `${id}-hint` : null;
  const control =
    isValidElement(children) && (children.props as { id?: string }).id === id
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          "aria-invalid": message ? true : (children.props as Record<string, unknown>)["aria-invalid"],
          "aria-describedby":
            [(children.props as Record<string, unknown>)["aria-describedby"], described].filter(Boolean).join(" ") || undefined,
        })
      : children;

  return (
    <div className="grid gap-0.5">
      <Label htmlFor={id} className="text-[0.8rem] font-semibold">
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground"> · {common("optional")}</span>
        ) : null}
      </Label>
      {control}
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
