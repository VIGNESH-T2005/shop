import { FilterQuery, Types } from 'mongoose';
import { Category } from '../models/Category';
import { Order } from '../models/Order';
import { IProduct, Product } from '../models/Product';
import { Review } from '../models/Review';
import { ApiError } from '../utils/ApiError';
import { paginate } from '../utils/http';
import { slugify } from '../utils/slug';

export interface ListParams {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  inStock?: 'true' | 'false';
  sort: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'popular';
  page: number;
  limit: number;
}

export async function listProducts(p: ListParams) {
  const filter: FilterQuery<IProduct> = { isActive: true };
  if (p.q) filter.$text = { $search: p.q };
  if (p.category) {
    const cat = await Category.findOne({ slug: p.category, isActive: true }).select('_id').lean();
    if (!cat) return { items: [], meta: paginate(p.page, p.limit, 0) };
    filter.category = cat._id;
  }
  if (p.brand) filter.brand = { $in: p.brand.split(',').map((b) => b.trim()).filter(Boolean) };
  if (p.minPrice !== undefined || p.maxPrice !== undefined) {
    filter.price = {
      ...(p.minPrice !== undefined ? { $gte: p.minPrice } : {}),
      ...(p.maxPrice !== undefined ? { $lte: p.maxPrice } : {}),
    };
  }
  if (p.rating) filter.ratingAverage = { $gte: p.rating };
  if (p.inStock === 'true') filter.totalStock = { $gt: 0 };

  const useText = Boolean(p.q) && p.sort === 'relevance';
  const sortMap: Record<string, any> = {
    newest: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    rating: { ratingAverage: -1, ratingCount: -1 },
    popular: { soldCount: -1, ratingCount: -1 },
  };
  const sort = useText ? { score: { $meta: 'textScore' } } : sortMap[p.sort] ?? sortMap.newest;

  let query = Product.find(filter, useText ? { score: { $meta: 'textScore' } } : undefined)
    .select('-description')
    .populate('category', 'name slug')
    .sort({ ...sort, _id: 1 } as any)
    .skip((p.page - 1) * p.limit)
    .limit(p.limit)
    .lean();
  const [items, total] = await Promise.all([query, Product.countDocuments(filter)]);
  return { items, meta: paginate(p.page, p.limit, total) };
}

export async function facets() {
  const [brands, price] = await Promise.all([
    Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$brand', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }]),
  ]);
  return {
    brands: brands.map((b) => ({ name: b._id as string, count: b.count as number })),
    price: { min: price[0]?.min ?? 0, max: price[0]?.max ?? 0 },
  };
}

export async function getBySlug(slug: string) {
  const product = await Product.findOne({ slug, isActive: true }).populate('category', 'name slug').lean();
  if (!product) throw new ApiError(404, 'Product not found.', 'NOT_FOUND');
  const related = await Product.find({ category: (product.category as any)._id, _id: { $ne: product._id }, isActive: true })
    .select('-description')
    .sort({ soldCount: -1 })
    .limit(4)
    .lean();
  return { product, related };
}

export async function getByIds(ids: string[]) {
  const valid = ids.filter((i) => Types.ObjectId.isValid(i)).slice(0, 100);
  return Product.find({ _id: { $in: valid }, isActive: true }).select('-description').lean();
}

export async function listReviews(productId: string, page: number, limit: number) {
  const [items, total] = await Promise.all([
    Review.find({ product: productId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Review.countDocuments({ product: productId }),
  ]);
  return { items, meta: paginate(page, limit, total) };
}

export async function addReview(userId: string, userName: string, slug: string, input: { rating: number; title?: string; body: string }) {
  const product = await Product.findOne({ slug, isActive: true }).select('_id').lean();
  if (!product) throw new ApiError(404, 'Product not found.', 'NOT_FOUND');
  const verified = Boolean(await Order.exists({ user: userId, paymentStatus: { $in: ['paid', 'partially_refunded'] }, 'items.product': product._id }));
  const review = await Review.create({ ...input, product: product._id, user: userId, userName, verifiedPurchase: verified });
  const [agg] = await Review.aggregate([
    { $match: { product: product._id } },
    { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
  ]);
  await Product.updateOne({ _id: product._id }, { $set: { ratingAverage: Math.round(agg.avg * 10) / 10, ratingCount: agg.n } });
  return review;
}

// ---------- admin ----------
async function uniqueSlug(title: string, ignoreId?: string) {
  const base = slugify(title);
  let slug = base;
  for (let n = 2; await Product.exists({ slug, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) }); n++) slug = `${base}-${n}`;
  return slug;
}
export async function createProduct(input: any) {
  if (!(await Category.exists({ _id: input.category }))) throw new ApiError(400, 'Choose a valid category.', 'BAD_CATEGORY');
  const p = new Product({ ...input, slug: await uniqueSlug(input.title) });
  await p.save();
  return p;
}
export async function updateProduct(id: string, input: any) {
  const p = await Product.findById(id);
  if (!p) throw new ApiError(404, 'Product not found.', 'NOT_FOUND');
  if (input.title !== p.title) p.slug = await uniqueSlug(input.title, id);
  p.set({ ...input, compareAtPrice: input.compareAtPrice ?? undefined });
  await p.save(); // pre-save recalculates totalStock
  return p;
}
export async function deleteProduct(id: string) {
  const p = await Product.findByIdAndDelete(id);
  if (!p) throw new ApiError(404, 'Product not found.', 'NOT_FOUND');
  await Review.deleteMany({ product: id });
}
export async function adminList(q: string | undefined, page: number, limit: number) {
  const filter: FilterQuery<IProduct> = q ? { title: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } : {};
  const [items, total] = await Promise.all([
    Product.find(filter).populate('category', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  return { items, meta: paginate(page, limit, total) };
}
