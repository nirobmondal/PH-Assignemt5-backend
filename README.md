# Niramoy Backend

Niramoy Backend is a TypeScript and Express 5 REST API for an online medicine marketplace. It supports **customer**, **seller**, and **admin** workflows: authentication and profiles, seller onboarding, category and manufacturer data, medicine catalog with media uploads, cart and checkout, **Stripe** payments, order lifecycle, reviews for delivered items, and role-aware dashboard statistics.

## Highlights

- **Custom JWT authentication** — access and refresh tokens issued as **HTTP-only cookies** (no Better Auth or external session store).
- **Google sign-in** — `POST /api/v1/auth/google-login` using Google ID tokens (`google-auth-library`).
- **Email via SendGrid** — OTP verification, password reset, and payment-related mail using **EJS** templates under `src/app/templates/`.
- **Stripe Checkout** — order payment flow with **`POST /webhook`** for Stripe events (signature-verified raw body).
- **Role-based access** for `CUSTOMER`, `SELLER`, and `ADMIN`.
- Seller profile creation (role upgrade from customer to seller).
- Category and manufacturer management (admin).
- Seller-managed medicine catalog with **Cloudinary** uploads.
- Cart, stock-aware orders, seller status updates, customer cancellation where allowed.
- Reviews tied to delivered order items.
- **Prisma** ORM with **PostgreSQL**.

## Tech stack

| Area | Choice |
|------|--------|
| Runtime | Node.js 18+ |
| Language | TypeScript |
| HTTP | Express 5 |
| Database | PostgreSQL |
| ORM | Prisma |
| Validation | Zod |
| Auth | `jsonwebtoken`, cookies (`cookie-parser`) |
| OAuth | `google-auth-library` |
| Email | `@sendgrid/mail`, EJS |
| Payments | Stripe (`stripe`) |
| Uploads | Multer, Cloudinary |
| Build | `tsup` |

## Core features

### Authentication and identity

- Register (customer) and login with email and password.
- **JWT** access and refresh tokens set on the response as cookies; `POST /api/v1/auth/refresh-token` issues new tokens from the refresh cookie.
- `GET /api/v1/auth/me`, `PATCH /api/v1/auth/update-me`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/change-password`.
- Email verification and resend OTP; forgot and reset password with OTP.
- **Google** login with ID token verification and linked `AuthProvider` records.
- All auth HTTP routes live under **`/api/v1/auth`** only (there is no `/api/auth` mount).

### Role-based workflows

- Customers browse medicines, manage the cart, place orders, and review delivered items.
- Customers become sellers via `POST /api/v1/seller/create-profile`.
- Sellers create, update, list, and soft-delete their medicines.
- Admins manage user status and maintain categories and manufacturers.

### Commerce and payments

- Public medicine browsing; cart subtotal handling; stock-aware order initiation.
- **Order payment:** `POST /api/v1/order` creates an order, then `POST /api/v1/order/:id/place` creates a **Stripe Checkout Session** and returns a `paymentUrl` for the client to redirect the user.
- **Webhooks:** Stripe calls `POST /webhook` on this server; the handler updates payment and order state and can send confirmation email with invoice data (see `src/app/module/payment/`).
- Seller order status progression; customer cancellation when allowed; reviews only for delivered lines.

## How auth and payments fit together

```mermaid
flowchart LR
  subgraph jwtAuth [JWT_auth]
    Login[Login_or_register] --> SetCookies[Set_access_and_refresh_cookies]
    SetCookies --> Requests[API_requests_with_credentials]
    Requests --> CheckAuth[checkAuth_reads_accessToken_JWT]
  end
```

```mermaid
sequenceDiagram
  participant Client
  participant API as Niramoy_API
  participant Stripe
  Client->>API: POST_api_v1_order
  Client->>API: POST_api_v1_order_id_place
  API->>Stripe: Create_Checkout_Session
  Stripe-->>Client: Redirect_to_checkout_URL
  Stripe->>API: POST_webhook
  API->>API: Update_payment_and_order
