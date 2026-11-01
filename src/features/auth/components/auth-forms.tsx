"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
} from "@/features/auth/actions";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/features/auth/schemas";
import { useFormAction } from "@/hooks/use-form-action";
import { Link } from "@/i18n/navigation";

export function SignInForm({ next }: { next?: string }) {
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

export function SignUpForm() {
  const t = useTranslations("auth");
  const form = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });
  const { submit, pending, error } = useFormAction(form, signUp);
  const { errors } = form.formState;

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
