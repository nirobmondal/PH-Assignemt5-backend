import status from "http-status";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { ICreateSellerProfilePayload } from "./seller.interface";
import { tokenUtils } from "../../utils/token";
import { StatusCodes } from "http-status-codes";

const createSellerProfile = async (
  userId: string,
  payload: ICreateSellerProfilePayload,
  sessionToken?: string,
) => {
  if (!sessionToken) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Session token is required");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      seller: true,
    },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  if (user.status === UserStatus.BANNED) {
    throw new AppError(
      status.FORBIDDEN,
      "Banned users cannot create seller profile",
    );
  }

  if (user.seller) {
    throw new AppError(status.CONFLICT, "Seller profile already exists");
  }

  const result = await prisma.$transaction(async (tx) => {
    const sellerProfile = await tx.seller.create({
      data: {
        userId,
        shopName: payload.shopName,
        shopAddress: payload.shopAddress,
        shopPhone: payload.shopPhone,
      },
    });

    const updatedUser = await tx.user.update({
      where: {
        id: userId,
      },
      data: {
        role: Role.SELLER,
      },
    });

    console.log(updatedUser);

    const accessToken = tokenUtils.getAccessToken({
      userId: updatedUser.id,
      role: updatedUser.role,
      name: updatedUser.name,
      email: updatedUser.email,
      status: updatedUser.status,
      emailVerified: updatedUser.emailVerified,
    });

    const refreshToken = tokenUtils.getRefreshToken({
      userId: updatedUser.id,
      role: updatedUser.role,
      name: updatedUser.name,
      email: updatedUser.email,
      status: updatedUser.status,
      emailVerified: updatedUser.emailVerified,
    });

    return {
      seller: sellerProfile,
      user: updatedUser,
      accessToken,
      refreshToken,
    };
  });

  // Get the updated session after role change
  const session = await auth.api.getSession({
    headers: new Headers({
      Authorization: `Bearer ${sessionToken}`,
    }),
  });

  if (!session) {
    throw new AppError(
      StatusCodes.UNAUTHORIZED,
      "Failed to get updated session",
    );
  }

  return {
    ...result,
    token: sessionToken, // Return the session token to be set in cookie
  };
};

export const sellerService = {
  createSellerProfile,
};
