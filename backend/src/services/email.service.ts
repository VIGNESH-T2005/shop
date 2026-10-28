import nodemailer, { Transporter } from 'nodemailer';
import { env, isProd, isTest } from '../config/env';
import { logger } from '../utils/logger';
import { escapeHtml as esc } from '../utils/slug';
import { IOrder } from '../models/Order';

export interface Mail {
  to: string;
  subject: string;
  html: string;
}
let smtp: Transporter | null = null;

/** Provider abstraction: swap EMAIL_PROVIDER between smtp / resend / none. Returns whether a message was actually sent. */
export async function sendMail(mail: Mail, devHint?: string): Promise<boolean> {
  if (isTest) return false;
  try {
    if (env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [mail.to], subject: mail.subject, html: mail.html }),
      });
      if (!r.ok) throw new Error(`Resend responded ${r.status}`);
      return true;
    }
    if (env.EMAIL_PROVIDER === 'smtp' && env.SMTP_HOST) {
      smtp ??= nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? 587,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      });
      await smtp.sendMail({ from: env.EMAIL_FROM, ...mail });
      return true;
    }
    logger.warn(`Email provider not configured; "${mail.subject}" to ${mail.to} was not sent.`);
    if (!isProd && devHint) logger.info(`[dev] ${devHint}`);
    return false;
  } catch (e) {
    logger.error('Email send failed:', (e as Error).message);
    return false;
  }
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const shell = (title: string, body: string) =>
  `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1626"><h2 style="margin:0 0 16px">${esc(title)}</h2>${body}<p style="color:#888;font-size:12px;margin-top:32px">Shop-Zone</p></div>`;
const button = (href: string, label: string) =>
  `<p><a href="${esc(href)}" style="background:#f2b84b;color:#1a1626;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">${esc(label)}</a></p>`;

export const mailer = {
  verifyEmail(to: string, name: string, token: string) {
    const link = `${env.CLIENT_URL}/verify-email?token=${token}`;
    return sendMail(
      { to, subject: 'Verify your Shop-Zone email', html: shell(`Welcome, ${name}`, `<p>Confirm your email to finish setting up your account.</p>${button(link, 'Verify email')}<p>This link expires in 24 hours.</p>`) },
      `verify link for ${to}: ${link}`,
    );
  },
  resetPassword(to: string, token: string) {
    const link = `${env.CLIENT_URL}/reset-password?token=${token}`;
    return sendMail(
      { to, subject: 'Reset your Shop-Zone password', html: shell('Reset your password', `<p>Use the button below to choose a new password. If you did not ask for this, ignore this email.</p>${button(link, 'Choose a new password')}<p>This link expires in 1 hour.</p>`) },
      `reset link for ${to}: ${link}`,
    );
  },
  orderConfirmation(order: IOrder) {
    const rows = order.items.map((i) => `<tr><td>${esc(i.title)}${i.variantLabel ? ` (${esc(i.variantLabel)})` : ''} × ${i.qty}</td><td align="right">${money(i.unitPrice * i.qty)}</td></tr>`).join('');
    const body = `<p>Thanks for your order <b>${esc(order.orderNumber)}</b>.</p><table width="100%" cellpadding="6">${rows}<tr><td>Shipping</td><td align="right">${money(order.shipping)}</td></tr><tr><td>Tax</td><td align="right">${money(order.tax)}</td></tr><tr><td><b>Total</b></td><td align="right"><b>${money(order.total)}</b></td></tr></table>${button(`${env.CLIENT_URL}/shop`, 'Keep shopping')}`;
    return sendMail({ to: order.email, subject: `Order ${order.orderNumber} confirmed`, html: shell('Order confirmed', body) });
  },
  shipped(order: IOrder) {
    const t = order.trackingNumber ? `<p>Tracking: <b>${esc(order.trackingNumber)}</b>${order.trackingCarrier ? ` (${esc(order.trackingCarrier)})` : ''}</p>` : '';
    return sendMail({ to: order.email, subject: `Order ${order.orderNumber} has shipped`, html: shell('Your order is on its way', `<p>Order <b>${esc(order.orderNumber)}</b> has shipped.</p>${t}`) });
  },
  refunded(order: IOrder, cents: number) {
    return sendMail({ to: order.email, subject: `Refund for order ${order.orderNumber}`, html: shell('Refund issued', `<p>We refunded ${money(cents)} for order <b>${esc(order.orderNumber)}</b>. It can take 5–10 days to appear on your statement.</p>`) });
  },
};
