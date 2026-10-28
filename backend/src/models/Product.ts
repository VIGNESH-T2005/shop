import { Schema, model, Types } from 'mongoose';

export interface IVariant {
  sku: string;
  size?: string;
  color?: string;
  stock: number;
}
export interface IProduct {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  /** All money values are integer cents. */
  price: number;
  compareAtPrice?: number;
  images: string[];
  category: Types.ObjectId;
  brand: string;
  variants: IVariant[];
  ratingAverage: number;
  ratingCount: number;
  tags: string[];
  isActive: boolean;
  totalStock: number;
  soldCount: number;
  viewer?: { shape: 'sphere' | 'torus' | 'box' | 'cone' | 'knot' | 'capsule'; color: string; modelUrl?: string };
  createdAt: Date;
}

const variantSchema = new Schema<IVariant>(
  {
    sku: { type: String, required: true, trim: true, maxlength: 64 },
    size: { type: String, trim: true, maxlength: 40 },
    color: { type: String, trim: true, maxlength: 40 },
    stock: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

const schema = new Schema<IProduct>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true, maxlength: 5000 },
    price: { type: Number, required: true, min: 0, validate: Number.isInteger },
    compareAtPrice: { type: Number, min: 0, validate: Number.isInteger },
    images: { type: [String], default: [] },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: String, required: true, trim: true, maxlength: 80 },
    variants: {
      type: [variantSchema],
      validate: [(v: IVariant[]) => v.length > 0, 'At least one variant is required'],
    },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    tags: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    totalStock: { type: Number, default: 0, min: 0 },
    soldCount: { type: Number, default: 0 },
    viewer: {
      shape: { type: String, enum: ['sphere', 'torus', 'box', 'cone', 'knot', 'capsule'] },
      color: String,
      modelUrl: String,
    },
  },
  { timestamps: true },
);

schema.pre('save', function (next) {
  this.totalStock = this.variants.reduce((n, v) => n + v.stock, 0);
  next();
});

schema.index({ category: 1, isActive: 1 });
schema.index({ price: 1 });
schema.index({ brand: 1 });
schema.index({ isActive: 1, createdAt: -1 });
schema.index(
  { title: 'text', brand: 'text', tags: 'text', description: 'text' },
  { weights: { title: 10, brand: 5, tags: 4, description: 1 }, name: 'product_text' },
);

export const Product = model<IProduct>('Product', schema);
