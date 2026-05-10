import status from "http-status";
import { Medicine, Prisma } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { IQueryParams } from "../../interfaces/query.interface";
import {
  medicineIncludeConfig,
  medicinePublicFilterableFields,
  medicineSearchableFields,
  medicineSellerFilterableFields,
  medicineSellerIncludeConfig,
} from "./medicine.constant";
import {
  ICreateMedicinePayload,
  IUpdateMedicinePayload,
} from "./medicine.interface";

const assertSellerProfile = async (userId: string) => {
  const seller = await prisma.seller.findUnique({
    where: {
      userId,
    },
  });

  if (!seller) {
    throw new AppError(status.NOT_FOUND, "Seller profile not found");
  }

  return seller;
};

const createMedicine = async (
  userId: string,
  payload: ICreateMedicinePayload,
) => {
  const seller = await assertSellerProfile(userId);

  const [duplicateMedicine, category, manufacturer] = await Promise.all([
    prisma.medicine.findFirst({
      where: {
        sellerId: seller.id,
        name: payload.name,
        dosageForm: payload.dosageForm,
        strength: payload.strength,
        categoryId: payload.categoryId,
        manufacturerId: payload.manufacturerId,
      },
    }),
    prisma.category.findUnique({
      where: {
        id: payload.categoryId,
      },
    }),
    prisma.manufacturer.findUnique({
      where: {
        id: payload.manufacturerId,
      },
    }),
  ]);

  if (duplicateMedicine) {
    throw new AppError(
      status.CONFLICT,
      "Medicine already exists for this seller",
    );
  }

  if (!category) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  if (!manufacturer) {
    throw new AppError(status.NOT_FOUND, "Manufacturer not found");
  }

  const medicine = await prisma.medicine.create({
    data: {
      ...payload,
      sellerId: seller.id,
    },
    include: medicineIncludeConfig as Prisma.MedicineInclude,
  });

  return medicine;
};

const getAllMedicines = async (query: IQueryParams) => {
  const result = await new QueryBuilder<Medicine>(prisma.medicine, query, {
    searchableFields: medicineSearchableFields,
    filterableFields: medicinePublicFilterableFields,
  })
    .where({ isAvailable: true })
    .include(medicineIncludeConfig)
    .search()
    .filter()
    .paginate()
    .sort()
    .execute();

  return result;
};

const getMedicineById = async (medicineId: string) => {
  const medicine = await prisma.medicine.findUnique({
    where: {
      id: medicineId,
    },
    include: medicineIncludeConfig,
  });

  if (!medicine) {
    throw new AppError(status.NOT_FOUND, "Medicine not found");
  }

  return medicine;
};

const getMedicineBySellerId = async (userId: string, query: IQueryParams) => {
  const seller = await assertSellerProfile(userId);

  const result = await new QueryBuilder<Medicine>(prisma.medicine, query, {
    searchableFields: medicineSearchableFields,
    filterableFields: medicineSellerFilterableFields,
  })
    .where({ sellerId: seller.id })
    .include(medicineSellerIncludeConfig)
    .search()
    .filter()
    .paginate()
    .sort()
    .execute();

  return result;
};

const updateMedicine = async (
  medicineId: string,
  userId: string,
  payload: IUpdateMedicinePayload,
) => {
  const seller = await assertSellerProfile(userId);

  const existingMedicine = await prisma.medicine.findFirst({
    where: {
      id: medicineId,
      sellerId: seller.id,
    },
  });

  if (!existingMedicine) {
    throw new AppError(status.NOT_FOUND, "Medicine not found");
  }

  const nextName = payload.name ?? existingMedicine.name;
  const nextDosageForm = payload.dosageForm ?? existingMedicine.dosageForm;
  const nextStrength = payload.strength ?? existingMedicine.strength;
  const nextCategoryId = payload.categoryId ?? existingMedicine.categoryId;
  const nextManufacturerId =
    payload.manufacturerId ?? existingMedicine.manufacturerId;

  const duplicateMedicine = await prisma.medicine.findFirst({
    where: {
      sellerId: seller.id,
      id: {
        not: medicineId,
      },
      name: nextName,
      dosageForm: nextDosageForm,
      strength: nextStrength,
      categoryId: nextCategoryId,
      manufacturerId: nextManufacturerId,
    },
  });

  if (duplicateMedicine) {
    throw new AppError(
      status.CONFLICT,
      "Medicine already exists for this seller",
    );
  }

  if (payload.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: payload.categoryId },
    });

    if (!category) {
      throw new AppError(status.NOT_FOUND, "Category not found");
    }
  }

  if (payload.manufacturerId) {
    const manufacturer = await prisma.manufacturer.findUnique({
      where: { id: payload.manufacturerId },
    });

    if (!manufacturer) {
      throw new AppError(status.NOT_FOUND, "Manufacturer not found");
    }
  }

  const medicine = await prisma.medicine.update({
    where: {
      id: medicineId,
    },
    data: payload,
    include: medicineIncludeConfig as Prisma.MedicineInclude,
  });

  return medicine;
};

const deleteMedicine = async (medicineId: string, userId: string) => {
  const seller = await assertSellerProfile(userId);

  const existingMedicine = await prisma.medicine.findFirst({
    where: {
      id: medicineId,
      sellerId: seller.id,
    },
  });

  if (!existingMedicine) {
    throw new AppError(status.NOT_FOUND, "Medicine not found");
  }

  const medicine = await prisma.medicine.update({
    where: {
      id: medicineId,
    },
    data: {
      stock: 0,
      price: 0,
      isAvailable: false,
      isFeatured: false,
    },
    include: medicineIncludeConfig as Prisma.MedicineInclude,
  });

  return medicine;
};

export const medicineService = {
  createMedicine,
  getMedicineById,
  getAllMedicines,
  getMedicineBySellerId,
  updateMedicine,
  deleteMedicine,
};
