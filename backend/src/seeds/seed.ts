import bcrypt from 'bcrypt';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { env } from '../config/env';
import { Category } from '../models/Category';
import { Coupon } from '../models/Coupon';
import { Product } from '../models/Product';
import { Review } from '../models/Review';
import { User } from '../models/User';
import { slugify } from '../utils/slug';

type Shape = 'sphere' | 'torus' | 'box' | 'cone' | 'knot' | 'capsule';
interface Cat { name: string; description: string; sizes?: string[]; colors: string[] }
const cats: Cat[] = [
  { name: 'Audio', description: 'Headphones, speakers and desk audio built to be heard.', colors: ['Graphite', 'Pearl'] },
  { name: 'Wearables', description: 'Watches and trackers that disappear on the wrist.', sizes: ['S/M', 'L'], colors: ['Midnight', 'Sand'] },
  { name: 'Home', description: 'Lighting and objects that make a room feel finished.', colors: ['Ash', 'Oat'] },
  { name: 'Bags', description: 'Carry-alls made to be used hard.', colors: ['Black', 'Olive'] },
  { name: 'Footwear', description: 'Everyday shoes with proper cushioning.', sizes: ['8', '9', '10', '11'], colors: ['Bone', 'Ink'] },
  { name: 'Desk', description: 'Tools for a clearer workspace.', colors: ['Slate', 'Birch'] },
];

