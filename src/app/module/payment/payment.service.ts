/* eslint-disable @typescript-eslint/no-explicit-any */
import Stripe from "stripe";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../utils/email";
import { OrderStatus, PaymentStatus } from "../../../generated/prisma/enums";
import { generateInvoicePdf } from "./payment.utils";
import { uploadFileToCloudinary } from "../../config/cloudinary.config";

const handlerStripeWebhookEvent = async (event: Stripe.Event) => {
  const existingPayment = await prisma.payment.findFirst({
    where: {
      stripeEventId: event.id,
    },
  });

  if (existingPayment) {
    return { message: `Event ${event.id} already processed. Skipping` };
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      const paymentId = session.metadata?.paymentId;

      if (!orderId || !paymentId) {
        return { message: "Missing metadata" };
      }

      const order = await prisma.order.findUnique({
        where: {
          id: orderId,
        },
        include: {
          customer: {
            select: {
              name: true,
              email: true,
            },
          },
          sellerOrders: {
            include: {
              seller: {
                select: {
                  shopName: true,
                },
              },
              items: {
                include: {
                  medicine: {
                    select: {
                      name: true,
                      price: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!order) {
        return { message: "Order not found" };
      }

      const payment = await prisma.payment.findUnique({
        where: {
          id: paymentId,
        },
      });

      if (!payment) {
        return { message: "Payment not found" };
      }

      const isPaid = session.payment_status === "paid";

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: {
            id: paymentId,
          },
          data: {
            stripeEventId: event.id,
            paymentGatewayData: session as any,
          },
        });

        if (isPaid) {
          await tx.order.update({
            where: {
              id: orderId,
            },
            data: {
              paymentStatus: PaymentStatus.PAID,
              status: OrderStatus.PLACED,
            },
          });
        }
      });

      if (isPaid) {
        const items = order.sellerOrders.flatMap((sellerOrder) =>
          sellerOrder.items.map((item) => {
            const unitPrice = Number(item.medicine.price);
            return {
              medicineName: item.medicine.name,
              sellerShopName: sellerOrder.seller.shopName,
              quantity: item.quantity,
              unitPrice,
              subtotal: Number(item.subtotal),
            };
          }),
        );
        try {
          const pdfBuffer = await generateInvoicePdf({
            invoiceId: payment.id,
            transactionId: payment.transactionId,
            customerName: order.customer.name,
            customerEmail: order.customer.email,
            orderId: order.id,
            paymentDate: new Date().toISOString(),
            items,
            totalAmount: Number(order.totalAmount),
          });

          const uploadResult = await uploadFileToCloudinary(
            pdfBuffer,
            `invoice-${payment.id}.pdf`,
          );

          await sendEmail({
            to: order.customer.email,
            subject: "Payment Confirmation & Invoice",
            templateName: "invoice",
            templateData: {
              customerName: order.customer.name,
              orderId: order.id,
              invoiceId: payment.id,
              transactionId: payment.transactionId,
              paymentDate: new Date().toLocaleDateString(),
              invoiceUrl: uploadResult.secure_url,
              items,
              amount: Number(order.totalAmount),
            },
            attachments: [
              {
                filename: `Invoice-${payment.id}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
              },
            ],
          });
        } catch (error) {
          console.error("Failed to send invoice email", error);
        }
      }

      break;
    }

    case "checkout.session.expired":
    case "payment_intent.payment_failed":
      break;

    default:
      break;
  }

  return { message: `Webhook Event ${event.id} processed successfully` };
};

export const PaymentService = {
  handlerStripeWebhookEvent,
};
