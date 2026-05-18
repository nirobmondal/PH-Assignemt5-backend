import { JwtPayload } from "jsonwebtoken";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../utils/email";
import { jwtUtils } from "../../utils/jwt";
import { tokenUtils } from "../../utils/token";
import { OAuth2Client } from "google-auth-library";
import {
  IChangePasswordPayload,
  ILoginUserPayload,
  IRegisterCustomerPayload,
  IUpdateMePayload,
} from "./auth.interface";
import { StatusCodes } from "http-status-codes";
import bcrypt from "bcrypt";

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const getOtpExpiry = (minutes: number) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

const sanitizeUser = (user: any) => {
  const {
    password,
    emailVerificationOtp,
    otpExpiresAt,
    resetPasswordOtp,
    resetOtpExpiresAt,
    ...rest
  } = user;
  return rest;
};

const registerCustomer = async (payload: IRegisterCustomerPayload) => {
  const { name, email, password } = payload;

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "User already exists. Please login or use a different email.",
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = generateOtp();
  const otpExpiresAt = getOtpExpiry(5);

  try {
    // first send mail if mail send successfully then create user
    await sendEmail({
      to: email,
      subject: "Verify your email",
      templateName: "otp",
      templateData: {
        name,
        otp,
        title: "Email Verification OTP",
        purpose: "verify your email",
        expiresIn: "5 minutes",
      },
    });

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          emailVerificationOtp: otp,
          otpExpiresAt,
        },
      });

      await tx.authProvider.create({
        data: {
          provider: "local",
          providerId: email,
          userId: createdUser.id,
        },
      });

      await tx.cart.create({
        data: {
          userId: createdUser.id,
        },
      });

      return createdUser;
    });

    return sanitizeUser(user);
  } catch (error) {
    console.log("Transaction error : ", error);
    throw error;
  }
};

const loginUser = async (payload: ILoginUserPayload) => {
  const { email, password } = payload;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, "User not found");
  }

  if (!user.emailVerified) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Email not verified");
  }

  if (user.status === UserStatus.BANNED) {
    throw new AppError(StatusCodes.FORBIDDEN, "User is banned");
  }

  const authProvider = await prisma.authProvider.findUnique({
    where: { userId: user.id },
  });

  if (!user.password) {
    if (authProvider?.provider === "google") {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'This account uses Google Sign-In. Please use "Login with Google".',
      );
    }

    throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid credentials");
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid credentials");
  }

  const accessToken = tokenUtils.getAccessToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status: user.status,
    emailVerified: user.emailVerified,
  });

  const refreshToken = tokenUtils.getRefreshToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status: user.status,
    emailVerified: user.emailVerified,
  });

  return {
    user: sanitizeUser(user),
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

const getNewToken = async (refreshToken: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    refreshToken,
    envVars.REFRESH_TOKEN_SECRET,
  );

  if (!verifiedRefreshToken.success && verifiedRefreshToken.error) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid refresh token");
  }

  const data = verifiedRefreshToken.data as JwtPayload;

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
  });

  if (!user) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "User not found");
  }

  if (!user.emailVerified) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Email not verified");
  }

  if (user.status === UserStatus.BANNED) {
    throw new AppError(StatusCodes.FORBIDDEN, "User is banned");
  }

  const newAccessToken = tokenUtils.getAccessToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status: user.status,
    emailVerified: user.emailVerified,
  });

  const newRefreshToken = tokenUtils.getRefreshToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status: user.status,
    emailVerified: user.emailVerified,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

const changePassword = async (
  payload: IChangePasswordPayload,
  user: IRequestUser,
) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: user.userId },
  });

  if (!existingUser) {
    throw new AppError(StatusCodes.NOT_FOUND, "User not found");
  }

  const authProvider = await prisma.authProvider.findUnique({
    where: { userId: existingUser.id },
  });

  if (authProvider?.provider !== "local") {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This account uses Google Sign-In. Password change is not available.",
    );
  }

  if (!existingUser.password) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid credentials");
  }

  const { currentPassword, newPassword } = payload;
  const isPasswordMatched = await bcrypt.compare(
    currentPassword,
    existingUser.password,
  );

  if (!isPasswordMatched) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid credentials");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: existingUser.id },
    data: {
      password: hashedPassword,
    },
  });
};

const verifyEmail = async (email: string, otp: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, "User not found");
  }

  if (!user.emailVerificationOtp || !user.otpExpiresAt) {
    throw new AppError(StatusCodes.BAD_REQUEST, "OTP is missing");
  }

  if (user.emailVerificationOtp !== otp) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Invalid OTP");
  }

  if (user.otpExpiresAt < new Date()) {
    throw new AppError(StatusCodes.BAD_REQUEST, "OTP expired");
  }

  await prisma.user.update({
    where: { email },
    data: {
      emailVerified: true,
      emailVerificationOtp: null,
      otpExpiresAt: null,
    },
  });
};

