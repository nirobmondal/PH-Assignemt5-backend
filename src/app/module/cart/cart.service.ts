import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { IAddToCartPayload, IUpdateCartPayload } from "./cart.interface";

const cartInclude = {
  cartItems: {
    include: {
      medicine: {
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
          isAvailable: true,
          imageUrl: true,
          dosageForm: true,
          strength: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },
};

const getOrCreateCart = async (userId: string, tx: typeof prisma) => {
  return tx.cart.upsert({
    where: {
      userId,
    },
    update: {},
    create: {
      userId,
    },
  });
};

const validateMedicineForCart = async (
  tx: typeof prisma,
  medicineId: string,
  requestedQuantity: number,
) => {
  const medicine = await tx.medicine.findUnique({
    where: {
      id: medicineId,
    },
    select: {
      id: true,
      price: true,
      stock: true,
      isAvailable: true,
    },
  });

  if (!medicine) {
    throw new AppError(status.NOT_FOUND, "Medicine not found");
  }

  if (!medicine.isAvailable) {
    throw new AppError(status.BAD_REQUEST, "Medicine is not available");
  }

  if (medicine.stock < requestedQuantity) {
    throw new AppError(
      status.BAD_REQUEST,
      `Only ${medicine.stock} units available in stock`,
    );
  }

  return medicine;
};

const recalculateCartSubtotal = async (tx: typeof prisma, cartId: string) => {
  const items = await tx.cartItem.findMany({
    where: {
      cartId,
    },
    select: {
      quantity: true,
      unitPrice: true,
    },
  });

  const subtotal = items.reduce((total, item) => {
    return total + Number(item.unitPrice) * item.quantity;
  }, 0);

  await tx.cart.update({
    where: {
      id: cartId,
    },
    data: {
      subtotal: Number(subtotal.toFixed(2)),
    },
  });
};

const getCartById = async (tx: typeof prisma, cartId: string) => {
  return tx.cart.findUnique({
    where: {
      id: cartId,
    },
    include: cartInclude,
  });
};

const addToCart = async (userId: string, payload: IAddToCartPayload) => {
  const result = await prisma.$transaction(async (tx) => {
    const cart = await getOrCreateCart(userId, tx as typeof prisma);

    const existingCartItem = await tx.cartItem.findUnique({
      where: {
        cartId_medicineId: {
          cartId: cart.id,
          medicineId: payload.medicineId,
        },
      },
    });

    const nextQuantity = existingCartItem
      ? existingCartItem.quantity + payload.quantity
      : payload.quantity;

    const medicine = await validateMedicineForCart(
      tx as typeof prisma,
      payload.medicineId,
      nextQuantity,
    );

    if (existingCartItem) {
      await tx.cartItem.update({
        where: {
          id: existingCartItem.id,
        },
        data: {
          quantity: nextQuantity,
          unitPrice: medicine.price,
        },
      });
    } else {
      await tx.cartItem.create({
        data: {
          cartId: cart.id,
          medicineId: payload.medicineId,
          quantity: payload.quantity,
          unitPrice: medicine.price,
        },
      });
    }

    await recalculateCartSubtotal(tx as typeof prisma, cart.id);

    return getCartById(tx as typeof prisma, cart.id);
  });

  return result;
};

const getCartItems = async (userId: string) => {
  const result = await prisma.$transaction(async (tx) => {
    const cart = await getOrCreateCart(userId, tx as typeof prisma);

    await recalculateCartSubtotal(tx as typeof prisma, cart.id);

    return getCartById(tx as typeof prisma, cart.id);
  });

  return result;
};

const updateCartItem = async (userId: string, payload: IUpdateCartPayload) => {
  const result = await prisma.$transaction(async (tx) => {
    const cart = await getOrCreateCart(userId, tx as typeof prisma);

    const cartItem = await tx.cartItem.findUnique({
      where: {
        cartId_medicineId: {
          cartId: cart.id,
          medicineId: payload.medicineId,
        },
      },
    });

    if (!cartItem) {
      throw new AppError(status.NOT_FOUND, "Cart item not found");
    }

    if (payload.quantity <= 0) {
      await tx.cartItem.delete({
        where: {
          id: cartItem.id,
        },
      });
    } else {
      const medicine = await validateMedicineForCart(
        tx as typeof prisma,
        payload.medicineId,
        payload.quantity,
      );

      await tx.cartItem.update({
        where: {
          id: cartItem.id,
        },
        data: {
          quantity: payload.quantity,
          unitPrice: medicine.price,
        },
      });
    }

    await recalculateCartSubtotal(tx as typeof prisma, cart.id);

    return getCartById(tx as typeof prisma, cart.id);
  });

  return result;
};

const deleteCartItem = async (userId: string, medicineId: string) => {
  const result = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: {
        userId,
      },
    });

    if (!cart) {
      throw new AppError(status.NOT_FOUND, "Cart not found");
    }

    const cartItem = await tx.cartItem.findUnique({
      where: {
        cartId_medicineId: {
          cartId: cart.id,
          medicineId,
        },
      },
    });

    if (!cartItem) {
      throw new AppError(status.NOT_FOUND, "Cart item not found");
    }

    await tx.cartItem.delete({
      where: {
        id: cartItem.id,
      },
    });

    await recalculateCartSubtotal(tx as typeof prisma, cart.id);

    return getCartById(tx as typeof prisma, cart.id);
  });

  return result;
};

const clearCart = async (userId: string) => {
  const result = await prisma.$transaction(async (tx) => {
    const cart = await getOrCreateCart(userId, tx as typeof prisma);

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

    return getCartById(tx as typeof prisma, cart.id);
  });

  return result;
};

export const cartService = {
  addToCart,
  getCartItems,
  updateCartItem,
  deleteCartItem,
  clearCart,
};
