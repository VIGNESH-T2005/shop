import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const stripeMock = vi.hoisted(() => ({
  coupons: { create: vi.fn(async () => ({ id: 'co_1' })) },
  checkout: { sessions: { create: vi.fn(async () => ({ id: 'cs_test_123', url: 'https://stripe.test/pay' })), expire: vi.fn(async () => ({})) } },
  refunds: { create: vi.fn(async () => ({ id: 're_1' })) },
  webhooks: {
    constructEvent: vi.fn((body: Buffer, sig: string) => {
      if (sig !== 'good') throw new Error('bad signature');
      return JSON.parse(body.toString());
    }),
  },
}));
vi.mock('../config/stripe', () => ({ getStripe: () => stripeMock, stripeConfigured: () => true }));

import { createApp } from '../app';
import { Coupon } from '../models/Coupon';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { cancelOrder, fulfillPaidOrder } from '../services/order.service';
import { clearDb, makeProduct, startDb, stopDb } from './helpers';

const app = createApp();
const H = { 'X-Requested-With': 'shop-zone' };
const address = { fullName: 'Ada L', line1: '1 Main St', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US' };

async function checkoutFor(productId: string, qty = 1, extra: Record<string, unknown> = {}) {
  return request(app).post('/api/checkout/session').set(H).send({
    items: [{ productId, sku: 'SKU-1', qty }],
    shippingMethod: 'standard',
    email: 'ada@example.com',
    shippingAddress: address,
    ...extra,
  });
}

describe('checkout, webhook and stock', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(async () => {
    await clearDb();
    vi.clearAllMocks();
  });

  it('creates a pending order priced by the server and a Stripe session', async () => {
    const p = await makeProduct({ price: 5000 });
    const res = await checkoutFor(String(p._id), 2);
    expect(res.status).toBe(201);
    expect(res.body.data.url).toBe('https://stripe.test/pay');
    const order = await Order.findOne();
    expect(order?.paymentStatus).toBe('pending');
    expect(order?.subtotal).toBe(10000);
    expect(order?.total).toBe(10000 + 0 + 800); // free standard shipping over $100, 8% tax
    expect(order?.items[0].title).toBe('Test Product'); // snapshot
    expect((await Product.findById(p._id))!.variants[0].stock).toBe(5); // stock untouched until payment
  });
  it('refuses to check out more than is in stock', async () => {
    const p = await makeProduct();
    const res = await checkoutFor(String(p._id), 6);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CART_CHANGED');
    expect(await Order.countDocuments()).toBe(0);
  });
  it('rejects a bad webhook signature', async () => {
    const res = await request(app).post('/api/webhooks/stripe').set('stripe-signature', 'bad').set('Content-Type', 'application/json').send('{}');
    expect(res.status).toBe(400);
  });
  it('fulfils on a verified webhook, decrements stock and counts the coupon once, even if delivered twice', async () => {
    const p = await makeProduct({ price: 5000 });
    await Coupon.create({ code: 'TEN', type: 'percent', value: 10 });
    await checkoutFor(String(p._id), 2, { couponCode: 'TEN' });
    const order = (await Order.findOne())!;
    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_123', payment_status: 'paid', payment_intent: 'pi_1', amount_total: order.total, metadata: { orderId: String(order._id) } } },
    };
    const send = () => request(app).post('/api/webhooks/stripe').set('stripe-signature', 'good').set('Content-Type', 'application/json').send(JSON.stringify(event));
    expect((await send()).body.result).toBe('fulfilled');
    expect((await send()).body.result).toBe('duplicate');
    expect((await Product.findById(p._id))!.variants[0].stock).toBe(3); // decremented exactly once
    expect((await Product.findById(p._id))!.totalStock).toBe(3);
    expect((await Coupon.findOne({ code: 'TEN' }))!.usedCount).toBe(1);
    const paid = (await Order.findById(order._id))!;
    expect(paid.paymentStatus).toBe('paid');
    expect(paid.fulfillmentStatus).toBe('processing');
  });
  it('never oversells: concurrent payments for the last unit leave one winner and one refund', async () => {
    const p = await makeProduct({ variants: [{ sku: 'SKU-1', stock: 1 }] });
    const mk = async (n: number) =>
      Order.create({
        orderNumber: `T-${n}`, email: `t${n}@x.com`, shippingAddress: address, shippingMethod: 'standard',
        subtotal: 5000, shipping: 500, tax: 400, total: 5900,
        items: [{ product: p._id, sku: 'SKU-1', title: 'Test Product', unitPrice: 5000, qty: 1 }],
      });
    const [a, b] = await Promise.all([mk(1), mk(2)]);
    const results = await Promise.all([fulfillPaidOrder(String(a._id), 'pi_a'), fulfillPaidOrder(String(b._id), 'pi_b')]);
    expect(results.sort()).toEqual(['fulfilled', 'oversold']);
    expect((await Product.findById(p._id))!.variants[0].stock).toBe(0);
    expect(stripeMock.refunds.create).toHaveBeenCalledTimes(1);
    const statuses = (await Order.find()).map((o) => o.fulfillmentStatus).sort();
    expect(statuses).toEqual(['cancelled', 'processing']);
  });
  it('cancel refunds an unshipped paid order and restocks it', async () => {
    const p = await makeProduct();
    await checkoutFor(String(p._id), 2);
    const order = (await Order.findOne())!;
    await fulfillPaidOrder(String(order._id), 'pi_1');
    expect((await Product.findById(p._id))!.variants[0].stock).toBe(3);
    const done = await cancelOrder(String(order._id), { id: 'admin', role: 'admin' });
    expect(done?.fulfillmentStatus).toBe('cancelled');
    expect(done?.paymentStatus).toBe('refunded');
    expect((await Product.findById(p._id))!.variants[0].stock).toBe(5);
    expect(stripeMock.refunds.create).toHaveBeenCalled();
  });
  it('does not allow cancelling a shipped order', async () => {
    const p = await makeProduct();
    await checkoutFor(String(p._id));
    const order = (await Order.findOne())!;
    await fulfillPaidOrder(String(order._id), 'pi_1');
    await Order.updateOne({ _id: order._id }, { fulfillmentStatus: 'shipped' });
    await expect(cancelOrder(String(order._id), { id: 'admin', role: 'admin' })).rejects.toMatchObject({ status: 409 });
  });
});
