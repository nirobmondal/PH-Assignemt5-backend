import status from "http-status";
import { randomUUID } from "crypto";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import {
  ICreateOrderPayload,
  IUpdateOrderStatusPayload,
} from "./order.interface";
import {
  OrderStatus,
  PaymentStatus,
  Role,
} from "../../../generated/prisma/enums";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { IQueryParams } from "../../interfaces/query.interface";
import { Order } from "../../../generated/prisma/client";
import { stripe } from "../../config/stripe.config";
import { envVars } from "../../config/env";

const orderInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  sellerOrders: {
    include: {
      seller: {
        select: {
          id: true,
          shopName: true,
          shopAddress: true,
          shopPhone: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      items: {
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
              price: true,
              imageUrl: true,
              dosageForm: true,
              strength: true,
            },
          },
        },
      },
    },
  },
};

const validateOrderStatusTransition = (
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
) => {
  const transitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
    [OrderStatus.PLACED]: [OrderStatus.PROCESSING],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.PENDING]: [],
  };

  if (currentStatus === nextStatus) {
    throw new AppError(status.BAD_REQUEST, "Order status is already set");
  }

  const allowedStatuses = transitions[currentStatus] || [];
  if (!allowedStatuses.includes(nextStatus)) {
    throw new AppError(
      status.BAD_REQUEST,
      `Invalid order status transition from ${currentStatus} to ${nextStatus}`,
    );
  }
};

const getScopedOrder = async (
  orderId: string,
  userId: string,
  role: Role,
  tx: typeof prisma,
) => {
  if (role === Role.ADMIN) {
    return tx.order.findUnique({
      where: {
        id: orderId,
      },
      include: orderInclude,
    });
  }

  if (role === Role.CUSTOMER) {
    return tx.order.findFirst({
      where: {
        id: orderId,
        customerId: userId,
      },
      include: orderInclude,
    });
  }

  const seller = await tx.seller.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!seller) {
    throw new AppError(status.NOT_FOUND, "Seller profile not found");
  }

  return tx.order.findFirst({
    where: {
      id: orderId,
      sellerOrders: {
        some: {
          sellerId: seller.id,
        },
      },
    },
    include: orderInclude,
  });
};

const initiateOrder = async (userId: string, payload: ICreateOrderPayload) => {
  const result = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: {
        userId,
      },
      include: {
        cartItems: {
          include: {
            medicine: {
              select: {
                id: true,
                sellerId: true,
                price: true,
                stock: true,
                isAvailable: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.cartItems.length === 0) {
      throw new AppError(status.BAD_REQUEST, "Cart is empty");
    }

    for (const cartItem of cart.cartItems) {
      if (!cartItem.medicine.isAvailable) {
        throw new AppError(
          status.BAD_REQUEST,
          "One or more medicines are not available",
        );
      }

      if (cartItem.medicine.stock < cartItem.quantity) {
        throw new AppError(
          status.BAD_REQUEST,
          "One or more medicines have insufficient stock",
        );
      }
    }

    const groupedBySeller = cart.cartItems.reduce(
      (acc, cartItem) => {
        const sellerId = cartItem.medicine.sellerId;
        if (!acc[sellerId]) {
          acc[sellerId] = [];
        }

        acc[sellerId].push(cartItem);
        return acc;
      },
      {} as Record<string, typeof cart.cartItems>,
    );

    let orderTotal = 0;
    for (const item of cart.cartItems) {
      orderTotal += Number(item.medicine.price) * item.quantity;
    }

    const order = await tx.order.create({
      data: {
        customerId: userId,
        totalAmount: Number(orderTotal.toFixed(2)),
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        shippingName: payload.shippingName,
        shippingPhone: payload.shippingPhone,
        shippingAddress: payload.shippingAddress,
        shippingCity: payload.shippingCity,
        note: payload.note,
      },
    });

    for (const [sellerId, sellerItems] of Object.entries(groupedBySeller)) {
      let sellerSubtotal = 0;

      for (const item of sellerItems) {
        sellerSubtotal += Number(item.medicine.price) * item.quantity;
      }

      const sellerOrder = await tx.sellerOrder.create({
        data: {
          orderId: order.id,
          sellerId,
          subtotal: Number(sellerSubtotal.toFixed(2)),
        },
      });

      await tx.orderItem.createMany({
        data: sellerItems.map((item) => ({
          sellerOrderId: sellerOrder.id,
          medicineId: item.medicineId,
          quantity: item.quantity,
          subtotal: Number(
            (Number(item.medicine.price) * item.quantity).toFixed(2),
          ),
        })),
      });
    }

    for (const cartItem of cart.cartItems) {
      const stockUpdate = await tx.medicine.updateMany({
        where: {
          id: cartItem.medicineId,
          isAvailable: true,
          stock: {
            gte: cartItem.quantity,
          },
        },
        data: {
          stock: {
            decrement: cartItem.quantity,
          },
        },
      });

      if (stockUpdate.count === 0) {
        throw new AppError(
          status.BAD_REQUEST,
          "Stock changed while placing order. Please try again",
        );
      }

      await tx.medicine.updateMany({
        where: {
          id: cartItem.medicineId,
          stock: 0,
        },
        data: {
          isAvailable: false,
        },
      });
    }

    await tx.cartItem.deleteMany({
      where: {
        cartId: cart.id,
      },
    });

    await tx.cart.update({
      where: {
        id: cart.id,
      },
      data: {
        subtotal: 0,
      },
    });

    return tx.order.findUnique({
      where: {
        id: order.id,
      },
      include: orderInclude,
    });
  });

  return result;
};

const placeOrderWithPayment = async (userId: string, orderId: string) => {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerId: userId,
    },
    include: {
      customer: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError(status.NOT_FOUND, "Order not found");
  }

  if (order.status !== OrderStatus.PENDING) {
    throw new AppError(status.BAD_REQUEST, "Only pending orders can be paid");
  }

  if (order.paymentStatus !== PaymentStatus.PENDING) {
    throw new AppError(status.BAD_REQUEST, "Order is already paid");
  }

  let payment = await prisma.payment.findUnique({
    where: {
      orderId: order.id,
    },
  });

  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        transactionId: randomUUID(),
      },
    });
  }

  const amount = Number(order.totalAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(status.BAD_REQUEST, "Invalid order amount");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "bdt",
          product_data: {
            name: "Medicine Order",
            description: `Order ${order.id}`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    customer_email: order.customer.email,
    metadata: {
      orderId: order.id,
      paymentId: payment.id,
    },
    success_url: `${envVars.FRONTEND_URL}/dashboard/payment/success`,
    cancel_url: `${envVars.FRONTEND_URL}/dashboard/order`,
  });

  return {
    paymentUrl: session.url,
    sessionId: session.id,
    orderId: order.id,
  };
};

