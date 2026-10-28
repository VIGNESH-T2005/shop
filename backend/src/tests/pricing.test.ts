import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Coupon } from '../models/Coupon';
import { computeTotals, evaluateCoupon, priceCart, shippingCost } from '../services/pricing.service';
import { clearDb, makeProduct, startDb, stopDb } from './helpers';

describe('pure pricing', () => {
  const base = { type: 'percent' as const, value: 10, minSubtotal: 0, usedCount: 0, isActive: true };
  it('applies percent coupons with a floor and a cap', () => {
    expect(evaluateCoupon(base, 9999).discount).toBe(999);
    expect(evaluateCoupon({ ...base, maxDiscount: 500 }, 9999).discount).toBe(500);
  });
  it('never discounts more than the subtotal', () => {
    expect(evaluateCoupon({ ...base, type: 'fixed', value: 5000 }, 3000).discount).toBe(3000);
  });
  it('rejects expired, exhausted, inactive and under-minimum coupons', () => {
    expect(evaluateCoupon({ ...base, expiresAt: new Date(Date.now() - 1000) }, 5000).error).toMatch(/expired/);
    expect(evaluateCoupon({ ...base, usageLimit: 1, usedCount: 1 }, 5000).error).toMatch(/usage limit/);
    expect(evaluateCoupon({ ...base, isActive: false }, 5000).error).toBeTruthy();
    expect(evaluateCoupon({ ...base, minSubtotal: 10000 }, 5000).error).toMatch(/Spend at least/);
    expect(evaluateCoupon(null, 5000).error).toBeTruthy();
  });
  it('charges shipping unless standard shipping is free over $100', () => {
    expect(shippingCost('standard', 9999)).toBe(500);
    expect(shippingCost('standard', 10000)).toBe(0);
    expect(shippingCost('express', 50000)).toBe(1500);
    expect(shippingCost('standard', 0)).toBe(0);
  });
  it('totals = subtotal - discount + shipping + tax, in whole cents', () => {
    const t = computeTotals({ subtotal: 5000, discount: 500, shippingMethod: 'standard', taxRate: 0.08 });
    expect(t).toEqual({ subtotal: 5000, discount: 500, shipping: 500, tax: 360, total: 5000 - 500 + 500 + 360 });
  });
});

describe('priceCart (server is the source of truth)', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('uses database prices and ignores anything the client claims', async () => {
    const p = await makeProduct({ price: 4200 });
    const r = await priceCart([{ productId: String(p._id), sku: 'SKU-1', qty: 2, price: 1 } as any]);
    expect(r.lines[0].unitPrice).toBe(4200);
    expect(r.subtotal).toBe(8400);
  });
  it('clamps quantity to stock and reports it', async () => {
    const p = await makeProduct();
    const r = await priceCart([{ productId: String(p._id), sku: 'SKU-1', qty: 99 }]);
    expect(r.lines[0].qty).toBe(5);
    expect(r.issues[0].type).toBe('stock_adjusted');
  });
  it('drops unknown variants and out-of-stock lines', async () => {
    const p = await makeProduct({ variants: [{ sku: 'SKU-1', stock: 0 }] });
    const r = await priceCart([
      { productId: String(p._id), sku: 'SKU-1', qty: 1 },
      { productId: String(p._id), sku: 'NOPE', qty: 1 },
    ]);
    expect(r.lines).toHaveLength(0);
    expect(r.issues.map((i) => i.type).sort()).toEqual(['out_of_stock', 'unavailable']);
  });
  it('merges duplicate lines and applies a valid coupon', async () => {
    const p = await makeProduct({ price: 10000 });
    await Coupon.create({ code: 'TEN', type: 'percent', value: 10 });
    const r = await priceCart(
      [
        { productId: String(p._id), sku: 'SKU-1', qty: 1 },
        { productId: String(p._id), sku: 'SKU-1', qty: 1 },
      ],
      { couponCode: 'ten' },
    );
    expect(r.lines).toHaveLength(1);
    expect(r.discount).toBe(2000);
    expect(r.coupon?.code).toBe('TEN');
  });
});