```

## Project structure

```text
Niramoy-Backend/
├── prisma/
│   ├── migrations/
│   └── schema/
│       ├── auth.prisma
│       ├── cart.prisma
│       ├── cartItem.prisma
│       ├── category.prisma
│       ├── enums.prisma
│       ├── manufacturer.prisma
│       ├── medicine.prisma
│       ├── order.prisma
│       ├── orderItem.prisma
│       ├── payment.prisma
│       ├── review.prisma
│       ├── seller.prisma
│       ├── sellerOrder.prisma
│       └── schema.prisma
├── src/
│   ├── app/
│   │   ├── config/
│   │   ├── lib/
│   │   ├── middleware/
│   │   ├── module/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── cart/
│   │   │   ├── category/
│   │   │   ├── manufacturer/
│   │   │   ├── medincine/
│   │   │   ├── order/
│   │   │   ├── payment/        # Stripe webhook + payment helpers (used with orders)
│   │   │   ├── review/
│   │   │   ├── seller/
│   │   │   └── stats/
│   │   ├── routes/
│   │   ├── shared/
│   │   ├── templates/          # EJS email templates
│   │   └── utils/
│   ├── generated/
│   ├── app.ts
│   └── server.ts
├── package.json
├── prisma.config.ts
├── tsconfig.json
└── tsup.config.ts
```

Note: the module folder is named `medincine` in the repository; the HTTP API path is `/api/v1/medicine`. Payment logic is wired through **order** routes and the root **`/webhook`** route, not a separate `/api/v1/payment` router.

## API base paths

| Path | Purpose |
|------|---------|
| `GET /` | Simple health or welcome message |
| `/api/v1/*` | Versioned application routes |
| `POST /webhook` | **Stripe webhook** (must receive raw JSON; registered in Stripe Dashboard or Stripe CLI) |

There is **no** Better Auth or `/api/auth` namespace.

## API modules summary

- **`/api/v1/auth`** — Registration, login, refresh, logout, profile, password change, email OTP verify/resend, forgot/reset password, Google login.
- **`/api/v1/seller`** — Customer to seller conversion (`POST /create-profile`).
- **`/api/v1/category`**, **`/api/v1/manufacturer`** — Admin-managed CRUD.
- **`/api/v1/medicine`** — Public listing and seller medicine management.
- **`/api/v1/cart`** — Customer cart.
- **`/api/v1/order`** — Create order, **`POST /:id/place`** for Stripe Checkout session, listings, detail, cancel, seller status updates.
- **`/api/v1/review`** — Delivered-order reviews.
- **`/api/v1/admin`** — User listing and status.
- **`/api/v1/stats`** — Role-specific dashboard data.

## Authentication notes

- **Cookies:** On successful login (or equivalent), the API sets **`accessToken`** and **`refreshToken`** as **HTTP-only** cookies (see `src/app/utils/token.ts` for options such as `secure` and `SameSite`).
- **Protected routes:** `checkAuth` reads **`accessToken`**, verifies it with `ACCESS_TOKEN_SECRET`, and attaches `req.user` (`userId`, `email`, `role`, etc.). There is **no** Better Auth session cookie.
- **Refresh:** Call **`POST /api/v1/auth/refresh-token`** with the **`refreshToken`** cookie to obtain new tokens (response sets cookies again).
- **Frontend:** Use `credentials: 'include'` (or equivalent) on requests to this API, and ensure **`FRONTEND_URL`** is allowed by CORS. After the user becomes a seller, refresh tokens so the JWT **role** matches before calling seller-only routes.

## Environment variables

Configuration is loaded in `src/app/config/env.ts`. **Every variable below is required** at startup; missing values throw during boot.

Create a `.env` file:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME

ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
ACCESS_TOKEN_EXPIRES_IN=1d
REFRESH_TOKEN_EXPIRES_IN=7d

SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=verified-sender@yourdomain.com

GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

FRONTEND_URL=http://localhost:3000

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD==admin123
```

### SendGrid

- Create an API key in the SendGrid dashboard.
- Use a **verified sender** (single sender or domain) matching `SENDGRID_FROM_EMAIL`.

### Google OAuth

- Create OAuth 2.0 credentials in Google Cloud Console.
- Use the same **Web client** ID (and secret if applicable) as configured for your frontend ID token flow; the backend verifies ID tokens against `GOOGLE_CLIENT_ID`.

### Stripe

- **`STRIPE_SECRET_KEY`** — Secret API key (test or live).
- **`STRIPE_WEBHOOK_SECRET`** — Signing secret for the endpoint **`POST https://<your-host>/webhook`** (or the URL Stripe CLI forwards to when developing locally).
- For local development, use the [Stripe CLI](https://docs.stripe.com/stripe-cli) to forward webhooks to `http://localhost:<PORT>/webhook`.

## Prerequisites

- Node.js 18 or newer and npm
- PostgreSQL
- [Cloudinary](https://cloudinary.com/) account for uploads
- [SendGrid](https://sendgrid.com/) API key and verified sender
- [Google Cloud](https://console.cloud.google.com/) OAuth client for Google sign-in
- [Stripe](https://stripe.com/) account for payments and webhooks

## Local setup

### 1. Clone and install dependencies

```bash
git clone <your-repository-url>
cd Niramoy-Backend
npm install
```

### 2. Configure environment variables

Copy the list above into `.env` and fill in real values.

### 3. Generate Prisma client

```bash
npm run generate
```

### 4. Apply database migrations

```bash
npm run migrate
```

Optional: push schema without a migration file:

```bash
npm run push
```

### 5. Stripe webhooks (when testing payments)

- Install Stripe CLI and run `stripe listen --forward-to localhost:5000/webhook` (adjust host/port).
- Put the CLI signing secret into `STRIPE_WEBHOOK_SECRET` while testing, or register a Dashboard webhook for a deployed URL.

### 6. Start the development server

```bash
npm run dev
```

Default base URL:

```text
http://localhost:5000
```

### 7. Production build

```bash
npm run build
npm start
```

## Available scripts

- `npm run dev` — Watch mode with `tsx`.
- `npm run build` — Bundle with `tsup`.
- `npm start` — Run `dist/server.js`.
- `npm run lint` — ESLint on `src`.
- `npm run generate` — Prisma client.
- `npm run migrate` — Prisma migrate dev.
- `npm run push` — `prisma db push`.
- `npm run pull` — `prisma db pull`.
- `npm run studio` — Prisma Studio.

## Response conventions

Successful responses:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

Errors (global handler):

```json
{
  "success": false,
  "message": "Error message",
  "errorSources": [
    {
      "path": "fieldName",
      "message": "Details"
    }
  ]
}
```

## File upload behavior

Uploads use Cloudinary via Multer.

- Field name: `file`
- Multipart JSON field name: `data`
- Endpoints:
  - `PATCH /api/v1/auth/update-me`
  - `POST /api/v1/medicine`
  - `PATCH /api/v1/medicine/:id`

## Suggested workflow for new developers

1. Create a PostgreSQL database and set `DATABASE_URL`.
2. Fill in all required `.env` variables (especially SendGrid, Google, Stripe, Cloudinary).
3. Run `npm install`, then `npm run generate`, then `npm run migrate`.
4. Start `npm run dev` and optionally forward Stripe webhooks for payment tests.
5. Use Postman or your frontend against `http://localhost:5000` with credentials enabled for cookie auth.

## License

This project is published under the `ISC` license as declared in `package.json`.
