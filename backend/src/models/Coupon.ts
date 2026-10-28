import { Schema, model } from 'mongoose';

export interface ICoupon {
  code: string;
  description?: string;
  type: 'percent' | 'fixed';
  /** percent: 1-100, fixed: integer cents */
  value: number;
  minSubtotal: number;
  maxDiscount?: number;
  expiresAt?: Date;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
}
const schema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 40 },
    description: { type: String, maxlength: 200 },
    type: { type: String, enum: ['percent', 'fixed'], required: true },
    value: { type: Number, required: true, min: 1 },
    minSubtotal: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, min: 0 },
    expiresAt: Date,
    usageLimit: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const Coupon = model<ICoupon>('Coupon', schema);
