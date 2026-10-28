import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { connectDB, disconnectDB } from '../config/db';

let repl: MongoMemoryReplSet;
// A replica set is required for transactions (same as MongoDB Atlas).
export async function startDb() {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDB(repl.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}
export async function stopDb() {
  await disconnectDB();
  await repl.stop();
}
export async function clearDb() {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
}
export async function makeProduct(over: Record<string, unknown> = {}) {
  const cat = (await Category.findOne()) ?? (await Category.create({ name: 'Test', slug: 'test' }));
  return new Product({
    title: 'Test Product',
    slug: `test-product-${Math.random().toString(36).slice(2, 8)}`,
    description: 'A product for tests.',
    price: 5000,
    category: cat._id,
    brand: 'TestBrand',
    variants: [{ sku: 'SKU-1', color: 'Red', stock: 5 }],
    ...over,
  }).save();
}
