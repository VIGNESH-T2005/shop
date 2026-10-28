import { Types } from 'mongoose';
import { env } from '../config/env';
import { Coupon, ICoupon } from '../models/Coupon';
import { IProduct, Product } from '../models/Product';

export interface CartItemInput {
  productId: string;
  sku: string;
  qty: number;
}
export const SHIPPING_METHODS = {
  standard: { id: 'standard', label: 'Standard', eta: '3–5 business days', cents: 500, freeOverCents: 10000 },
  express: { id: 'express', label: 'Express', eta: '1–2 business days', cents: 1500, freeOverCents: null as number | null },
} as const;
export type ShippingMethodId = keyof typeof SHIPPING_METHODS;

export function shippingCost(method: ShippingMethodId, taxableSubtotal: number) {
  const m = SHIPPING_METHODS[method];
  if (taxableSubtotal <= 0) return 0;
  if (m.freeOverCents !== null && taxableSubtotal >= m.freeOverCents) return 0;
  return m.cents;
}

/** Pure coupon evaluation, kept separate so it is trivially testable. */
export function evaluateCoupon(
  coupon: Pick<ICoupon, 'type' | 'value' | 'minSubtotal' | 'maxDiscount' | 'expiresAt' | 'usageLimit' | 'usedCount' | 'isActive'> | null,
  subtotal: number,
  now = new Date(),
): { discount: number; error?: string } {
  if (!coupon || !coupon.isActive) return { discount: 0, error: 'That coupon code is not valid.' };
  if (coupon.expiresAt && coupon.expiresAt < now) return { discount: 0, error: 'That coupon has expired.' };
  if (coupon.usageLimit !== undefined && coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { discount: 0, error: 'That coupon has reached its usage limit.' };
  }
  if (subtotal < coupon.minSubtotal) {
    return { discount: 0, error: `Spend at least $${(coupon.minSubtotal / 100).toFixed(2)} to use this coupon.` };
  }
  let discount = coupon.type === 'percent' ? Math.floor((subtotal * Math.min(coupon.value, 100)) / 100) : coupon.value;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  return { discount: Math.min(discount, subtotal) };
}

export function computeTotals(p: { subtotal: number; discount: number; shippingMethod: ShippingMethodId; taxRate: number }) {
  const taxable = Math.max(0, p.subtotal - p.discount);
  const shipping = shippingCost(p.shippingMethod, taxable);
  const tax = Math.round(taxable * p.taxRate);
  return { subtotal: p.subtotal, discount: p.discount, shipping, tax, total: taxable + shipping + tax };
}

export interface PricedLine {
  productId: string;
  sku: string;
  slug: string;
  title: string;
  image?: string;
  variantLabel: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  stock: number;
}
export interface CartIssue {
  productId: string;
  sku: string;
  type: 'unavailable' | 'out_of_stock' | 'stock_adjusted';
  message: string;
}

/** The server is the only source of truth for prices, stock and totals. Client prices are never read. */
export async function priceCart(rawItems: CartItemInput[], opts: { couponCode?: string; shippingMethod?: ShippingMethodId } = {}) {
  const merged = new Map<string, CartItemInput>();
  for (const i of rawItems) {
    const k = `${i.productId}:${i.sku}`;
    const prev = merged.get(k);
    merged.set(k, { ...i, qty: Math.min(99, (prev?.qty ?? 0) + i.qty) });
  }
  const ids = [...new Set([...merged.values()].map((i) => i.productId))];
  const products = (await Product.find({ _id: { $in: ids }, isActive: true }).lean()) as IProduct[];
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines: PricedLine[] = [];
  const issues: CartIssue[] = [];
  for (const item of merged.values()) {
    const p = byId.get(item.productId);
    const v = p?.variants.find((x) => x.sku === item.sku);
    if (!p || !v) {
      issues.push({ ...pick(item), type: 'unavailable', message: 'This item is no longer available.' });
      continue;
    }
    if (v.stock <= 0) {
      issues.push({ ...pick(item), type: 'out_of_stock', message: `${p.title} is out of stock.` });
      continue;
    }
    const qty = Math.min(item.qty, v.stock);
    if (qty < item.qty) {
      issues.push({ ...pick(item), type: 'stock_adjusted', message: `Only ${v.stock} of ${p.title} left. Quantity reduced.` });
    }
    lines.push({
      productId: String(p._id),
      sku: v.sku,
      slug: p.slug,
      title: p.title,
      image: p.images[0],
      variantLabel: [v.size, v.color].filter(Boolean).join(' / '),
      unitPrice: p.price,
      qty,
      lineTotal: p.price * qty,
      stock: v.stock,
    });
  }

  const subtotal = lines.reduce((n, l) => n + l.lineTotal, 0);
  let discount = 0;
  let coupon: { code: string; description?: string } | null = null;
  let couponError: string | undefined;
  if (opts.couponCode && lines.length) {
    const doc = await Coupon.findOne({ code: opts.couponCode.trim().toUpperCase() }).lean();
    const r = evaluateCoupon(doc, subtotal);
    if (r.error) couponError = r.error;
    else {
      discount = r.discount;
      coupon = { code: doc!.code, description: doc!.description };
    }
  }
  const totals = computeTotals({ subtotal, discount, shippingMethod: opts.shippingMethod ?? 'standard', taxRate: env.TAX_RATE });
  return { lines, issues, coupon, couponError, ...totals, shippingMethod: opts.shippingMethod ?? 'standard' };
}
const pick = (i: CartItemInput) => ({ productId: i.productId, sku: i.sku });

export const asObjectId = (id: string) => new Types.ObjectId(id);
