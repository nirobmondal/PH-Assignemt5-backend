import { JwtPayload } from "jsonwebtoken";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import { tokenUtils } from "../../utils/token";
import {
  IChangePasswordPayload,
  ILoginUserPayload,
  IRegisterCustomerPayload,
  IUpdateMePayload,
} from "./auth.interface";
import { StatusCodes } from "http-status-codes";

const registerCustomer = async (payload: IRegisterCustomerPayload) => {
  const { name, email, password } = payload;

  const data = await auth.api.signUpEmail({
    body: {
      name,
      email,
      password,
    },
  });

  if (!data.user) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Failed to register customer");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.cart.create({
        data: {
          userId: data.user.id,
        },
      });
    });

    return {
      ...data,
    };
  } catch (error) {
    console.log("Transaction error : ", error);
    await prisma.user.delete({
      where: {
        id: data.user.id,
      },
    });
    throw error;
  }
};

const loginUser = async (payload: ILoginUserPayload) => {
  const { email, password } = payload;

  const data = await auth.api.signInEmail({
    body: {
      email,
      password,
    },
  });

  if (data.user.status === UserStatus.BANNED) {
    throw new AppError(StatusCodes.FORBIDDEN, "User is banned");
  }

  const accessToken = tokenUtils.getAccessToken({
    userId: data.user.id,
    role: data.user.role,
    name: data.user.name,
    email: data.user.email,
    status: data.user.status,
    emailVerified: data.user.emailVerified,
  });

  const refreshToken = tokenUtils.getRefreshToken({
    userId: data.user.id,
    role: data.user.role,
    name: data.user.name,
    email: data.user.email,
    status: data.user.status,
    emailVerified: data.user.emailVerified,
  });

  return {
    ...data,
    accessToken,
    refreshToken,
  };
};

const getMe = async (user: IRequestUser) => {
  const isUserExists = await prisma.user.findUnique({
    where: {
      id: user.userId,
    },
    include: {
      seller: true,
    },
  });

  if (!isUserExists) {
    throw new AppError(StatusCodes.NOT_FOUND, "User not found");
  }

  return isUserExists;
};

const updateMe = async (user: IRequestUser, payload: IUpdateMePayload) => {
  const isUserExists = await prisma.user.findUnique({
    where: { id: user.userId },
    include: { seller: true },
  });

  if (!isUserExists) {
    throw new AppError(StatusCodes.NOT_FOUND, "User not found");
  }

  if (isUserExists.status === UserStatus.BANNED) {
    throw new AppError(StatusCodes.FORBIDDEN, "User is banned");
  }

  const { seller, ...userPayload } = payload;
  const sellerPayload = seller ?? {};

  if (seller && isUserExists.role !== Role.SELLER) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Only seller can update seller profile",
    );
  }

  const cleanUserPayload = Object.fromEntries(
    Object.entries(userPayload).filter(([_, v]) => v !== undefined),
  );

  const cleanSellerPayload = Object.fromEntries(
    Object.entries(sellerPayload).filter(([_, v]) => v !== undefined),
  );

  const hasUserUpdateFields = Object.keys(cleanUserPayload).length > 0;
  const hasSellerUpdateFields = Object.keys(cleanSellerPayload).length > 0;

  if (!hasUserUpdateFields && !hasSellerUpdateFields) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "At least one field is required to update profile",
    );
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    if (hasUserUpdateFields) {
      await tx.user.update({
        where: { id: user.userId },
        data: cleanUserPayload,
      });
    }

    if (hasSellerUpdateFields) {
      if (isUserExists.role !== Role.SELLER) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "Only seller can update seller profile",
        );
      }

      if (!isUserExists.seller) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "Seller profile does not exist",
        );
      }

      await tx.seller.update({
        where: { userId: user.userId },
        data: cleanSellerPayload,
      });
    }

    return tx.user.findUnique({
      where: { id: user.userId },
      include: { seller: true },
    });
  });

  return updatedUser;
};

