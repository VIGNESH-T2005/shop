import { asyncHandler, ok } from '../utils/http';
import * as admin from '../services/admin.service';
import * as products from '../services/product.service';
import * as orders from '../services/order.service';
import { Category } from '../models/Category';
import { Coupon } from '../models/Coupon';
import { ApiError } from '../utils/ApiError';

export const stats = asyncHandler(async (_req, res) => ok(res, await admin.stats()));

export const listProducts = asyncHandler(async (req, res) => {
  const q = req.query as any;
  const { items, meta } = await products.adminList(q.q, q.page, q.limit);
  ok(res, items, meta);
});
export const createProduct = asyncHandler(async (req, res) => ok(res, await products.createProduct(req.body), undefined, 201));
export const updateProduct = asyncHandler(async (req, res) => ok(res, await products.updateProduct(req.params.id, req.body)));
export const deleteProduct = asyncHandler(async (req, res) => {
  await products.deleteProduct(req.params.id);
  ok(res, { deleted: true });
});

export const listCategories = asyncHandler(async (_req, res) => ok(res, await Category.find().sort({ name: 1 }).lean()));
export const createCategory = asyncHandler(async (req, res) => ok(res, await admin.saveCategory(undefined, req.body), undefined, 201));
export const updateCategory = asyncHandler(async (req, res) => ok(res, await admin.saveCategory(req.params.id, req.body)));
export const deleteCategory = asyncHandler(async (req, res) => {
  await admin.deleteCategory(req.params.id);
  ok(res, { deleted: true });
});

export const listCoupons = asyncHandler(async (_req, res) => ok(res, await Coupon.find().sort({ createdAt: -1 }).lean()));
export const createCoupon = asyncHandler(async (req, res) => ok(res, await admin.saveCoupon(undefined, req.body), undefined, 201));
export const updateCoupon = asyncHandler(async (req, res) => ok(res, await admin.saveCoupon(req.params.id, req.body)));
export const deleteCoupon = asyncHandler(async (req, res) => {
  await Coupon.findByIdAndDelete(req.params.id);
  ok(res, { deleted: true });
});

export const listUsers = asyncHandler(async (req, res) => {
  const q = req.query as any;
  const { items, meta } = await admin.listUsers(q.q, q.page, q.limit);
  ok(res, items, meta);
});
export const updateUser = asyncHandler(async (req, res) => ok(res, await admin.updateUser(req.user!.id, req.params.id, req.body)));

export const listOrders = asyncHandler(async (req, res) => {
  const { items, meta } = await orders.adminListOrders(req.query as any);
  ok(res, items, meta);
});
export const updateOrder = asyncHandler(async (req, res) => ok(res, await orders.updateFulfillment(req.params.id, req.body)));
export const refundOrder = asyncHandler(async (req, res) => ok(res, await orders.refundOrder(req.params.id, req.body.amountCents)));

export const upload = asyncHandler(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw new ApiError(400, 'Choose at least one image.', 'NO_FILE');
  ok(res, { urls: await admin.uploadImages(files) });
});
