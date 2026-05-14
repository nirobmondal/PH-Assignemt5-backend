import { Router } from "express";
import { authController } from "./auth.controller";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { multerUpload } from "../../config/multer.config";
import { validateRequest } from "../../middleware/validateRequest";
import { authValidation } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validateRequest(authValidation.registerCustomerValidationSchema),
  authController.registerCustomer,
);
router.post(
  "/login",
  validateRequest(authValidation.loginUserValidationSchema),
  authController.loginUser,
);
router.get(
  "/me",
  checkAuth(Role.CUSTOMER, Role.SELLER, Role.ADMIN),
  authController.getMe,
);
router.patch(
  "/update-me",
  multerUpload.single("file"),
  checkAuth(Role.CUSTOMER, Role.SELLER, Role.ADMIN),
  validateRequest(authValidation.updateMeValidationSchema),
  authController.updateMe,
);
router.post("/refresh-token", authController.getNewToken);
router.post(
  "/change-password",
  checkAuth(Role.CUSTOMER, Role.SELLER, Role.ADMIN),
  validateRequest(authValidation.changePasswordValidationSchema),
  authController.changePassword,
);
router.post(
  "/logout",
  checkAuth(Role.CUSTOMER, Role.SELLER, Role.ADMIN),
  authController.logoutUser,
);
router.post(
  "/verify-email",
  validateRequest(authValidation.verifyEmailValidationSchema),
  authController.verifyEmail,
);
router.post(
  "/forget-password",
  validateRequest(authValidation.forgetPasswordValidationSchema),
  authController.forgetPassword,
);

router.post(
  "/reset-password",
  validateRequest(authValidation.resetPasswordValidationSchema),
  authController.resetPassword,
);

router.get("/login/google", authController.googleLogin);
router.get("/google/success", authController.googleLoginSuccess);
router.get("/oauth/error", authController.handleOAuthError);

export const authRoute = router;
