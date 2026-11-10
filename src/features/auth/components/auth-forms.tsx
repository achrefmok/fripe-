"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  requestEmailCode,
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  verifyEmailCode,
} from "@/features/auth/actions";
import {
  emailCodeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  verifyEmailCodeSchema,
} from "@/features/auth/schemas";
import { AddressFields } from "@/features/auth/components/address-fields";
import type { LocationOption } from "@/features/shops/queries";
import { useFormAction } from "@/hooks/use-form-action";
import { Link } from "@/i18n/navigation";

export function SignInForm({ next, initialMethod = "password" }: { next?: string; initialMethod?: "password" | "code" }) {
  const t = useTranslations("auth");
  const [method, setMethod] = useState(initialMethod);

  return (
    <div className="grid gap-5">
      <div role="group" aria-label={t("methodLabel")} className="grid grid-cols-2 rounded-full bg-cream p-1">
        {(["password", "code"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={method === value}
            onClick={() => setMethod(value)}
            className={
              method === value
                ? "min-h-11 rounded-full bg-foreground px-3 text-sm font-semibold text-background"
                : "min-h-11 rounded-full px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {t(value === "password" ? "methodPassword" : "methodCode")}
          </button>
        ))}
      </div>
      {method === "password" ? <PasswordSignInForm next={next} /> : <EmailCodeSignInForm next={next} />}
    </div>
  );
}

// Connexion sans mot de passe ni inscription : l'adresse, puis le code à 6 chiffres reçu.
function EmailCodeSignInForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const emailForm = useForm({ resolver: zodResolver(emailCodeSchema), defaultValues: { email: "" } });
  const codeForm = useForm({ resolver: zodResolver(verifyEmailCodeSchema), defaultValues: { email: "", code: "" } });

  const request = useFormAction(emailForm, requestEmailCode, () => {
    const email = emailForm.getValues("email").trim().toLowerCase();
    codeForm.reset({ email, code: "" });
    setSentTo(email);
  });
  const verify = useFormAction(codeForm, (values) => verifyEmailCode(values, next));
  const [resending, startResend] = useTransition();
  const [resendError, setResendError] = useState<string | null>(null);

  // Le renvoi part de l'adresse déjà validée : un code à moitié saisi ne le bloque pas.
  const resend = () => {
    if (!sentTo) return;
    setResendError(null);
    startResend(async () => {
      const result = await requestEmailCode({ email: sentTo });
      if (result.ok) toast.success(t("codeResent"));
      else setResendError(result.error);
    });
  };

  if (!sentTo) {
    const { errors } = emailForm.formState;
    return (
      <form onSubmit={request.submit} noValidate className="grid gap-5">
        <p className="text-sm text-muted-foreground">{t("codeLead")}</p>
        <Field id="code-email" label={t("email")} error={errors.email?.message}>
          <Input
            id="code-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...emailForm.register("email")}
          />
        </Field>
        <FormError error={request.error} />
        <Button type="submit" size="lg" disabled={request.pending} className="w-full">
          {t("codeSend")}
        </Button>
      </form>
    );
  }

  const { errors } = codeForm.formState;
  return (
    <form onSubmit={verify.submit} noValidate className="grid gap-5">
      <p role="status" className="bg-secondary px-3 py-2 text-sm">
        {t("codeSentTo", { email: sentTo })}
      </p>
      <Field id="code" label={t("code")} error={errors.code?.message}>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          className="text-center font-mono text-xl tracking-[0.5em]"
          aria-invalid={Boolean(errors.code)}
          {...codeForm.register("code")}
        />
      </Field>
      <FormError error={resendError ?? verify.error} />
      <Button type="submit" size="lg" disabled={verify.pending} className="w-full">
        {t("codeSubmit")}
      </Button>
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <button type="button" onClick={resend} disabled={resending} className="font-medium underline underline-offset-4">
          {t("codeResend")}
        </button>
        <button type="button" onClick={() => setSentTo(null)} className="font-medium underline underline-offset-4">
          {t("codeChangeEmail")}
        </button>
      </div>
    </form>
  );
}

function PasswordSignInForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const form = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const { submit, pending, error } = useFormAction(form, (values) => signIn(values, next));
  const { errors } = form.formState;

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field id="email" label={t("email")} error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...form.register("email")}
        />
      </Field>
      <Field id="password" label={t("password")} error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          {...form.register("password")}
        />
      </Field>
      <FormError error={error} />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {t("signIn")}
      </Button>
      <div className="grid gap-1 text-sm">
        <Link href="/mot-de-passe-oublie" className="font-medium underline underline-offset-4">
          {t("forgot")}
        </Link>
        <p className="text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href="/inscription" className="font-semibold text-foreground underline underline-offset-4">
            {t("signUp")}
          </Link>
        </p>
      </div>
    </form>
  );
}

export function SignUpForm({ locations }: { locations: LocationOption[] }) {
  const t = useTranslations("auth");
  const form = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "", phone: "", governorateId: "", cityId: "", addressLine: "" },
  });
  const { submit, pending, error } = useFormAction(form, signUp);
  const { errors } = form.formState;
  const governorateId = String(useWatch({ control: form.control, name: "governorateId" }) ?? "");

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field id="displayName" label={t("displayName")} error={errors.displayName?.message}>
        <Input
          id="displayName"
          autoComplete="name"
          aria-invalid={Boolean(errors.displayName)}
          {...form.register("displayName")}
        />
      </Field>
      <Field id="email" label={t("email")} error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...form.register("email")}
        />
      </Field>
      <Field
        id="password"
        label={t("password")}
        hint={t("passwordHint")}
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          {...form.register("password")}
        />
      </Field>
      <Field id="phone" label={t("phone")} hint={t("phoneHint")} error={errors.phone?.message}>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel-national"
          placeholder="22 123 456"
          aria-invalid={Boolean(errors.phone)}
          className="text-start"
          {...form.register("phone")}
        />
      </Field>
      <AddressFields
        locations={locations}
        governorateId={governorateId}
        register={form.register}
        setValue={form.setValue}
        errors={errors}
      />
      <p className="text-sm text-muted-foreground">
        {t.rich("signUpTerms", {
          terms: (chunks) => <Link href="/cgu" prefetch={false} className="underline underline-offset-2">{chunks}</Link>,
          privacy: (chunks) => <Link href="/confidentialite" prefetch={false} className="underline underline-offset-2">{chunks}</Link>,
        })}
      </p>
      <FormError error={error} />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {t("signUp")}
      </Button>
      <p className="text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/connexion" className="font-semibold text-foreground underline underline-offset-4">
          {t("signIn")}
        </Link>
      </p>
      <p className="text-sm text-muted-foreground">
        {t("noAccountCode")}{" "}
        <Link href={{ pathname: "/connexion", query: { methode: "code" } }} className="font-semibold text-foreground underline underline-offset-4">
          {t("noAccountCodeLink")}
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [sent, setSent] = useState(false);
  const form = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const { submit, pending, error } = useFormAction(form, requestPasswordReset, () => setSent(true));
  const { errors } = form.formState;

  if (sent) {
    return (
      <p role="status" className="leading-relaxed font-medium">
        {t("forgotSent")}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field id="email" label={t("email")} error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...form.register("email")}
        />
      </Field>
      <FormError error={error} />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {t("forgotSubmit")}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const form = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
  });
  const { submit, pending, error } = useFormAction(form, updatePassword);
  const { errors } = form.formState;

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field
        id="password"
        label={t("password")}
        hint={t("passwordHint")}
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          {...form.register("password")}
        />
      </Field>
      <FormError error={error} />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {t("resetSubmit")}
      </Button>
    </form>
  );
}
