import { Schema, model } from 'mongoose';

export interface ICategory {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  isActive: boolean;
}
const schema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, maxlength: 500 },
    image: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const Category = model<ICategory>('Category', schema);
