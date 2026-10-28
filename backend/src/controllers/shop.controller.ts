import { asyncHandler, ok } from '../utils/http';
import * as products from '../services/product.service';
import * as cart from '../services/cart.service';
import * as orders from '../services/order.service';
import { priceCart } from '../services/pricing.service';
import { Category } from '../models/Category';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';

// ----- catalog -----
export const listProducts = asyncHandler(async (req, res) => {
  const { items, meta } = await products.listProducts(req.query as any);
  ok(res, items, meta);
});
export const facets = asyncHandler(async (_req, res) => ok(res, await products.facets()));
export const productBySlug = asyncHandler(async (req, res) => ok(res, await products.getBySlug(req.params.slug)));
export const productsByIds = asyncHandler(async (req, res) => ok(res, await products.getByIds(String(req.query.ids).split(','))));
export const categories = asyncHandler(async (_req, res) => ok(res, await Category.find({ isActive: true }).sort({ name: 1 }).lean()));
export const reviews = asyncHandler(async (req, res) => {
  const p = await products.getBySlug(req.params.slug);
  const { items, meta } = await products.listReviews(String((p.product as any)._id), Number(req.query.page) || 1, 10);
  ok(res, items, meta);
});
export const addReview = asyncHandler(async (req, res) => {
  const u = await User.findById(req.user!.id).select('name');
  ok(res, await products.addReview(req.user!.id, u!.name, req.params.slug, req.body), undefined, 201);
});

// ----- cart & wishlist -----
export const priceCartCtl = asyncHandler(async (req, res) => ok(res, await priceCart(req.body.items, { couponCode: req.body.couponCode, shippingMethod: req.body.shippingMethod })));
export const getCart = asyncHandler(async (req, res) => ok(res, { items: await cart.getCart(req.user!.id) }));
export const putCart = asyncHandler(async (req, res) => ok(res, { items: await cart.replaceCart(req.user!.id, req.body.items) }));
export const mergeCart = asyncHandler(async (req, res) => ok(res, { items: await cart.mergeCart(req.user!.id, req.body.items) }));
export const getWishlist = asyncHandler(async (req, res) => ok(res, { productIds: await cart.getWishlist(req.user!.id) }));
export const addWishlist = asyncHandler(async (req, res) => ok(res, { productIds: await cart.addWishlist(req.user!.id, req.params.id) }));
export const removeWishlist = asyncHandler(async (req, res) => ok(res, { productIds: await cart.removeWishlist(req.user!.id, req.params.id) }));
export const mergeWishlist = asyncHandler(async (req, res) => ok(res, { productIds: await cart.mergeWishlist(req.user!.id, req.body.productIds) }));

// ----- checkout & orders -----
export const checkout = asyncHandler(async (req, res) =>
  ok(res, await orders.createCheckout({ ...req.body, userId: req.user?.id }), undefined, 201),
);
export const orderBySession = asyncHandler(async (req, res) => ok(res, await orders.getBySession(String(req.query.sessionId))));
export const myOrders = asyncHandler(async (req, res) => {
  const { items, meta } = await orders.listMine(req.user!.id, Number(req.query.page) || 1, 10);
  ok(res, items, meta);
});
export const orderById = asyncHandler(async (req, res) => ok(res, await orders.getForUser(req.params.id, req.user!)));
export const cancelOrder = asyncHandler(async (req, res) => ok(res, await orders.cancelOrder(req.params.id, req.user!)));
export const noop = () => {
  throw new ApiError(501, 'Not implemented', 'NOT_IMPLEMENTED');
};
