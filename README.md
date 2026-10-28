# Shop-Zone

A production-style MERN e-commerce platform: catalog, server-priced cart, Stripe Checkout with a verified webhook, orders, Google sign-in, and an admin dashboard.

**Stack.** Frontend: React, Vite, TypeScript, Tailwind, React Router, TanStack Query, Zustand, React Hook Form + Zod, Framer Motion, GSAP, Lenis, React Three Fiber. Backend: Node, Express, TypeScript, MongoDB/Mongoose, JWT in httpOnly cookies, Zod, Helmet, rate limiting. Payments: Stripe (test mode).

```
shop-zone/
  frontend/   React app (Vercel)
  backend/    Express API (Render)
```

## Quick setup (about 5 minutes)

You need Node 18.18+ (Node 20 recommended) and a MongoDB Atlas cluster. Atlas is a replica set, which the order/stock transactions require. A plain local `mongod` will not work unless started as a replica set.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Fill in `backend/.env`:

| Variable | What to put |
|---|---|
| `MONGODB_URI` | Your Atlas connection string (add `/shopzone` as the database name) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Two different random strings. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_PASSWORD` | The password for the seeded admin account |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional until you test payments (see Stripe below) |

Everything else is optional. The app starts without Stripe, Google, Cloudinary or email, and each feature shows a clear "setup required" message until you add its keys.

```bash
npm run seed                # 6 categories, 32 products, 3 coupons, 1 admin
npm run dev                 # API on http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env        # leave VITE_API_URL empty locally
npm run dev                 # http://localhost:5173
```

Sign in as `admin@shop-zone.dev` (or your `ADMIN_EMAIL`) with `ADMIN_PASSWORD`. Seeded coupons: `WELCOME10`, `SAVE20` (orders over $100), `BIGSPENDER`.

### Scripts

| Where | Command | Does |
|---|---|---|
| backend | `npm run dev` | API with reload |
| backend | `npm run seed` | Reset catalog, categories, coupons; upsert admin |
| backend | `npm test` | Vitest + Supertest (uses an in-memory replica set; first run downloads a MongoDB binary) |
| backend | `npm run build && npm start` | Production build |
| frontend | `npm run dev` / `npm run build` | Dev server / production build |

## Stripe (test mode)

1. In the Stripe dashboard (test mode) copy the secret key (`sk_test_...`) into `STRIPE_SECRET_KEY`.
2. Local webhooks: install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then run
   `stripe listen --forward-to localhost:5000/api/webhooks/stripe`
   and copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`. Restart the API.
3. Pay with card `4242 4242 4242 4242`, any future date, any CVC.
4. Production: add a webhook endpoint `https://<your-render-url>/api/webhooks/stripe` listening for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired` and `payment_intent.succeeded`, and use its signing secret.

How it works: the client sends only product ids, SKUs and quantities. The server prices everything, creates a *pending* order and a Stripe Checkout Session. The order becomes paid only when the signed webhook arrives. That step is idempotent (a conditional update gates it), decrements stock with conditional updates inside a Mongo transaction, and refunds the customer automatically if an item sold out in the meantime.

## Google sign-in

1. Go to Google Cloud Console, create a project, then **APIs & Services > OAuth consent screen** (External, add your email as a test user).
2. **Credentials > Create credentials > OAuth client ID > Web application**.
3. **Authorized JavaScript origins:** `http://localhost:5173`, and your production frontend, e.g. `https://shop-zone.vercel.app`. (No redirect URIs are needed: Google Identity Services returns an ID token to the page.)
4. Copy the client ID into `GOOGLE_CLIENT_ID` in `backend/.env` and restart the API. The frontend reads it from `/api/auth/config`, so there is nothing to set on Vercel.
5. Until it is set, the sign-in pages show "Google sign-in: setup required". Login is never simulated.

The server verifies the ID token (signature, audience, verified email), then creates or finds the user and issues the same cookies as email login. If a password account with that email exists, Google is linked to it. If that account's email was never verified, its password is removed on linking, which blocks pre-registration takeover.

## Deployment

