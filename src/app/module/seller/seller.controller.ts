import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sellerService } from "./seller.service";
import { sendResponse } from "../../shared/sendResponse";
import status from "http-status";
import { tokenUtils } from "../../utils/token";

const createSellerProfile = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  const result = await sellerService.createSellerProfile(
    req.user.userId,
    payload,
  );

  const { accessToken, refreshToken, ...rest } = result;

  // Set all cookies with updated tokens after role change
  tokenUtils.setAccessTokenCookie(res, accessToken);
  tokenUtils.setRefreshTokenCookie(res, refreshToken);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Seller profile created successfully",
    data: {
      accessToken,
      refreshToken,
      ...rest,
    },
  });
});

export const sellerController = {
  createSellerProfile,
};
