export interface Address {
  _id?: string;
  label?: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  avatar?: string;
  emailVerified: boolean;
  hasPassword?: boolean;
  addresses: Address[];
}
export interface Category { _id: string; name: string; slug: string; description?: string; image?: string; isActive: boolean }
export interface Variant { sku: string; size?: string; color?: string; stock: number }
export interface Product {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  category: Pick<Category, '_id' | 'name' | 'slug'>;
  brand: string;
  variants: Variant[];
  ratingAverage: number;
  ratingCount: number;
  tags: string[];
  isActive: boolean;
  totalStock: number;
  soldCount: number;
  viewer?: { shape: 'sphere' | 'torus' | 'box' | 'cone' | 'knot' | 'capsule'; color: string; modelUrl?: string };
}
export interface Meta { page: number; limit: number; total: number; pages: number }
export interface CartItem { productId: string; sku: string; qty: number }
export interface PricedLine {
  productId: string; sku: string; slug: string; title: string; image?: string; variantLabel: string;
  unitPrice: number; qty: number; lineTotal: number; stock: number;
}
export interface CartIssue { productId: string; sku: string; type: 'unavailable' | 'out_of_stock' | 'stock_adjusted'; message: string }
export interface PricedCart {
  lines: PricedLine[]; issues: CartIssue[]; coupon: { code: string; description?: string } | null; couponError?: string;
  subtotal: number; discount: number; shipping: number; tax: number; total: number; shippingMethod: 'standard' | 'express';
}
export interface OrderItem { product: string; sku: string; title: string; image?: string; variantLabel?: string; unitPrice: number; qty: number }
export interface Order {
  _id: string; orderNumber: string; email: string; items: OrderItem[]; shippingAddress: Address; shippingMethod: string;
  subtotal: number; discount: number; shipping: number; tax: number; total: number; couponCode?: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
  fulfillmentStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  refundedCents: number; trackingNumber?: string; trackingCarrier?: string;
  timeline: { status: string; note?: string; at: string }[]; createdAt: string;
}
export interface Review { _id: string; userName: string; rating: number; title?: string; body: string; verifiedPurchase: boolean; createdAt: string }
export interface Coupon { _id: string; code: string; description?: string; type: 'percent' | 'fixed'; value: number; minSubtotal: number; maxDiscount?: number; expiresAt?: string; usageLimit?: number; usedCount: number; isActive: boolean }
