import status from "http-status";
import { Category } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import {
  ICreateCategoryPayload,
  IUpdateCategoryPayload,
} from "./category.interface";

const createCategory = async (
  payload: ICreateCategoryPayload,
): Promise<Category> => {
  const existingCategory = await prisma.category.findFirst({
    where: {
      name: {
        equals: payload.name,
        mode: "insensitive",
      },
    },
  });

  if (existingCategory) {
    throw new AppError(status.CONFLICT, "Category already exists");
  }

  const category = await prisma.category.create({
    data: payload,
  });

  return category;
};

const getAllCategory = async (): Promise<Category[]> => {
  const category = await prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
  });
  return category;
};

const updateCategory = async (
  id: string,
  payload: IUpdateCategoryPayload,
): Promise<Category> => {
  const existingCategory = await prisma.category.findUnique({
    where: {
      id,
    },
  });

  if (!existingCategory) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  if (payload.name) {
    const duplicateCategory = await prisma.category.findFirst({
      where: {
        name: {
          equals: payload.name,
          mode: "insensitive",
        },
        id: {
          not: id,
        },
      },
    });

    if (duplicateCategory) {
      throw new AppError(status.CONFLICT, "Category already exists");
    }
  }

  const category = await prisma.category.update({
    where: {
      id,
    },
    data: payload,
  });
  return category;
};

const deleteCategory = async (id: string): Promise<Category> => {
  const existingCategory = await prisma.category.findUnique({
    where: {
      id,
    },
  });

  if (!existingCategory) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  const findMedicine = await prisma.medicine.findFirst({
    where: {
      categoryId: id,
    },
  });

  if (findMedicine) {
    throw new AppError(
      status.CONFLICT,
      "Category is associated with a medicine. Cannot delete.",
    );
  }
  const category = await prisma.category.delete({
    where: {
      id,
    },
  });
  return category;
};

export const categoryService = {
  createCategory,
  getAllCategory,
  updateCategory,
  deleteCategory,
};
