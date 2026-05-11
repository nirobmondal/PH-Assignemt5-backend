import { Router } from "express";
import { orderController } from "./order.controller";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { orderValidation } from "./order.validation";

const router = Router();

router.post(
  "/",
  checkAuth(Role.CUSTOMER),
  validateRequest(orderValidation.createOrderSchema),
  orderController.initiateOrder,
);
router.post("/:id/place", checkAuth(Role.CUSTOMER), orderController.placeOrder);
router.get(
  "/",
  checkAuth(Role.ADMIN, Role.CUSTOMER, Role.SELLER),
  orderController.getOrders,
);
router.get(
  "/:id",
  checkAuth(Role.ADMIN, Role.CUSTOMER, Role.SELLER),
  orderController.getOrderById,
);
router.patch(
  "/:id/cancel",
  checkAuth(Role.CUSTOMER),
  orderController.cancelOrder,
);
router.patch(
  "/:id/status",
  checkAuth(Role.SELLER),
  validateRequest(orderValidation.updateOrderStatusSchema),
  orderController.updateOrderStatus,
);

export const orderRoute = router;
