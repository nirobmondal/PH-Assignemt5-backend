import z from "zod";

const addToCartSchema = z.object({
  medicineId: z.string("Medicine id must be a valid UUID"),
  quantity: z.coerce
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than 0"),
});

const updateCartItemSchema = z.object({
  medicineId: z.string("Medicine id must be a valid UUID"),
  quantity: z.coerce
    .number()
    .int("Quantity must be an integer")
    .nonnegative("Quantity cannot be negative"),
});

export const cartValidation = {
  addToCartSchema,
  updateCartItemSchema,
};
