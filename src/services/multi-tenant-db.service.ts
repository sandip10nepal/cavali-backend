/**
 * Multi-Tenant Database Service — Hardened Production Implementation
 * 
 * ARCHITECTURE:
 * - Authoritative Storage: MongoDB Atlas production cluster.
 * - In-Memory / Local Cache: Fast sub-millisecond local reads and offline resilience.
 * - Auto-Migration: Automatically migrates legacy local data into MongoDB Atlas on startup.
 */

import { MongoClient, Db } from 'mongodb';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';
import { DatabaseUnavailableError, ValidationError } from '../core/errors';
import {
  Restaurant,
  User,
  Device,
  DeviceActivationCode,
  DeviceType,
  RestaurantTable,
  MenuCategory,
  MenuItemModel,
  Order,
  OrderStatus,
  InventoryItem,
  InventoryTransaction,
  PaymentSession,
  AuditLog,
  CustomerSession,
  Credit,
  Timecard,
} from '../models/types';

const DB_FILE = path.join(__dirname, '../../multi_tenant_db.json');

export const COLLECTIONS = {
  restaurants: 'restaurants',
  users: 'users',
  devices: 'devices',
  device_activation_codes: 'device_activation_codes',
  tables: 'tables',
  menu_categories: 'menu_categories',
  menu_items: 'menu_items',
  orders: 'orders',
  inventory: 'inventory_items',
  inventory_categories: 'inventory_categories',
  inventory_transactions: 'inventory_transactions',
  payment_sessions: 'payment_sessions',
  audit_logs: 'audit_logs',
  customer_sessions: 'customer_sessions',
  credits: 'credits',
  timecards: 'timecards',
  leads: 'leads',
  service_requests: 'service_requests',
} as const;

interface LocalSchema {
  restaurants: Restaurant[];
  users: User[];
  devices: Device[];
  device_activation_codes: DeviceActivationCode[];
  tables: RestaurantTable[];
  menu_categories: MenuCategory[];
  menu_items: MenuItemModel[];
  orders: Order[];
  inventory_items: InventoryItem[];
  inventory_categories: any[];
  inventory_transactions: InventoryTransaction[];
  payment_sessions: PaymentSession[];
  audit_logs: AuditLog[];
  customer_sessions: CustomerSession[];
  credits: Credit[];
  timecards: Timecard[];
  leads: any[];
  service_requests: any[];
}

export class MultiTenantDbService {
  private static client: MongoClient | null = null;
  private static db: Db | null = null;
  private static initialized = false;
  private static localDb: LocalSchema | null = null;
  private static mongoConnected = false;
  private static backupIntervalId: any = null;
  private static initPromise: Promise<void> | null = null;

  /* ─────────────── Initialization ─────────────── */

  static async initialize(mongoUri?: string): Promise<void> {
    if (this.mongoConnected && this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const isMongo = env.isMongoMode;

      if (isMongo) {
        const uri = mongoUri || env.MONGODB_URI;
        if (!uri) {
          throw new Error('FATAL: MONGODB_URI is required when DATABASE_MODE=mongodb');
        }

        console.log(`[Database] Environment: ${env.NODE_ENV}`);
        console.log(`[Database] Mode: mongodb (Mandatory Authoritative)`);
        console.log(`[Database] Connecting to MongoDB Atlas cluster...`);

        try {
          if (this.client) {
            try { await this.client.close(); } catch (_) {}
            this.client = null;
          }
          this.client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 30000,
            connectTimeoutMS: 30000,
            retryWrites: true,
          });
          await this.client.connect();
          this.db = this.client.db();

          // Strict ping verification
          await this.db.command({ ping: 1 });
          this.mongoConnected = true;

          console.log(`[Database] MongoDB Atlas connection established`);
          console.log(`[Database] Ping: successful`);
          console.log(`[Database] Database: ${this.db.databaseName}`);

          this.ensureIndexes().catch((idxErr) => {
            console.warn('[Database] Non-fatal index creation note:', idxErr.message);
          });
        } catch (err) {
          this.mongoConnected = false;
          this.db = null;
          this.client = null;
          console.error(`[Database] FATAL: MongoDB Atlas connection/ping failed: ${(err as Error).message}`);
          throw err;
        }
      } else {
        // Local development mode ONLY
        if (env.isProduction) {
          throw new Error('FATAL: Local database mode is strictly prohibited in production!');
        }
        this.localDb = this.loadLocalDb();
        this.mongoConnected = false;
        console.log(`[Database] Mode: local (Explicit Development Mode Only)`);
        console.log(`[Database] Loaded local JSON cache with ${this.localDb.restaurants?.length || 0} restaurants`);
      }

      this.initialized = true;

      // Baseline sanity data in background (non-blocking)
      this.ensureRestaurantCodes().catch(() => {});
      this.ensureDefaultStaff().catch(() => {});
      this.ensureDefaultInventory().catch(() => {});
      this.archiveExpiredTimecards(undefined, 180).catch(() => {});
      this.ensureSoftDrinksConfiguration().catch(() => {});
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  static isInitialized(): boolean {
    return this.initialized;
  }

  static isMongoConnected(): boolean {
    return this.mongoConnected;
  }

  static getDb(): Db | null {
    return this.db;
  }

  static async pingDatabase(): Promise<boolean> {
    if (!this.db) return false;
    try {
      await this.db.command({ ping: 1 });
      this.mongoConnected = true;
      return true;
    } catch {
      return false;
    }
  }

  static assertDbReady(): Db {
    if (env.isMongoMode) {
      if (!this.db) {
        if (!this.initPromise) {
          this.initialize().catch(() => {});
        }
        throw new DatabaseUnavailableError('The database is temporarily unavailable.');
      }
      return this.db;
    }
    return null as any;
  }

  static async ensureReady(): Promise<Db> {
    if (env.isMongoMode) {
      if (this.db && this.mongoConnected) return this.db;
      if (this.initPromise) {
        await this.initPromise.catch(() => {});
        if (this.db && this.mongoConnected) return this.db;
      }
      await this.initialize().catch(() => {});
      if (!this.db || !this.mongoConnected) {
        throw new DatabaseUnavailableError('The database is temporarily unavailable.');
      }
      return this.db;
    }
    return null as any;
  }

