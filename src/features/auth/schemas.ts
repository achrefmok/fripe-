import { z } from "zod";
import { addressSchema, emailSchema, optionalPhoneSchema, passwordSchema, requiredPhoneSchema } from "@/lib/validations/common";

const displayNameSchema = z.string().trim().min(2, "nameTooShort").max(80, "nameTooLong");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "passwordTooShort"),
});

// Connexion sans mot de passe : un code à 6 chiffres reçu par e-mail.
export const emailCodeSchema = z.object({ email: emailSchema });

export const verifyEmailCodeSchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^[0-9]{6}$/, "codeInvalid"),
});

export const signUpSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: requiredPhoneSchema,
  ...addressSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({ password: passwordSchema });

export const profileSchema = z.object({
  displayName: displayNameSchema,
  phone: optionalPhoneSchema,
  locale: z.enum(["fr", "ar"]),
  ...addressSchema,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "passwordRequired"),
  confirmation: z.literal(true, { error: "confirmationRequired" }),
});
