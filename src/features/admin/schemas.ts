import { z } from "zod";

export const reviewShopSchema = z
  .object({
    shopId: z.uuid(),
    status: z.enum(["approved", "rejected", "suspended"]),
    note: z.string().trim().max(500, "noteTooLong"),
  })
  .refine((value) => value.status === "approved" || value.note.length >= 3, {
    path: ["note"],
    message: "noteRequired",
  });

export const userStatusSchema = z
  .object({
    userId: z.uuid(),
    status: z.enum(["active", "suspended"]),
    reason: z.string().trim().max(500, "noteTooLong"),
  })
  .refine((value) => value.status === "active" || value.reason.length >= 3, {
    path: ["reason"],
    message: "noteRequired",
  });

const nameFr = z.string().trim().min(2, "nameTooShort").max(80, "nameTooLong");
const nameAr = z.string().trim().min(2, "nameTooShort").max(80, "nameTooLong");

export const referenceIdSchema = z.uuid();

export const categorySchema = z
  .object({
    id: z.uuid().nullable(),
    parentId: z.uuid().nullable(),
    nameFr,
    nameAr,
    position: z.coerce.number().int().min(0).max(999),
  })
  .refine((value) => value.id || /[a-z0-9]/i.test(value.nameFr.normalize("NFD")), {
    path: ["nameFr"],
    message: "nameTooShort",
  });

export const governorateSchema = z.object({
  id: z.number().int().positive(),
  nameFr,
  nameAr,
});

export const citySchema = z.object({
  id: z.number().int().positive().nullable(),
  governorateId: z.number().int().positive(),
  nameFr,
  nameAr,
});
