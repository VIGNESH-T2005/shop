import { Schema, model, Types } from 'mongoose';

export interface ICart {
  user: Types.ObjectId;
  items: { product: Types.ObjectId; sku: string; qty: number }[];
}
const schema = new Schema<ICart>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
      {
        _id: false,
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        sku: { type: String, required: true },
        qty: { type: Number, required: true, min: 1, max: 99 },
      },
    ],
  },
  { timestamps: true },
);
export const Cart = model<ICart>('Cart', schema);
