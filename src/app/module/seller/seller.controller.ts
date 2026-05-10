import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sellerService } from "./seller.service";
import { sendResponse } from "../../shared/sendResponse";
import status from "http-status";
import { tokenUtils } from "../../utils/token";
import { CookieUtils } from "../../utils/cookie";

const createSellerProfile = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const sessionToken = CookieUtils.getCookie(req, "better-auth.session_token");

  const result = await sellerService.createSellerProfile(
    req.user.userId,
    payload,
    sessionToken,
  );

  const { accessToken, refreshToken, token, ...rest } = result;

  // Set all three cookies with updated tokens after role change
  tokenUtils.setAccessTokenCookie(res, accessToken);
  tokenUtils.setRefreshTokenCookie(res, refreshToken);
  tokenUtils.setBetterAuthSessionCookie(res, token);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Seller profile created successfully",
    data: {
      token,
      accessToken,
      refreshToken,
      ...rest,
    },
  });
});

export const sellerController = {
  createSellerProfile,
};