// [title, brand, category index, price $, compare-at $ (0 = none), shape, color, tags, description]
const P: [string, string, number, number, number, Shape, string, string[], string][] = [
  ['Halo ANC Headphones', 'Auralis', 0, 249, 299, 'torus', '#b794f6', ['headphones', 'noise cancelling'], 'Over-ear headphones with adaptive noise cancelling, 40-hour battery and a memory-foam fit that stays comfortable on long flights.'],
  ['Pulse Mini Speaker', 'Auralis', 0, 89, 0, 'sphere', '#f2b84b', ['speaker', 'portable'], 'A palm-sized Bluetooth speaker with surprising low end, IP67 water resistance and 16 hours of playback.'],
  ['Strata Desk Speakers', 'Noma', 0, 179, 0, 'box', '#8fd3c8', ['speaker', 'desk'], 'Powered bookshelf speakers with a walnut-wrapped enclosure, USB-C input and a physical bass dial.'],
  ['Drift Wireless Earbuds', 'Noma', 0, 129, 159, 'capsule', '#9aa7ff', ['earbuds', 'wireless'], 'Compact earbuds with transparency mode, wireless charging case and six eartip sizes.'],
  ['Vinyl Turntable T1', 'Groove & Co', 0, 329, 0, 'torus', '#e07a5f', ['turntable', 'vinyl'], 'Belt-drive turntable with a carbon fibre tonearm, built-in preamp and a precision-machined platter.'],
  ['Studio Mic Arm', 'Noma', 0, 69, 0, 'capsule', '#c7c2d6', ['microphone', 'desk'], 'Low-profile boom arm with internal cable routing and a spring-free damped hinge.'],
  ['Meridian Watch 41', 'Tidewell', 1, 299, 349, 'torus', '#f2b84b', ['watch', 'smartwatch'], 'A 41 mm smartwatch with an always-on sapphire display, sleep tracking and a week of battery.'],
  ['Meridian Watch 45 Steel', 'Tidewell', 1, 389, 0, 'torus', '#c7c2d6', ['watch', 'steel'], 'The larger Meridian in brushed steel with dual-band GPS and a titanium crown.'],
  ['Arc Fitness Band', 'Tidewell', 1, 79, 99, 'capsule', '#8fd3c8', ['fitness', 'tracker'], 'A slim band that tracks heart rate, SpO2 and workouts for ten days on one charge.'],
  ['Loop Smart Ring', 'Orbit Labs', 1, 259, 0, 'torus', '#b794f6', ['ring', 'sleep'], 'A titanium ring that tracks sleep, readiness and temperature with no screen to distract you.'],
  ['Trail GPS Watch', 'Orbit Labs', 1, 449, 499, 'knot', '#e07a5f', ['gps', 'outdoor'], 'Rugged multi-sport GPS watch with offline maps, 28-day battery and a scratch-proof lens.'],
  ['Kin Kids Tracker', 'Tidewell', 1, 59, 0, 'sphere', '#9aa7ff', ['tracker', 'kids'], 'A durable, waterproof tracker with a parent-managed contact list and step goals.'],
  ['Ember Table Lamp', 'Lumen', 2, 119, 0, 'cone', '#f2b84b', ['lamp', 'lighting'], 'A dimmable table lamp with a hand-blown opal glass shade and warm 2700K light.'],
  ['Cloud Floor Lamp', 'Lumen', 2, 199, 249, 'sphere', '#e8e4f2', ['lamp', 'floor'], 'A tall floor lamp with a paper-lantern globe and a weighted steel base.'],
  ['Basalt Planter', 'Hearth', 2, 49, 0, 'box', '#6f6a80', ['planter', 'ceramic'], 'Matte ceramic planter with a drainage plug and a cork-lined base to protect surfaces.'],
  ['Tide Ceramic Vase', 'Hearth', 2, 64, 79, 'capsule', '#8fd3c8', ['vase', 'ceramic'], 'Wheel-thrown stoneware vase finished in a reactive glaze. No two are identical.'],
  ['Hush Wool Throw', 'Hearth', 2, 95, 0, 'box', '#c9b79c', ['blanket', 'wool'], 'A heavyweight merino throw woven in Portugal, naturally temperature regulating.'],
  ['Prism Wall Clock', 'Lumen', 2, 79, 0, 'torus', '#9aa7ff', ['clock', 'wall'], 'Silent-sweep wall clock with a mineral glass face and a brushed aluminium frame.'],
  ['Courier Backpack 24L', 'Fieldwork', 3, 149, 179, 'box', '#3a3a44', ['backpack', 'commute'], 'Weatherproof commuter backpack with a padded 16 inch laptop sleeve and magnetic closures.'],
  ['Nomad Duffel 40L', 'Fieldwork', 3, 169, 0, 'capsule', '#6b705c', ['duffel', 'travel'], 'A carry-on sized duffel in waxed canvas with a shoe compartment and a luggage pass-through.'],
  ['Slim Sling Bag', 'Fieldwork', 3, 59, 0, 'capsule', '#c9b79c', ['sling', 'everyday'], 'Compact cross-body bag with a hidden zip pocket and a quick-adjust strap.'],
  ['Atlas Tote', 'Marlow', 3, 85, 109, 'box', '#e07a5f', ['tote', 'leather'], 'Vegetable-tanned leather tote with a structured base that holds its shape.'],
  ['Roll-Top Pack 18L', 'Marlow', 3, 99, 0, 'cone', '#9aa7ff', ['backpack', 'waterproof'], 'Welded waterproof roll-top pack for bike commutes and rainy cities.'],
  ['Cascade Runner', 'Stride', 4, 139, 0, 'knot', '#8fd3c8', ['running', 'sneaker'], 'Responsive daily trainer with a recycled-knit upper and a 32 mm stack.'],
  ['Studio Leather Sneaker', 'Stride', 4, 159, 189, 'knot', '#e8e4f2', ['sneaker', 'leather'], 'A clean low-top in Italian leather with a cushioned insole and replaceable laces.'],
  ['Terrain Trail Boot', 'Stride', 4, 189, 0, 'knot', '#6b705c', ['boot', 'hiking'], 'Waterproof hiking boot with a grippy lug sole and a gusseted tongue.'],
  ['Wander Slip-On', 'Marlow', 4, 99, 0, 'knot', '#c9b79c', ['slip-on', 'casual'], 'Easy canvas slip-ons with a molded footbed. Wash them in the machine.'],
  ['Slab Standing Desk Mat', 'Plane', 5, 79, 0, 'box', '#3a3a44', ['mat', 'desk'], 'Anti-fatigue mat with a contoured edge and a non-slip base for standing desks.'],
  ['Quill Mechanical Keyboard', 'Plane', 5, 169, 199, 'box', '#b794f6', ['keyboard', 'mechanical'], 'Hot-swappable 75% keyboard with gasket mounting and a machined aluminium case.'],
  ['Orbit Wireless Mouse', 'Plane', 5, 89, 0, 'sphere', '#9aa7ff', ['mouse', 'wireless'], 'Ergonomic mouse with a 4000 DPI sensor, silent clicks and a month of battery life.'],
  ['Lift Monitor Stand', 'Plane', 5, 109, 0, 'box', '#c9b79c', ['stand', 'monitor'], 'Solid-oak monitor riser with a cable channel and a sliding storage drawer.'],
  ['Beam Desk Light', 'Lumen', 5, 129, 149, 'cone', '#f2b84b', ['light', 'desk'], 'Asymmetric LED desk light that lights your page, not your screen. Adjustable colour temperature.'],
];

