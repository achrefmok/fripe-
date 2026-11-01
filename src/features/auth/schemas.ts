import { z } from "zod";
import { emailSchema, optionalPhoneSchema, passwordSchema } from "@/lib/validations/common";

const displayNameSchema = z.string().trim().min(2, "nameTooShort").max(80, "nameTooLong");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "passwordTooShort"),
});

export const signUpSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({ password: passwordSchema });

export const profileSchema = z.object({
  displayName: displayNameSchema,
  phone: optionalPhoneSchema,
  locale: z.enum(["fr", "ar"]),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "passwordRequired"),
  confirmation: z.literal(true, { error: "confirmationRequired" }),
});
