import { Router } from 'express';
import * as A from '../controllers/auth.controller';
import * as S from '../controllers/shop.controller';
import * as D from '../controllers/admin.controller';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth';
import { authLimiter, paymentLimiter } from '../middleware/security';
import { upload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import * as Z from '../validators/schemas';
import { z } from 'zod';

const r = Router();
const adminOnly = [authenticate, requireRole('admin')];
const idP = { params: Z.idParam };

r.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } }));

// ---------- auth ----------
r.get('/auth/config', A.config);
r.post('/auth/register', authLimiter, validate({ body: Z.registerBody }), A.register);
r.post('/auth/login', authLimiter, validate({ body: Z.loginBody }), A.login);
r.post('/auth/google', authLimiter, validate({ body: Z.googleBody }), A.google);
r.post('/auth/refresh', A.refresh);
r.post('/auth/logout', A.logout);
r.get('/auth/me', authenticate, A.me);
r.post('/auth/verify-email', authLimiter, validate({ body: Z.verifyBody }), A.verifyEmail);
r.post('/auth/resend-verification', authLimiter, authenticate, A.resendVerification);
r.post('/auth/forgot-password', authLimiter, validate({ body: Z.forgotBody }), A.forgot);
r.post('/auth/reset-password', authLimiter, validate({ body: Z.resetBody }), A.reset);

// ---------- account ----------
r.patch('/account/profile', authenticate, validate({ body: Z.profileBody }), A.updateProfile);
r.post('/account/password', authLimiter, authenticate, validate({ body: Z.changePasswordBody }), A.changePassword);
r.post('/account/addresses', authenticate, validate({ body: Z.addressBody }), A.addAddress);
r.put('/account/addresses/:id', authenticate, validate({ ...idP, body: Z.addressBody.partial() }), A.updateAddress);
r.delete('/account/addresses/:id', authenticate, validate(idP), A.deleteAddress);

// ---------- catalog ----------
r.get('/products', validate({ query: Z.productQuery }), S.listProducts);
r.get('/products/facets', S.facets);
r.get('/products/by-ids', validate({ query: Z.idsQuery }), S.productsByIds);
r.get('/products/:slug', validate({ params: Z.slugParam }), S.productBySlug);
r.get('/products/:slug/reviews', validate({ params: Z.slugParam }), S.reviews);
r.post('/products/:slug/reviews', authenticate, validate({ params: Z.slugParam, body: Z.reviewBody }), S.addReview);
r.get('/categories', S.categories);

// ---------- cart & wishlist ----------
r.post('/cart/price', validate({ body: Z.cartPriceBody }), S.priceCartCtl);
r.get('/cart', authenticate, S.getCart);
r.put('/cart', authenticate, validate({ body: Z.cartReplaceBody }), S.putCart);
r.post('/cart/merge', authenticate, validate({ body: Z.cartReplaceBody }), S.mergeCart);
r.get('/wishlist', authenticate, S.getWishlist);
r.post('/wishlist/merge', authenticate, validate({ body: Z.wishlistMergeBody }), S.mergeWishlist);
r.post('/wishlist/:id', authenticate, validate(idP), S.addWishlist);
r.delete('/wishlist/:id', authenticate, validate(idP), S.removeWishlist);

// ---------- checkout & orders ----------
r.post('/checkout/session', paymentLimiter, optionalAuth, validate({ body: Z.checkoutBody }), S.checkout);
r.get('/orders/by-session', validate({ query: Z.lookupQuery }), S.orderBySession);
r.get('/orders', authenticate, S.myOrders);
r.get('/orders/:id', authenticate, validate(idP), S.orderById);
r.post('/orders/:id/cancel', paymentLimiter, authenticate, validate(idP), S.cancelOrder);

// ---------- admin ----------
const a = Router();
a.use(...adminOnly);
a.get('/stats', D.stats);
a.get('/products', validate({ query: Z.adminListQuery }), D.listProducts);
a.post('/products', validate({ body: Z.productBody }), D.createProduct);
a.put('/products/:id', validate({ ...idP, body: Z.productBody }), D.updateProduct);
a.delete('/products/:id', validate(idP), D.deleteProduct);
a.get('/categories', D.listCategories);
a.post('/categories', validate({ body: Z.categoryBody }), D.createCategory);
a.put('/categories/:id', validate({ ...idP, body: Z.categoryBody }), D.updateCategory);
a.delete('/categories/:id', validate(idP), D.deleteCategory);
a.get('/coupons', D.listCoupons);
a.post('/coupons', validate({ body: Z.couponBody }), D.createCoupon);
a.put('/coupons/:id', validate({ ...idP, body: Z.couponBody }), D.updateCoupon);
a.delete('/coupons/:id', validate(idP), D.deleteCoupon);
a.get('/users', validate({ query: Z.adminListQuery }), D.listUsers);
a.patch('/users/:id', validate({ ...idP, body: Z.userRoleBody }), D.updateUser);
a.get('/orders', validate({ query: Z.adminOrderQuery }), D.listOrders);
a.patch('/orders/:id', validate({ ...idP, body: Z.orderStatusBody }), D.updateOrder);
a.post('/orders/:id/refund', paymentLimiter, validate({ ...idP, body: Z.refundBody }), D.refundOrder);
a.post('/upload', upload.array('images', 6), D.upload);
r.use('/admin', a);

export default r;
void z;
