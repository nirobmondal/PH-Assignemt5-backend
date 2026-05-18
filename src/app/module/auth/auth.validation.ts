import z from "zod";

const registerCustomerValidationSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password can be at most 100 characters"),
});

const loginUserValidationSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const changePasswordValidationSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(100, "New password can be at most 100 characters"),
});

const resetPasswordValidationSchema = z.object({
  email: z.email("Invalid email address"),
  otp: z
    .string()
    .trim()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only digits"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(100, "New password can be at most 100 characters"),
});

const verifyEmailValidationSchema = z.object({
  email: z.email("Invalid email address"),
  otp: z
    .string()
    .trim()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only digits"),
});

const forgetPasswordValidationSchema = z.object({
  email: z.email("Invalid email address"),
});

const googleLoginValidationSchema = z.object({
  idToken: z.string().min(1, "Google ID token is required"),
});

const resendVerificationOtpValidationSchema = z.object({
  email: z.email("Invalid email address"),
});

const updateSellerProfileValidationSchema = z
  .object({
    shopName: z.string().trim().min(1).optional(),
    shopAddress: z.string().optional(),
    shopPhone: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one seller profile field is required",
  })
  .optional();

const updateMeValidationSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    phone: z.string().optional(),
    image: z.url("Image must be a valid URL").optional(),
    seller: updateSellerProfileValidationSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required to update profile",
  });

export const authValidation = {
  registerCustomerValidationSchema,
  loginUserValidationSchema,
  changePasswordValidationSchema,
  verifyEmailValidationSchema,
  forgetPasswordValidationSchema,
  resetPasswordValidationSchema,
  updateMeValidationSchema,
  googleLoginValidationSchema,
  resendVerificationOtpValidationSchema,
};
