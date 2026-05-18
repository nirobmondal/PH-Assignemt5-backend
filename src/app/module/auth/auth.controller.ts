import { Request, Response } from "express";
import AppError from "../../errorHelpers/AppError";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CookieUtils } from "../../utils/cookie";
import { tokenUtils } from "../../utils/token";
import { authService } from "./auth.service";
import { StatusCodes } from "http-status-codes";

const registerCustomer = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  const result = await authService.registerCustomer(payload);

  sendResponse(res, {
    httpStatusCode: StatusCodes.CREATED,
    success: true,
    message: "Customer registered successfully",
    data: {
      user: result,
    },
  });
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  const result = await authService.loginUser(payload);
  const { accessToken, refreshToken, user } = result;

  tokenUtils.setAccessTokenCookie(res, accessToken);
  tokenUtils.setRefreshTokenCookie(res, refreshToken);

  sendResponse(res, {
    httpStatusCode: StatusCodes.OK,
    success: true,
    message: "User logged in successfully",
    data: {
      accessToken,
      refreshToken,
      user,
    },
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await authService.getMe(user);
  sendResponse(res, {
    httpStatusCode: StatusCodes.OK,
    success: true,
    message: "User profile fetched successfully",
    data: result,
  });
});

const updateMe = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const payload = {
    ...req.body,
    image: req.file?.path,
  };

  const result = await authService.updateMe(user, payload);

  sendResponse(res, {
    httpStatusCode: StatusCodes.OK,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

const getNewToken = catchAsync(async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Refresh token is missing");
  }
  const result = await authService.getNewToken(refreshToken);

  const { accessToken, refreshToken: newRefreshToken } = result;

  tokenUtils.setAccessTokenCookie(res, accessToken);
  tokenUtils.setRefreshTokenCookie(res, newRefreshToken);

  sendResponse(res, {
    httpStatusCode: StatusCodes.OK,
    success: true,
    message: "New tokens generated successfully",
    data: {
      accessToken,
      refreshToken: newRefreshToken,
    },
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  await authService.changePassword(payload, req.user);

  CookieUtils.clearCookie(res, "accessToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
  CookieUtils.clearCookie(res, "refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });

  sendResponse(res, {
    httpStatusCode: StatusCodes.OK,
    success: true,
    message: "Password changed successfully",
    data: null,
  });
});

const logoutUser = catchAsync(async (req: Request, res: Response) => {
  CookieUtils.clearCookie(res, "accessToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
  CookieUtils.clearCookie(res, "refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });

  sendResponse(res, {
    httpStatusCode: StatusCodes.OK,
    success: true,
    message: "User logged out successfully",
    data: null,
  });
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  await authService.verifyEmail(email, otp);

  sendResponse(res, {
    httpStatusCode: StatusCodes.OK,
    success: true,
    message: "Email verified successfully",
  });
});

const resendVerificationOtp = catchAsync(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    await authService.resendVerificationOtp(email);

    sendResponse(res, {
      httpStatusCode: StatusCodes.OK,
      success: true,
      message: "Verification OTP resent successfully",
    });
  },
);

const forgetPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  await authService.forgetPassword(email);

  sendResponse(res, {
    httpStatusCode: StatusCodes.OK,
    success: true,
    message: "Password reset OTP sent to email successfully",
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;
  await authService.resetPassword(email, otp, newPassword);

  sendResponse(res, {
    httpStatusCode: StatusCodes.OK,
    success: true,
    message: "Password reset successfully",
  });
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
  const { idToken } = req.body;
  const { user, accessToken, refreshToken } =
    await authService.googleLoginService(idToken);

  await tokenUtils.setAccessTokenCookie(res, accessToken);
  await tokenUtils.setRefreshTokenCookie(res, refreshToken);

  sendResponse(res, {
    httpStatusCode: StatusCodes.OK,
    success: true,
    message: "Login successful",
    data: {
      user,
      accessToken,
      refreshToken,
    },
  });
});

export const authController = {
  registerCustomer,
  loginUser,
  getMe,
  updateMe,
  getNewToken,
  changePassword,
  logoutUser,
  verifyEmail,
  resendVerificationOtp,
  forgetPassword,
  resetPassword,
  googleLogin,
};
