import { z } from "zod";
import { optionalPhoneSchema } from "@/lib/validations/common";

const shopFields = {
  name: z.string().trim().min(2, "nameTooShort").max(80, "nameTooLong"),
  description: z.string().trim().max(1000, "descriptionTooLong"),
  phone: optionalPhoneSchema,
  governorateId: z.coerce.number().int().positive("locationRequired"),
  cityId: z.coerce.number().int().positive("locationRequired"),
};

export const updateShopSchema = z.object(shopFields);

export const createShopSchema = z.object({
  ...shopFields,
  slug: z
    .string()
    .trim()
    .min(3, "slugInvalid")
    .max(60, "slugInvalid")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slugInvalid"),
});

export const shopIdSchema = z.uuid();
