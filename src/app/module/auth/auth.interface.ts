export interface ILoginUserPayload {
  email: string;
  password: string;
}

export interface IRegisterCustomerPayload {
  name: string;
  email: string;
  password: string;
}

export interface IChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface IResetPasswordPayload {
  email: string;
  otp: string;
  newPassword: string;
}

export interface IUpdateSellerProfilePayload {
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
}

export interface IUpdateMePayload {
  name?: string;
  phone?: string;
  image?: string;
  seller?: IUpdateSellerProfilePayload;
}
