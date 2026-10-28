import { env } from '../config/env';
import { asyncHandler, ok } from '../utils/http';
import * as auth from '../services/auth.service';
import { User, publicUser } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { clearAuthCookies } from '../utils/cookies';

export const config = asyncHandler(async (_req, res) => ok(res, { googleEnabled: auth.googleEnabled(), googleClientId: auth.googleEnabled() ? env.GOOGLE_CLIENT_ID : null }));
export const register = asyncHandler(async (req, res) => ok(res, { user: await auth.register(res, req.body) }, undefined, 201));
export const login = asyncHandler(async (req, res) => ok(res, { user: await auth.login(res, req.body) }));
export const google = asyncHandler(async (req, res) => ok(res, { user: await auth.googleLogin(res, req.body.credential) }));
export const refresh = asyncHandler(async (req, res) => ok(res, { user: await auth.refresh(req, res) }));
export const logout = asyncHandler(async (req, res) => {
  await auth.logout(req, res);
  ok(res, { loggedOut: true });
});
export const me = asyncHandler(async (req, res) => ok(res, { user: await auth.me(req.user!.id) }));
export const verifyEmail = asyncHandler(async (req, res) => {
  await auth.verifyEmail(req.body.token);
  ok(res, { verified: true });
});
export const resendVerification = asyncHandler(async (req, res) => {
  await auth.resendVerification(req.user!.id);
  ok(res, { sent: true });
});
export const forgot = asyncHandler(async (req, res) => {
  await auth.forgotPassword(req.body.email);
  ok(res, { message: 'If that email has an account, a reset link is on its way.' });
});
export const reset = asyncHandler(async (req, res) => {
  await auth.resetPassword(req.body.token, req.body.password);
  clearAuthCookies(res);
  ok(res, { reset: true });
});

// account
export const changePassword = asyncHandler(async (req, res) => {
  await auth.changePassword(res, req.user!.id, req.body.currentPassword, req.body.newPassword);
  ok(res, { changed: true });
});
export const updateProfile = asyncHandler(async (req, res) => {
  const u = await User.findByIdAndUpdate(req.user!.id, { name: req.body.name }, { new: true });
  if (!u) throw new ApiError(404, 'Account not found.', 'NOT_FOUND');
  ok(res, { user: publicUser(u) });
});
export const addAddress = asyncHandler(async (req, res) => {
  const u = await User.findById(req.user!.id);
  if (!u) throw new ApiError(404, 'Account not found.', 'NOT_FOUND');
  if (u.addresses.length >= 10) throw new ApiError(400, 'You can save up to 10 addresses.', 'LIMIT');
  if (req.body.isDefault || u.addresses.length === 0) u.addresses.forEach((a) => (a.isDefault = false));
  u.addresses.push({ ...req.body, isDefault: req.body.isDefault || u.addresses.length === 0 });
  await u.save();
  ok(res, { addresses: u.addresses }, undefined, 201);
});
export const updateAddress = asyncHandler(async (req, res) => {
  const u = await User.findById(req.user!.id);
  const a = u?.addresses.find((x) => String(x._id) === req.params.id);
  if (!u || !a) throw new ApiError(404, 'Address not found.', 'NOT_FOUND');
  if (req.body.isDefault) u.addresses.forEach((x) => (x.isDefault = false));
  Object.assign(a, req.body);
  await u.save();
  ok(res, { addresses: u.addresses });
});
export const deleteAddress = asyncHandler(async (req, res) => {
  const u = await User.findByIdAndUpdate(req.user!.id, { $pull: { addresses: { _id: req.params.id } } }, { new: true });
  ok(res, { addresses: u?.addresses ?? [] });
});
