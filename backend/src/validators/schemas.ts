import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParam = z.object({ id: objectId });
export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email').max(254);
// bcrypt only uses the first 72 bytes, so cap there.
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

// ---------- auth ----------
export const registerBody = z.object({ name: z.string().trim().min(2).max(100), email: emailSchema, password: passwordSchema });
export const loginBody = z.object({ email: emailSchema, password: z.string().min(1).max(200) });
export const forgotBody = z.object({ email: emailSchema });
export const resetBody = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const verifyBody = z.object({ token: z.string().min(20).max(200) });
export const googleBody = z.object({ credential: z.string().min(20).max(5000) });
export const changePasswordBody = z.object({ currentPassword: z.string().max(200).optional(), newPassword: passwordSchema });
export const profileBody = z.object({ name: z.string().trim().min(2).max(100) });

export const addressBody = z.object({
  label: z.string().trim().max(40).optional(),
  fullName: z.string().trim().min(2).max(100),
  line1: z.string().trim().min(3).max(150),
  line2: z.string().trim().max(150).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(1).max(80),
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().length(2).toUpperCase().default('US'),
  phone: z.string().trim().max(30).optional(),
  isDefault: z.boolean().optional(),
});

// ---------- catalog ----------
export const productQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  brand: z.string().trim().max(300).optional(), // comma-separated
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  sort: z.enum(['relevance', 'newest', 'price_asc', 'price_desc', 'rating', 'popular']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});
export const slugParam = z.object({ slug: z.string().trim().toLowerCase().max(120) });
export const idsQuery = z.object({ ids: z.string().max(1000) });

const variantBody = z.object({
  sku: z.string().trim().min(1).max(64),
  size: z.string().trim().max(40).optional(),
  color: z.string().trim().max(40).optional(),
  stock: z.number().int().min(0).max(100000),
});
export const productBody = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(5000),
  price: z.number().int().min(1),
  compareAtPrice: z.number().int().min(0).optional().nullable(),
  images: z.array(z.string().url()).max(10).default([]),
  category: objectId,
  brand: z.string().trim().min(1).max(80),
  variants: z.array(variantBody).min(1).max(50),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  isActive: z.boolean().default(true),
  viewer: z
    .object({
      shape: z.enum(['sphere', 'torus', 'box', 'cone', 'knot', 'capsule']),
      color: z.string().regex(/^#[0-9a-f]{6}$/i),
      modelUrl: z.string().url().optional(),
    })
    .optional(),
});
export const categoryBody = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  image: z.string().url().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});
export const reviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(5).max(2000),
});

// ---------- cart & checkout ----------
export const shippingMethodEnum = z.enum(['standard', 'express']);
export const cartItem = z.object({ productId: objectId, sku: z.string().trim().min(1).max(64), qty: z.number().int().min(1).max(99) });
export const cartItems = z.array(cartItem).max(50);
export const cartPriceBody = z.object({
  items: cartItems,
  couponCode: z.string().trim().max(40).optional(),
  shippingMethod: shippingMethodEnum.default('standard'),
});
export const cartReplaceBody = z.object({ items: cartItems });
export const wishlistMergeBody = z.object({ productIds: z.array(objectId).max(200) });
export const checkoutBody = z.object({
  items: cartItems.min(1),
  couponCode: z.string().trim().max(40).optional(),
  shippingMethod: shippingMethodEnum,
  email: emailSchema,
  shippingAddress: addressBody,
});

// ---------- orders & admin ----------
export const orderStatusBody = z.object({
  fulfillmentStatus: z.enum(['processing', 'shipped', 'delivered']),
  trackingNumber: z.string().trim().max(100).optional(),
  trackingCarrier: z.string().trim().max(60).optional(),
  note: z.string().trim().max(300).optional(),
});
export const refundBody = z.object({ amountCents: z.number().int().min(1).optional(), reason: z.string().trim().max(300).optional() });
export const lookupQuery = z.object({ sessionId: z.string().min(10).max(200) });
export const adminOrderQuery = z.object({
  ...pageQuery,
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  q: z.string().trim().max(100).optional(),
});
export const couponBody = z.object({
  code: z.string().trim().min(3).max(40).toUpperCase(),
  description: z.string().trim().max(200).optional(),
  type: z.enum(['percent', 'fixed']),
  value: z.number().int().min(1),
  minSubtotal: z.number().int().min(0).default(0),
  maxDiscount: z.number().int().min(1).optional(),
  expiresAt: z.coerce.date().optional(),
  usageLimit: z.number().int().min(1).optional(),
  isActive: z.boolean().default(true),
});
export const userRoleBody = z.object({ role: z.enum(['customer', 'admin']).optional(), isActive: z.boolean().optional() });
export const adminListQuery = z.object({ ...pageQuery, q: z.string().trim().max(100).optional() });
