import { Types } from 'mongoose';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { CartItemInput } from './pricing.service';

const toInputs = (items: { product: Types.ObjectId; sku: string; qty: number }[]): CartItemInput[] =>
  items.map((i) => ({ productId: String(i.product), sku: i.sku, qty: i.qty }));

function mergeItems(a: CartItemInput[], b: CartItemInput[]): CartItemInput[] {
  const m = new Map<string, CartItemInput>();
  for (const i of [...a, ...b]) {
    const k = `${i.productId}:${i.sku}`;
    const prev = m.get(k);
    m.set(k, { ...i, qty: Math.min(99, Math.max(prev?.qty ?? 0, i.qty)) }); // same item on both sides: keep the larger quantity
  }
  return [...m.values()];
}

export async function getCart(userId: string) {
  const cart = await Cart.findOne({ user: userId }).lean();
  return cart ? toInputs(cart.items) : [];
}
export async function replaceCart(userId: string, items: CartItemInput[]) {
  const cart = await Cart.findOneAndUpdate(
    { user: userId },
    { $set: { items: items.map((i) => ({ product: i.productId, sku: i.sku, qty: i.qty })) } },
    { upsert: true, new: true },
  ).lean();
  return toInputs(cart!.items);
}
export async function mergeCart(userId: string, guestItems: CartItemInput[]) {
  return replaceCart(userId, mergeItems(await getCart(userId), guestItems));
}
export const clearCart = (userId: string) => Cart.deleteOne({ user: userId });

// ---------- wishlist ----------
export async function getWishlist(userId: string) {
  const u = await User.findById(userId).select('wishlist').lean();
  return (u?.wishlist ?? []).map(String);
}
export async function addWishlist(userId: string, productId: string) {
  await User.updateOne({ _id: userId }, { $addToSet: { wishlist: productId } });
  return getWishlist(userId);
}
export async function removeWishlist(userId: string, productId: string) {
  await User.updateOne({ _id: userId }, { $pull: { wishlist: productId } });
  return getWishlist(userId);
}
export async function mergeWishlist(userId: string, productIds: string[]) {
  const valid = await Product.find({ _id: { $in: productIds }, isActive: true }).distinct('_id');
  if (valid.length) await User.updateOne({ _id: userId }, { $addToSet: { wishlist: { $each: valid } } });
  return getWishlist(userId);
}
