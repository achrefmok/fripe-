import { z } from "zod";

// Accepte « 22 123 456 », « +216 22123456 » ou « 0021622123456 » et stocke le format E.164.
export function normalizeTunisianPhone(value: string) {
  const digits = value.replace(/[\s.-]/g, "").replace(/^\+/, "").replace(/^00/, "");
  const national = digits.startsWith("216") && digits.length === 11 ? digits.slice(3) : digits;
  return /^[2-9]\d{7}$/.test(national) ? `+216${national}` : null;
}

export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === "") return null;

    const phone = normalizeTunisianPhone(value);
    if (!phone) {
      context.addIssue({ code: "custom", message: "phoneInvalid" });
      return z.NEVER;
    }

    return phone;
  });

export const emailSchema = z.string().trim().toLowerCase().email("emailInvalid");
export const passwordSchema = z.string().min(8, "passwordTooShort").max(72, "passwordTooLong");
