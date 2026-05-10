import z from "zod";

const createSellerProfileSchema = z.object({
  shopName: z
    .string()
    .trim()
    .min(2, "Shop name is required")
    .max(120, "Shop name must be at most 120 characters"),
  shopAddress: z
    .string()
    .max(255, "Shop address must be at most 255 characters")
    .optional(),
  shopPhone: z
    .string()
    .trim()
    .regex(/^[+]?\d{11,14}$/, "Shop phone must contain 11 to 14 digits")
    .optional(),
});

export const sellerValidation = {
  createSellerProfileSchema,
};
