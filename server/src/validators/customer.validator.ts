import { z } from "zod";
import { CUSTOMER_TAGS } from "../constants/index.js";
import { normalizePhoneWa } from "../utils/phone.js";

export const createCustomerSchema = z.object({
  name: z.string().min(2, "Nama customer minimal 2 karakter"),
  phoneWa: z
    .string()
    .min(1, "Nomor WhatsApp wajib diisi")
    .transform((val, ctx) => {
      try {
        return normalizePhoneWa(val);
      } catch (err: any) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err.message || "Format nomor WhatsApp tidak valid",
        });
        return val;
      }
    }),
  socialMedia: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  recipientName: z.string().optional(),
  tag: z.enum([CUSTOMER_TAGS.REGULAR, CUSTOMER_TAGS.VIP, CUSTOMER_TAGS.WARNING]).default(CUSTOMER_TAGS.REGULAR),
  waOptIn: z.boolean().default(true),
  notes: z.string().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

// Quick create for CUS-5: only requires name and phoneWa
export const quickCreateCustomerSchema = z.object({
  name: z.string().min(2, "Nama customer minimal 2 karakter"),
  phoneWa: z
    .string()
    .min(1, "Nomor WhatsApp wajib diisi")
    .transform((val, ctx) => {
      try {
        return normalizePhoneWa(val);
      } catch (err: any) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err.message || "Format nomor WhatsApp tidak valid",
        });
        return val;
      }
    }),
  tag: z.enum([CUSTOMER_TAGS.REGULAR, CUSTOMER_TAGS.VIP, CUSTOMER_TAGS.WARNING]).default(CUSTOMER_TAGS.REGULAR),
  notes: z.string().optional(),
});

export type QuickCreateCustomerInput = z.infer<typeof quickCreateCustomerSchema>;

export const updateCustomerSchema = z.object({
  name: z.string().min(2, "Nama customer minimal 2 karakter").optional(),
  phoneWa: z
    .string()
    .optional()
    .transform((val, ctx) => {
      if (!val) return undefined;
      try {
        return normalizePhoneWa(val);
      } catch (err: any) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err.message || "Format nomor WhatsApp tidak valid",
        });
        return val;
      }
    }),
  socialMedia: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  recipientName: z.string().optional(),
  tag: z.enum([CUSTOMER_TAGS.REGULAR, CUSTOMER_TAGS.VIP, CUSTOMER_TAGS.WARNING]).optional(),
  waOptIn: z.boolean().optional(),
  notes: z.string().optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
