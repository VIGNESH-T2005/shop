import { Schema, model, Types } from 'mongoose';

export interface IAddress {
  _id?: Types.ObjectId;
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
export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  avatar?: string;
  role: 'customer' | 'admin';
  emailVerified: boolean;
  isActive: boolean;
  verifyTokenHash?: string;
  verifyTokenExpires?: Date;
  resetTokenHash?: string;
  resetTokenExpires?: Date;
  sessions: { jti: string; expiresAt: Date }[];
  addresses: IAddress[];
  wishlist: Types.ObjectId[];
  createdAt: Date;
}

export const addressSchema = new Schema<IAddress>({
  label: { type: String, trim: true, maxlength: 40 },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  line1: { type: String, required: true, trim: true, maxlength: 150 },
  line2: { type: String, trim: true, maxlength: 150 },
  city: { type: String, required: true, trim: true, maxlength: 80 },
  state: { type: String, required: true, trim: true, maxlength: 80 },
  postalCode: { type: String, required: true, trim: true, maxlength: 20 },
  country: { type: String, required: true, trim: true, maxlength: 2, uppercase: true, default: 'US' },
  phone: { type: String, trim: true, maxlength: 30 },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    avatar: String,
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    emailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    verifyTokenHash: { type: String, select: false },
    verifyTokenExpires: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    sessions: { type: [{ _id: false, jti: String, expiresAt: Date }], select: false, default: [] },
    addresses: { type: [addressSchema], default: [] },
    wishlist: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true },
);
userSchema.index({ verifyTokenHash: 1 }, { sparse: true });
userSchema.index({ resetTokenHash: 1 }, { sparse: true });

export const User = model<IUser>('User', userSchema);

/** Shape returned to the client. */
export const publicUser = (u: IUser, hasPassword = false) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  avatar: u.avatar,
  emailVerified: u.emailVerified,
  hasPassword,
  addresses: u.addresses,
  createdAt: u.createdAt,
});