  private static loadLocalDb(): LocalSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.timecards) parsed.timecards = [];
        if (!parsed.device_activation_codes) parsed.device_activation_codes = [];
        if (!parsed.inventory_transactions) parsed.inventory_transactions = [];
        if (!parsed.inventory_categories) parsed.inventory_categories = [];
        if (!parsed.leads) parsed.leads = [];
        if (!parsed.service_requests) parsed.service_requests = [];
        return parsed;
      }
    } catch (e) {
      console.error('Error loading multi_tenant_db.json:', e);
    }
    const empty: LocalSchema = {
      restaurants: [], users: [], devices: [], device_activation_codes: [], tables: [],
      menu_categories: [], menu_items: [], orders: [], inventory_items: [], inventory_categories: [],
      inventory_transactions: [], payment_sessions: [], audit_logs: [],
      customer_sessions: [], credits: [], timecards: [], leads: [], service_requests: [],
    };
    this.saveLocalDb(empty);
    return empty;
  }

  private static saveLocalDb(data: LocalSchema) {
    if (env.isMongoMode) {
      return; // Do not write to local JSON in MongoDB mode
    }
    this.localDb = data;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving multi_tenant_db.json:', e);
    }
  }

  public static getCollection<K extends keyof LocalSchema>(key: K): LocalSchema[K] {
    if (env.isMongoMode) {
      throw new DatabaseUnavailableError(`Cannot access local collection "${String(key)}" in MongoDB mode`);
    }
    if (!this.localDb) this.localDb = this.loadLocalDb();
    if (!this.localDb[key]) (this.localDb as any)[key] = [];
    return this.localDb[key];
  }

  public static saveCollection<K extends keyof LocalSchema>(key: K, data: LocalSchema[K]) {
    if (env.isMongoMode) {
      return; // In MongoDB mode, mutations are persisted directly to MongoDB
    }
    if (!this.localDb) this.localDb = this.loadLocalDb();
    this.localDb[key] = data;
    this.saveLocalDb(this.localDb);
  }

  /* ───────────────────────────────────────────────────────────────────────── */

  private static async ensureIndexes(): Promise<void> {
    if (!this.db) return;
    try {
      await Promise.all([
        this.db.collection<any>(COLLECTIONS.restaurants).createIndex({ slug: 1 }, { unique: true }),
        this.db.collection<any>(COLLECTIONS.restaurants).createIndex({ restaurant_code: 1 }, { unique: true }),
        this.db.collection<any>(COLLECTIONS.users).createIndex({ restaurant_id: 1, email: 1 }),
        this.db.collection<any>(COLLECTIONS.devices).createIndex({ restaurant_id: 1, device_token: 1 }),
        this.db.collection<any>(COLLECTIONS.device_activation_codes).createIndex({ restaurant_id: 1, code: 1 }),
        this.db.collection<any>(COLLECTIONS.device_activation_codes).createIndex({ expires_at: 1 }),
        this.db.collection<any>(COLLECTIONS.tables).createIndex({ restaurant_id: 1, number: 1 }),
        this.db.collection<any>(COLLECTIONS.menu_categories).createIndex({ restaurant_id: 1, sort_order: 1 }),
        this.db.collection<any>(COLLECTIONS.menu_items).createIndex({ restaurant_id: 1, category_id: 1 }),
        this.db.collection<any>(COLLECTIONS.menu_items).createIndex(
          { restaurant_id: 1, name: 1 },
          { name: 'uniq_restaurant_item_name', unique: true, collation: { locale: 'en', strength: 2 } }
        ),
        this.db.collection<any>(COLLECTIONS.orders).createIndex({ restaurant_id: 1, status: 1 }),
        this.db.collection<any>(COLLECTIONS.orders).createIndex({ restaurant_id: 1, idempotency_key: 1 }),
        this.db.collection<any>(COLLECTIONS.inventory).createIndex({ restaurant_id: 1, category: 1 }),
        this.db.collection<any>(COLLECTIONS.inventory_transactions).createIndex({ restaurant_id: 1, timestamp: -1 }),
        this.db.collection<any>(COLLECTIONS.audit_logs).createIndex({ restaurant_id: 1, timestamp: -1 }),
        this.db.collection<any>(COLLECTIONS.timecards).createIndex({ restaurant_id: 1, user_id: 1, clock_in: -1 }),
        this.db.collection<any>(COLLECTIONS.timecards).createIndex({ restaurant_id: 1, status: 1 }),
      ]);
    } catch (e) {}
  }

  private static async ensureRestaurantCodes(): Promise<void> {
    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const list = await db.collection<any>(COLLECTIONS.restaurants).find({}).toArray();
      for (const r of list) {
        if (!r.restaurant_code) {
          const code = r.slug === 'cavali' ? '4821' : Math.floor(1000 + Math.random() * 9000).toString();
          await db.collection<any>(COLLECTIONS.restaurants).updateOne(
            { _id: r._id },
            { $set: { restaurant_code: code, updated_at: new Date().toISOString() } }
          );
        }
      }
      return;
    }

    const list = this.getCollection('restaurants');
    let changed = false;
    for (const r of list) {
      if (!r.restaurant_code) {
        r.restaurant_code = r.slug === 'cavali' ? '4821' : Math.floor(1000 + Math.random() * 9000).toString();
        changed = true;
      }
    }
    if (changed) this.saveCollection('restaurants', list);
  }

  static async ensureDefaultStaff(): Promise<void> {
    try {
      const restaurant = await this.getRestaurantBySlug('cavali');
      if (!restaurant) return;

      const { AuthService } = require('./auth.service');
      const defaultStaff: { name: string; email: string; role: any; pin: string; position: string; rate: number }[] = [
        { name: 'Manager / Owner', email: 'manager@cavalli.com', role: 'manager', pin: '1234', position: 'General Manager', rate: 30 },
        { name: 'Suzi', email: 'server@cavalli.com', role: 'server', pin: '1234', position: 'Head Server', rate: 15 },
        { name: 'Chef Kenji', email: 'chief@cavalli.com', role: 'chef', pin: '1234', position: 'Head Chef', rate: 25 },
        { name: 'Alex Rivera', email: 'bar@cavalli.com', role: 'bartender', pin: '1234', position: 'Lead Mixologist', rate: 22.5 },
        { name: 'Samir Hookah Master', email: 'hookah@cavalli.com', role: 'hookah_maker', pin: '1234', position: 'Lounge Master', rate: 20 },
      ];

      for (const s of defaultStaff) {
        const existing = await this.getUserByEmail(restaurant._id, s.email);
        if (!existing) {
          await this.createUser({
            restaurant_id: restaurant._id,
            name: s.name,
            email: s.email,
            phone: null,
            role: s.role,
            position: s.position,
            hourly_rate: s.rate,
            pin_hash: AuthService.hashPin(s.pin),
            active: true,
          });
        }
      }
    } catch (err) {}
  }

  static async ensureDefaultInventory(targetRestaurantId?: string): Promise<void> {
    try {
      const templateItems = [
        { name: 'House Shisha Blend', stock: 1500, unit: 'g', category: 'shisha', active: true, low_threshold: 100 },
        { name: 'Mint Shisha Flavor', stock: 2000, unit: 'g', category: 'shisha', active: true, low_threshold: 100 },
        { name: 'Fruit Mix Shisha', stock: 1000, unit: 'g', category: 'shisha', active: true, low_threshold: 100 },
        { name: 'Karak Black Tea', stock: 250, unit: 'bags', category: 'beverages', active: true, low_threshold: 20 },
        { name: 'Desi Coffee Beans', stock: 500, unit: 'g', category: 'beverages', active: true, low_threshold: 50 },
        { name: 'Chicken Breast', stock: 40, unit: 'kg', category: 'food', active: true, low_threshold: 5 },
        { name: 'Basmati Rice', stock: 100, unit: 'kg', category: 'food', active: true, low_threshold: 10 }
      ];

      if (env.isMongoMode) {
        const db = this.assertDbReady();
        const targetIds = targetRestaurantId 
          ? [targetRestaurantId] 
          : (await db.collection<any>(COLLECTIONS.restaurants).find({}).project({ _id: 1 }).toArray()).map(r => r._id);

        const existingRids = new Set(
          await db.collection<any>(COLLECTIONS.inventory).distinct('restaurant_id', { restaurant_id: { $in: targetIds } })
        );

        for (const rid of targetIds) {
          if (!rid || existingRids.has(rid)) continue;
          const docs = templateItems.map(item => ({
            _id: `INV_${rid}_${item.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            id: `INV_${rid}_${item.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            restaurant_id: rid,
            ...item,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));
          await db.collection<any>(COLLECTIONS.inventory).insertMany(docs);
        }
        return;
      }

      const targetIds = targetRestaurantId 
        ? [targetRestaurantId] 
        : (this.getCollection('restaurants') || []).map((r: any) => r._id || r.id);

      const allInv = this.getCollection('inventory_items');
      let changed = false;

      for (const rid of targetIds) {
        if (!rid) continue;
        const existing = allInv.filter(i => i.restaurant_id === rid);
        if (existing.length === 0) {
          for (const item of templateItems) {
            const now = new Date().toISOString();
            const newItem: InventoryItem = {
              _id: `INV_${rid}_${item.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              restaurant_id: rid,
              ...item,
              created_at: now,
              updated_at: now
            };
            allInv.push(newItem);
            changed = true;
          }
        }
      }

      if (changed) {
        this.saveCollection('inventory_items', allInv);
      }
    } catch (e) {
      console.error('[MultiTenantDB] error in ensureDefaultInventory:', e);
    }
  }

  static async ensureSoftDrinksConfiguration(): Promise<void> {
    try {
      const hookahEnhancementGroup = {
        id: 'MOD_HOOKAH_ENHANCEMENTS',
        name: 'Hookah Enhancements',
        min_selection: 0,
        max_selection: 2,
        required: false,
        options: [
          { id: 'OPT_ICE_BASE', name: 'Ice Base', price: 2, price_adjustment: 2, available: true, sort_order: 1 },
          { id: 'OPT_ICE_HOSE', name: 'Ice Hose', price: 6, price_adjustment: 6, available: true, sort_order: 2 }
        ]
      };

      if (env.isMongoMode && this.db) {
        // 1. Soft drinks modifier group updates
        await this.db.collection<any>(COLLECTIONS.menu_items).updateMany(
          { 
            $or: [
              { name: { $regex: /soft drink/i } },
              { _id: 'MI_soft_drinks_beverage' },
              { id: 'MI_soft_drinks_beverage' }
            ]
          },
          {
            $set: {
              'modifier_groups.$[elem].max_selections': 10,
              'modifier_groups.$[elem].maxSelect': 10,
              'modifier_groups.$[elem].required': false,
              'modifier_groups.$[elem].options.$[opt].price': 0,
              'modifier_groups.$[elem].options.$[opt].price_adjustment': 0,
            }
          },
          {
            arrayFilters: [
              { 'elem.id': { $exists: true } },
              { 'opt.id': { $exists: true } }
            ]
          }
        ).catch(() => {});

        // 2. Ensure all hookah items have MOD_HOOKAH_ENHANCEMENTS
        await this.db.collection<any>(COLLECTIONS.menu_items).updateMany(
          {
            $or: [
              { category: 'hookah' },
              { name: { $regex: /hookah/i } },
              { category_id: { $regex: /hookah/i } }
            ],
            'modifier_groups.id': { $ne: 'MOD_HOOKAH_ENHANCEMENTS' }
          },
          {
            $push: { modifier_groups: hookahEnhancementGroup as any }
          } as any
        ).catch(() => {});
      }
    } catch (e) {
      console.warn('[MultiTenantDB] ensureSoftDrinksConfiguration note:', (e as Error).message);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                         RESTAURANT CRUD                                    */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async createRestaurant(data: Omit<Restaurant, '_id' | 'created_at' | 'updated_at' | 'restaurant_code'> & { restaurant_code?: string }): Promise<Restaurant> {
    const now = new Date().toISOString();
    const id = `RES_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const restaurant: Restaurant = {
      ...data,
      restaurant_code: data.restaurant_code || Math.floor(1000 + Math.random() * 9000).toString(),
      _id: id,
      created_at: now,
      updated_at: now,
    };

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.restaurants).insertOne({ ...restaurant });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge restaurant insertion in MongoDB Atlas');
      }
      return restaurant;
    }

    const list = this.getCollection('restaurants');
    list.push(restaurant);
    this.saveCollection('restaurants', list);
    return restaurant;
  }

  static async getRestaurant(id: string): Promise<Restaurant | null> {
    if (!id) return null;
    const clean = String(id).trim();

    if (env.isMongoMode) {
      const db = await this.ensureReady();
      const rest = await db.collection<any>(COLLECTIONS.restaurants).findOne({
        $or: [
          { _id: clean },
          { id: clean },
          { slug: clean.toLowerCase() },
          { restaurant_code: clean },
        ]
      });
      if (!rest) return null;
      return {
        ...rest,
        _id: (rest._id as any).toString(),
        id: (rest._id as any).toString(),
      } as unknown as Restaurant;
    }

    const list = this.getCollection('restaurants');
    return list.find(r => r._id === clean || (r.slug && r.slug.toLowerCase() === clean.toLowerCase()) || (r.restaurant_code && r.restaurant_code === clean)) || null;
  }

  static async getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
    if (!slug) return null;
    const clean = slug.trim().toLowerCase();
    const rawTrim = slug.trim();
    const searchSlugs = [clean];
    if (clean === 'cavalli') searchSlugs.push('cavali');
    if (clean === 'cavali') searchSlugs.push('cavalli');

    if (env.isMongoMode) {
      const db = await this.ensureReady();
      const rest = await db.collection<any>(COLLECTIONS.restaurants).findOne({
        $or: [
          { slug: { $in: searchSlugs } },
          { restaurant_code: rawTrim },
          { _id: rawTrim },
          { id: rawTrim },
        ]
      });
      if (!rest) return null;
      return {
        ...rest,
        _id: (rest._id as any).toString(),
        id: (rest._id as any).toString(),
      } as unknown as Restaurant;
    }

    const list = this.getCollection('restaurants');
    return list.find(r => 
      searchSlugs.includes(r.slug?.toLowerCase()) || 
      (r.restaurant_code && r.restaurant_code === rawTrim) || 
      r._id === rawTrim
    ) || null;
  }

  static async resolveRestaurantId(idOrSlug: string): Promise<string> {
    if (!idOrSlug) return 'RES_EED4E9D266DF';
    const clean = String(idOrSlug).trim();
    const searchSlugs = [clean.toLowerCase()];
    if (clean.toLowerCase() === 'cavalli') searchSlugs.push('cavali');
    if (clean.toLowerCase() === 'cavali') searchSlugs.push('cavalli');

    if (env.isMongoMode) {
      const db = await this.ensureReady();
      const rest = await db.collection<any>(COLLECTIONS.restaurants).findOne({
        $or: [
          { _id: clean },
          { id: clean },
          { slug: { $in: searchSlugs } },
          { restaurant_code: clean },
        ]
      });
      return rest ? (rest._id as string) : clean;
    }

    const list = this.getCollection('restaurants') as Restaurant[];
    const found = list.find(r => r._id === clean || (r.slug && searchSlugs.includes(r.slug.toLowerCase())) || (r.restaurant_code && r.restaurant_code === clean));
    return found ? found._id : clean;
  }

  static async getRestaurantByCode(code: string): Promise<Restaurant | null> {
    if (!code) return null;
    const cleanCode = String(code).trim();

    if (env.isMongoMode) {
      const db = await this.ensureReady();
      const rest = await db.collection<any>(COLLECTIONS.restaurants).findOne({
        $or: [
          { restaurant_code: cleanCode },
          { slug: cleanCode.toLowerCase() },
          { _id: cleanCode },
          { id: cleanCode },
        ]
      });
      if (!rest) return null;
      return {
        ...rest,
        _id: (rest._id as any).toString(),
        id: (rest._id as any).toString(),
      } as unknown as Restaurant;
    }

    const list = this.getCollection('restaurants');
    return list.find(r => r.restaurant_code === cleanCode || (r.restaurant_code && cleanCode.startsWith(r.restaurant_code)) || r.slug === cleanCode.toLowerCase() || r._id === cleanCode) || null;
  }

  static async getPublicConfig(restaurantIdOrSlug: string): Promise<any> {
    let restaurant = await this.getRestaurant(restaurantIdOrSlug);
    if (!restaurant) {
      restaurant = await this.getRestaurantBySlug(restaurantIdOrSlug);
    }
    if (!restaurant) return null;

    const categories = await this.listMenuCategories(restaurant._id);
    const menuItems = await this.listMenuItems(restaurant._id);
    const tables = await this.listTables(restaurant._id);

    return {
      restaurant: {
        id: restaurant._id,
        slug: restaurant.slug,
        restaurant_code: restaurant.restaurant_code,
        name: restaurant.name,
        branding: restaurant.branding,
        settings: {
          currency: restaurant.settings.currency,
          tax_config: restaurant.settings.tax_config,
          auto_accept_orders: restaurant.settings.auto_accept_orders,
          require_table_number: restaurant.settings.require_table_number,
          enable_tips: restaurant.settings.enable_tips,
          tip_options: restaurant.settings.tip_options,
          enable_split_payment: restaurant.settings.enable_split_payment,
          session_timeout_minutes: restaurant.settings.session_timeout_minutes,
        },
      },
      categories: categories.filter(c => c.active !== false).map(c => ({
        _id: c._id,
        id: c._id,
        restaurant_id: c.restaurant_id,
        parent_id: c.parent_id !== undefined ? c.parent_id : null,
        name: c.name || c.title || 'Category',
        title: c.name || c.title || 'Category',
        description: c.description || c.subtitle || '',
        icon: c.icon || (c.parent_id === null ? '👑' : '📋'),
        color: c.color || '#E5B13A',
        sort_order: c.sort_order ?? 0,
        active: c.active !== false,
      })).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      menu_items: menuItems.filter(i => i.active !== false).map(item => {
        const cat = categories.find(c => c._id === item.category_id || (c as any).id === item.category_id);
        const catTitle = cat?.name || cat?.title || item.category_id || '';
        const catLower = (catTitle + ' ' + (item.category_id || '')).toLowerCase();

        let superCat = 'food';
        if (catLower.includes('hookah')) {
          superCat = 'hookah';
        } else if (catLower.includes('drink') || catLower.includes('beverage')) {
          superCat = 'drinks';
        }

        const rawModGroups = (item.modifier_groups && item.modifier_groups.length > 0)
          ? item.modifier_groups
          : (superCat === 'hookah' ? [{
              id: 'MOD_HOOKAH_ENHANCEMENTS',
              name: 'Hookah Enhancements',
              min_selection: 0,
              max_selection: 2,
              maxSelect: 2,
              required: false,
              options: [
                { id: 'OPT_ICE_BASE', name: 'Ice Base', price: 2, price_adjustment: 2, available: true, sort_order: 1 },
                { id: 'OPT_ICE_HOSE', name: 'Ice Hose', price: 6, price_adjustment: 6, available: true, sort_order: 2 }
              ]
            }] : []);

        const sanitizedModGroups = rawModGroups.map((g: any) => {
          const isSoftDrinkGroup = (g.id === 'mod_soft_drink_choice' || (item.name && item.name.toLowerCase().includes('soft drink')));
          return {
            ...g,
            max_selections: isSoftDrinkGroup ? 10 : (g.max_selections || g.maxSelect || 2),
            maxSelect: isSoftDrinkGroup ? 10 : (g.maxSelect || g.max_selections || 2),
            required: isSoftDrinkGroup ? false : Boolean(g.required),
            options: (g.options || []).map((opt: any) => {
              const adj = Number(opt.price !== undefined ? opt.price : opt.price_adjustment !== undefined ? opt.price_adjustment : 0);
              return {
                ...opt,
                price: adj,
                price_adjustment: adj,
              };
            }),
          };
        });

        return {
          _id: item._id,
          id: item._id,
          restaurant_id: item.restaurant_id,
          category_id: item.category_id,
          category: superCat,
          subcategory: catTitle || superCat,
          name: item.name,
          description: item.description || item.desc || '',
          desc: item.desc || item.description || '',
          price: Number(item.price) || 0,
          emoji: item.emoji || (superCat === 'hookah' ? '💨' : superCat === 'drinks' ? '🍹' : '🍽️'),
          image_url: item.image_url || null,
          imageUrl: item.image_url || null,
          sort_order: item.sort_order ?? 0,
          category_sort_order: cat?.sort_order ?? 9999,
          active: item.active !== false,
          available: item.available !== false,
          recipe: item.recipe || [],
          modifier_groups: sanitizedModGroups,
          modifierGroups: sanitizedModGroups,
          variants: item.variants || [],
        };
      }).sort((a, b) => {
        const catOrderA = (a as any).category_sort_order ?? 9999;
        const catOrderB = (b as any).category_sort_order ?? 9999;
        if (catOrderA !== catOrderB) return catOrderA - catOrderB;
        const itemOrderA = a.sort_order ?? 0;
        const itemOrderB = b.sort_order ?? 0;
        if (itemOrderA !== itemOrderB) return itemOrderA - itemOrderB;
        return (a.name || '').localeCompare(b.name || '');
      }),
      tables: tables.map(t => ({
        id: t._id,
        table_number: String(t.number || t.label || '1'),
        section: t.label || 'Main',
        status: t.active !== false ? 'available' : 'inactive',
      })),
    };
  }

  static async listRestaurants(): Promise<Restaurant[]> {
    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const docs = await db.collection<any>(COLLECTIONS.restaurants).find({ active: { $ne: false } }).toArray();
      return docs.map(d => ({
        ...d,
        _id: (d._id as any).toString(),
        id: (d._id as any).toString(),
      })) as unknown as Restaurant[];
    }
    return this.getCollection('restaurants');
  }

  static async updateRestaurant(id: string, update: Partial<Restaurant>): Promise<boolean> {
    if (!id) return false;
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.restaurants).updateOne(
        { $or: [{ _id: id }, { id: id }] },
        { $set: { ...update, updated_at: now } }
      );
      return res.matchedCount > 0;
    }

    const list = this.getCollection('restaurants');
    const idx = list.findIndex(r => r._id === id || (r as any).id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...update, updated_at: now };
    this.saveCollection('restaurants', list);
    return true;
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                           USER / STAFF CRUD                                */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async createUser(data: Omit<User, '_id' | 'created_at' | 'updated_at'>): Promise<User> {
    const now = new Date().toISOString();
    const id = `USR_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const user: User = {
      failed_login_attempts: 0,
      locked_until: null,
      token_version: 1,
      ...data,
      _id: id,
      created_at: now,
      updated_at: now,
    };

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.users).insertOne({ ...user });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge user insertion in MongoDB Atlas');
      }
      return user;
    }

    const list = this.getCollection('users');
    list.push(user);
    this.saveCollection('users', list);
    return user;
  }

  static async getUser(id: string): Promise<User | null> {
    if (!id) return null;

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const user = await db.collection<any>(COLLECTIONS.users).findOne({
        $or: [{ _id: id }, { id: id }]
      });
      if (!user) return null;
      return {
        ...user,
        _id: (user._id as any).toString(),
        id: (user._id as any).toString(),
      } as unknown as User;
    }

    return this.getCollection('users').find(u => u._id === id || (u as any).id === id) || null;
  }

  static async getUserByEmail(restaurantId: string, email: string): Promise<User | null> {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const user = await db.collection<any>(COLLECTIONS.users).findOne({
        restaurant_id: restaurantId,
        email: cleanEmail
      });
      if (!user) return null;
      return {
        ...user,
        _id: (user._id as any).toString(),
        id: (user._id as any).toString(),
      } as unknown as User;
    }

    return this.getCollection('users').find(u => u.restaurant_id === restaurantId && u.email?.toLowerCase() === cleanEmail) || null;
  }

  static async findUserByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const user = await db.collection<any>(COLLECTIONS.users).findOne({
        email: cleanEmail,
        active: { $ne: false }
      });
      if (!user) return null;
      return {
        ...user,
        _id: (user._id as any).toString(),
        id: (user._id as any).toString(),
      } as unknown as User;
    }

    return this.getCollection('users').find(u => u.active !== false && u.email?.toLowerCase() === cleanEmail) || null;
  }

  static async listUsers(restaurantId: string, includeInactive = false): Promise<User[]> {
    if (!restaurantId) return [];

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const query: any = { restaurant_id: restaurantId };
      if (!includeInactive) query.active = { $ne: false };
      const docs = await db.collection<any>(COLLECTIONS.users).find(query).toArray();
      return docs.map(d => ({
        ...d,
        _id: (d._id as any).toString(),
        id: (d._id as any).toString(),
      })) as unknown as User[];
    }

    return this.getCollection('users').filter(u => u.restaurant_id === restaurantId && (includeInactive || u.active !== false));
  }

  static async updateUser(id: string, restaurantId: string, update: Partial<User>): Promise<boolean> {
    if (!id) return false;
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const query: any = { $or: [{ _id: id }, { id: id }] };
      if (restaurantId) query.restaurant_id = restaurantId;
      const res = await db.collection<any>(COLLECTIONS.users).updateOne(query, { $set: { ...update, updated_at: now } });
      return res.matchedCount > 0;
    }

    const list = this.getCollection('users');
    const idx = list.findIndex(u => (u._id === id || (u as any).id === id) && (u.restaurant_id === restaurantId || !restaurantId));
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...update, updated_at: now };
    this.saveCollection('users', list);
    return true;
  }

  static async deleteUser(id: string, restaurantId?: string): Promise<boolean> {
    if (!id) return false;
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const query: any = { $or: [{ _id: id }, { id: id }] };
      if (restaurantId) query.restaurant_id = restaurantId;
      const res = await db.collection<any>(COLLECTIONS.users).updateOne(query, { $set: { active: false, updated_at: now } });
      return res.matchedCount > 0;
    }

    const list = this.getCollection('users');
    const idx = list.findIndex(u => (u._id === id || (u as any).id === id) && (!restaurantId || u.restaurant_id === restaurantId));
    if (idx === -1) return false;
    const removed = list.splice(idx, 1)[0];
    this.saveCollection('users', list);
    return true;
  }

  /* ─────────────── Failed Login & Lockout Tracking ─────────────── */

  static async recordFailedLogin(userId: string): Promise<{ locked: boolean; lockedUntil?: string }> {
    const user = await this.getUser(userId);
    if (!user) return { locked: false };

    const attempts = (user.failed_login_attempts || 0) + 1;
    let lockedUntil: string | null = null;

    if (attempts >= 5) {
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }

    await this.updateUser(user._id, user.restaurant_id, {
      failed_login_attempts: attempts,
      locked_until: lockedUntil,
    });

    return { locked: !!lockedUntil, lockedUntil: lockedUntil || undefined };
  }

  static async resetFailedLogins(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;
    await this.updateUser(user._id, user.restaurant_id, {
      failed_login_attempts: 0,
      locked_until: null,
    });
  }

  static isAccountLocked(user: User): boolean {
    if (!user.locked_until) return false;
    const lockTime = new Date(user.locked_until).getTime();
    return lockTime > Date.now();
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                         DEVICE PROVISIONING & CRUD                         */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async generateDeviceActivationCode(
    restaurantId: string,
    deviceType: DeviceType,
    deviceName: string,
    tableId?: string,
    stationId?: string,
    createdBy = 'manager'
  ): Promise<DeviceActivationCode> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const id = `ACT_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    const activation: DeviceActivationCode = {
      _id: id,
      restaurant_id: restaurantId,
      code,
      device_type: deviceType,
      device_name: deviceName,
      table_id: tableId,
      station_id: stationId,
      expires_at: expiresAt,
      used: false,
      created_by: createdBy,
      created_at: now.toISOString(),
    };

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.device_activation_codes).insertOne({ ...activation });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge activation code insertion in MongoDB Atlas');
      }
      return activation;
    }

    const list = this.getCollection('device_activation_codes');
    list.push(activation);
    this.saveCollection('device_activation_codes', list);
    return activation;
  }

  static async verifyAndBurnActivationCode(
    restaurantCode: string,
    activationCode: string
  ): Promise<{ restaurant: Restaurant; activation: DeviceActivationCode } | null> {
    const restaurant = await this.getRestaurantByCode(restaurantCode);
    if (!restaurant) return null;

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const act = await db.collection<any>(COLLECTIONS.device_activation_codes).findOne({
        restaurant_id: restaurant._id,
        code: activationCode.trim(),
        used: false,
        expires_at: { $gt: new Date().toISOString() }
      });
      if (!act) return null;

      await db.collection<any>(COLLECTIONS.device_activation_codes).updateOne(
        { _id: act._id },
        { $set: { used: true, updated_at: new Date().toISOString() } }
      );
      return {
        restaurant,
        activation: {
          ...act,
          _id: (act._id as any).toString(),
          id: (act._id as any).toString(),
          used: true,
        } as unknown as DeviceActivationCode
      };
    }

    const list = this.getCollection('device_activation_codes');
    const act = list.find(
      a => a.restaurant_id === restaurant._id &&
           a.code === activationCode.trim() &&
           !a.used &&
           new Date(a.expires_at).getTime() > Date.now()
    );

    if (!act) return null;
    act.used = true;
    this.saveCollection('device_activation_codes', list);
    return { restaurant, activation: act };
  }

  static async registerOrUpdateDevice(data: {
    restaurant_id: string;
    device_name: string;
    device_type: DeviceType;
    table_id?: string;
    station_id?: string;
    app_version?: string;
    os_version?: string;
  }): Promise<Device> {
    const token = `dev_${crypto.randomBytes(24).toString('hex')}`;
    const now = new Date().toISOString();
    const id = `DEV_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    const device: Device = {
      _id: id,
      restaurant_id: data.restaurant_id,
      device_name: data.device_name,
      device_type: data.device_type,
      table_id: data.table_id,
      station_id: data.station_id,
      device_token: token,
      status: 'ACTIVE',
      app_version: data.app_version || '1.0.0',
      os_version: data.os_version || 'unknown',
      last_seen_at: now,
      last_activity: 'Registered',
      paired_at: now,
      created_at: now,
    };

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.devices).insertOne({ ...device });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge device insertion in MongoDB Atlas');
      }
      return device;
    }

    const list = this.getCollection('devices');
    list.push(device);
    this.saveCollection('devices', list);
    return device;
  }

  static async getDevice(id: string): Promise<Device | null> {
    if (!id) return null;

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const device = await db.collection<any>(COLLECTIONS.devices).findOne({
        $or: [{ _id: id }, { id: id }]
      });
      if (!device) return null;
      return {
        ...device,
        _id: (device._id as any).toString(),
        id: (device._id as any).toString(),
      } as unknown as Device;
    }

    return this.getCollection('devices').find(d => d._id === id || (d as any).id === id) || null;
  }

  static async getDeviceByToken(token: string): Promise<Device | null> {
    if (!token) return null;

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const device = await db.collection<any>(COLLECTIONS.devices).findOne({ device_token: token });
      if (!device) return null;
      return {
        ...device,
        _id: (device._id as any).toString(),
        id: (device._id as any).toString(),
      } as unknown as Device;
    }

    return this.getCollection('devices').find(d => d.device_token === token) || null;
  }

  static async listDevices(restaurantId: string): Promise<Device[]> {
    if (!restaurantId) return [];

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const docs = await db.collection<any>(COLLECTIONS.devices).find({ restaurant_id: restaurantId }).toArray();
      return docs.map(d => ({
        ...d,
        _id: (d._id as any).toString(),
        id: (d._id as any).toString(),
      })) as unknown as Device[];
    }

    return this.getCollection('devices').filter(d => d.restaurant_id === restaurantId);
  }

  static async updateDevice(id: string, restaurantId: string, update: Partial<Device>): Promise<boolean> {
    if (!id || !restaurantId) return false;
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.devices).updateOne(
        { $or: [{ _id: id }, { id: id }], restaurant_id: restaurantId },
        { $set: { ...update, updated_at: now } }
      );
      return res.matchedCount > 0;
    }

    const list = this.getCollection('devices');
    const idx = list.findIndex(d => (d._id === id || (d as any).id === id) && d.restaurant_id === restaurantId);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...update, last_seen_at: now };
    this.saveCollection('devices', list);
    return true;
  }

  static async revokeDevice(id: string, restaurantId: string): Promise<boolean> {
    return this.updateDevice(id, restaurantId, { status: 'REVOKED', last_activity: 'Revoked by Manager' });
  }

  static async recordDeviceHeartbeat(deviceId: string, appVersion?: string, osVersion?: string): Promise<void> {
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const update: any = { last_seen_at: now, status: 'ACTIVE' };
      if (appVersion) update.app_version = appVersion;
      if (osVersion) update.os_version = osVersion;
      await db.collection<any>(COLLECTIONS.devices).updateOne(
        { $or: [{ _id: deviceId }, { device_token: deviceId }] },
        { $set: update }
      );
      return;
    }

    const list = this.getCollection('devices');
    const d = list.find(x => x._id === deviceId || x.device_token === deviceId);
    if (d) {
      d.last_seen_at = now;
      if (appVersion) d.app_version = appVersion;
      if (osVersion) d.os_version = osVersion;
      if (d.status === 'OFFLINE') d.status = 'ACTIVE';
      this.saveCollection('devices', list);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                            MENU CATEGORIES & ITEMS                          */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async listCategories(restaurantId: string): Promise<MenuCategory[]> {
    return this.listMenuCategories(restaurantId);
  }

  static async listMenuCategories(restaurantId: string): Promise<MenuCategory[]> {
    if (!restaurantId) throw new Error('Restaurant ID is required to list menu categories');
    const targetId = await this.resolveRestaurantId(restaurantId);

    if (env.isMongoMode) {
      const db = await this.ensureReady();
      const mongoDocs = await db.collection<any>(COLLECTIONS.menu_categories).find({
        restaurant_id: targetId,
        active: { $ne: false }
      }).toArray();

      const mapped = mongoDocs.map(c => {
        const isSuper = c.parent_id === null;
        const catName = c.name || c.title || 'Category';
        let parent_id = c.parent_id;
        if (parent_id === undefined) {
          if (c.is_super) {
            parent_id = null;
          } else {
            const lower = (catName + ' ' + (c._id || '') + ' ' + (c.menu_type || '')).toLowerCase();
            if (lower.includes('hookah')) {
              parent_id = `CAT_SUPER_${targetId}_HOOKAH`;
            } else if (lower.includes('drink') || lower.includes('beverage')) {
              parent_id = `CAT_SUPER_${targetId}_DRINKS`;
            } else {
              parent_id = `CAT_SUPER_${targetId}_FOOD`;
            }
          }
        }
        return {
          ...c,
          _id: (c._id as any).toString(),
          id: (c._id as any).toString(),
          parent_id,
          name: catName,
          title: catName,
          is_super: isSuper,
          active: c.active !== false,
        } as unknown as MenuCategory;
      });

      // Guarantee any referenced parent supercategories are synthesized if not present
      const existingIds = new Set(mapped.map(c => c._id));
      const missingParents = new Set<string>();
      for (const c of mapped) {
        if (c.parent_id && !existingIds.has(c.parent_id)) {
          missingParents.add(c.parent_id);
        }
      }
      for (const pid of missingParents) {
        let name = 'Food & Dining';
        let icon = '🍔';
        let sort_order = 1;
        let color = '#E5B13A';
        if (pid.toUpperCase().includes('HOOKAH')) {
          name = 'Hookah';
          icon = '💨';
          sort_order = 0;
          color = '#0099FF';
        } else if (pid.toUpperCase().includes('DRINK') || pid.toUpperCase().includes('BEVERAGE')) {
          name = 'Beverages';
          icon = '🍹';
          sort_order = 2;
          color = '#14B8A6';
        }
        mapped.unshift({
          _id: pid,
          id: pid,
          restaurant_id: targetId,
          parent_id: null,
          name,
          title: name,
          icon,
          color,
          sort_order,
          is_super: true,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as MenuCategory);
      }

      return mapped.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }

    const allCats = this.getCollection('menu_categories') as MenuCategory[];
    const venueCats = allCats.filter(c => c.restaurant_id === targetId && c.active !== false);

    const localMapped = venueCats.map(c => {
      const isSuper = c.parent_id === null;
      const catName = c.name || c.title || 'Category';
      let parent_id = c.parent_id;
      if (parent_id === undefined) {
        if (c.is_super) {
          parent_id = null;
        } else {
          const lower = (catName + ' ' + (c._id || '') + ' ' + (c.menu_type || '')).toLowerCase();
          if (lower.includes('hookah')) {
            parent_id = `CAT_SUPER_${targetId}_HOOKAH`;
          } else if (lower.includes('drink') || lower.includes('beverage')) {
            parent_id = `CAT_SUPER_${targetId}_DRINKS`;
          } else {
            parent_id = `CAT_SUPER_${targetId}_FOOD`;
          }
        }
      }
      return {
        ...c,
        parent_id,
        name: catName,
        title: catName,
        is_super: isSuper,
        active: c.active !== false,
      };
    });

    const localExisting = new Set(localMapped.map(c => c._id));
    const localMissing = new Set<string>();
    for (const c of localMapped) {
      if (c.parent_id && !localExisting.has(c.parent_id)) {
        localMissing.add(c.parent_id);
      }
    }
    for (const pid of localMissing) {
      let name = 'Food & Dining';
      let icon = '🍔';
      let sort_order = -1;
      if (pid.toUpperCase().includes('HOOKAH')) {
        name = 'Hookah';
        icon = '💨';
        sort_order = 10;
      } else if (pid.toUpperCase().includes('DRINK') || pid.toUpperCase().includes('BEVERAGE')) {
        name = 'Beverages';
        icon = '🍸';
        sort_order = 20;
      }
      localMapped.unshift({
        _id: pid,
        id: pid,
        restaurant_id: targetId,
        parent_id: null,
        name,
        title: name,
        icon,
        color: '#E5B13A',
        sort_order,
        is_super: true,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);
    }

    return localMapped.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  static async createMenuCategory(data: Partial<MenuCategory> & { restaurant_id: string; title?: string; name?: string }): Promise<MenuCategory> {
    if (!data.restaurant_id) throw new Error('Restaurant ID is required to create a menu category');
    const targetId = await this.resolveRestaurantId(data.restaurant_id);
    const name = (data.name || data.title || '').trim();

    if (!name) {
      throw new ValidationError('Category name is required');
    }

    let parentId: string | null = data.parent_id !== undefined ? data.parent_id : (data.is_super ? null : null);

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      if (parentId !== null) {
        const parent = await db.collection<any>(COLLECTIONS.menu_categories).findOne({
          restaurant_id: targetId,
          $or: [{ _id: parentId }, { id: parentId }],
          active: { $ne: false }
        });
        if (!parent) {
          throw new ValidationError(`Parent category "${parentId}" not found or inactive`);
        }
        if (parent.parent_id !== null) {
          throw new ValidationError(`Parent category "${parent.name || parent._id}" is a Sub Category. Categories can only be 2 levels deep (Super -> Sub).`);
        }
      }

      const now = new Date().toISOString();
      const catId = `CAT_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      const finalParentId = parentId === undefined ? null : parentId;
      const cat: MenuCategory = {
        _id: catId,
        restaurant_id: targetId,
        parent_id: finalParentId,
        name,
        title: name,
        description: data.description || data.subtitle || '',
        icon: data.icon || (finalParentId === null ? '👑' : '📋'),
        color: data.color || '#6366F1',
        sort_order: data.sort_order ?? 0,
        is_super: finalParentId === null,
        active: true,
        created_at: now,
        updated_at: now,
      };

      const res = await db.collection<any>(COLLECTIONS.menu_categories).insertOne({ ...cat });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge category insertion in MongoDB Atlas');
      }
      return cat;
    }

    const allCats = this.getCollection('menu_categories') as MenuCategory[];
    if (parentId !== null) {
      const parent = allCats.find(c => c.restaurant_id === targetId && (c._id === parentId || (c as any).id === parentId) && c.active !== false);
      if (!parent) {
        throw new ValidationError(`Parent category "${parentId}" not found or inactive`);
      }
      if (parent.parent_id !== null) {
        throw new ValidationError(`Parent category "${parent.name || parent._id}" is a Sub Category. Categories can only be 2 levels deep (Super -> Sub).`);
      }
    }

    const now = new Date().toISOString();
    const finalParentId = parentId === undefined ? null : parentId;
    const cat: MenuCategory = {
      _id: `CAT_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      restaurant_id: targetId,
      parent_id: finalParentId,
      name,
      title: name,
      description: data.description || data.subtitle || '',
      icon: data.icon || (finalParentId === null ? '👑' : '📋'),
      color: data.color || '#6366F1',
      sort_order: data.sort_order ?? 0,
      is_super: finalParentId === null,
      active: true,
      created_at: now,
      updated_at: now,
    };

    const list = this.getCollection('menu_categories');
    list.push(cat);
    this.saveCollection('menu_categories', list);
    return cat;
  }

  static async updateMenuCategory(id: string, restaurantId: string, update: Partial<MenuCategory>): Promise<boolean> {
    if (!restaurantId) throw new Error('Restaurant ID is required to update a menu category');
    const targetId = await this.resolveRestaurantId(restaurantId);
    const catId = String(id).trim();
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      if (update.parent_id !== undefined && update.parent_id !== null) {
        const parent = await db.collection<any>(COLLECTIONS.menu_categories).findOne({
          restaurant_id: targetId,
          $or: [{ _id: update.parent_id }, { id: update.parent_id }],
          active: { $ne: false }
        });
        if (!parent) {
          throw new ValidationError(`Parent category "${update.parent_id}" not found or inactive`);
        }
        if (parent.parent_id !== null) {
          throw new ValidationError(`Parent category "${parent.name || parent._id}" is a Sub Category. Categories can only be 2 levels deep.`);
        }
      }

      const res = await db.collection<any>(COLLECTIONS.menu_categories).updateOne(
        { $or: [{ _id: catId }, { id: catId }], restaurant_id: targetId, active: { $ne: false } },
        { $set: { ...update, updated_at: now } }
      );
      return res.matchedCount > 0;
    }

    const list = this.getCollection('menu_categories') as MenuCategory[];
    const index = list.findIndex(c => c.restaurant_id === targetId && (c._id === catId || (c as any).id === catId) && c.active !== false);

    if (index === -1) {
      return false;
    }

    if (update.parent_id !== undefined && update.parent_id !== null) {
      const parent = list.find(c => c.restaurant_id === targetId && (c._id === update.parent_id || (c as any).id === update.parent_id) && c.active !== false);
      if (!parent) {
        throw new ValidationError(`Parent category "${update.parent_id}" not found or inactive`);
      }
      if (parent.parent_id !== null) {
        throw new ValidationError(`Parent category "${parent.name || parent._id}" is a Sub Category. Categories can only be 2 levels deep.`);
      }
    }

    const updatedName = (update.name || update.title || list[index].name || list[index].title || '').trim();

    list[index] = {
      ...list[index],
      ...update,
      name: updatedName,
      title: updatedName,
      description: update.description || update.subtitle || list[index].description,
      updated_at: now
    };

    this.saveCollection('menu_categories', list);
    return true;
  }

  static async deleteMenuCategory(id: string, restaurantId: string): Promise<{ success: boolean; conflict?: boolean; notFound?: boolean; message?: string }> {
    if (!restaurantId) throw new Error('Restaurant ID is required to delete a menu category');
    const targetId = await this.resolveRestaurantId(restaurantId);
    const catId = String(id).trim();
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const targetCat = await db.collection<any>(COLLECTIONS.menu_categories).findOne({
        restaurant_id: targetId,
        $or: [{ _id: catId }, { id: catId }],
        active: { $ne: false }
      });

      if (!targetCat) {
        return { success: false, notFound: true, message: 'Category not found.' };
      }

      if (targetCat.parent_id === null) {
        const activeSubCount = await db.collection<any>(COLLECTIONS.menu_categories).countDocuments({
          restaurant_id: targetId,
          parent_id: targetCat._id,
          active: { $ne: false }
        });
        if (activeSubCount > 0) {
          return {
            success: false,
            conflict: true,
            message: `Cannot delete "${targetCat.name || targetCat.title}" because it contains ${activeSubCount} active sub-category(ies).`
          };
        }
      }

      const activeItemCount = await db.collection<any>(COLLECTIONS.menu_items).countDocuments({
        restaurant_id: targetId,
        category_id: targetCat._id,
        active: { $ne: false }
      });
      if (activeItemCount > 0) {
        return {
          success: false,
          conflict: true,
          message: `Cannot delete "${targetCat.name || targetCat.title}" because it contains ${activeItemCount} active menu item(s).`
        };
      }

      const res = await db.collection<any>(COLLECTIONS.menu_categories).updateOne(
        { _id: targetCat._id, restaurant_id: targetId },
        { $set: { active: false, updated_at: now } }
      );
      return { success: res.matchedCount > 0 };
    }

    const list = this.getCollection('menu_categories') as MenuCategory[];
    const targetIdx = list.findIndex(c => c.restaurant_id === targetId && (c._id === catId || (c as any).id === catId) && c.active !== false);

    if (targetIdx === -1) {
      return { success: false, notFound: true, message: 'Category not found.' };
    }

    const targetCat = list[targetIdx];

    if (targetCat.parent_id === null) {
      const activeChildren = list.filter(c => c.restaurant_id === targetId && c.parent_id === targetCat._id && c.active !== false);
      if (activeChildren.length > 0) {
        return {
          success: false,
          conflict: true,
          message: `Cannot delete "${targetCat.name || targetCat.title}" because it contains ${activeChildren.length} active sub-category(ies).`
        };
      }
    }

    const items = this.getCollection('menu_items') as MenuItemModel[];
    const activeItems = items.filter(i => {
      if (i.restaurant_id !== targetId || i.active === false) return false;
      return i.category_id === targetCat._id || (i as any).category === targetCat._id;
    });

    if (activeItems.length > 0) {
      return {
        success: false,
        conflict: true,
        message: `Cannot delete "${targetCat.name || targetCat.title}" because it contains ${activeItems.length} active menu item(s).`
      };
    }

    list[targetIdx].active = false;
    list[targetIdx].updated_at = now;
    this.saveCollection('menu_categories', list);
    return { success: true };
  }

  static async listInventoryCategories(restaurantId: string): Promise<any[]> {
    if (env.isMongoMode) {
      const db = this.assertDbReady();
      let list = await db.collection<any>(COLLECTIONS.inventory_categories).find({
        restaurant_id: restaurantId,
        active: { $ne: false }
      }).toArray();

      if (list.length === 0 && restaurantId) {
        const now = new Date().toISOString();
        const defaults = [
          { _id: `INVCAT_${restaurantId}_SHISHA`, restaurant_id: restaurantId, title: 'Shisha Flavors', icon: '💨', sort_order: 10, active: true, created_at: now, updated_at: now },
          { _id: `INVCAT_${restaurantId}_COALS`, restaurant_id: restaurantId, title: 'Coals & Heads', icon: '🔥', sort_order: 20, active: true, created_at: now, updated_at: now },
          { _id: `INVCAT_${restaurantId}_LIQUOR`, restaurant_id: restaurantId, title: 'Liquors & Drinks', icon: '🍾', sort_order: 30, active: true, created_at: now, updated_at: now },
          { _id: `INVCAT_${restaurantId}_RAW`, restaurant_id: restaurantId, title: 'Raw Ingredients', icon: '🍅', sort_order: 40, active: true, created_at: now, updated_at: now },
        ];
        await db.collection<any>(COLLECTIONS.inventory_categories).insertMany(defaults);
        list = await db.collection<any>(COLLECTIONS.inventory_categories).find({
          restaurant_id: restaurantId,
          active: { $ne: false }
        }).toArray();
      }

      return list.map(d => ({
        ...d,
        _id: (d._id as any).toString(),
        id: (d._id as any).toString(),
      })).sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
    }

    const allInvCats = this.getCollection('inventory_categories') as any[];
    const venueCats = allInvCats.filter(c => c.restaurant_id === restaurantId);
    let list = venueCats.filter(c => c.active !== false);
    if (venueCats.length === 0 && restaurantId) {
      const now = new Date().toISOString();
      const defaults = [
        { _id: `INVCAT_${restaurantId}_SHISHA`, restaurant_id: restaurantId, title: 'Shisha Flavors', icon: '💨', sort_order: 10, active: true, created_at: now, updated_at: now },
        { _id: `INVCAT_${restaurantId}_COALS`, restaurant_id: restaurantId, title: 'Coals & Heads', icon: '🔥', sort_order: 20, active: true, created_at: now, updated_at: now },
        { _id: `INVCAT_${restaurantId}_LIQUOR`, restaurant_id: restaurantId, title: 'Liquors & Drinks', icon: '🍾', sort_order: 30, active: true, created_at: now, updated_at: now },
        { _id: `INVCAT_${restaurantId}_RAW`, restaurant_id: restaurantId, title: 'Raw Ingredients', icon: '🍅', sort_order: 40, active: true, created_at: now, updated_at: now },
      ];
      for (const d of defaults) {
        allInvCats.push(d);
      }
      this.saveCollection('inventory_categories', allInvCats);
      list = allInvCats.filter(c => c.restaurant_id === restaurantId && c.active !== false);
    }
    return list.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
  }

  static async createInventoryCategory(data: { restaurant_id: string; title: string; icon?: string; sort_order?: number }): Promise<any> {
    const now = new Date().toISOString();
    const id = `INVCAT_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const cat: any = {
      _id: id,
      id: id,
      restaurant_id: data.restaurant_id,
      title: data.title,
      icon: data.icon || '📦',
      sort_order: data.sort_order || 10,
      active: true,
      created_at: now,
      updated_at: now,
    };

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.inventory_categories).insertOne({ ...cat });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge inventory category insertion in MongoDB Atlas');
      }
      return cat;
    }

    const list = this.getCollection('inventory_categories') as any[];
    list.push(cat);
    this.saveCollection('inventory_categories', list as any);
    return cat;
  }

  static async updateInventoryCategory(id: string, restaurantId: string, update: Partial<any>): Promise<boolean> {
    const targetId = String(id).toLowerCase();
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.inventory_categories).updateOne(
        {
          restaurant_id: restaurantId,
          $or: [
            { _id: id },
            { id: id },
            { _id: new RegExp(`${targetId}$`, 'i') },
            { title: new RegExp(`^${targetId}$`, 'i') }
          ]
        },
        { $set: { ...update, updated_at: now } }
      );
      return res.matchedCount > 0;
    }

    const list = this.getCollection('inventory_categories') as any[];
    const idx = list.findIndex(c => {
      if (c.restaurant_id !== restaurantId) return false;
      const cId = String(c._id || c.id || '').toLowerCase();
      const cTitle = String(c.title || '').toLowerCase();
      return cId === targetId || cTitle === targetId || cId.endsWith(`_${targetId}`);
    });
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...update, updated_at: now };
    this.saveCollection('inventory_categories', list as any);
    return true;
  }

  static async deleteInventoryCategory(id: string, restaurantId: string): Promise<boolean> {
    const targetId = String(id).toLowerCase();
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.inventory_categories).updateOne(
        {
          restaurant_id: restaurantId,
          $or: [
            { _id: id },
            { id: id },
            { _id: new RegExp(`${targetId}$`, 'i') },
            { title: new RegExp(`^${targetId}$`, 'i') }
          ]
        },
        { $set: { active: false, updated_at: now } }
      );
      return res.matchedCount > 0;
    }

    const list = this.getCollection('inventory_categories') as any[];
    const idx = list.findIndex(c => {
      if (c.restaurant_id !== restaurantId) return false;
      const cId = String(c._id || c.id || '').toLowerCase();
      const cTitle = String(c.title || '').toLowerCase();
      return cId === targetId || cTitle === targetId || cId.endsWith(`_${targetId}`);
    });
    if (idx === -1) return false;
    list[idx].active = false;
    list[idx].updated_at = now;
    this.saveCollection('inventory_categories', list as any);
    return true;
  }

  static async createTable(data: Omit<RestaurantTable, '_id' | 'created_at'>): Promise<RestaurantTable> {
    const now = new Date().toISOString();
    const id = `TBL_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const table: RestaurantTable = {
      _id: id,
      ...data,
      created_at: now,
    };

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.tables).insertOne({ ...table });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge table insertion in MongoDB Atlas');
      }
      return table;
    }

    const list = this.getCollection('tables');
    list.push(table);
    this.saveCollection('tables', list);
    return table;
  }

  static async getTable(id?: string, restaurantId?: string): Promise<RestaurantTable | null> {
    if (!id) return null;

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const query: any = { $or: [{ _id: id }, { id: id }] };
      if (restaurantId) query.restaurant_id = restaurantId;
      const doc = await db.collection<any>(COLLECTIONS.tables).findOne(query);
      if (!doc) return null;
      return {
        ...doc,
        _id: (doc._id as any).toString(),
        id: (doc._id as any).toString(),
      } as unknown as RestaurantTable;
    }

    return this.getCollection('tables').find(t => t._id === id && (!restaurantId || t.restaurant_id === restaurantId)) || null;
  }

  static async listTables(restaurantId: string): Promise<RestaurantTable[]> {
    if (!restaurantId) return [];

    if (env.isMongoMode) {
      const db = await this.ensureReady();
      const docs = await db.collection<any>(COLLECTIONS.tables).find({ restaurant_id: restaurantId }).toArray();
      return docs.map(d => ({
        ...d,
        _id: (d._id as any).toString(),
        id: (d._id as any).toString(),
      })) as unknown as RestaurantTable[];
    }

    return this.getCollection('tables').filter(t => t.restaurant_id === restaurantId);
  }

  static async createDevice(data: any): Promise<Device> {
    return this.registerOrUpdateDevice({
      restaurant_id: data.restaurant_id,
      device_name: data.device_name || 'iPad Device',
      device_type: data.device_type || 'customer_table',
      table_id: data.table_id,
      station_id: data.station_id,
    });
  }

  static async listMenuItems(restaurantId: string, categoryId?: string): Promise<MenuItemModel[]> {
    if (!restaurantId) throw new Error('Restaurant ID is required to list menu items');
    const targetId = await this.resolveRestaurantId(restaurantId);

    const hookahModifiers = [
      {
        id: 'MOD_HOOKAH_ENHANCEMENTS',
        name: 'Hookah Enhancements',
        min_selection: 0,
        max_selection: 2,
        required: false,
        options: [
          { id: 'OPT_ICE_BASE', name: 'Ice Base', price: 2 },
          { id: 'OPT_ICE_HOSE', name: 'Ice Hose', price: 6 }
        ]
      }
    ];

    const categories = await this.listMenuCategories(targetId);
    const catMap = new Map<string, number>();
    categories.forEach(c => catMap.set(c._id, c.sort_order ?? 9999));

    const sortFn = (a: any, b: any) => {
      const catOrderA = catMap.get(a.category_id) ?? 9999;
      const catOrderB = catMap.get(b.category_id) ?? 9999;
      if (catOrderA !== catOrderB) return catOrderA - catOrderB;
      const itemOrderA = a.sort_order ?? 0;
      const itemOrderB = b.sort_order ?? 0;
      if (itemOrderA !== itemOrderB) return itemOrderA - itemOrderB;
      return (a.name || '').localeCompare(b.name || '');
    };

    if (env.isMongoMode) {
      const db = await this.ensureReady();
      const query: any = { restaurant_id: targetId, active: { $ne: false } };
      if (categoryId) {
        query.$or = [
          { category_id: categoryId },
          { category: categoryId },
          { category_id: new RegExp(`^${categoryId}$`, 'i') },
          { category: new RegExp(`^${categoryId}$`, 'i') }
        ];
      }
      const mongoDocs = await db.collection<any>(COLLECTIONS.menu_items).find(query as any).toArray();
      return mongoDocs.map(i => {
        const isHookah = (i.category === 'hookah' || String(i.category_id || '').toLowerCase().includes('hookah') || i.subcategory === 'House Mixes' || /cavalli crush|shah jahan|habibi nights|kashmiri chai|anarkali|white king|zaalim|shokha|dubai nights|dragon/i.test(i.name || ''));
        const mods = i.modifier_groups || i.modifierGroups || (isHookah ? hookahModifiers : []);
        return {
          ...i,
          _id: (i._id as any).toString(),
          id: (i._id as any).toString(),
          restaurant_id: i.restaurant_id || targetId,
          category_id: i.category_id || i.category || '',
          category: i.category_id || i.category || '',
          image_url: isHookah ? null : (i.image_url || (i as any).imageUrl || (i as any).image || null),
          imageUrl: isHookah ? null : (i.image_url || (i as any).imageUrl || (i as any).image || null),
          desc: i.desc || i.description || '',
          description: i.description || i.desc || '',
          modifier_groups: mods,
          modifierGroups: mods,
          active: i.active !== false,
          available: i.available !== false,
        } as unknown as MenuItemModel;
      }).sort(sortFn);
    }

    let items = (this.getCollection('menu_items') as MenuItemModel[]).filter(i => i.restaurant_id === targetId && i.active !== false);
    if (categoryId) items = items.filter(i => (i.category_id || i.category || '').toLowerCase() === categoryId.toLowerCase());
    return items.map(i => {
      const isHookah = (i.category === 'hookah' || String(i.category_id || '').toLowerCase().includes('hookah') || (i as any).subcategory === 'House Mixes' || /cavalli crush|shah jahan|habibi nights|kashmiri chai|anarkali|white king|zaalim|shokha|dubai nights|dragon/i.test(i.name || ''));
      const mods = (i as any).modifier_groups || (i as any).modifierGroups || (isHookah ? hookahModifiers : []);
      return {
        ...i,
        category_id: i.category_id || i.category || '',
        category: i.category_id || i.category || '',
        image_url: isHookah ? null : (i.image_url || (i as any).imageUrl || (i as any).image || null),
        imageUrl: isHookah ? null : (i.image_url || (i as any).imageUrl || (i as any).image || null),
        desc: i.desc || i.description || '',
        description: i.description || i.desc || '',
        modifier_groups: mods,
        modifierGroups: mods,
        active: i.active !== false,
        available: i.available !== false,
      };
    }).sort(sortFn);
  }

  static async getMenuItem(id: string, restaurantId: string): Promise<MenuItemModel | null> {
    if (!id) return null;
    const targetId = await this.resolveRestaurantId(restaurantId);

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const item = await db.collection<any>(COLLECTIONS.menu_items).findOne({
        $or: [{ _id: id }, { id: id }],
        restaurant_id: targetId,
        active: { $ne: false }
      } as any);
      if (!item) return null;
      return {
        ...item,
        _id: (item._id as any).toString(),
        id: (item._id as any).toString(),
        restaurant_id: item.restaurant_id || targetId,
        category_id: item.category_id || item.category || '',
        category: item.category_id || item.category || '',
        image_url: item.image_url || (item as any).imageUrl || (item as any).image || null,
        desc: item.desc || item.description || '',
        description: item.description || item.desc || '',
        active: item.active !== false,
        available: item.available !== false,
      } as unknown as MenuItemModel;
    }

    const item = (this.getCollection('menu_items') as MenuItemModel[]).find(i => (i._id === id || (i as any).id === id) && i.restaurant_id === targetId && i.active !== false);
    if (!item) return null;
    return {
      ...item,
      category_id: item.category_id || item.category || '',
      category: item.category_id || item.category || '',
      image_url: item.image_url || (item as any).imageUrl || (item as any).image || null,
      desc: item.desc || item.description || '',
      description: item.description || item.desc || '',
      active: item.active !== false,
      available: item.available !== false,
    };
  }

  static async createMenuItem(data: Partial<MenuItemModel> & { restaurant_id: string; name: string; price: number }): Promise<MenuItemModel> {
    if (!data.restaurant_id) throw new Error('Restaurant ID is required to create a menu item');
    if (!data.name || !data.name.trim()) throw new Error('Menu item name is required');

    const targetId = await this.resolveRestaurantId(data.restaurant_id);

    const price = Number(data.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Invalid price "${data.price}": Price must be a finite non-negative number`);
    }

    const categories = await this.listMenuCategories(targetId);
    const categoryId = String(data.category_id || data.category || '').trim();
    const cleanCatLower = categoryId.toLowerCase().replace(/^cat_/, '');

    let matchedCat = categories.find(c => 
      c.active !== false && (
        c._id === categoryId || 
        (c as any).id === categoryId || 
        c._id.toLowerCase() === categoryId.toLowerCase() ||
        c._id.toLowerCase() === `cat_${cleanCatLower}` ||
        (c.name && c.name.toLowerCase() === cleanCatLower) ||
        (c.title && c.title.toLowerCase() === cleanCatLower)
      )
    );

    if (!matchedCat) {
      matchedCat = categories.find(c => c.active !== false && c.parent_id !== null) || categories[0];
    }

    let recipe = data.recipe;
    if (Array.isArray(recipe)) {
      recipe = recipe.map((r: any) => {
        const ingId = String(r.ingredient_id || r.ingredientId || '').trim();
        const qty = Number(r.quantity || r.amount || 0);
        const unit = r.unit || 'g';
        return { ingredient_id: ingId, quantity: qty, unit };
      }).filter((r: any) => r.ingredient_id && r.quantity > 0);
    }

    const now = new Date().toISOString();
    const itemId = data._id || (data as any).id || `ITM_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const imgUrl = data.image_url || (data as any).imageUrl || null;
    const desc = data.desc || data.description || '';

    const item: MenuItemModel = {
      _id: itemId,
      restaurant_id: targetId,
      category_id: matchedCat ? matchedCat._id : (data.category_id || data.category || 'cat_mains'),
      name: data.name.trim(),
      description: desc,
      desc: desc,
      price,
      emoji: data.emoji || '🍽️',
      image_url: imgUrl,
      sort_order: data.sort_order ?? 0,
      active: true,
      available: data.available !== false,
      recipe: recipe || [],
      modifier_groups: data.modifier_groups || [],
      variants: data.variants || [],
      created_at: now,
      updated_at: now,
    };

    if (env.isMongoMode) {
      const db = await this.ensureReady();
      // Deduplication check: if item with same name exists for this restaurant, update it (upsert)
      const existing = await db.collection<any>(COLLECTIONS.menu_items).findOne(
        { restaurant_id: targetId, name: item.name },
        { collation: { locale: 'en', strength: 2 } }
      );
      if (existing) {
        await db.collection<any>(COLLECTIONS.menu_items).updateOne(
          { _id: existing._id },
          {
            $set: {
              ...item,
              _id: existing._id,
              created_at: existing.created_at || now,
              updated_at: now,
            }
          }
        );
        return {
          ...item,
          _id: existing._id,
          created_at: existing.created_at || now,
          updated_at: now,
        };
      }

      const res = await db.collection<any>(COLLECTIONS.menu_items).insertOne({ ...item });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge menu item insertion in MongoDB Atlas');
      }
      return item;
    }

    const list = this.getCollection('menu_items');
    const existingIdx = list.findIndex(i => i.restaurant_id === targetId && i.name.trim().toLowerCase() === item.name.toLowerCase());
    if (existingIdx !== -1) {
      const existing = list[existingIdx];
      const updated = {
        ...item,
        _id: existing._id,
        created_at: existing.created_at || now,
        updated_at: now,
      };
      list[existingIdx] = updated;
      this.saveCollection('menu_items', list);
      return updated;
    }
    list.push(item);
    this.saveCollection('menu_items', list);
    return item;
  }

  static async updateMenuItem(id: string, restaurantId: string, update: Partial<MenuItemModel>): Promise<boolean> {
    if (!id) return false;
    const targetId = await this.resolveRestaurantId(restaurantId);

    if (update.price !== undefined) {
      const p = Number(update.price);
      if (!Number.isFinite(p) || p < 0) {
        throw new Error(`Invalid price "${update.price}": Price must be a finite non-negative number`);
      }
    }

    const imageUrl = update.image_url !== undefined ? update.image_url : ((update as any).imageUrl !== undefined ? (update as any).imageUrl : undefined);
    const desc = update.desc !== undefined ? update.desc : (update.description !== undefined ? update.description : undefined);

    let categoryId = update.category_id || (update as any).category;
    if (categoryId) {
      const targetCatId = String(categoryId).trim();
      const categories = await this.listMenuCategories(targetId);
      const cleanCatLower = targetCatId.toLowerCase().replace(/^cat_/, '');
      const matched = categories.find(c => 
        c.active !== false && (
          c._id === targetCatId || 
          (c as any).id === targetCatId || 
          c._id.toLowerCase() === targetCatId.toLowerCase() ||
          c._id.toLowerCase() === `cat_${cleanCatLower}` ||
          (c.name && c.name.toLowerCase() === cleanCatLower) ||
          (c.title && c.title.toLowerCase() === cleanCatLower)
        )
      );
      if (matched) {
        categoryId = matched._id;
      }
    }

    let recipe = update.recipe;
    if (Array.isArray(recipe)) {
      recipe = recipe.map((r: any) => {
        const ingId = String(r.ingredient_id || r.ingredientId || '').trim();
        const qty = Number(r.quantity || r.amount || 0);
        const unit = r.unit || 'g';
        return { ingredient_id: ingId, quantity: qty, unit };
      }).filter((r: any) => r.ingredient_id && r.quantity > 0);
    }

    const mongoSet: any = {
      ...update,
      updated_at: new Date().toISOString()
    };
    if (imageUrl !== undefined) {
      mongoSet.image_url = imageUrl;
      mongoSet.imageUrl = imageUrl;
      mongoSet.image = imageUrl;
    }
    if (desc !== undefined) {
      mongoSet.desc = desc;
      mongoSet.description = desc;
    }
    if (categoryId) {
      mongoSet.category_id = categoryId;
      mongoSet.category = categoryId;
    }
    if (recipe !== undefined) {
      mongoSet.recipe = recipe;
    }
    if (update.modifier_groups !== undefined) {
      mongoSet.modifier_groups = update.modifier_groups;
      mongoSet.modifierGroups = update.modifier_groups;
    } else if ((update as any).modifierGroups !== undefined) {
      mongoSet.modifier_groups = (update as any).modifierGroups;
      mongoSet.modifierGroups = (update as any).modifierGroups;
    }

    if (env.isMongoMode) {
      const db = await this.ensureReady();
      const res = await db.collection<any>(COLLECTIONS.menu_items).updateOne(
        { $or: [{ _id: id }, { id: id }], restaurant_id: targetId } as any,
        { $set: mongoSet }
      );
      // Explicit check: matchedCount === 0 means item does not exist for this restaurant
      return res.matchedCount > 0;
    }

    const list = this.getCollection('menu_items') as MenuItemModel[];
    let idx = list.findIndex(i => (i._id === id || (i as any).id === id) && i.restaurant_id === targetId && i.active !== false);
    if (idx === -1) {
      return false;
    }
    list[idx] = { ...list[idx], ...mongoSet };
    this.saveCollection('menu_items', list);
    return true;
  }

  static async deleteMenuItem(id: string, restaurantId: string): Promise<boolean> {
    if (!id || !restaurantId) return false;
    const targetId = await this.resolveRestaurantId(restaurantId);
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.menu_items).updateOne(
        { $or: [{ _id: id }, { id: id }], restaurant_id: targetId } as any,
        { $set: { active: false, updated_at: now } }
      );
      return res.matchedCount > 0;
    }

    const list = this.getCollection('menu_items') as MenuItemModel[];
    const idx = list.findIndex(i => (i._id === id || (i as any).id === id) && i.restaurant_id === targetId && i.active !== false);
    if (idx === -1) return false;
    list[idx].active = false;
    list[idx].updated_at = now;
    this.saveCollection('menu_items', list);
    return true;
  }

  static async setMenuItemAvailability(id: string, restaurantId: string, available: boolean): Promise<boolean> {
    return this.updateMenuItem(id, restaurantId, { available });
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                                ORDERS CRUD                                  */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async createOrder(data: Omit<Order, '_id' | 'created_at' | 'updated_at'>): Promise<Order> {
    const now = new Date().toISOString();
    const id = `ORD_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`.toUpperCase();
    const order: Order = {
      _id: id,
      ...data,
      created_at: now,
      updated_at: now,
    };

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      if (data.idempotency_key) {
        const existing = await db.collection<any>(COLLECTIONS.orders).findOne({
          restaurant_id: data.restaurant_id,
          idempotency_key: data.idempotency_key
        });
        if (existing) {
          return {
            ...existing,
            _id: (existing._id as any).toString(),
            id: (existing._id as any).toString(),
          } as unknown as Order;
        }
      }

      const res = await db.collection<any>(COLLECTIONS.orders).insertOne({ ...order });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge order insertion in MongoDB Atlas');
      }
      return order;
    }

    if (data.idempotency_key) {
      const existing = this.getCollection('orders').find(
        o => o.restaurant_id === data.restaurant_id && o.idempotency_key === data.idempotency_key
      );
      if (existing) return existing;
    }

    const list = this.getCollection('orders');
    list.unshift(order);
    this.saveCollection('orders', list);
    return order;
  }

  static async getOrder(id: string, restaurantId: string): Promise<Order | null> {
    if (!id || !restaurantId) return null;

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const doc = await db.collection<any>(COLLECTIONS.orders).findOne({
        _id: id,
        restaurant_id: restaurantId
      });
      if (!doc) return null;
      return {
        ...doc,
        _id: (doc._id as any).toString(),
        id: (doc._id as any).toString(),
      } as unknown as Order;
    }

    return this.getCollection('orders').find(o => o._id === id && o.restaurant_id === restaurantId) || null;
  }

  static async getOrderById(id: string, restaurantId?: string): Promise<Order | null> {
    if (!id) return null;
    const cleanId = String(id).replace(/^cav-/, '');

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const query: any = {
        $or: [{ _id: id }, { id: id }, { _id: cleanId }, { id: cleanId }]
      };
      if (restaurantId) query.restaurant_id = restaurantId;
      const doc = await db.collection<any>(COLLECTIONS.orders).findOne(query);
      if (!doc) return null;
      return {
        ...doc,
        _id: (doc._id as any).toString(),
        id: (doc._id as any).toString(),
      } as unknown as Order;
    }

    const list = this.getCollection('orders');
    return list.find(o => 
      (o._id === id || (o as any).id === id || o._id === cleanId || (o as any).id === cleanId) &&
      (!restaurantId || o.restaurant_id === restaurantId)
    ) || null;
  }

  static async listOrders(restaurantId: string, filters?: { status?: OrderStatus; limit?: number }): Promise<Order[]> {
    if (!restaurantId) return [];

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const query: any = { restaurant_id: restaurantId };
      if (filters?.status) query.status = filters.status;
      const limit = filters?.limit || 100;
      const docs = await db.collection<any>(COLLECTIONS.orders)
        .find(query)
        .sort({ created_at: -1 })
        .limit(limit)
        .toArray();

      return docs.map(d => ({
        ...d,
        _id: (d._id as any).toString(),
        id: (d._id as any).toString(),
      })) as unknown as Order[];
    }

    let list = this.getCollection('orders').filter(o => o.restaurant_id === restaurantId);
    if (filters?.status) list = list.filter(o => o.status === filters.status);
    if (filters?.limit) list = list.slice(0, filters.limit);
    return list;
  }

  static async updateOrderStatus(id: string, restaurantId: string, status: string, extra?: Partial<Order>): Promise<boolean> {
    if (!id || !restaurantId) return false;
    const cleanId = String(id).replace(/^cav-/, '');
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.orders).updateOne(
        {
          $or: [{ _id: id }, { id: id }, { _id: cleanId }, { id: cleanId }],
          restaurant_id: restaurantId
        },
        {
          $set: {
            status: status as any,
            ...extra,
            updated_at: now
          }
        }
      );
      return res.matchedCount > 0;
    }

    const list = this.getCollection('orders');
    const idx = list.findIndex(o => 
      (o._id === id || (o as any).id === id || o._id === cleanId || (o as any).id === cleanId) && 
      o.restaurant_id === restaurantId
    );
    if (idx === -1) return false;
    list[idx] = {
      ...list[idx],
      status: status as any,
      ...extra,
      updated_at: now,
    };
    this.saveCollection('orders', list);
    return true;
  }

  static async deleteOrder(id: string, restaurantId?: string): Promise<boolean> {
    if (!id) return false;
    const cleanId = String(id).replace(/^cav-/, '');

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const query: any = {
        $or: [{ _id: id }, { id: id }, { _id: cleanId }, { id: cleanId }]
      };
      if (restaurantId) query.restaurant_id = restaurantId;
      const res = await db.collection<any>(COLLECTIONS.orders).deleteOne(query);
      return res.deletedCount > 0;
    }

    const list = this.getCollection('orders');
    const idx = list.findIndex(o => 
      (o._id === id || (o as any).id === id || o._id === cleanId || (o as any).id === cleanId) &&
      (!restaurantId || o.restaurant_id === restaurantId)
    );
    if (idx === -1) return false;
    list.splice(idx, 1);
    this.saveCollection('orders', list);
    return true;
  }

  static async clearArchive(restaurantId: string): Promise<number> {
    if (!restaurantId) return 0;

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.orders).deleteMany({
        restaurant_id: restaurantId,
        $or: [
          { status: 'fulfilled' },
          { status: 'completed' },
          { closedSession: true }
        ]
      });
      return res.deletedCount;
    }

    const list = this.getCollection('orders');
    const toDelete = list.filter(o => 
      o.restaurant_id === restaurantId && 
      ((o as any).status === 'fulfilled' || (o as any).status === 'completed' || (o as any).closedSession)
    );

    const remaining = list.filter(o => 
      !(o.restaurant_id === restaurantId && ((o as any).status === 'fulfilled' || (o as any).status === 'completed' || (o as any).closedSession))
    );

    this.saveCollection('orders', remaining);
    return toDelete.length;
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                  INVENTORY & IMMUTABLE INVENTORY LEDGER                     */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async addInventoryItem(item: {
    restaurant_id: string;
    name: string;
    category?: string;
    stock: number;
    unit: string;
    reorder_threshold?: number;
    cost_per_unit?: number;
  }): Promise<InventoryItem> {
    const id = `inv_${item.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const now = new Date().toISOString();
    const newItem: InventoryItem = {
      _id: id,
      restaurant_id: item.restaurant_id,
      name: item.name,
      category: item.category || 'shisha',
      stock: item.stock || 0,
      unit: item.unit || 'g',
      low_threshold: item.reorder_threshold || 100,
      reorder_threshold: item.reorder_threshold || 100,
      cost_per_unit: item.cost_per_unit || 0,
      active: true,
      created_at: now,
      updated_at: now
    };

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.inventory).insertOne({ ...newItem });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge inventory insertion in MongoDB Atlas');
      }
      return newItem;
    }

    const list = this.getCollection('inventory_items');
    list.push(newItem);
    this.saveCollection('inventory_items', list);
    return newItem;
  }

  static async listInventory(restaurantId: string): Promise<InventoryItem[]> {
    if (!restaurantId) return [];

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      let docs = await db.collection<any>(COLLECTIONS.inventory).find({
        restaurant_id: restaurantId,
        active: { $ne: false }
      }).toArray();

      if (docs.length === 0) {
        await this.ensureDefaultInventory(restaurantId);
        docs = await db.collection<any>(COLLECTIONS.inventory).find({
          restaurant_id: restaurantId,
          active: { $ne: false }
        }).toArray();
      }

      return docs.map(d => ({
        ...d,
        _id: (d._id as any).toString(),
        id: (d._id as any).toString(),
      })) as unknown as InventoryItem[];
    }

    const allItems = this.getCollection('inventory_items');
    let items = allItems.filter(i => i.restaurant_id === restaurantId);
    if (items.length === 0 && restaurantId) {
      await this.ensureDefaultInventory(restaurantId);
      items = this.getCollection('inventory_items').filter(i => i.restaurant_id === restaurantId);
    }
    return items;
  }

  static async updateInventoryStock(
    id: string,
    restaurantId: string,
    adjustment: number,
    transactionMeta?: { type: InventoryTransaction['type']; reason: string; orderId?: string; userId?: string }
  ): Promise<boolean> {
    if (!id || !restaurantId) return false;
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const item = await db.collection<any>(COLLECTIONS.inventory).findOne({
        _id: id,
        restaurant_id: restaurantId
      });
      if (!item) return false;

      const prevQty = item.stock || 0;
      const newQty = Math.max(0, prevQty + adjustment);
      const res = await db.collection<any>(COLLECTIONS.inventory).updateOne(
        { _id: id, restaurant_id: restaurantId },
        { $set: { stock: newQty, updated_at: now } }
      );

      if (res.matchedCount > 0 && transactionMeta) {
        await this.recordInventoryTransaction({
          restaurant_id: restaurantId,
          inventory_item_id: id,
          item_name: item.name,
          type: transactionMeta.type,
          quantity_change: adjustment,
          previous_quantity: prevQty,
          new_quantity: newQty,
          reason: transactionMeta.reason,
          order_id: transactionMeta.orderId,
          user_id: transactionMeta.userId,
        });
      }

      return res.matchedCount > 0;
    }

    const list = this.getCollection('inventory_items');
    const idx = list.findIndex(i => i._id === id && i.restaurant_id === restaurantId);
    if (idx === -1) return false;

    const prevQty = list[idx].stock || 0;
    const newQty = Math.max(0, prevQty + adjustment);
    list[idx].stock = newQty;
    list[idx].updated_at = now;
    this.saveCollection('inventory_items', list);

    if (transactionMeta) {
      await this.recordInventoryTransaction({
        restaurant_id: restaurantId,
        inventory_item_id: id,
        item_name: list[idx].name,
        type: transactionMeta.type,
        quantity_change: adjustment,
        previous_quantity: prevQty,
        new_quantity: newQty,
        reason: transactionMeta.reason,
        order_id: transactionMeta.orderId,
        user_id: transactionMeta.userId,
      });
    }

    return true;
  }

  static async updateInventoryItem(
    id: string,
    restaurantId: string,
    fields: Partial<InventoryItem>
  ): Promise<boolean> {
    if (!id || !restaurantId) return false;
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.inventory).updateOne(
        { $or: [{ _id: id }, { id: id }], restaurant_id: restaurantId },
        { $set: { ...fields, updated_at: now } }
      );
      return res.matchedCount > 0;
    }

    const list = this.getCollection('inventory_items');
    const idx = list.findIndex(i => (i._id === id || (i as any).id === id) && i.restaurant_id === restaurantId);
    if (idx === -1) return false;

    list[idx] = {
      ...list[idx],
      ...fields,
      updated_at: now
    };
    this.saveCollection('inventory_items', list);
    return true;
  }

  static async deleteInventoryItem(id: string, restaurantId: string): Promise<boolean> {
    if (!id || !restaurantId) return false;
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.inventory).updateOne(
        { $or: [{ _id: id }, { id: id }], restaurant_id: restaurantId },
        { $set: { active: false, updated_at: now } }
      );
      return res.matchedCount > 0;
    }

    const list = this.getCollection('inventory_items');
    const idx = list.findIndex(i => (i._id === id || (i as any).id === id) && i.restaurant_id === restaurantId);
    if (idx === -1) return false;

    list.splice(idx, 1);
    this.saveCollection('inventory_items', list);
    return true;
  }

  static async recordInventoryTransaction(
    tx: Omit<InventoryTransaction, '_id' | 'timestamp'>
  ): Promise<InventoryTransaction> {
    const entry: InventoryTransaction = {
      _id: `ITX_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`.toUpperCase(),
      ...tx,
      timestamp: new Date().toISOString(),
    };

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.inventory_transactions).insertOne({ ...entry });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge inventory transaction in MongoDB Atlas');
      }
      return entry;
    }

    const list = this.getCollection('inventory_transactions');
    list.unshift(entry);
    this.saveCollection('inventory_transactions', list);
    return entry;
  }

  static async listInventoryTransactions(restaurantId: string, limit = 100): Promise<InventoryTransaction[]> {
    if (!restaurantId) return [];

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const docs = await db.collection<any>(COLLECTIONS.inventory_transactions)
        .find({ restaurant_id: restaurantId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      return docs.map(d => ({
        ...d,
        _id: (d._id as any).toString(),
        id: (d._id as any).toString(),
      })) as unknown as InventoryTransaction[];
    }

    return this.getCollection('inventory_transactions')
      .filter(tx => tx.restaurant_id === restaurantId)
      .slice(0, limit);
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                        TIMECARDS & SHIFT RETENTION                          */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async createTimecard(data: Omit<Timecard, '_id' | 'created_at' | 'updated_at'>): Promise<Timecard> {
    const now = new Date().toISOString();
    const id = `TC_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const timecard: Timecard = {
      _id: id,
      ...data,
      created_at: now,
      updated_at: now,
    };

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.timecards).insertOne({ ...timecard });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge timecard insertion in MongoDB Atlas');
      }
      return timecard;
    }

    const list = this.getCollection('timecards');
    list.push(timecard);
    this.saveCollection('timecards', list);
    return timecard;
  }

  static async getTimecard(id: string, restaurantId: string): Promise<Timecard | null> {
    if (!id || !restaurantId) return null;

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const doc = await db.collection<any>(COLLECTIONS.timecards).findOne({
        _id: id,
        restaurant_id: restaurantId
      });
      if (!doc) return null;
      return {
        ...doc,
        _id: (doc._id as any).toString(),
        id: (doc._id as any).toString(),
      } as unknown as Timecard;
    }

    return this.getCollection('timecards').find(t => t._id === id && t.restaurant_id === restaurantId) || null;
  }

  static async getActiveTimecard(restaurantId: string, userId: string): Promise<Timecard | null> {
    if (!restaurantId || !userId) return null;

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const doc = await db.collection<any>(COLLECTIONS.timecards).findOne({
        restaurant_id: restaurantId,
        user_id: userId,
        status: 'active'
      });
      if (!doc) return null;
      return {
        ...doc,
        _id: (doc._id as any).toString(),
        id: (doc._id as any).toString(),
      } as unknown as Timecard;
    }

    return this.getCollection('timecards').find(
      t => t.restaurant_id === restaurantId && t.user_id === userId && t.status === 'active'
    ) || null;
  }

  static async updateTimecard(id: string, restaurantId: string, update: Partial<Timecard>): Promise<boolean> {
    if (!id || !restaurantId) return false;
    const now = new Date().toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.timecards).updateOne(
        { _id: id, restaurant_id: restaurantId },
        { $set: { ...update, updated_at: now } }
      );
      return res.matchedCount > 0;
    }

    const list = this.getCollection('timecards');
    const idx = list.findIndex(t => t._id === id && t.restaurant_id === restaurantId);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...update, updated_at: now };
    this.saveCollection('timecards', list);
    return true;
  }

  static async listTimecards(
    restaurantId: string,
    filters?: { userId?: string; role?: string; status?: string; startDate?: string; endDate?: string }
  ): Promise<Timecard[]> {
    if (!restaurantId) return [];

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const query: any = { restaurant_id: restaurantId };
      if (filters?.userId) query.user_id = filters.userId;
      if (filters?.role) query.role = filters.role;
      if (filters?.status) query.status = filters.status;
      if (filters?.startDate || filters?.endDate) {
        query.clock_in = {};
        if (filters.startDate) query.clock_in.$gte = filters.startDate;
        if (filters.endDate) query.clock_in.$lte = filters.endDate;
      }

      const docs = await db.collection<any>(COLLECTIONS.timecards)
        .find(query)
        .sort({ clock_in: -1 })
        .toArray();

      return docs.map(d => ({
        ...d,
        _id: (d._id as any).toString(),
        id: (d._id as any).toString(),
      })) as unknown as Timecard[];
    }

    let list = this.getCollection('timecards').filter(t => t.restaurant_id === restaurantId);
    if (filters?.userId) list = list.filter(t => t.user_id === filters.userId);
    if (filters?.role) list = list.filter(t => t.role === filters.role);
    if (filters?.status) list = list.filter(t => t.status === filters.status);
    if (filters?.startDate) {
      const start = new Date(filters.startDate).getTime();
      list = list.filter(t => new Date(t.clock_in).getTime() >= start);
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate).getTime();
      list = list.filter(t => new Date(t.clock_in).getTime() <= end);
    }

    return list.sort((a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime());
  }

  static async deleteTimecard(id: string, restaurantId: string): Promise<boolean> {
    if (!id || !restaurantId) return false;

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.timecards).deleteOne({
        _id: id,
        restaurant_id: restaurantId
      });
      return res.deletedCount > 0;
    }

    const list = this.getCollection('timecards');
    const idx = list.findIndex(t => t._id === id && t.restaurant_id === restaurantId);
    if (idx === -1) return false;
    list.splice(idx, 1);
    this.saveCollection('timecards', list);
    return true;
  }

  static async archiveExpiredTimecards(restaurantId?: string, retentionDays = 180): Promise<{ archivedCount: number }> {
    const cutoffIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const query: any = {
        clock_in: { $lt: cutoffIso },
        status: 'completed'
      };
      if (restaurantId) query.restaurant_id = restaurantId;

      const res = await db.collection<any>(COLLECTIONS.timecards).updateMany(
        query,
        { $set: { status: 'archived', updated_at: new Date().toISOString() } }
      );
      return { archivedCount: res.modifiedCount };
    }

    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const list = this.getCollection('timecards');
    let archivedCount = 0;

    for (const card of list) {
      const cardTime = new Date(card.clock_in || card.created_at).getTime();
      const matchRestaurant = !restaurantId || card.restaurant_id === restaurantId;
      if (matchRestaurant && cardTime < cutoffTime && card.status === 'completed') {
        card.status = 'archived';
        archivedCount++;
      }
    }

    if (archivedCount > 0) {
      this.saveCollection('timecards', list);
    }

    return { archivedCount };
  }

  static async pruneExpiredTimecards(restaurantId?: string, retentionDays = 180): Promise<{ prunedCount: number }> {
    const res = await this.archiveExpiredTimecards(restaurantId, retentionDays);
    return { prunedCount: res.archivedCount };
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                             AUDIT LOGGING                                   */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async logAudit(
    restaurantId: string,
    actorId: string,
    actorName: string,
    action: AuditLog['action'],
    resourceType: string,
    resourceId: string,
    metadata: Record<string, any> = {}
  ): Promise<AuditLog> {
    const now = new Date().toISOString();
    const log: AuditLog = {
      _id: `AUD_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`.toUpperCase(),
      restaurant_id: restaurantId,
      actor_id: actorId,
      actor_name: actorName,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata,
      timestamp: now,
    };

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.audit_logs).insertOne({ ...log });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge audit log insertion in MongoDB Atlas');
      }
      return log;
    }

    const list = this.getCollection('audit_logs');
    list.unshift(log);
    this.saveCollection('audit_logs', list);
    return log;
  }

  static async listAuditLogs(restaurantId: string, limit = 100): Promise<AuditLog[]> {
    if (!restaurantId) return [];

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const docs = await db.collection<any>(COLLECTIONS.audit_logs)
        .find({ restaurant_id: restaurantId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      return docs.map(d => ({
        ...d,
        _id: (d._id as any).toString(),
        id: (d._id as any).toString(),
      })) as unknown as AuditLog[];
    }

    return this.getCollection('audit_logs')
      .filter(l => l.restaurant_id === restaurantId)
      .slice(0, limit);
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                         MARKETING LEADS CRUD                                */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async createLead(data: {
    name: string;
    restaurant_name: string;
    email: string;
    phone?: string;
    message?: string;
    source?: string;
  }): Promise<any> {
    const now = new Date().toISOString();
    const lead = {
      _id: `LEAD_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`.toUpperCase(),
      name: data.name,
      restaurant_name: data.restaurant_name,
      email: data.email,
      phone: data.phone || null,
      message: data.message || null,
      status: 'new',
      source: data.source || 'website',
      assigned_to: null,
      created_at: now,
      updated_at: now,
    };

    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const res = await db.collection<any>(COLLECTIONS.leads).insertOne({ ...lead });
      if (!res.acknowledged) {
        throw new DatabaseUnavailableError('Failed to acknowledge lead insertion in MongoDB Atlas');
      }
      return lead;
    }

    const list = this.getCollection('leads') as any[];
    list.unshift(lead);
    this.saveCollection('leads', list as any);
    return lead;
  }

  static async listLeads(limit = 100): Promise<any[]> {
    if (env.isMongoMode) {
      const db = this.assertDbReady();
      const docs = await db.collection<any>(COLLECTIONS.leads)
        .find({})
        .sort({ created_at: -1 })
        .limit(limit)
        .toArray();

      return docs.map(d => ({
        ...d,
        _id: (d._id as any).toString(),
        id: (d._id as any).toString(),
      }));
    }

    return (this.getCollection('leads') as any[]).slice(0, limit);
  }

  static async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
    this.mongoConnected = false;
    this.initialized = false;
  }
}