const COUPONS = [
  { code: 'WELCOME10', description: '10% off your order', type: 'percent' as const, value: 10, minSubtotal: 0 },
  { code: 'SAVE20', description: '$20 off orders over $100', type: 'fixed' as const, value: 2000, minSubtotal: 10000 },
  { code: 'BIGSPENDER', description: '15% off orders over $300, up to $75', type: 'percent' as const, value: 15, minSubtotal: 30000, maxDiscount: 7500 },
];

async function main() {
  await connectDB();
  await Promise.all([Product.deleteMany({}), Category.deleteMany({}), Coupon.deleteMany({}), Review.deleteMany({})]);

  const catDocs = await Category.insertMany(cats.map((c) => ({ name: c.name, slug: slugify(c.name), description: c.description })));
  const rnd = (seed: string) => parseInt(crypto.createHash('md5').update(seed).digest('hex').slice(0, 6), 16);

  for (const [title, brand, ci, price, compare, shape, color, tags, description] of P) {
    const cat = cats[ci];
    const slug = slugify(title);
    const variants = (cat.sizes ?? [undefined]).flatMap((size) =>
      cat.colors.map((c) => ({
        sku: `${slug.slice(0, 10).toUpperCase()}-${(size ?? 'OS').replace('/', '')}-${c.slice(0, 3).toUpperCase()}`,
        size,
        color: c,
        stock: 4 + (rnd(slug + size + c) % 40),
      })),
    );
    // a couple of deliberately low-stock items so the admin low-stock alert has something to show
    if (title.startsWith('Loop') || title.startsWith('Vinyl')) variants[0].stock = 2;
    await new Product({
      title,
      slug,
      description,
      price: price * 100,
      compareAtPrice: compare ? compare * 100 : undefined,
      images: [1, 2, 3].map((n) => `https://picsum.photos/seed/${slug}-${n}/900/1100`),
      category: catDocs[ci]._id,
      brand,
      variants,
      tags,
      soldCount: rnd(slug) % 120,
      ratingAverage: 3.8 + (rnd(slug + 'r') % 12) / 10,
      ratingCount: 8 + (rnd(slug + 'c') % 90),
      viewer: { shape, color },
    }).save();
  }

  for (const c of COUPONS) await Coupon.create(c);

  const password = env.ADMIN_PASSWORD ?? crypto.randomBytes(9).toString('base64url') + '9';
  await User.findOneAndUpdate(
    { email: env.ADMIN_EMAIL },
    { name: 'Store Admin', email: env.ADMIN_EMAIL, passwordHash: await bcrypt.hash(password, 12), role: 'admin', emailVerified: true, isActive: true },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log(`\nSeeded ${cats.length} categories, ${P.length} products, ${COUPONS.length} coupons.`);
  console.log(`Admin login: ${env.ADMIN_EMAIL}  /  ${env.ADMIN_PASSWORD ? '(the ADMIN_PASSWORD you set)' : password}`);
  console.log(`Coupons: ${COUPONS.map((c) => c.code).join(', ')}\n`);
  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
