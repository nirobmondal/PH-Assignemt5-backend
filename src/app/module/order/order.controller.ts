import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { orderService } from "./order.service";
import { sendResponse } from "../../shared/sendResponse";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";

const initiateOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await orderService.initiateOrder(req.user.userId, req.body);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Order initiated successfully",
    data: result,
  });
});

const placeOrder = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await orderService.placeOrderWithPayment(
    req.user.userId,
    id as string,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Checkout session created successfully",
    data: result,
  });
});

const getOrders = catchAsync(async (req: Request, res: Response) => {
  const result = await orderService.getOrders(
    req.user.userId,
    req.user.role,
    req.query as unknown as IQueryParams,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Orders fetched successfully",
    data: result,
  });
});

const getOrderById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await orderService.getOrderById(
    id as string,
    req.user.userId,
    req.user.role,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order fetched successfully",
    data: result,
  });
});

const cancelOrder = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await orderService.cancelOrder(id as string, req.user.userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order cancelled successfully",
    data: result,
  });
});

const updateOrderStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await orderService.updateOrderStatus(
    id as string,
    req.user.userId,
    req.body,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order status updated successfully",
    data: result,
  });
});

export const orderController = {
  initiateOrder,
  placeOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
};
