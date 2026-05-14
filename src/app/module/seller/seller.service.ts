import status from "http-status";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { ICreateSellerProfilePayload } from "./seller.interface";
import { tokenUtils } from "../../utils/token";

const createSellerProfile = async (
  userId: string,
  payload: ICreateSellerProfilePayload,
) => {
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

  return {
    ...result,
  };
};

export const sellerService = {
  createSellerProfile,
};
