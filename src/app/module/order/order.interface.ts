export interface ICreateOrderPayload {
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  note?: string;
}

export interface IUpdateOrderStatusPayload {
  status: "PROCESSING" | "SHIPPED" | "DELIVERED";
}
