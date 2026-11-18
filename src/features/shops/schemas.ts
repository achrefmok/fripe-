import { z } from "zod";
import { optionalPhoneSchema } from "@/lib/validations/common";
import { inTunisia } from "./location";

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

// La localisation de la boutique : l'adresse est obligatoire, la position GPS facultative, mais
// latitude et longitude vont ensemble, et doivent tomber en Tunisie (inversion fréquente sinon).
const coordinate = (min: number, max: number) =>
  z.preprocess((value) => (value === "" || value === null || value === undefined ? null : Number(value)), z.number().min(min).max(max).nullable());

export const shopLocationSchema = z
  .object({
    addressLine: z.string().trim().min(3, "addressRequired").max(200, "addressTooLong"),
    governorateId: z.coerce.number().int().positive("locationRequired"),
    cityId: z.coerce.number().int().positive("locationRequired"),
    latitude: coordinate(-90, 90),
    longitude: coordinate(-180, 180),
  })
  .superRefine((value, context) => {
    if ((value.latitude === null) !== (value.longitude === null)) {
      context.addIssue({ code: "custom", path: ["latitude"], message: "positionIncomplete" });
      return;
    }
    if (value.latitude !== null && value.longitude !== null && !inTunisia({ latitude: value.latitude, longitude: value.longitude })) {
      context.addIssue({ code: "custom", path: ["latitude"], message: "positionOutsideTunisia" });
    }
  });
