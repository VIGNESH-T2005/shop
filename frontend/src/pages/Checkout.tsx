import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Field, SelectField } from '../components/Field';
import { EmptyState } from '../components/StateViews';
import { Totals } from '../components/Totals';
import { Skeleton } from '../components/Skeleton';
import { usePricedCart } from '../hooks/usePricedCart';
import { ApiError, api } from '../lib/api';
import { money } from '../lib/format';
import { useAuth } from '../store/auth';
import { useCart } from '../store/cart';
import { useCheckout } from '../store/checkout';
import { toast } from '../store/ui';
import type { Address } from '../types';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  fullName: z.string().trim().min(2, 'Enter the recipient’s name'),
  line1: z.string().trim().min(3, 'Enter a street address'),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'Enter a city'),
  state: z.string().trim().min(1, 'Enter a state or region'),
  postalCode: z.string().trim().min(3, 'Enter a postal code'),
  country: z.string().length(2),
  phone: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;
const STEPS = ['Shipping address', 'Delivery', 'Payment', 'Review'];
const METHODS = [
  { id: 'standard' as const, label: 'Standard', eta: '3–5 business days', price: '$5.00, free over $100' },
  { id: 'express' as const, label: 'Express', eta: '1–2 business days', price: '$15.00' },
];

export default function Checkout() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const user = useAuth((s) => s.user);
  const items = useCart((s) => s.items);
  const co = useCheckout();
  const [step, setStep] = useState(0);
  const [couponInput, setCouponInput] = useState(co.coupon);
  const priced = usePricedCart({ couponCode: co.coupon, shippingMethod: co.method });
  const d = priced.data;

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: co.email, country: 'US', ...(co.address ?? {}) } as FormValues,
  });
  useEffect(() => { if (sp.get('cancelled')) toast.info('Payment was cancelled. Your cart is still here.'); }, [sp]);
  useEffect(() => { if (user && !co.email) setValue('email', user.email); }, [user]); // eslint-disable-line

  const pay = useMutation({
    mutationFn: () => {
      const { email, address, method, coupon } = useCheckout.getState();
      return api<{ url: string }>('/checkout/session', { method: 'POST', body: { items, email, shippingAddress: address, shippingMethod: method, couponCode: coupon || undefined } });
    },
    onSuccess: (r) => window.location.assign(r.url),
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'CART_CHANGED') { toast.error(e.message); nav('/cart'); }
      else toast.error((e as Error).message);
    },
  });

  if (!items.length) return <div className="container-x py-20"><EmptyState title="Nothing to check out" cta={{ to: '/shop', label: 'Browse the shop' }} /></div>;

  const onAddress = (v: FormValues) => {
    const { email, ...address } = v;
    co.set({ email, address: address as Address });
    setStep(1);
  };
  const applyCoupon = () => { co.set({ coupon: couponInput.trim().toUpperCase() }); };
  const addr = co.address;

  return (
    <div className="container-x py-10">
      <h1 className="text-4xl font-bold">Checkout</h1>
      <ol className="mt-6 flex flex-wrap gap-2" aria-label="Checkout steps">
        {STEPS.map((s, i) => (
          <li key={s}><button disabled={i > step} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className={`chip ${i === step ? '!border-brass !text-ink' : ''} ${i < step ? '!text-ok' : ''}`}>{i < step ? '✓ ' : ''}{s}</button></li>
        ))}
      </ol>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="card p-6 sm:p-8">
          {step === 0 && (
            <form onSubmit={handleSubmit(onAddress)} className="grid gap-4 sm:grid-cols-2" noValidate>
              <h2 className="sm:col-span-2 font-sans text-xl font-bold">Where should we send it?</h2>
              {user && user.addresses.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="saved">Use a saved address</label>
                  <select id="saved" className="input" defaultValue="" onChange={(e) => { const a = user.addresses.find((x) => x._id === e.target.value); if (a) reset({ email: user.email, ...a } as FormValues); }}>
                    <option value="">Choose…</option>{user.addresses.map((a) => <option key={a._id} value={a._id}>{a.label || a.line1}, {a.city}</option>)}
                  </select>
                </div>
              )}
              <Field className="sm:col-span-2" label="Email for your receipt" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
              <Field className="sm:col-span-2" label="Full name" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
              <Field className="sm:col-span-2" label="Address" autoComplete="address-line1" error={errors.line1?.message} {...register('line1')} />
              <Field className="sm:col-span-2" label="Apartment, suite (optional)" autoComplete="address-line2" {...register('line2')} />
              <Field label="City" autoComplete="address-level2" error={errors.city?.message} {...register('city')} />
              <Field label="State / region" autoComplete="address-level1" error={errors.state?.message} {...register('state')} />
              <Field label="Postal code" autoComplete="postal-code" error={errors.postalCode?.message} {...register('postalCode')} />
              <SelectField label="Country" autoComplete="country" {...register('country')}>
                {[['US', 'United States'], ['CA', 'Canada'], ['GB', 'United Kingdom'], ['AU', 'Australia'], ['IN', 'India'], ['DE', 'Germany'], ['FR', 'France']].map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </SelectField>
              <Field className="sm:col-span-2" label="Phone (optional)" type="tel" autoComplete="tel" {...register('phone')} />
              <div className="sm:col-span-2 flex items-center justify-between">
                {!user && <p className="text-sm text-muted">Checking out as a guest. <Link to="/login" state={{ from: '/checkout' }} className="text-brass underline">Sign in</Link> to save your details.</p>}
                <button className="btn-primary ml-auto !px-8">Continue to delivery</button>
              </div>
            </form>
          )}

          {step === 1 && (
            <div>
              <h2 className="font-sans text-xl font-bold">How fast do you need it?</h2>
              <div role="radiogroup" aria-label="Delivery method" className="mt-5 space-y-3">
                {METHODS.map((m) => (
                  <label key={m.id} className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${co.method === m.id ? 'border-brass bg-brass/5' : 'border-line'}`}>
                    <span className="flex items-center gap-3"><input type="radio" name="method" className="accent-[rgb(var(--brass))]" checked={co.method === m.id} onChange={() => co.set({ method: m.id })} /><span><b>{m.label}</b><br /><span className="text-sm text-muted">{m.eta}</span></span></span>
                    <span className="text-sm">{m.price}</span>
                  </label>
                ))}
              </div>
              <div className="mt-6 flex justify-between"><button className="btn-ghost" onClick={() => setStep(0)}>Back</button><button className="btn-primary !px-8" onClick={() => setStep(2)}>Continue to payment</button></div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-sans text-xl font-bold">Payment</h2>
              <p className="mt-2 text-sm text-muted">You’ll enter your card on Stripe’s secure page after the review step. Shop-Zone never sees or stores card details.</p>
              <div className="mt-6">
                <label htmlFor="coupon" className="label">Coupon code</label>
                <div className="flex gap-2">
                  <input id="coupon" className="input" placeholder="e.g. WELCOME10" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyCoupon())} />
                  <button className="btn-ghost" onClick={applyCoupon}>Apply</button>
                  {co.coupon && <button className="btn-ghost" onClick={() => { setCouponInput(''); co.set({ coupon: '' }); }}>Remove</button>}
                </div>
                {d?.couponError && co.coupon && <p className="field-error" role="alert">{d.couponError}</p>}
                {d?.coupon && <p className="mt-1 text-sm text-ok">{d.coupon.code} applied{d.coupon.description ? `: ${d.coupon.description}` : ''}.</p>}
              </div>
              <p className="mt-6 rounded-xl border border-dashed border-line p-3 text-xs text-muted">Test mode: pay with card 4242 4242 4242 4242, any future date, any CVC.</p>
              <div className="mt-6 flex justify-between"><button className="btn-ghost" onClick={() => setStep(1)}>Back</button><button className="btn-primary !px-8" onClick={() => setStep(3)}>Review order</button></div>
            </div>
          )}

          {step === 3 && addr && (
            <div>
              <h2 className="font-sans text-xl font-bold">Review and pay</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div><h3 className="font-sans text-sm font-semibold">Ship to</h3><p className="mt-1 text-sm text-muted">{addr.fullName}<br />{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />{addr.city}, {addr.state} {addr.postalCode}, {addr.country}<br />{co.email}</p><button className="mt-1 text-xs text-brass underline" onClick={() => setStep(0)}>Edit</button></div>
                <div><h3 className="font-sans text-sm font-semibold">Delivery</h3><p className="mt-1 text-sm text-muted">{METHODS.find((m) => m.id === co.method)?.label}, {METHODS.find((m) => m.id === co.method)?.eta}</p><button className="mt-1 text-xs text-brass underline" onClick={() => setStep(1)}>Edit</button></div>
              </div>
              {d?.issues.length ? <p className="mt-5 text-sm text-danger" role="alert">{d.issues[0].message}</p> : null}
              <div className="mt-8 flex justify-between"><button className="btn-ghost" onClick={() => setStep(2)}>Back</button>
                <button className="btn-primary !px-8 !py-3" disabled={pay.isPending || !d || d.issues.length > 0 || !!(co.coupon && d.couponError)} onClick={() => pay.mutate()}>{pay.isPending ? 'Opening Stripe…' : `Pay ${d ? money(d.total) : ''}`}</button></div>
            </div>
          )}
          {step === 3 && !addr && <p>Please enter your address first.</p>}
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-24" aria-label="Order summary">
          <h2 className="mb-4 font-sans text-lg font-bold">Order summary</h2>
          {!d ? <Skeleton className="h-40" /> : (
            <>
              <ul className="mb-5 space-y-3">{d.lines.map((l) => (
                <li key={l.productId + l.sku} className="flex gap-3 text-sm"><div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-raised">{l.image && <img src={l.image} alt="" className="h-full w-full object-cover" />}</div><div className="flex-1"><p className="font-medium">{l.title}</p><p className="text-xs text-muted">{l.variantLabel} × {l.qty}</p></div><span>{money(l.lineTotal)}</span></li>
              ))}</ul>
              <Totals d={d} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