**MongoDB Atlas.** Create a free cluster, a database user, and allow network access (for Render use `0.0.0.0/0` or Render's outbound IPs). Copy the connection string.

**Backend on Render.** New Web Service from the repo, root directory `backend`, build `npm install && npm run build`, start `npm start`. Environment: everything from `.env.example`, with `NODE_ENV=production` and `CLIENT_URL=https://<your-vercel-domain>` (no trailing slash). Run `npm run seed` once from the Render shell, or locally against the Atlas URI.

**Frontend on Vercel.** Import the repo, root directory `frontend`, framework Vite. Set `VITE_API_URL=https://<your-render-service>.onrender.com`. `vercel.json` already rewrites all routes to `index.html`.

Cross-site cookies: in production the cookies are `Secure; SameSite=None`, and state-changing requests must send `X-Requested-With: shop-zone` (an allow-listed header, so only your `CLIENT_URL` passes the CORS preflight). Keep `CLIENT_URL` exact. Note: Safari and some browsers block third-party cookies by default; for the most robust setup put both apps under one parent domain (e.g. `app.example.com` and `api.example.com`) and set `SameSite=Lax` by editing `utils/cookies.ts`.

## API reference

All responses: `{ "success": true, "data": ..., "meta"?: { page, limit, total, pages } }` or `{ "success": false, "error": { "code", "message", "details"? } }`. Money is integer cents. Write requests need the `X-Requested-With: shop-zone` header and a session cookie where noted.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | | Liveness |
| GET | `/api/auth/config` | | Whether Google sign-in is configured |
| POST | `/api/auth/register` | | Create account (rate limited) |
| POST | `/api/auth/login` | | Email/password sign-in |
| POST | `/api/auth/google` | | Sign in with a Google ID token `{credential}` |
| POST | `/api/auth/refresh` | cookie | Rotate refresh token (reuse revokes all sessions) |
| POST | `/api/auth/logout` | | End this session |
| GET | `/api/auth/me` | user | Current user |
| POST | `/api/auth/verify-email` | | `{token}` |
| POST | `/api/auth/resend-verification` | user | |
| POST | `/api/auth/forgot-password` | | Always responds 200 |
| POST | `/api/auth/reset-password` | | `{token, password}` |
| PATCH | `/api/account/profile` | user | Change name |
| POST | `/api/account/password` | user | Change or set password |
| POST/PUT/DELETE | `/api/account/addresses[/:id]` | user | Manage addresses |
| GET | `/api/products` | | Search, filter, sort, paginate: `q, category, brand, minPrice, maxPrice, rating, inStock, sort, page, limit` |
| GET | `/api/products/facets` | | Brands with counts, price bounds |
| GET | `/api/products/by-ids?ids=a,b` | | Fetch several |
| GET | `/api/products/:slug` | | Detail plus related |
| GET/POST | `/api/products/:slug/reviews` | POST: user | List / add review |
| GET | `/api/categories` | | Active categories |
| POST | `/api/cart/price` | | Price a cart server-side `{items, couponCode?, shippingMethod?}` |
| GET/PUT | `/api/cart` | user | Server cart |
| POST | `/api/cart/merge` | user | Merge guest cart into account |
| GET | `/api/wishlist` | user | |
| POST | `/api/wishlist/merge` | user | `{productIds}` |
| POST/DELETE | `/api/wishlist/:productId` | user | |
| POST | `/api/checkout/session` | optional | Create pending order + Stripe session (rate limited) |
| POST | `/api/webhooks/stripe` | signature | Verified, idempotent fulfilment |
| GET | `/api/orders/by-session?sessionId=` | | Order for the success page |
| GET | `/api/orders` | user | My orders |
| GET | `/api/orders/:id` | owner/admin | Order detail |
| POST | `/api/orders/:id/cancel` | owner/admin | Cancel if unshipped; refunds and restocks |
| GET | `/api/admin/stats` | admin | Revenue, top products, low stock |
| GET/POST/PUT/DELETE | `/api/admin/products[/:id]` | admin | Product CRUD |
| GET/POST/PUT/DELETE | `/api/admin/categories[/:id]` | admin | Category CRUD |
| GET/POST/PUT/DELETE | `/api/admin/coupons[/:id]` | admin | Coupon CRUD |
| GET/PATCH | `/api/admin/users[/:id]` | admin | List users, change role, disable |
| GET | `/api/admin/orders` | admin | Order table (filters) |
| PATCH | `/api/admin/orders/:id` | admin | Status and tracking number |
| POST | `/api/admin/orders/:id/refund` | admin | Full or partial Stripe refund |
| POST | `/api/admin/upload` | admin | Images to Cloudinary (multipart `images`) |

## Design decisions

- **Prices in integer cents**, computed only on the server. The client never sends a price.
- **Stock** is decremented at payment confirmation (not at checkout start), so abandoned checkouts never lock inventory. Checkout creation still rejects out-of-stock carts, and the webhook refunds if two buyers race for the last unit.
- **Sessions:** 15-minute access cookie, 7-day rotating refresh cookie stored hashed-by-jti on the user, with reuse detection. The frontend refreshes in a single-flight so parallel requests don't trip reuse detection.
- **Tax** is a flat `TAX_RATE` (default 8%). **Shipping:** Standard $5 (free over $100), Express $15. Edit `pricing.service.ts` to change.
- **Email** goes through `email.service.ts` (SMTP via Nodemailer, or Resend). With `EMAIL_PROVIDER=none`, nothing is sent; in development the verify/reset links are logged to the API console.
- **3D viewer** renders procedural shapes (per-product shape and color set in admin), optionally a GLB via `viewer.modelUrl`. It is lazy-loaded and only used on the home hero and product pages.
- **Dark-only** design system (tokens in `frontend/src/index.css`).
