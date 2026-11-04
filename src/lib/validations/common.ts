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

// Obligatoire : c'est le numéro qu'appelle le livreur et qui confirme le paiement à la livraison.
export const requiredPhoneSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    const phone = normalizeTunisianPhone(value);
    if (!phone) {
      context.addIssue({ code: "custom", message: value === "" ? "phoneRequired" : "phoneInvalid" });
      return z.NEVER;
    }

    return phone;
  });

const optionalId = z
  .union([z.literal(""), z.coerce.number().int().positive()])
  .optional()
  .transform((value) => value || null);

// Adresse facultative : gouvernorat, ville et rue, reprises à la commande.
export const addressSchema = {
  governorateId: optionalId,
  cityId: optionalId,
  addressLine: z
    .string()
    .trim()
    .max(200, "textTooLong")
    .optional()
    .transform((value) => value || null),
};

export const emailSchema = z.string().trim().toLowerCase().email("emailInvalid");
export const passwordSchema = z.string().min(8, "passwordTooShort").max(72, "passwordTooLong");
