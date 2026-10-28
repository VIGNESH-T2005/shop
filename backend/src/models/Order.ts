import { Schema, model, Types } from 'mongoose';
import { IAddress, addressSchema } from './User';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
export type FulfillmentStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface IOrderItem {
  product: Types.ObjectId;
  sku: string;
  title: string;
  image?: string;
  variantLabel?: string;
  unitPrice: number;
  qty: number;
}
export interface IOrder {
  _id: Types.ObjectId;
  orderNumber: string;
  user?: Types.ObjectId;
  email: string;
  items: IOrderItem[];
  shippingAddress: IAddress;
  shippingMethod: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode?: string;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  stripeSessionId?: string;
  paymentIntentId?: string;
  refundedCents: number;
  paidAt?: Date;
  trackingNumber?: string;
  trackingCarrier?: string;
  timeline: { status: string; note?: string; at: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    items: [
      {
        _id: false,
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        sku: { type: String, required: true },
        title: { type: String, required: true },
        image: String,
        variantLabel: String,
        unitPrice: { type: Number, required: true },
        qty: { type: Number, required: true, min: 1 },
      },
    ],
    shippingAddress: { type: addressSchema, required: true },
    shippingMethod: { type: String, required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    shipping: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    couponCode: String,
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'], default: 'pending' },
    fulfillmentStatus: { type: String, enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
    stripeSessionId: { type: String, unique: true, sparse: true },
    paymentIntentId: String,
    refundedCents: { type: Number, default: 0 },
    paidAt: Date,
    trackingNumber: String,
    trackingCarrier: String,
    timeline: [{ _id: false, status: String, note: String, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true },
);
schema.index({ createdAt: -1 });
schema.index({ email: 1 });
schema.index({ paymentStatus: 1, fulfillmentStatus: 1 });

export const Order = model<IOrder>('Order', schema);
