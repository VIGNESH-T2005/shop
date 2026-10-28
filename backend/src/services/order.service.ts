import crypto from 'crypto';
import mongoose, { FilterQuery, Types } from 'mongoose';
import Stripe from 'stripe';
import { env } from '../config/env';
import { getStripe } from '../config/stripe';
import { Coupon } from '../models/Coupon';
import { IOrder, Order } from '../models/Order';
import { Product } from '../models/Product';
import { ApiError } from '../utils/ApiError';
import { paginate } from '../utils/http';
import { logger } from '../utils/logger';
import { clearCart } from './cart.service';
import { mailer } from './email.service';
import { CartItemInput, ShippingMethodId, SHIPPING_METHODS, priceCart } from './pricing.service';

class StockError extends Error {
  constructor(public sku: string) {
    super(`Insufficient stock for ${sku}`);
  }
}
const genOrderNumber = () => `SZ-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

export async function createCheckout(input: {
  userId?: string;
  email: string;
  items: CartItemInput[];
  couponCode?: string;
  shippingMethod: ShippingMethodId;
  shippingAddress: any;
}) {
  const stripe = getStripe();
  const priced = await priceCart(input.items, { couponCode: input.couponCode, shippingMethod: input.shippingMethod });
  if (!priced.lines.length) throw new ApiError(400, 'Your cart is empty.', 'EMPTY_CART');
  if (priced.issues.length) throw new ApiError(422, priced.issues[0].message, 'CART_CHANGED', priced.issues);
  if (input.couponCode && priced.couponError) throw new ApiError(422, priced.couponError, 'BAD_COUPON');

  const order = await Order.create({
    orderNumber: genOrderNumber(),
    user: input.userId,
    email: input.email,
    items: priced.lines.map((l) => ({
      product: l.productId,
      sku: l.sku,
      title: l.title,
      image: l.image,
      variantLabel: l.variantLabel,
      unitPrice: l.unitPrice,
      qty: l.qty,
    })),
    shippingAddress: input.shippingAddress,
    shippingMethod: priced.shippingMethod,
    subtotal: priced.subtotal,
    discount: priced.discount,
    shipping: priced.shipping,
    tax: priced.tax,
    total: priced.total,
    couponCode: priced.coupon?.code,
    timeline: [{ status: 'created', note: 'Awaiting payment', at: new Date() }],
  });

  try {
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = priced.lines.map((l) => ({
      quantity: l.qty,
      price_data: {
        currency: 'usd',
        unit_amount: l.unitPrice,
        product_data: {
          name: l.variantLabel ? `${l.title} (${l.variantLabel})` : l.title,
          ...(l.image && /^https?:\/\//.test(l.image) ? { images: [l.image] } : {}),
        },
      },
    }));
    if (priced.tax > 0) {
      line_items.push({ quantity: 1, price_data: { currency: 'usd', unit_amount: priced.tax, product_data: { name: 'Estimated tax' } } });
    }
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    if (priced.discount > 0) {
      const c = await stripe.coupons.create({
        amount_off: priced.discount,
        currency: 'usd',
        duration: 'once',
        max_redemptions: 1,
        name: priced.coupon?.code ?? 'Discount',
      });
      discounts = [{ coupon: c.id }];
    }
    const method = SHIPPING_METHODS[input.shippingMethod];
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: input.email,
      client_reference_id: String(order._id),
      line_items,
      discounts,
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: priced.shipping, currency: 'usd' },
            display_name: `${method.label} (${method.eta})`,
          },
        },
      ],
      metadata: { orderId: String(order._id), orderNumber: order.orderNumber },
      payment_intent_data: { metadata: { orderId: String(order._id), orderNumber: order.orderNumber } },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: `${env.CLIENT_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.CLIENT_URL}/checkout?cancelled=1`,
    });
    order.stripeSessionId = session.id;
    await order.save();
    return { url: session.url!, orderNumber: order.orderNumber };
  } catch (e) {
    await Order.deleteOne({ _id: order._id });
    throw e;
  }
}

/**
 * Idempotent fulfilment. The conditional update (paymentStatus: 'pending' -> 'paid') is the gate:
 * only one webhook delivery can pass it. Stock is decremented with conditional updates inside the same
 * transaction, so an oversell aborts everything and the customer is refunded.
 */
export async function fulfillPaidOrder(orderId: string, paymentIntentId?: string, amountTotal?: number) {
  const session = await mongoose.startSession();
  type Outcome = 'fulfilled' | 'duplicate' | 'oversold';
  const state = { outcome: 'duplicate' as Outcome, order: null as IOrder | null };
  try {
    await session.withTransaction(async () => {
      state.outcome = 'duplicate';
      const order = await Order.findOneAndUpdate(
        { _id: orderId, paymentStatus: 'pending', fulfillmentStatus: 'pending' },
        {
          $set: { paymentStatus: 'paid', fulfillmentStatus: 'processing', paymentIntentId, paidAt: new Date() },
          $push: { timeline: { status: 'paid', note: 'Payment received', at: new Date() } },
        },
        { new: true, session },
      );
      if (!order) return;
      if (amountTotal !== undefined && amountTotal !== order.total) {
        logger.error(`Order ${order.orderNumber}: Stripe total ${amountTotal} differs from order total ${order.total}`);
      }
      for (const item of order.items) {
        const r = await Product.updateOne(
          { _id: item.product, variants: { $elemMatch: { sku: item.sku, stock: { $gte: item.qty } } } },
          { $inc: { 'variants.$.stock': -item.qty, totalStock: -item.qty, soldCount: item.qty } },
          { session },
        );
        if (r.modifiedCount !== 1) throw new StockError(item.sku);
      }
      if (order.couponCode) await Coupon.updateOne({ code: order.couponCode }, { $inc: { usedCount: 1 } }, { session });
      state.order = order;
      state.outcome = 'fulfilled';
    });
  } catch (e) {
    if (e instanceof StockError) state.outcome = 'oversold';
    else throw e;
  } finally {
    await session.endSession();
  }

  if (state.outcome === 'fulfilled' && state.order) {
    const o = state.order;
    if (o.user) await clearCart(String(o.user));
    void mailer.orderConfirmation(o);
  }
  if (state.outcome === 'oversold') await refundOversold(orderId, paymentIntentId);
  return state.outcome;
}

async function refundOversold(orderId: string, paymentIntentId?: string) {
  const order = await Order.findById(orderId);
  if (!order) return;
  try {
    if (paymentIntentId) await getStripe().refunds.create({ payment_intent: paymentIntentId }, { idempotencyKey: `oversold-${orderId}` });
  } catch (e) {
    logger.error(`Automatic refund failed for ${order.orderNumber}; refund it manually in Stripe.`, (e as Error).message);
  }
  await Order.updateOne(
    { _id: orderId },
    {
      $set: { paymentStatus: 'refunded', fulfillmentStatus: 'cancelled', refundedCents: order.total, paymentIntentId },
      $push: { timeline: { status: 'cancelled', note: 'An item sold out while paying. The payment was refunded.', at: new Date() } },
    },
  );
  void mailer.refunded(order, order.total);
}

export async function expireOrder(orderId: string) {
  await Order.updateOne(
    { _id: orderId, paymentStatus: 'pending' },
    { $set: { fulfillmentStatus: 'cancelled', paymentStatus: 'failed' }, $push: { timeline: { status: 'cancelled', note: 'Checkout expired', at: new Date() } } },
  );
}

async function restock(order: IOrder) {
  for (const i of order.items) {
    await Product.updateOne(
      { _id: i.product, 'variants.sku': i.sku },
      { $inc: { 'variants.$.stock': i.qty, totalStock: i.qty, soldCount: -i.qty } },
    );
  }
}

export async function cancelOrder(orderId: string, actor: { id: string; role: string }) {
  const order = await Order.findById(orderId);
  if (!order || (actor.role !== 'admin' && String(order.user) !== actor.id)) throw new ApiError(404, 'Order not found.', 'NOT_FOUND');
  if (!['pending', 'processing'].includes(order.fulfillmentStatus)) {
    throw new ApiError(409, 'This order has already shipped and cannot be cancelled.', 'NOT_CANCELLABLE');
  }
  const wasPaid = order.paymentStatus === 'paid';
  const gate = await Order.findOneAndUpdate(
    { _id: orderId, fulfillmentStatus: order.fulfillmentStatus },
    { $set: { fulfillmentStatus: 'cancelled' }, $push: { timeline: { status: 'cancelled', note: 'Cancelled by ' + (actor.role === 'admin' ? 'store' : 'customer'), at: new Date() } } },
    { new: true },
  );
  if (!gate) throw new ApiError(409, 'This order just changed. Refresh and try again.', 'CONFLICT');
  if (!wasPaid) {
    if (order.stripeSessionId) await getStripe().checkout.sessions.expire(order.stripeSessionId).catch(() => undefined);
    return gate;
  }
  try {
    const remaining = order.total - order.refundedCents;
    if (remaining > 0 && order.paymentIntentId) {
      await getStripe().refunds.create({ payment_intent: order.paymentIntentId, amount: remaining }, { idempotencyKey: `cancel-${orderId}` });
    }
  } catch (e) {
    await Order.updateOne({ _id: orderId }, { $set: { fulfillmentStatus: order.fulfillmentStatus } }); // undo the gate
    throw e;
  }
  await restock(order);
  const done = await Order.findByIdAndUpdate(
    orderId,
    { $set: { paymentStatus: 'refunded', refundedCents: order.total } },
    { new: true },
  );
  void mailer.refunded(order, order.total - order.refundedCents);
  return done;
}

export async function refundOrder(orderId: string, amountCents?: number) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found.', 'NOT_FOUND');
  if (!['paid', 'partially_refunded'].includes(order.paymentStatus) || !order.paymentIntentId) {
    throw new ApiError(409, 'This order has no payment to refund.', 'NOT_REFUNDABLE');
  }
  const remaining = order.total - order.refundedCents;
  const amount = amountCents ?? remaining;
  if (amount < 1 || amount > remaining) throw new ApiError(400, `Refund must be between $0.01 and $${(remaining / 100).toFixed(2)}.`, 'BAD_AMOUNT');
  await getStripe().refunds.create({ payment_intent: order.paymentIntentId, amount }, { idempotencyKey: `refund-${orderId}-${order.refundedCents}-${amount}` });
  const full = amount === remaining;
  const restockNow = full && ['processing', 'pending'].includes(order.fulfillmentStatus);
  const updated = await Order.findByIdAndUpdate(
    orderId,
    {
      $inc: { refundedCents: amount },
      $set: { paymentStatus: full ? 'refunded' : 'partially_refunded', ...(restockNow ? { fulfillmentStatus: 'cancelled' } : {}) },
      $push: { timeline: { status: 'refunded', note: `Refunded $${(amount / 100).toFixed(2)}`, at: new Date() } },
    },
    { new: true },
  );
  if (restockNow) await restock(order);
  void mailer.refunded(order, amount);
  return updated;
}

const FLOW = ['processing', 'shipped', 'delivered'];
export async function updateFulfillment(orderId: string, input: { fulfillmentStatus: string; trackingNumber?: string; trackingCarrier?: string; note?: string }) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found.', 'NOT_FOUND');
  if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partially_refunded') throw new ApiError(409, 'Only paid orders can be fulfilled.', 'NOT_PAID');
  const cur = FLOW.indexOf(order.fulfillmentStatus);
  const next = FLOW.indexOf(input.fulfillmentStatus);
  if (cur === -1) throw new ApiError(409, `A ${order.fulfillmentStatus} order cannot be updated.`, 'BAD_TRANSITION');
  if (next < cur) throw new ApiError(409, 'Orders cannot move backwards.', 'BAD_TRANSITION');
  const updated = await Order.findByIdAndUpdate(
    orderId,
    {
      $set: {
        fulfillmentStatus: input.fulfillmentStatus,
        ...(input.trackingNumber ? { trackingNumber: input.trackingNumber } : {}),
        ...(input.trackingCarrier ? { trackingCarrier: input.trackingCarrier } : {}),
      },
      $push: { timeline: { status: input.fulfillmentStatus, note: input.note, at: new Date() } },
    },
    { new: true },
  );
  if (input.fulfillmentStatus === 'shipped' && order.fulfillmentStatus !== 'shipped' && updated) void mailer.shipped(updated);
  return updated;
}

export async function listMine(userId: string, page: number, limit: number) {
  const filter = { user: userId, fulfillmentStatus: { $ne: 'cancelled' as const }, $or: [{ paymentStatus: { $ne: 'pending' as const } }] };
  const [items, total] = await Promise.all([
    Order.find({ user: userId, paymentStatus: { $ne: 'pending' } }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments({ user: userId, paymentStatus: { $ne: 'pending' } }),
  ]);
  void filter;
  return { items, meta: paginate(page, limit, total) };
}
export async function getForUser(orderId: string, actor: { id: string; role: string }) {
  const order = await Order.findById(orderId).lean();
  if (!order || (actor.role !== 'admin' && String(order.user) !== actor.id)) throw new ApiError(404, 'Order not found.', 'NOT_FOUND');
  return order;
}
export async function getBySession(sessionId: string) {
  const order = await Order.findOne({ stripeSessionId: sessionId }).lean();
  if (!order) throw new ApiError(404, 'Order not found.', 'NOT_FOUND');
  return order;
}
export async function adminListOrders(p: { page: number; limit: number; status?: string; q?: string }) {
  const filter: FilterQuery<IOrder> = { paymentStatus: { $ne: 'pending' } };
  if (p.status) filter.fulfillmentStatus = p.status as any;
  if (p.q) {
    const rx = { $regex: p.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    filter.$or = [{ orderNumber: rx }, { email: rx }];
  }
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((p.page - 1) * p.limit).limit(p.limit).lean(),
    Order.countDocuments(filter),
  ]);
  return { items, meta: paginate(p.page, p.limit, total) };
}

/** Webhook entry points */
export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.payment_status !== 'paid') return 'ignored';
      const id = s.metadata?.orderId;
      if (!id || !Types.ObjectId.isValid(id)) return 'ignored';
      return fulfillPaidOrder(id, typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id, s.amount_total ?? undefined);
    }
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const id = pi.metadata?.orderId;
      if (!id || !Types.ObjectId.isValid(id)) return 'ignored';
      return fulfillPaidOrder(id, pi.id, pi.amount_received);
    }
    case 'checkout.session.expired': {
      const id = (event.data.object as Stripe.Checkout.Session).metadata?.orderId;
      if (id && Types.ObjectId.isValid(id)) await expireOrder(id);
      return 'expired';
    }
    default:
      return 'ignored';
  }
}