const getOrders = async (userId: string, role: Role, query: IQueryParams) => {
  let baseWhere: Record<string, unknown> = {};

  if (role === Role.CUSTOMER) {
    baseWhere = { customerId: userId };
  }

  if (role === Role.SELLER) {
    const seller = await prisma.seller.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!seller) {
      throw new AppError(status.NOT_FOUND, "Seller profile not found");
    }

    baseWhere = {
      sellerOrders: {
        some: {
          sellerId: seller.id,
        },
      },
    };
  }

  const result = await new QueryBuilder<Order>(prisma.order, query, {
    searchableFields: [
      "shippingName",
      "customer.name",
      "sellerOrders.seller.shopName",
    ],
    filterableFields: [
      "status",
      "paymentStatus",
      "customer.name",
      "sellerOrders.seller.shopName",
    ],
  })
    .where(baseWhere)
    .include(orderInclude)
    .search()
    .filter()
    .paginate()
    .sort()
    .execute();

  return result;
};

const getOrderById = async (orderId: string, userId: string, role: Role) => {
  const order = await getScopedOrder(orderId, userId, role, prisma);

  if (!order) {
    throw new AppError(status.NOT_FOUND, "Order not found");
  }

  return order;
};

const cancelOrder = async (orderId: string, userId: string) => {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        id: orderId,
        customerId: userId,
      },
      include: {
        sellerOrders: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError(status.NOT_FOUND, "Order not found");
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new AppError(
        status.BAD_REQUEST,
        "Only pending orders can be cancelled by customer",
      );
    }

    for (const sellerOrder of order.sellerOrders) {
      for (const item of sellerOrder.items) {
        await tx.medicine.update({
          where: {
            id: item.medicineId,
          },
          data: {
            stock: {
              increment: item.quantity,
            },
            isAvailable: true,
          },
        });
      }
    }

    const updatedOrder = await tx.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: OrderStatus.CANCELLED,
      },
      include: orderInclude,
    });

    return updatedOrder;
  });

  return result;
};

const removeExpiredPendingOrders = async () => {
  const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING,
      createdAt: {
        lt: cutoffDate,
      },
    },
    include: {
      sellerOrders: {
        include: {
          items: true,
        },
      },
    },
  });

  if (orders.length === 0) {
    return { deletedCount: 0 };
  }

  await prisma.$transaction(async (tx) => {
    for (const order of orders) {
      for (const sellerOrder of order.sellerOrders) {
        for (const item of sellerOrder.items) {
          await tx.medicine.update({
            where: {
              id: item.medicineId,
            },
            data: {
              stock: {
                increment: item.quantity,
              },
              isAvailable: true,
            },
          });
        }
      }
    }

    await tx.order.deleteMany({
      where: {
        id: {
          in: orders.map((order) => order.id),
        },
      },
    });
  });

  return { deletedCount: orders.length };
};

const updateOrderStatus = async (
  orderId: string,
  userId: string,
  payload: IUpdateOrderStatusPayload,
) => {
  const result = await prisma.$transaction(async (tx) => {
    const seller = await tx.seller.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!seller) {
      throw new AppError(status.NOT_FOUND, "Seller profile not found");
    }

    const order = await tx.order.findFirst({
      where: {
        id: orderId,
        sellerOrders: {
          some: {
            sellerId: seller.id,
          },
        },
      },
    });

    if (!order) {
      throw new AppError(status.NOT_FOUND, "Order not found");
    }

    validateOrderStatusTransition(order.status, payload.status as OrderStatus);

    const updatedOrder = await tx.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: payload.status as OrderStatus,
      },
      include: orderInclude,
    });

    return updatedOrder;
  });

  return result;
};

export const orderService = {
  initiateOrder,
  placeOrderWithPayment,
  getOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
  removeExpiredPendingOrders,
};
