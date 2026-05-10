import status from "http-status";
import { Manufacturer } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import {
  ICreateManufacturerPayload,
  IUpdateManufacturerPayload,
} from "./manufacturer.interface";

const createManufacturer = async (
  payload: ICreateManufacturerPayload,
): Promise<Manufacturer> => {
  const existingManufacturer = await prisma.manufacturer.findFirst({
    where: {
      name: {
        equals: payload.name,
        mode: "insensitive",
      },
    },
  });

  if (existingManufacturer) {
    throw new AppError(status.CONFLICT, "Manufacturer already exists");
  }

  const manufacturer = await prisma.manufacturer.create({
    data: payload,
  });

  return manufacturer;
};

const getAllManufacturer = async (): Promise<Manufacturer[]> => {
  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: {
      name: "asc",
    },
  });

  return manufacturers;
};

const updateManufacturer = async (
  id: string,
  payload: IUpdateManufacturerPayload,
): Promise<Manufacturer> => {
  const existingManufacturer = await prisma.manufacturer.findUnique({
    where: {
      id,
    },
  });

  if (!existingManufacturer) {
    throw new AppError(status.NOT_FOUND, "Manufacturer not found");
  }

  if (payload.name) {
    const duplicateManufacturer = await prisma.manufacturer.findFirst({
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

    if (duplicateManufacturer) {
      throw new AppError(status.CONFLICT, "Manufacturer already exists");
    }
  }

  const manufacturer = await prisma.manufacturer.update({
    where: {
      id,
    },
    data: payload,
  });

  return manufacturer;
};

const deleteManufacturer = async (id: string): Promise<Manufacturer> => {
  const existingManufacturer = await prisma.manufacturer.findUnique({
    where: {
      id,
    },
  });

  if (!existingManufacturer) {
    throw new AppError(status.NOT_FOUND, "Manufacturer not found");
  }

  const medicineExists = await prisma.medicine.findFirst({
    where: {
      manufacturerId: id,
    },
    select: {
      id: true,
    },
  });

  if (medicineExists) {
    throw new AppError(
      status.CONFLICT,
      "Manufacturer is associated with medicine. Cannot delete.",
    );
  }

  const manufacturer = await prisma.manufacturer.delete({
    where: {
      id,
    },
  });

  return manufacturer;
};

export const manufacturerService = {
  createManufacturer,
  getAllManufacturer,
  updateManufacturer,
  deleteManufacturer,
};
