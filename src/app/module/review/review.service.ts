import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { ICreateReviewPayload, IUpdateReviewPayload } from "./review.interface";
import { OrderStatus, Role } from "../../../generated/prisma/enums";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { IQueryParams } from "../../interfaces/query.interface";

const recalculateMedicineRating = async (
  tx: typeof prisma,
  medicineId: string,
) => {
  const ratingAggregation = await tx.review.aggregate({
    where: {
      medicineId,
    },
    _avg: {
      rating: true,
    },
    _count: {
      _all: true,
    },
  });

  const avgRating = ratingAggregation._avg.rating ?? 0;
  const reviewCount = ratingAggregation._count._all;

  await tx.medicine.update({
    where: {
      id: medicineId,
    },
    data: {
      avgRating,
      reviewCount,
    },
  });
};

const createReview = async (userId: string, payload: ICreateReviewPayload) => {
  const result = await prisma.$transaction(async (tx) => {
    const orderItem = await tx.orderItem.findUnique({
      where: {
        id: payload.orderItemId,
      },
      include: {
        sellerOrder: {
          include: {
            order: true,
          },
        },
      },
    });

    if (!orderItem) {
      throw new AppError(status.NOT_FOUND, "Order item not found");
    }

    if (orderItem.sellerOrder.order.customerId !== userId) {
      throw new AppError(
        status.FORBIDDEN,
        "You can only review medicines from your own orders",
      );
    }

    if (orderItem.sellerOrder.order.status !== OrderStatus.DELIVERED) {
      throw new AppError(
        status.BAD_REQUEST,
        "Only delivered order items can be reviewed",
      );
    }

    const existingReview = await tx.review.findUnique({
      where: {
        orderItemId: payload.orderItemId,
      },
    });

    if (existingReview) {
      throw new AppError(
        status.CONFLICT,
        "Review already exists for this order item",
      );
    }

    const review = await tx.review.create({
      data: {
        customerId: userId,
        medicineId: orderItem.medicineId,
        orderItemId: payload.orderItemId,
        rating: payload.rating,
        comment: payload.comment,
      },
    });

    await recalculateMedicineRating(tx as typeof prisma, review.medicineId);

    return tx.review.findUnique({
      where: {
        id: review.id,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });
  });

  return result;
};

const getReviewsByMedicineId = async (medicineId: string) => {
  const medicine = await prisma.medicine.findUnique({
    where: {
      id: medicineId,
    },
    select: {
      id: true,
    },
  });

  if (!medicine) {
    throw new AppError(status.NOT_FOUND, "Medicine not found");
  }

  const reviews = await prisma.review.findMany({
    where: {
      medicineId,
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return reviews;
};

const getAllReviews = async (query: IQueryParams) => {
  const reviews = await new QueryBuilder(prisma.review, query, {
    searchableFields: ["comment", "customer.name", "medicine.name"],
    filterableFields: ["rating", "customer.name", "medicine.name"],
  })
    .include({
      customer: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      medicine: {
        select: {
          id: true,
          name: true,
        },
      },
    })
    .search()
    .filter()
    .paginate()
    .sort()
    .execute();

  return reviews;
};

const updateReview = async (
  reviewId: string,
  userId: string,
  role: Role,
  payload: IUpdateReviewPayload,
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existingReview = await tx.review.findFirst({
      where: {
        id: reviewId,
        ...(role === Role.ADMIN ? {} : { customerId: userId }),
      },
    });

    if (!existingReview) {
      throw new AppError(status.NOT_FOUND, "Review not found");
    }

    const updatedReview = await tx.review.update({
      where: {
        id: reviewId,
      },
      data: payload,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    await recalculateMedicineRating(
      tx as typeof prisma,
      existingReview.medicineId,
    );

    return updatedReview;
  });

  return result;
};

const deleteReview = async (reviewId: string, userId: string, role: Role) => {
  const result = await prisma.$transaction(async (tx) => {
    const existingReview = await tx.review.findFirst({
      where: {
        id: reviewId,
        ...(role === Role.ADMIN ? {} : { customerId: userId }),
      },
    });

    if (!existingReview) {
      throw new AppError(status.NOT_FOUND, "Review not found");
    }

    await tx.review.delete({
      where: {
        id: reviewId,
      },
    });

    await recalculateMedicineRating(
      tx as typeof prisma,
      existingReview.medicineId,
    );

    return null;
  });

  return result;
};

export const reviewService = {
  createReview,
  getAllReviews,
  getReviewsByMedicineId,
  updateReview,
  deleteReview,
};
