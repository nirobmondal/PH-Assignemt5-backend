import { Role } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import { prisma } from "../lib/prisma";

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

    const adminData = await prisma.user.create({
      data: {
        name: "Admin",
        email: envVars.ADMIN_EMAIL,
        password: envVars.ADMIN_PASSWORD,
        role: Role.ADMIN,
        emailVerified: true,
      },
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
