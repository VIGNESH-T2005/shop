import { FilterQuery } from 'mongoose';
import { cloudinary, cloudinaryConfigured } from '../config/cloudinary';
import { Category } from '../models/Category';
import { Coupon } from '../models/Coupon';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { IUser, User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { paginate } from '../utils/http';
import { escapeRegex, slugify } from '../utils/slug';

export async function stats() {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const paid = { paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] } };
  const [revenueByDay, totals, topProducts, lowStock, customers, toFulfil] = await Promise.all([
    Order.aggregate([
      { $match: { ...paid, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: { $subtract: ['$total', '$refundedCents'] } }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([{ $match: paid }, { $group: { _id: null, revenue: { $sum: { $subtract: ['$total', '$refundedCents'] } }, orders: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { paymentStatus: { $in: ['paid', 'partially_refunded'] } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', title: { $first: '$items.title' }, units: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.qty'] } } } },
      { $sort: { units: -1 } },
      { $limit: 8 },
    ]),
    Product.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$variants' },
      { $match: { 'variants.stock': { $lte: 5 } } },
      { $project: { title: 1, slug: 1, sku: '$variants.sku', stock: '$variants.stock' } },
      { $sort: { stock: 1 } },
      { $limit: 20 },
    ]),
    User.countDocuments({ role: 'customer' }),
    Order.countDocuments({ fulfillmentStatus: 'processing' }),
  ]);
  return {
    revenueByDay: revenueByDay.map((d) => ({ date: d._id as string, revenue: d.revenue as number, orders: d.orders as number })),
    totalRevenue: totals[0]?.revenue ?? 0,
    totalOrders: totals[0]?.orders ?? 0,
    customers,
    toFulfil,
    topProducts: topProducts.map((t) => ({ productId: String(t._id), title: t.title as string, units: t.units as number, revenue: t.revenue as number })),
    lowStock,
  };
}

// ---------- categories ----------
export async function saveCategory(id: string | undefined, input: any) {
  const data = { ...input, image: input.image || undefined };
  if (!id) {
    let slug = slugify(input.name);
    for (let n = 2; await Category.exists({ slug }); n++) slug = `${slugify(input.name)}-${n}`;
    return Category.create({ ...data, slug });
  }
  const c = await Category.findByIdAndUpdate(id, data, { new: true });
  if (!c) throw new ApiError(404, 'Category not found.', 'NOT_FOUND');
  return c;
}
export async function deleteCategory(id: string) {
  if (await Product.exists({ category: id })) throw new ApiError(409, 'Move or delete this category’s products first.', 'IN_USE');
  await Category.findByIdAndDelete(id);
}

// ---------- coupons ----------
export async function saveCoupon(id: string | undefined, input: any) {
  if (input.type === 'percent' && input.value > 100) throw new ApiError(400, 'A percentage coupon cannot exceed 100.', 'BAD_VALUE');
  if (!id) return Coupon.create(input);
  const c = await Coupon.findByIdAndUpdate(id, input, { new: true });
  if (!c) throw new ApiError(404, 'Coupon not found.', 'NOT_FOUND');
  return c;
}

// ---------- users ----------
export async function listUsers(q: string | undefined, page: number, limit: number) {
  const filter: FilterQuery<IUser> = q ? { $or: [{ email: { $regex: escapeRegex(q), $options: 'i' } }, { name: { $regex: escapeRegex(q), $options: 'i' } }] } : {};
  const [items, total] = await Promise.all([
    User.find(filter).select('name email role isActive emailVerified createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return { items, meta: paginate(page, limit, total) };
}
export async function updateUser(actorId: string, id: string, input: { role?: 'customer' | 'admin'; isActive?: boolean }) {
  if (actorId === id && (input.role === 'customer' || input.isActive === false)) {
    throw new ApiError(400, 'You cannot remove your own admin access.', 'SELF_DEMOTE');
  }
  const u = await User.findByIdAndUpdate(id, { $set: input, ...(input.isActive === false ? { $set: { ...input, sessions: [] } } : {}) }, { new: true }).select('name email role isActive');
  if (!u) throw new ApiError(404, 'User not found.', 'NOT_FOUND');
  return u;
}

// ---------- uploads ----------
export async function uploadImages(files: Express.Multer.File[]) {
  if (!cloudinaryConfigured()) {
    throw new ApiError(503, 'Image uploads are not set up. Add the CLOUDINARY_* variables, or paste image URLs instead.', 'CLOUDINARY_NOT_CONFIGURED');
  }
  return Promise.all(
    files.map(
      (f) =>
        new Promise<string>((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ folder: 'shop-zone/products', resource_type: 'image' }, (err, res) => (err || !res ? reject(err) : resolve(res.secure_url)))
            .end(f.buffer);
        }),
    ),
  );
}
