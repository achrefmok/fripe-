"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  confirmMfaEnrollment,
  removeMfaFactor,
  startMfaEnrollment,
  verifyMfa,
} from "@/features/auth/mfa-actions";
import { useRouter } from "@/i18n/navigation";

function CodeField({ value, onChange, error }: { value: string; onChange: (code: string) => void; error?: string }) {
  const t = useTranslations("mfa");

  return (
    <Field id="mfa-code" label={t("code")} error={error}>
      <Input
        id="mfa-code"
        dir="ltr"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        className="text-start tracking-widest"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
      />
    </Field>
  );
}

export function MfaChallenge({ factorId, next }: { factorId: string; next: string }) {
  const t = useTranslations("mfa");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setFieldError(undefined);

        startTransition(async () => {
          const result = await verifyMfa({ factorId, code });

          if (result.ok) {
            router.replace(next);
            router.refresh();
          } else if (result.fields?.code) {
            setFieldError(result.fields.code);
          } else {
            setError(result.error);
            setCode("");
          }
        });
      }}
    >
      <CodeField value={code} onChange={setCode} error={fieldError} />
      <FormError error={error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{t("verify")}</Button>
    </form>
  );
}

export function MfaEnroll({ next, defaultName }: { next: string; defaultName: string }) {
  const t = useTranslations("mfa");
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [enrollment, setEnrollment] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!enrollment) {
    return (
      <form
        noValidate
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);

          startTransition(async () => {
            const result = await startMfaEnrollment(name);

            if (result.ok) setEnrollment(result.data);
            else setError(result.error);
          });
        }}
      >
        <Field id="mfa-name" label={t("deviceName")}>
          <Input id="mfa-name" maxLength={40} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <FormError error={error} />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>{t("start")}</Button>
      </form>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setFieldError(undefined);

        startTransition(async () => {
          const result = await confirmMfaEnrollment({ factorId: enrollment.factorId, code });

          if (result.ok) {
            toast.success(t("enrolled"));
            router.replace(next);
            router.refresh();
          } else if (result.fields?.code) {
            setFieldError(result.fields.code);
          } else {
            setError(result.error);
            setCode("");
          }
        });
      }}
    >
      <p className="text-sm">{t("scan")}</p>
      <div className="justify-self-center bg-white p-2">
        <Image src={enrollment.qrCode} alt={t("qrAlt")} width={180} height={180} unoptimized />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{t("manual")}</p>
        <code data-testid="mfa-secret" dir="ltr" className="block text-sm font-semibold [overflow-wrap:anywhere]">
          {enrollment.secret}
        </code>
      </div>
      <CodeField value={code} onChange={setCode} error={fieldError} />
      <FormError error={error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{t("confirm")}</Button>
    </form>
  );
}

export function RemoveFactorButton({ factorId, name }: { factorId: string; name: string }) {
  const t = useTranslations("mfa");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      aria-label={t("removeNamed", { name })}
      onClick={() =>
        startTransition(async () => {
          const result = await removeMfaFactor(factorId);

          if (result.ok) {
            toast.success(t("removed"));
            router.refresh();
          } else {
            toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
          }
        })
      }
    >
      {t("remove")}
    </Button>
  );
}
