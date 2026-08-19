/**
 * Database Connection Manager
 *
 * Provides a clean interface for MongoDB Atlas connection and collection access.
 */
import { MongoClient, Db, Collection } from 'mongodb';
import { env } from '../config/env';
import { COLLECTIONS, CollectionName } from './collections';

export class Database {
  private static client: MongoClient | null = null;
  private static db: Db | null = null;
  private static connected = false;

  static async connect(uri?: string): Promise<Db | null> {
    const connectionUri = uri || env.MONGODB_URI;
    if (!connectionUri) {
      console.warn('⚠️  [Database] MONGODB_URI not provided. Running in local memory/file fallback mode.');
      return null;
    }

    if (this.db && this.connected) {
      return this.db;
    }

    try {
      console.log('☁️  [Database] Connecting to MongoDB Atlas...');
      this.client = new MongoClient(connectionUri, { serverSelectionTimeoutMS: 5000 });
      await this.client.connect();
      this.db = this.client.db();
      this.connected = true;
      console.log('✅ [Database] Connected to MongoDB Atlas successfully.');

      await this.createIndexes();
      return this.db;
    } catch (err) {
      console.warn('⚠️  [Database] MongoDB Atlas connection failed:', (err as Error).message);
      this.connected = false;
      return null;
    }
  }

  static getDb(): Db | null {
    return this.db;
  }

  static isConnected(): boolean {
    return this.connected;
  }

  static getCollection<T extends Document = any>(name: CollectionName): Collection<T> | null {
    if (!this.db || !this.connected) return null;
    return this.db.collection<T>(COLLECTIONS[name]);
  }

  static async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.connected = false;
      console.log('🔌 [Database] MongoDB connection closed.');
    }
  }

  private static async createIndexes(): Promise<void> {
    if (!this.db) return;
    try {
      await Promise.all([
        this.db.collection(COLLECTIONS.restaurants).createIndex({ slug: 1 }, { unique: true }),
        this.db.collection(COLLECTIONS.restaurants).createIndex({ restaurant_code: 1 }, { unique: true }),
        this.db.collection(COLLECTIONS.users).createIndex({ restaurant_id: 1, email: 1 }),
        this.db.collection(COLLECTIONS.devices).createIndex({ restaurant_id: 1, device_token: 1 }),
        this.db.collection(COLLECTIONS.orders).createIndex({ restaurant_id: 1, status: 1 }),
        this.db.collection(COLLECTIONS.orders).createIndex({ restaurant_id: 1, idempotency_key: 1 }),
        this.db.collection(COLLECTIONS.inventory_items).createIndex({ restaurant_id: 1, category: 1 }),
        this.db.collection(COLLECTIONS.timecards).createIndex({ restaurant_id: 1, user_id: 1, clock_in: -1 }),
        this.db.collection(COLLECTIONS.service_requests).createIndex({ restaurant_id: 1, status: 1 }),
      ]);
    } catch (err) {
      console.warn('[Database] Index creation note:', (err as Error).message);
    }
  }
}
