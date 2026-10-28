import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { User } from '../models/User';
import { clearDb, startDb, stopDb } from './helpers';

const app = createApp();
const H = { 'X-Requested-With': 'shop-zone' };
const creds = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'correct-horse-7' };
const cookiesOf = (res: request.Response) => (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]);

describe('auth', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);

  it('registers, hashes the password and sets httpOnly cookies', async () => {
    const res = await request(app).post('/api/auth/register').set(H).send(creds);
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(creds.email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect((res.headers['set-cookie'] as unknown as string[]).every((c) => /HttpOnly/i.test(c))).toBe(true);
    const u = await User.findOne({ email: creds.email }).select('+passwordHash');
    expect(u?.passwordHash).toMatch(/^\$2[aby]\$/);
  });
  it('rejects weak passwords and duplicate emails', async () => {
    expect((await request(app).post('/api/auth/register').set(H).send({ ...creds, password: 'short' })).status).toBe(400);
    await request(app).post('/api/auth/register').set(H).send(creds);
    const dup = await request(app).post('/api/auth/register').set(H).send(creds);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_EXISTS');
  });
  it('blocks state-changing requests without the CSRF header', async () => {
    expect((await request(app).post('/api/auth/login').send({ email: creds.email, password: 'x' })).status).toBe(403);
  });
  it('logs in with correct credentials only', async () => {
    await request(app).post('/api/auth/register').set(H).send(creds);
    expect((await request(app).post('/api/auth/login').set(H).send({ email: creds.email, password: 'wrong-pass-1' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').set(H).send({ email: creds.email, password: creds.password })).status).toBe(200);
  });
  it('protects /auth/me', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const reg = await request(app).post('/api/auth/register').set(H).send(creds);
    const me = await request(app).get('/api/auth/me').set('Cookie', cookiesOf(reg));
    expect(me.status).toBe(200);
    expect(me.body.data.user.hasPassword).toBe(true);
  });
  it('rotates refresh tokens and revokes everything when one is reused', async () => {
    const reg = await request(app).post('/api/auth/register').set(H).send(creds);
    const first = cookiesOf(reg);
    const rt1 = first.find((c) => c.startsWith('sz_rt='))!;
    const r1 = await request(app).post('/api/auth/refresh').set(H).set('Cookie', [rt1]);
    expect(r1.status).toBe(200);
    const rt2 = cookiesOf(r1).find((c) => c.startsWith('sz_rt='))!;
    expect(rt2).not.toBe(rt1);
    // replaying the old token is treated as theft
    expect((await request(app).post('/api/auth/refresh').set(H).set('Cookie', [rt1])).status).toBe(401);
    // ...and the newer token no longer works either
    expect((await request(app).post('/api/auth/refresh').set(H).set('Cookie', [rt2])).status).toBe(401);
  });
  it('resets a password with a valid token and revokes sessions', async () => {
    await request(app).post('/api/auth/register').set(H).send(creds);
    const { randomToken, sha256 } = await import('../utils/tokens');
    const token = randomToken();
    await User.updateOne({ email: creds.email }, { resetTokenHash: sha256(token), resetTokenExpires: new Date(Date.now() + 60000) });
    expect((await request(app).post('/api/auth/reset-password').set(H).send({ token, password: 'brand-new-pass-1' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').set(H).send({ email: creds.email, password: 'brand-new-pass-1' })).status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').set(H).send({ token, password: 'another-pass-22' })).status).toBe(400);
  });
  it('shows a clear setup error instead of simulating Google login', async () => {
    const cfg = await request(app).get('/api/auth/config');
    expect(cfg.body.data.googleEnabled).toBe(false);
    const res = await request(app).post('/api/auth/google').set(H).send({ credential: 'x'.repeat(40) });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('GOOGLE_NOT_CONFIGURED');
  });
});
