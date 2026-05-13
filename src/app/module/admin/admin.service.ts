import status from "http-status";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { IManageUserStatusPayload } from "./admin.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { IQueryParams } from "../../interfaces/query.interface";
import { User } from "../../../generated/prisma/client";

const manageUserStatues = async (
  adminUserId: string,
  targetUserId: string,
  payload: IManageUserStatusPayload,
) => {
  const adminUser = await prisma.user.findUnique({
    where: {
      id: adminUserId,
    },
  });

  if (!adminUser || adminUser.role !== Role.ADMIN) {
    throw new AppError(status.FORBIDDEN, "Only admin can manage user status");
  }

  if (adminUserId === targetUserId) {
    throw new AppError(status.BAD_REQUEST, "Admin cannot change own status");
  }

  const targetUser = await prisma.user.findUnique({
    where: {
      id: targetUserId,
    },
  });

  if (!targetUser) {
    throw new AppError(status.NOT_FOUND, "Target user not found");
  }

  if (targetUser.role === Role.ADMIN) {
    throw new AppError(
      status.BAD_REQUEST,
      "Admin user status cannot be changed",
    );
  }

  if (targetUser.status === payload.status) {
    throw new AppError(
      status.BAD_REQUEST,
      `User is already ${payload.status.toLowerCase()}`,
    );
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: targetUserId,
    },
    data: {
      status: payload.status,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      updatedAt: true,
    },
  });

  if (payload.status === UserStatus.BANNED) {
    await prisma.session.deleteMany({
      where: {
        userId: targetUserId,
      },
    });
  }

  return updatedUser;
};

const getAllUsers = async (query: IQueryParams) => {
  const result = await new QueryBuilder<User>(prisma.user, query, {
    searchableFields: ["name"],
    filterableFields: ["role", "status"],
  })
    .include({
      seller: {
        select: {
          id: true,
          shopName: true,
        },
      },
    })
    .search()
    .filter()
    .paginate()
    .sort()
    .execute();

  return result;
};

export const adminService = {
  manageUserStatues,
  getAllUsers,
};
