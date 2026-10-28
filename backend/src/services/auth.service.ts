import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { IUser, User, publicUser } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from '../utils/cookies';
import { REFRESH_TTL_SEC, randomToken, sha256, signAccess, signRefresh, verifyRefresh } from '../utils/tokens';
import { mailer } from './email.service';

const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-password', 10);
const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;
export const googleEnabled = () => Boolean(googleClient);

async function issueSession(res: Response, user: Pick<IUser, '_id' | 'role'>) {
  const jti = crypto.randomUUID();
  await User.updateOne(
    { _id: user._id },
    { $push: { sessions: { $each: [{ jti, expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000) }], $slice: -10 } } },
  );
  setAuthCookies(res, signAccess(String(user._id), user.role), signRefresh(String(user._id), jti));
}

export async function register(res: Response, input: { name: string; email: string; password: string }) {
  const existing = await User.findOne({ email: input.email }).select('+passwordHash');
  if (existing) {
    throw new ApiError(
      409,
      existing.googleId && !existing.passwordHash
        ? 'This email is registered with Google. Use "Continue with Google" to sign in.'
        : 'An account with this email already exists. Try signing in.',
      'EMAIL_EXISTS',
    );
  }
  const token = randomToken();
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 12),
    verifyTokenHash: sha256(token),
    verifyTokenExpires: new Date(Date.now() + 24 * 3600 * 1000),
  });
  void mailer.verifyEmail(user.email, user.name, token);
  await issueSession(res, user);
  return publicUser(user, true);
}

export async function login(res: Response, input: { email: string; password: string }) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const matches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH); // constant-ish time either way
  if (user && !user.passwordHash && user.googleId) {
    throw new ApiError(400, 'This account uses Google. Use "Continue with Google" to sign in.', 'GOOGLE_ACCOUNT');
  }
  if (!user || !matches) throw new ApiError(401, 'Incorrect email or password.', 'BAD_CREDENTIALS');
  if (!user.isActive) throw new ApiError(403, 'This account has been disabled.', 'ACCOUNT_DISABLED');
  await issueSession(res, user);
  return publicUser(user, true);
}

/** Refresh-token rotation with reuse detection: a refresh token works exactly once. */
export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new ApiError(401, 'Please sign in to continue.', 'UNAUTHENTICATED');
  let payload: { sub: string; jti: string };
  try {
    payload = verifyRefresh(token);
  } catch {
    clearAuthCookies(res);
    throw new ApiError(401, 'Your session has expired. Please sign in again.', 'TOKEN_EXPIRED');
  }
  const user = await User.findById(payload.sub).select('+sessions');
  if (!user || !user.isActive) {
    clearAuthCookies(res);
    throw new ApiError(401, 'Please sign in to continue.', 'UNAUTHENTICATED');
  }
  if (!user.sessions.some((s) => s.jti === payload.jti)) {
    await User.updateOne({ _id: user._id }, { $set: { sessions: [] } }); // token reuse => revoke every session
    clearAuthCookies(res);
    throw new ApiError(401, 'Your session was ended for security. Please sign in again.', 'TOKEN_REUSED');
  }
  await User.updateOne({ _id: user._id }, { $pull: { sessions: { jti: payload.jti } } });
  await issueSession(res, user);
  return publicUser(user);
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const p = verifyRefresh(token);
      await User.updateOne({ _id: p.sub }, { $pull: { sessions: { jti: p.jti } } });
    } catch {
      /* already invalid */
    }
  }
  clearAuthCookies(res);
}

export async function me(userId: string) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !user.isActive) throw new ApiError(401, 'Please sign in to continue.', 'UNAUTHENTICATED');
  return publicUser(user, Boolean(user.passwordHash));
}

export async function verifyEmail(token: string) {
  const user = await User.findOne({ verifyTokenHash: sha256(token), verifyTokenExpires: { $gt: new Date() } });
  if (!user) throw new ApiError(400, 'This verification link is invalid or has expired.', 'BAD_TOKEN');
  user.emailVerified = true;
  user.verifyTokenHash = undefined;
  user.verifyTokenExpires = undefined;
  await user.save();
}

export async function resendVerification(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Account not found.', 'NOT_FOUND');
  if (user.emailVerified) return;
  const token = randomToken();
  user.verifyTokenHash = sha256(token);
  user.verifyTokenExpires = new Date(Date.now() + 24 * 3600 * 1000);
  await user.save();
  void mailer.verifyEmail(user.email, user.name, token);
}

export async function forgotPassword(email: string) {
  const user = await User.findOne({ email, isActive: true });
  if (!user) return; // never reveal whether the email exists
  const token = randomToken();
  user.resetTokenHash = sha256(token);
  user.resetTokenExpires = new Date(Date.now() + 3600 * 1000);
  await user.save();
  void mailer.resetPassword(user.email, token);
}

export async function resetPassword(token: string, password: string) {
  const user = await User.findOne({ resetTokenHash: sha256(token), resetTokenExpires: { $gt: new Date() } });
  if (!user) throw new ApiError(400, 'This reset link is invalid or has expired.', 'BAD_TOKEN');
  user.passwordHash = await bcrypt.hash(password, 12);
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  user.emailVerified = true; // the reset email proves ownership
  user.sessions = [];
  await user.save();
}

export async function changePassword(res: Response, userId: string, currentPassword: string | undefined, newPassword: string) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new ApiError(404, 'Account not found.', 'NOT_FOUND');
  if (user.passwordHash) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new ApiError(400, 'Your current password is incorrect.', 'BAD_CREDENTIALS');
    }
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.sessions = [];
  await user.save();
  await issueSession(res, user); // keep this device signed in, drop every other session
}

export async function googleLogin(res: Response, credential: string) {
  if (!googleClient) {
    throw new ApiError(503, 'Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID to the server environment.', 'GOOGLE_NOT_CONFIGURED');
  }
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, 'Google sign-in could not be verified. Please try again.', 'GOOGLE_INVALID');
  }
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new ApiError(401, 'Your Google account has no verified email address.', 'GOOGLE_UNVERIFIED');
  }
  const email = payload.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] }).select('+passwordHash');
  if (user) {
    if (!user.isActive) throw new ApiError(403, 'This account has been disabled.', 'ACCOUNT_DISABLED');
    if (user.googleId && user.googleId !== payload.sub) {
      throw new ApiError(409, 'This email is linked to a different Google account.', 'GOOGLE_CONFLICT');
    }
    if (!user.googleId) {
      // Account linking: an existing email/password account gains Google sign-in.
      // If its email was never verified, someone else may have registered it first, so drop that password.
      const unverified = !user.emailVerified;
      const update: Record<string, any> = {
        $set: { googleId: payload.sub, emailVerified: true, ...(user.avatar ? {} : { avatar: payload.picture }) },
      };
      if (unverified) {
        update.$unset = { passwordHash: 1 };
        update.$set.sessions = [];
      }
      await User.updateOne({ _id: user._id }, update);
      user = await User.findById(user._id).select('+passwordHash');
    }
  } else {
    user = await User.create({
      name: payload.name ?? email.split('@')[0],
      email,
      googleId: payload.sub,
      avatar: payload.picture,
      emailVerified: true,
    });
  }
  await issueSession(res, user!);
  return publicUser(user!, Boolean(user!.passwordHash));
}
