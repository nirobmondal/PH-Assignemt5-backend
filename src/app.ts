/* eslint-disable @typescript-eslint/no-explicit-any */
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import path from "path";
import qs from "qs";
import cron from "node-cron";
import { envVars } from "./app/config/env";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { indexRoutes } from "./app/routes";
import { PaymentController } from "./app/module/payment/payment.controller";
import { orderService } from "./app/module/order/order.service";

const app: Application = express();
app.set("query parser", (str: string) => qs.parse(str));

app.set("view engine", "ejs");
app.set("views", path.resolve(process.cwd(), `src/app/templates`));

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  PaymentController.handleStripeWebhookEvent,
);

app.use(
  cors({
    origin: [
      envVars.FRONTEND_URL,
      envVars.BETTER_AUTH_URL,
      "http://localhost:3000",
      "http://localhost:5000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

// Basic route
app.get("/", async (req: Request, res: Response) => {
  res.send("Welcome to Niramoy MedicineStore!");
});

// custom routes
app.use("/api/v1", indexRoutes);

cron.schedule("0 2 * * *", async () => {
  try {
    const result = await orderService.removeExpiredPendingOrders();
    if (result.deletedCount > 0) {
      console.log(`Removed ${result.deletedCount} expired pending orders`);
    }
  } catch (error) {
    console.error("Failed to remove expired pending orders", error);
  }
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
