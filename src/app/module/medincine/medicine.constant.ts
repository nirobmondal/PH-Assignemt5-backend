export const medicineSearchableFields = ["name"];

export const medicinePublicFilterableFields = [
  "categoryId",
  "manufacturerId",
  "price",
  "isAvailable",
];

export const medicineSellerFilterableFields = [
  "categoryId",
  "manufacturerId",
  "price",
  "isAvailable",
  "isFeatured",
];

export const medicineIncludeConfig = {
  category: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
  manufacturer: {
    select: {
      id: true,
      name: true,
      country: true,
    },
  },
  seller: {
    select: {
      id: true,
      shopName: true,
      shopAddress: true,
      shopPhone: true,
    },
  },
};

export const medicineSellerIncludeConfig = {
  category: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
  manufacturer: {
    select: {
      id: true,
      name: true,
      country: true,
    },
  },
};
