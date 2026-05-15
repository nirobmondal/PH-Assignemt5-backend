import { Role } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";

export const seedAdmin = async () => {
  try {
    const isAdminExist = await prisma.user.findFirst({
      where: {
        role: Role.ADMIN,
      },
    });

    if (isAdminExist) {
      console.log("Admin already exists. Skipping seeding admin.");
      return;
    }

    const hashedPassword = await bcrypt.hash(envVars.ADMIN_PASSWORD, 10);

    const adminData = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: "Admin",
          email: envVars.ADMIN_EMAIL,
          password: hashedPassword,
          role: Role.ADMIN,
          emailVerified: true,
        },
      });

      await tx.authProvider.create({
        data: {
          provider: "local",
          providerId: envVars.ADMIN_EMAIL,
          userId: createdUser.id,
        },
      });

      return createdUser;
    });

    console.log("Admin Created ", adminData);
  } catch (error) {
    console.error("Error seeding admin: ", error);
    await prisma.user.delete({
      where: {
        email: envVars.ADMIN_EMAIL,
      },
    });
  }
};