const getNewToken = async (refreshToken: string, sessionToken?: string) => {
  if (!sessionToken) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Session token is missing");
  }

  const isSessionTokenExists = await prisma.session.findUnique({
    where: {
      token: sessionToken,
    },
    include: {
      user: true,
    },
  });

  if (!isSessionTokenExists) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid session token");
  }

  const verifiedRefreshToken = jwtUtils.verifyToken(
    refreshToken,
    envVars.REFRESH_TOKEN_SECRET,
  );

  if (!verifiedRefreshToken.success && verifiedRefreshToken.error) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid refresh token");
  }

  const data = verifiedRefreshToken.data as JwtPayload;

  const newAccessToken = tokenUtils.getAccessToken({
    userId: data.userId,
    role: data.role,
    name: data.name,
    email: data.email,
    status: data.status,
    emailVerified: data.emailVerified,
  });

  const newRefreshToken = tokenUtils.getRefreshToken({
    userId: data.userId,
    role: data.role,
    name: data.name,
    email: data.email,
    status: data.status,
    emailVerified: data.emailVerified,
  });

  const { token } = await prisma.session.update({
    where: {
      token: sessionToken,
    },
    data: {
      token: sessionToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 24 * 1000),
      updatedAt: new Date(),
    },
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    sessionToken: token,
  };
};

const changePassword = async (
  payload: IChangePasswordPayload,
  sessionToken?: string,
) => {
  if (!sessionToken) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Session token is missing");
  }

  const session = await auth.api.getSession({
    headers: new Headers({
      Authorization: `Bearer ${sessionToken}`,
    }),
  });

  if (!session) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid session token");
  }

  const { currentPassword, newPassword } = payload;

  const result = await auth.api.changePassword({
    body: {
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    },
    headers: new Headers({
      Authorization: `Bearer ${sessionToken}`,
    }),
  });

  const accessToken = tokenUtils.getAccessToken({
    userId: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
    status: session.user.status,
    emailVerified: session.user.emailVerified,
  });

  const refreshToken = tokenUtils.getRefreshToken({
    userId: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
    status: session.user.status,
    emailVerified: session.user.emailVerified,
  });

  return {
    ...result,
    accessToken,
    refreshToken,
  };
};

const logoutUser = async (sessionToken: string) => {
  const result = await auth.api.signOut({
    headers: new Headers({
      Authorization: `Bearer ${sessionToken}`,
    }),
  });

  return result;
};

const verifyEmail = async (email: string, otp: string) => {
  const result = await auth.api.verifyEmailOTP({
    body: {
      email,
      otp,
    },
  });

  if (result.status && !result.user.emailVerified) {
    await prisma.user.update({
      where: {
        email,
      },
      data: {
        emailVerified: true,
      },
    });
  }
};

const forgetPassword = async (email: string) => {
  const isUserExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!isUserExist) {
    throw new AppError(StatusCodes.NOT_FOUND, "User not found");
  }

  if (!isUserExist.emailVerified) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Email not verified");
  }

  await auth.api.requestPasswordResetEmailOTP({
    body: {
      email,
    },
  });
};

const resetPassword = async (
  email: string,
  otp: string,
  newPassword: string,
) => {
  const isUserExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!isUserExist) {
    throw new AppError(StatusCodes.NOT_FOUND, "User not found");
  }

  if (!isUserExist.emailVerified) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Email not verified");
  }

  if (isUserExist.status === UserStatus.BANNED) {
    throw new AppError(StatusCodes.NOT_FOUND, "User is banned");
  }

  await auth.api.resetPasswordEmailOTP({
    body: {
      email,
      otp,
      password: newPassword,
    },
  });

  await prisma.session.deleteMany({
    where: {
      userId: isUserExist.id,
    },
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const googleLoginSuccess = async (session: Record<string, any>) => {
  const isCartExists = await prisma.cart.findUnique({
    where: {
      userId: session.user.id,
    },
  });

  if (!isCartExists) {
    await prisma.cart.create({
      data: {
        userId: session.user.id,
      },
    });
  }

  const accessToken = tokenUtils.getAccessToken({
    userId: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
    status: session.user.status,
    emailVerified: session.user.emailVerified,
  });

  const refreshToken = tokenUtils.getRefreshToken({
    userId: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
    status: session.user.status,
    emailVerified: session.user.emailVerified,
  });

  return {
    accessToken,
    refreshToken,
  };
};

const verifyOauthCode = async (code: string) => {
  const oauthCode = await prisma.oAuthCode.findUnique({
    where: {
      code,
    },
  });

  if (!oauthCode) {
    throw new AppError(StatusCodes.NOT_FOUND, "OAuth code not found");
  }

  if (oauthCode.expiresAt < new Date()) {
    throw new AppError(StatusCodes.BAD_REQUEST, "OAuth code expired");
  }

  return oauthCode;
};

export const authService = {
  registerCustomer,
  loginUser,
  getMe,
  updateMe,
  getNewToken,
  changePassword,
  logoutUser,
  verifyEmail,
  forgetPassword,
  resetPassword,
  googleLoginSuccess,
  verifyOauthCode,
};
