import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { reviewService } from "./review.service";
import { sendResponse } from "../../shared/sendResponse";
import status from "http-status";

const createReview = catchAsync(async (req: Request, res: Response) => {
  const result = await reviewService.createReview(req.user.userId, req.body);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Review created successfully",
    data: result,
  });
});

const getReviewsByMedicineId = catchAsync(
  async (req: Request, res: Response) => {
    const { medicineId } = req.params;
    const result = await reviewService.getReviewsByMedicineId(
      medicineId as string,
    );

    sendResponse(res, {
      httpStatusCode: status.OK,
      success: true,
      message: "Reviews fetched successfully",
      data: result,
    });
  },
);

const getAllReviews = catchAsync(async (req: Request, res: Response) => {
  const result = await reviewService.getAllReviews();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Reviews fetched successfully",
    data: result,
  });
});

const updateReview = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await reviewService.updateReview(
    id as string,
    req.user.userId,
    req.user.role,
    req.body,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Review updated successfully",
    data: result,
  });
});

const deleteReview = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  await reviewService.deleteReview(
    id as string,
    req.user.userId,
    req.user.role,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Review deleted successfully",
    data: null,
  });
});

export const reviewController = {
  createReview,
  getReviewsByMedicineId,
  getAllReviews,
  updateReview,
  deleteReview,
};