const resendVerificationOtp = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, "User not found");
  }

  if (user.status === UserStatus.BANNED) {
    throw new AppError(StatusCodes.FORBIDDEN, "User is banned");
  }

  if (user.emailVerified) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Email already verified");
  }

  const otp = generateOtp();
  const otpExpiresAt = getOtpExpiry(5);

  await sendEmail({
    to: email,
    subject: "Verify your email",
    templateName: "otp",
    templateData: {
      name: user.name,
      otp,
      title: "Email Verification OTP",
      purpose: "verify your email",
      expiresIn: "5 minutes",
    },
  });

  await prisma.user.update({
    where: { email },
    data: {
      emailVerificationOtp: otp,
      otpExpiresAt,
    },
  });
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

  if (isUserExist.status === UserStatus.BANNED) {
    throw new AppError(StatusCodes.FORBIDDEN, "User is banned");
  }

  const authProvider = await prisma.authProvider.findUnique({
    where: { userId: isUserExist.id },
  });

  if (authProvider?.provider !== "local") {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This account uses Google Sign-In. Password reset is not available.",
    );
  }

  const otp = generateOtp();
  const otpExpiresAt = getOtpExpiry(5);

  // first send mail if mail send successfully then update user with otp
  await sendEmail({
    to: email,
    subject: "Reset your password",
    templateName: "otp",
    templateData: {
      name: isUserExist.name,
      otp,
      title: "Password Reset OTP",
      purpose: "reset your password",
      expiresIn: "5 minutes",
    },
  });

  await prisma.user.update({
    where: { email },
    data: {
      resetPasswordOtp: otp,
      resetOtpExpiresAt: otpExpiresAt,
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

  const authProvider = await prisma.authProvider.findUnique({
    where: { userId: isUserExist.id },
  });

  if (authProvider?.provider !== "local") {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This account uses Google Sign-In. Password reset is not available.",
    );
  }

  if (!isUserExist.emailVerified) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Email not verified");
  }

  if (isUserExist.status === UserStatus.BANNED) {
    throw new AppError(StatusCodes.NOT_FOUND, "User is banned");
  }

  if (!isUserExist.resetPasswordOtp || !isUserExist.resetOtpExpiresAt) {
    throw new AppError(StatusCodes.BAD_REQUEST, "OTP is missing");
  }

  if (isUserExist.resetPasswordOtp !== otp) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Invalid OTP");
  }

  if (isUserExist.resetOtpExpiresAt < new Date()) {
    throw new AppError(StatusCodes.BAD_REQUEST, "OTP expired");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: isUserExist.id },
    data: {
      password: hashedPassword,
      resetPasswordOtp: null,
      resetOtpExpiresAt: null,
    },
  });
};

const client = new OAuth2Client(envVars.GOOGLE_CLIENT_ID);

const googleLoginService = async (idToken: string) => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: envVars.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload?.email) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Google verification failed");
  }

  const email = payload.email;
  const providerId = payload.sub;
  const name = payload.name as string;

  if (!providerId) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Google verification failed");
  }

  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          name,
          password: null,
          emailVerified: true,
          role: Role.CUSTOMER,
          image: payload.picture,
        },
      });

      await tx.authProvider.create({
        data: {
          provider: "google",
          providerId,
          userId: createdUser.id,
        },
      });

      await tx.cart.create({
        data: {
          userId: createdUser.id,
        },
      });

      return createdUser;
    });
  }

  if (user.status === UserStatus.BANNED) {
    throw new AppError(StatusCodes.FORBIDDEN, "User is banned");
  }

  const authProvider = await prisma.authProvider.findUnique({
    where: { userId: user.id },
  });

  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
    user = {
      ...user,
      emailVerified: true,
    };
  }

  if (!authProvider) {
    await prisma.authProvider.create({
      data: {
        provider: "google",
        providerId,
        userId: user.id,
      },
    });
  } else if (authProvider.provider === "google") {
    if (authProvider.providerId !== providerId) {
      await prisma.authProvider.update({
        where: { userId: user.id },
        data: { providerId },
      });
    }
  }

  const cartExists = await prisma.cart.findUnique({
    where: { userId: user.id },
  });

  if (!cartExists) {
    await prisma.cart.create({
      data: {
        userId: user.id,
      },
    });
  }

  const accessToken = tokenUtils.getAccessToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status: user.status,
    emailVerified: user.emailVerified,
  });

  const refreshToken = tokenUtils.getRefreshToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status: user.status,
    emailVerified: user.emailVerified,
  });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

export const authService = {
  registerCustomer,
  loginUser,
  getMe,
  updateMe,
  getNewToken,
  changePassword,
  verifyEmail,
  resendVerificationOtp,
  forgetPassword,
  resetPassword,
  googleLoginService,
};
