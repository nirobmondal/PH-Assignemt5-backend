import z from "zod";

const createMedicineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Medicine name must be at least 2 characters")
    .max(150, "Medicine name must be at most 150 characters"),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be at most 1000 characters")
    .optional(),
  price: z.coerce.number().positive("Price must be greater than 0"),
  stock: z.coerce
    .number()
    .int("Stock must be an integer")
    .nonnegative("Stock cannot be negative"),
  dosageForm: z
    .string()
    .trim()
    .min(2, "Dosage form must be at least 2 characters")
    .max(100, "Dosage form must be at most 100 characters"),
  strength: z
    .string()
    .trim()
    .min(1, "Strength is required")
    .max(100, "Strength must be at most 100 characters"),
  categoryId: z.string().uuid("Category id must be a valid UUID"),
  manufacturerId: z.string().uuid("Manufacturer id must be a valid UUID"),
  imageUrl: z.string().url("Image URL must be a valid URL").optional(),
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

const updateMedicineSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Medicine name must be at least 2 characters")
      .max(150, "Medicine name must be at most 150 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, "Description must be at most 1000 characters")
      .optional(),
    price: z.coerce
      .number()
      .positive("Price must be greater than 0")
      .optional(),
    stock: z.coerce
      .number()
      .int("Stock must be an integer")
      .nonnegative("Stock cannot be negative")
      .optional(),
    dosageForm: z
      .string()
      .trim()
      .min(2, "Dosage form must be at least 2 characters")
      .max(100, "Dosage form must be at most 100 characters")
      .optional(),
    strength: z
      .string()
      .trim()
      .min(1, "Strength is required")
      .max(100, "Strength must be at most 100 characters")
      .optional(),
    categoryId: z.string().uuid("Category id must be a valid UUID").optional(),
    manufacturerId: z
      .string()
      .uuid("Manufacturer id must be a valid UUID")
      .optional(),
    imageUrl: z.string().url("Image URL must be a valid URL").optional(),
    isAvailable: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required for update",
  });

export const medicineValidation = {
  createMedicineSchema,
  updateMedicineSchema,
};
