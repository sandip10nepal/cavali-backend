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
}

export class MultiTenantDbService {
  private static client: MongoClient | null = null;
  private static db: Db | null = null;
  private static initialized = false;
  private static localDb: LocalSchema | null = null;
  private static mongoConnected = false;
  private static backupIntervalId: any = null;

  /* ─────────────── Initialization ─────────────── */

  static async initialize(mongoUri?: string): Promise<void> {
    // 1. Load local schema cache
    this.localDb = this.loadLocalDb();
    this.initialized = true;

    // 2. Connect to MongoDB Atlas
    const uri = mongoUri || process.env.MONGODB_URI;
    if (uri) {
      try {
        console.log('☁️  [MultiTenantDB] Connecting to MongoDB Atlas authoritative cluster...');
        this.client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await this.client.connect();
        this.db = this.client.db();
        this.mongoConnected = true;
        console.log('✅ [MultiTenantDB] Connected to MongoDB Atlas successfully.');

        await this.ensureIndexes();
        await this.migrateLocalDataToAtlasIfEmpty();
      } catch (err) {
        console.warn('⚠️  [MultiTenantDB] MongoDB Atlas connection failed. Operating in local cached mode:', (err as Error).message);
      }
    }

    // 3. Ensure essential baseline data
    await this.ensureRestaurantCodes();
    await this.ensureDefaultStaff();
    await this.ensureDefaultInventory();
    await this.archiveExpiredTimecards(undefined, 180).catch(() => {});

    console.log(`📁 [MultiTenantDB] SaaS Engine Ready: ${this.localDb.restaurants?.length || 0} restaurants, ${this.localDb.menu_items?.length || 0} menu items`);
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
        return parsed;
      }
    } catch (e) {
      console.error('Error loading multi_tenant_db.json:', e);
    }
    const empty: LocalSchema = {
      restaurants: [], users: [], devices: [], device_activation_codes: [], tables: [],
      menu_categories: [], menu_items: [], orders: [], inventory_items: [], inventory_categories: [],
      inventory_transactions: [], payment_sessions: [], audit_logs: [],
      customer_sessions: [], credits: [], timecards: [], leads: [],
    };
    this.saveLocalDb(empty);
    return empty;
  }

  private static saveLocalDb(data: LocalSchema) {
    this.localDb = data;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving multi_tenant_db.json:', e);
    }
  }

  private static getCollection<K extends keyof LocalSchema>(key: K): LocalSchema[K] {
    if (!this.localDb) this.localDb = this.loadLocalDb();
    if (!this.localDb[key]) (this.localDb as any)[key] = [];
    return this.localDb[key];
  }

  private static saveCollection<K extends keyof LocalSchema>(key: K, data: LocalSchema[K]) {
    if (!this.localDb) this.localDb = this.loadLocalDb();
    this.localDb[key] = data;
    this.saveLocalDb(this.localDb);
  }

  /* ─────────────── MongoDB Sync & Migrations ─────────────── */

  private static async syncDirectMongo(colName: string, op: 'upsert' | 'delete', docOrId: any): Promise<void> {
    if (!this.mongoConnected || !this.db) return;
    try {
      if (op === 'upsert') {
        await this.db.collection(colName).updateOne(
          { _id: docOrId._id },
          { $set: docOrId },
          { upsert: true }
        );
      } else if (op === 'delete') {
        const id = typeof docOrId === 'string' ? docOrId : docOrId._id;
        await this.db.collection(colName).deleteOne({ _id: id });
      }
    } catch (err) {
      console.warn(`[MultiTenantDB] Direct MongoDB sync error on ${colName}:`, (err as Error).message);
    }
  }

  private static async migrateLocalDataToAtlasIfEmpty(): Promise<void> {
    if (!this.mongoConnected || !this.db || !this.localDb) return;
    try {
      const restCount = await this.db.collection(COLLECTIONS.restaurants).countDocuments();
      if (restCount === 0 && this.localDb.restaurants?.length > 0) {
        console.log('📦 [MultiTenantDB] Migrating local data to MongoDB Atlas...');
        for (const [key, colName] of Object.entries(COLLECTIONS)) {
          const items = (this.localDb as any)[key] || (this.localDb as any)[colName];
          if (Array.isArray(items) && items.length > 0) {
            for (const item of items) {
              if (item && item._id) {
                await this.db.collection(colName).updateOne(
                  { _id: item._id },
                  { $set: item },
                  { upsert: true }
                );
              }
            }
          }
        }
        console.log('✅ [MultiTenantDB] Migration to MongoDB Atlas completed.');
      }
    } catch (err) {
      console.warn('[MultiTenantDB] Auto-migration error:', (err as Error).message);
    }
  }

  private static async ensureIndexes(): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.collection(COLLECTIONS.restaurants).createIndex({ slug: 1 }, { unique: true });
      await this.db.collection(COLLECTIONS.restaurants).createIndex({ restaurant_code: 1 }, { unique: true });
      await this.db.collection(COLLECTIONS.users).createIndex({ restaurant_id: 1, email: 1 });
      await this.db.collection(COLLECTIONS.devices).createIndex({ restaurant_id: 1, device_token: 1 });
      await this.db.collection(COLLECTIONS.device_activation_codes).createIndex({ restaurant_id: 1, code: 1 });
      await this.db.collection(COLLECTIONS.device_activation_codes).createIndex({ expires_at: 1 });
      await this.db.collection(COLLECTIONS.tables).createIndex({ restaurant_id: 1, number: 1 });
      await this.db.collection(COLLECTIONS.menu_categories).createIndex({ restaurant_id: 1, sort_order: 1 });
      await this.db.collection(COLLECTIONS.menu_items).createIndex({ restaurant_id: 1, category_id: 1 });
      await this.db.collection(COLLECTIONS.orders).createIndex({ restaurant_id: 1, status: 1 });
      await this.db.collection(COLLECTIONS.orders).createIndex({ restaurant_id: 1, idempotency_key: 1 });
      await this.db.collection(COLLECTIONS.inventory).createIndex({ restaurant_id: 1, category: 1 });
      await this.db.collection(COLLECTIONS.inventory_transactions).createIndex({ restaurant_id: 1, timestamp: -1 });
      await this.db.collection(COLLECTIONS.audit_logs).createIndex({ restaurant_id: 1, timestamp: -1 });
      await this.db.collection(COLLECTIONS.timecards).createIndex({ restaurant_id: 1, user_id: 1, clock_in: -1 });
      await this.db.collection(COLLECTIONS.timecards).createIndex({ restaurant_id: 1, status: 1 });
    } catch (e) {}
  }

  private static async ensureRestaurantCodes(): Promise<void> {
    const list = this.getCollection('restaurants');
    let changed = false;
    for (const r of list) {
      if (!r.restaurant_code) {
        r.restaurant_code = r.slug === 'cavali' ? '4821' : Math.floor(1000 + Math.random() * 9000).toString();
        changed = true;
        await this.syncDirectMongo(COLLECTIONS.restaurants, 'upsert', r);
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
          console.log(`✅ [MultiTenantDB] Seeded initial default inventory stock for venue ${rid}`);
        }
      }

      if (changed) {
        this.saveCollection('inventory_items', allInv);
      }
    } catch (e) {
      console.error('[MultiTenantDB] error in ensureDefaultInventory:', e);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                         RESTAURANT CRUD                                    */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async createRestaurant(data: Omit<Restaurant, '_id' | 'created_at' | 'updated_at' | 'restaurant_code'> & { restaurant_code?: string }): Promise<Restaurant> {
    const now = new Date().toISOString();
    const restaurant: Restaurant = {
      ...data,
      restaurant_code: data.restaurant_code || Math.floor(1000 + Math.random() * 9000).toString(),
      _id: `RES_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      created_at: now,
      updated_at: now,
    };
    const list = this.getCollection('restaurants');
    list.push(restaurant);
    this.saveCollection('restaurants', list);
    await this.syncDirectMongo(COLLECTIONS.restaurants, 'upsert', restaurant);
    return restaurant;
  }

  static async getRestaurant(id: string): Promise<Restaurant | null> {
    const list = this.getCollection('restaurants');
    return list.find(r => r._id === id) || null;
  }

  static async getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
    const list = this.getCollection('restaurants');
    return list.find(r => r.slug === slug.toLowerCase()) || null;
  }

  static async getRestaurantByCode(code: string): Promise<Restaurant | null> {
    const list = this.getCollection('restaurants');
    const cleanCode = String(code).trim();
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
      menu_items: menuItems.filter(i => i.active !== false).map(item => ({
        _id: item._id,
        id: item._id,
        restaurant_id: item.restaurant_id,
        category_id: item.category_id,
        name: item.name,
        description: item.description || item.desc || '',
        desc: item.desc || item.description || '',
        price: Number(item.price) || 0,
        emoji: item.emoji || '🍽️',
        image_url: item.image_url || null,
        imageUrl: item.image_url || null,
        sort_order: item.sort_order ?? 0,
        active: item.active !== false,
        available: item.available !== false,
        recipe: item.recipe || [],
        modifier_groups: item.modifier_groups || [],
        modifierGroups: item.modifier_groups || [],
        variants: item.variants || [],
      })).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      tables: tables.map(t => ({
        id: t._id,
        table_number: String(t.number || t.label || '1'),
        section: t.label || 'Main',
        status: t.active !== false ? 'available' : 'inactive',
      })),
    };
  }

  static async listRestaurants(): Promise<Restaurant[]> {
    return this.getCollection('restaurants');
  }

  static async updateRestaurant(id: string, update: Partial<Restaurant>): Promise<boolean> {
    const list = this.getCollection('restaurants');
    const idx = list.findIndex(r => r._id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...update, updated_at: new Date().toISOString() };
    this.saveCollection('restaurants', list);
    await this.syncDirectMongo(COLLECTIONS.restaurants, 'upsert', list[idx]);
    return true;
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                           USER / STAFF CRUD                                */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async createUser(data: Omit<User, '_id' | 'created_at' | 'updated_at'>): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      failed_login_attempts: 0,
      locked_until: null,
      token_version: 1,
      ...data,
      _id: `USR_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      created_at: now,
      updated_at: now,
    };
    const list = this.getCollection('users');
    list.push(user);
    this.saveCollection('users', list);
    await this.syncDirectMongo(COLLECTIONS.users, 'upsert', user);
    return user;
  }

  static async getUser(id: string): Promise<User | null> {
    return this.getCollection('users').find(u => u._id === id || (u as any).id === id) || null;
  }

  static async getUserByEmail(restaurantId: string, email: string): Promise<User | null> {
    return this.getCollection('users').find(u => u.restaurant_id === restaurantId && u.email?.toLowerCase() === email.toLowerCase()) || null;
  }

  static async findUserByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    return this.getCollection('users').find(u => u.active !== false && u.email?.toLowerCase() === cleanEmail) || null;
  }

  static async listUsers(restaurantId: string, includeInactive = false): Promise<User[]> {
    return this.getCollection('users').filter(u => u.restaurant_id === restaurantId && (includeInactive || u.active !== false));
  }

  static async updateUser(id: string, restaurantId: string, update: Partial<User>): Promise<boolean> {
    const list = this.getCollection('users');
    const idx = list.findIndex(u => (u._id === id || (u as any).id === id) && (u.restaurant_id === restaurantId || !restaurantId));
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...update, updated_at: new Date().toISOString() };
    this.saveCollection('users', list);
    await this.syncDirectMongo(COLLECTIONS.users, 'upsert', list[idx]);
    return true;
  }

  static async deleteUser(id: string, restaurantId?: string): Promise<boolean> {
    const list = this.getCollection('users');
    const idx = list.findIndex(u => (u._id === id || (u as any).id === id) && (!restaurantId || u.restaurant_id === restaurantId));
    if (idx === -1) return false;
    const removed = list.splice(idx, 1)[0];
    this.saveCollection('users', list);
    await this.syncDirectMongo(COLLECTIONS.users, 'delete', removed._id);
    return true;
  }

  /* ─────────────── Failed Login & Lockout Tracking ─────────────── */

  static async recordFailedLogin(userId: string): Promise<{ locked: boolean; lockedUntil?: string }> {
    const user = await this.getUser(userId);
    if (!user) return { locked: false };

    const attempts = (user.failed_login_attempts || 0) + 1;
    let lockedUntil: string | null = null;

    // 5 failed attempts = 15-minute temporary lockout
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
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit one-time code
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15-minute expiration

    const activation: DeviceActivationCode = {
      _id: `ACT_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
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

    const list = this.getCollection('device_activation_codes');
    list.push(activation);
    this.saveCollection('device_activation_codes', list);
    await this.syncDirectMongo(COLLECTIONS.device_activation_codes, 'upsert', activation);

    return activation;
  }

  static async verifyAndBurnActivationCode(
    restaurantCode: string,
    activationCode: string
  ): Promise<{ restaurant: Restaurant; activation: DeviceActivationCode } | null> {
    const restaurant = await this.getRestaurantByCode(restaurantCode);
    if (!restaurant) return null;

    const list = this.getCollection('device_activation_codes');
    const act = list.find(
      a => a.restaurant_id === restaurant._id &&
           a.code === activationCode.trim() &&
           !a.used &&
           new Date(a.expires_at).getTime() > Date.now()
    );

    if (!act) return null;

    // Burn code on use
    act.used = true;
    this.saveCollection('device_activation_codes', list);
    await this.syncDirectMongo(COLLECTIONS.device_activation_codes, 'upsert', act);

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

    const device: Device = {
      _id: `DEV_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
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

    const list = this.getCollection('devices');
    list.push(device);
    this.saveCollection('devices', list);
    await this.syncDirectMongo(COLLECTIONS.devices, 'upsert', device);

    return device;
  }

  static async getDevice(id: string): Promise<Device | null> {
    return this.getCollection('devices').find(d => d._id === id) || null;
  }

  static async getDeviceByToken(token: string): Promise<Device | null> {
    return this.getCollection('devices').find(d => d.device_token === token) || null;
  }

  static async listDevices(restaurantId: string): Promise<Device[]> {
    return this.getCollection('devices').filter(d => d.restaurant_id === restaurantId);
  }

  static async updateDevice(id: string, restaurantId: string, update: Partial<Device>): Promise<boolean> {
    const list = this.getCollection('devices');
    const idx = list.findIndex(d => d._id === id && d.restaurant_id === restaurantId);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...update };
    this.saveCollection('devices', list);
    await this.syncDirectMongo(COLLECTIONS.devices, 'upsert', list[idx]);
    return true;
  }

  static async revokeDevice(id: string, restaurantId: string): Promise<boolean> {
    return this.updateDevice(id, restaurantId, { status: 'REVOKED', last_activity: 'Revoked by Manager' });
  }

  static async recordDeviceHeartbeat(deviceId: string, appVersion?: string, osVersion?: string): Promise<void> {
    const list = this.getCollection('devices');
    const d = list.find(x => x._id === deviceId || x.device_token === deviceId);
    if (d) {
      d.last_seen_at = new Date().toISOString();
      if (appVersion) d.app_version = appVersion;
      if (osVersion) d.os_version = osVersion;
      if (d.status === 'OFFLINE') d.status = 'ACTIVE';
      this.saveCollection('devices', list);
      await this.syncDirectMongo(COLLECTIONS.devices, 'upsert', d);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                            MENU CATEGORIES & ITEMS                          */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async listCategories(restaurantId: string): Promise<MenuCategory[]> {
    return this.getCollection('menu_categories').filter(c => c.restaurant_id === restaurantId && c.active);
  }

  static async listMenuCategories(restaurantId: string): Promise<MenuCategory[]> {
    if (!restaurantId) throw new Error('Restaurant ID is required to list menu categories');
    const allCats = this.getCollection('menu_categories') as MenuCategory[];
    const venueCats = allCats.filter(c => c.restaurant_id === restaurantId && c.active !== false);

    return venueCats.map(c => {
      const isSuper = c.parent_id === null;
      const catName = c.name || c.title || 'Category';
      return {
        ...c,
        parent_id: c.parent_id !== undefined ? c.parent_id : (c.is_super ? null : `CAT_SUPER_${restaurantId}_${(c.menu_type || 'hookah').toUpperCase()}`),
        name: catName,
        title: catName,
        is_super: isSuper,
        active: c.active !== false,
      };
    }).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  static async createMenuCategory(data: Partial<MenuCategory> & { restaurant_id: string; title?: string; name?: string }): Promise<MenuCategory> {
    if (!data.restaurant_id) throw new Error('Restaurant ID is required to create a menu category');
    const name = (data.name || data.title || '').trim();

    if (!name) {
      throw new Error('Category name is required');
    }

    const allCats = this.getCollection('menu_categories') as MenuCategory[];
    let parentId: string | null = data.parent_id !== undefined ? data.parent_id : (data.is_super ? null : null);

    // Validate parent_id for Sub Categories
    if (parentId !== null) {
      const parent = allCats.find(c => c.restaurant_id === data.restaurant_id && (c._id === parentId || (c as any).id === parentId) && c.active !== false);
      if (!parent) {
        throw new Error(`Parent category "${parentId}" not found or inactive`);
      }
      if (parent.parent_id !== null) {
        throw new Error(`Parent category "${parent.name || parent._id}" is a Sub Category. Categories can only be 2 levels deep (Super -> Sub).`);
      }
    }

    const now = new Date().toISOString();
    const finalParentId = parentId === undefined ? null : parentId;
    const cat: MenuCategory = {
      _id: `CAT_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      restaurant_id: data.restaurant_id,
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
    await this.syncDirectMongo(COLLECTIONS.menu_categories, 'upsert', cat);
    return cat;
  }

  static async updateMenuCategory(id: string, restaurantId: string, update: Partial<MenuCategory>): Promise<boolean> {
    if (!restaurantId) throw new Error('Restaurant ID is required to update a menu category');
    const list = this.getCollection('menu_categories') as MenuCategory[];
    const targetId = String(id).trim();

    // Match ONLY by immutable _id / id
    const index = list.findIndex(c => c.restaurant_id === restaurantId && (c._id === targetId || (c as any).id === targetId) && c.active !== false);

    if (index === -1) {
      return false; // NO auto-creation on PATCH!
    }

    // If updating parent_id, validate new parent
    if (update.parent_id !== undefined && update.parent_id !== null) {
      const parent = list.find(c => c.restaurant_id === restaurantId && (c._id === update.parent_id || (c as any).id === update.parent_id) && c.active !== false);
      if (!parent) {
        throw new Error(`Parent category "${update.parent_id}" not found or inactive`);
      }
      if (parent.parent_id !== null) {
        throw new Error(`Parent category "${parent.name || parent._id}" is a Sub Category. Categories can only be 2 levels deep.`);
      }
    }

    const updatedName = (update.name || update.title || list[index].name || list[index].title || '').trim();

    list[index] = {
      ...list[index],
      ...update,
      name: updatedName,
      title: updatedName,
      description: update.description || update.subtitle || list[index].description,
      updated_at: new Date().toISOString()
    };

    this.saveCollection('menu_categories', list);
    await this.syncDirectMongo(COLLECTIONS.menu_categories, 'upsert', list[index]);
    return true;
  }

  static async deleteMenuCategory(id: string, restaurantId: string): Promise<{ success: boolean; conflict?: boolean; notFound?: boolean; message?: string }> {
    if (!restaurantId) throw new Error('Restaurant ID is required to delete a menu category');
    const list = this.getCollection('menu_categories') as MenuCategory[];
    const targetId = String(id).trim();

    // Match ONLY by immutable _id / id
    const targetIdx = list.findIndex(c => c.restaurant_id === restaurantId && (c._id === targetId || (c as any).id === targetId) && c.active !== false);

    if (targetIdx === -1) {
      return { success: false, notFound: true, message: 'Category not found.' };
    }

    const targetCat = list[targetIdx];

    // Safety Check 1: Active child categories (if Super Category)
    if (targetCat.parent_id === null) {
      const activeChildren = list.filter(c => c.restaurant_id === restaurantId && c.parent_id === targetCat._id && c.active !== false);
      if (activeChildren.length > 0) {
        return {
          success: false,
          conflict: true,
          message: `Cannot delete "${targetCat.name || targetCat.title}" because it contains ${activeChildren.length} active sub-category(ies).`
        };
      }
    }

    // Safety Check 2: Active menu items
    const items = this.getCollection('menu_items') as MenuItemModel[];
    const activeItems = items.filter(i => {
      if (i.restaurant_id !== restaurantId || i.active === false) return false;
      return i.category_id === targetCat._id || (i as any).category === targetCat._id;
    });

    if (activeItems.length > 0) {
      return {
        success: false,
        conflict: true,
        message: `Cannot delete "${targetCat.name || targetCat.title}" because it contains ${activeItems.length} active menu item(s).`
      };
    }

    // Soft delete: set active = false
    list[targetIdx].active = false;
    list[targetIdx].updated_at = new Date().toISOString();

    this.saveCollection('menu_categories', list);
    await this.syncDirectMongo(COLLECTIONS.menu_categories, 'upsert', list[targetIdx]);

    return { success: true };
  }

  static async listInventoryCategories(restaurantId: string): Promise<any[]> {
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
        await this.syncDirectMongo('inventory_categories', 'upsert', d);
      }
      this.saveCollection('inventory_categories', allInvCats);
      list = allInvCats.filter(c => c.restaurant_id === restaurantId && c.active !== false);
    }
    return list.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
  }

  static async createInventoryCategory(data: { restaurant_id: string; title: string; icon?: string; sort_order?: number }): Promise<any> {
    const now = new Date().toISOString();
    const cat: any = {
      _id: `INVCAT_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      restaurant_id: data.restaurant_id,
      title: data.title,
      icon: data.icon || '📦',
      sort_order: data.sort_order || 10,
      active: true,
      created_at: now,
      updated_at: now,
    };
    const list = this.getCollection('inventory_categories') as any[];
    list.push(cat);
    this.saveCollection('inventory_categories', list as any);
    await this.syncDirectMongo('inventory_categories', 'upsert', cat);
    return cat;
  }

  static async updateInventoryCategory(id: string, restaurantId: string, update: Partial<any>): Promise<boolean> {
    const list = this.getCollection('inventory_categories') as any[];
    const targetId = String(id).toLowerCase();
    const idx = list.findIndex(c => {
      if (c.restaurant_id !== restaurantId) return false;
      const cId = String(c._id || c.id || '').toLowerCase();
      const cTitle = String(c.title || '').toLowerCase();
      return cId === targetId || cTitle === targetId || cId.endsWith(`_${targetId}`);
    });
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...update, updated_at: new Date().toISOString() };
    this.saveCollection('inventory_categories', list as any);
    await this.syncDirectMongo('inventory_categories', 'upsert', list[idx]);
    return true;
  }

  static async deleteInventoryCategory(id: string, restaurantId: string): Promise<boolean> {
    const list = this.getCollection('inventory_categories') as any[];
    const targetId = String(id).toLowerCase();
    const idx = list.findIndex(c => {
      if (c.restaurant_id !== restaurantId) return false;
      const cId = String(c._id || c.id || '').toLowerCase();
      const cTitle = String(c.title || '').toLowerCase();
      return cId === targetId || cTitle === targetId || cId.endsWith(`_${targetId}`);
    });
    if (idx === -1) return false;
    list[idx].active = false;
    list[idx].updated_at = new Date().toISOString();
    this.saveCollection('inventory_categories', list as any);
    await this.syncDirectMongo('inventory_categories', 'upsert', list[idx]);
    return true;
  }

  static async createTable(data: Omit<RestaurantTable, '_id' | 'created_at'>): Promise<RestaurantTable> {
    const now = new Date().toISOString();
    const table: RestaurantTable = {
      _id: `TBL_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      ...data,
      created_at: now,
    };
    const list = this.getCollection('tables');
    list.push(table);
    this.saveCollection('tables', list);
    await this.syncDirectMongo(COLLECTIONS.tables, 'upsert', table);
    return table;
  }

  static async getTable(id?: string, restaurantId?: string): Promise<RestaurantTable | null> {
    if (!id) return null;
    return this.getCollection('tables').find(t => t._id === id && (!restaurantId || t.restaurant_id === restaurantId)) || null;
  }

  static async listTables(restaurantId: string): Promise<RestaurantTable[]> {
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
    let items = (this.getCollection('menu_items') as MenuItemModel[]).filter(i => i.restaurant_id === restaurantId && i.active !== false);
    if (categoryId) items = items.filter(i => (i.category_id || i.category || '').toLowerCase() === categoryId.toLowerCase());
    return items.map(i => ({
      ...i,
      category_id: i.category_id || i.category || '',
      category: i.category_id || i.category || '',
      active: i.active !== false,
      available: i.available !== false,
    })).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  static async getMenuItem(id: string, restaurantId: string): Promise<MenuItemModel | null> {
    const item = (this.getCollection('menu_items') as MenuItemModel[]).find(i => (i._id === id || (i as any).id === id) && i.restaurant_id === restaurantId && i.active !== false);
    if (!item) return null;
    return {
      ...item,
      category_id: item.category_id || item.category || '',
      category: item.category_id || item.category || '',
      active: item.active !== false,
      available: item.available !== false,
    };
  }

  static async createMenuItem(data: Partial<MenuItemModel> & { restaurant_id: string; name: string; price: number }): Promise<MenuItemModel> {
    if (!data.restaurant_id) throw new Error('Restaurant ID is required to create a menu item');
    if (!data.name || !data.name.trim()) throw new Error('Menu item name is required');

    const price = Number(data.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Invalid price "${data.price}": Price must be a finite non-negative number`);
    }

    const categories = await this.listMenuCategories(data.restaurant_id);
    const categoryId = String(data.category_id || data.category || '').trim();

    const matchedCat = categories.find(c => (c._id === categoryId || (c as any).id === categoryId) && c.active !== false);

    if (!matchedCat) {
      throw new Error(`Category "${categoryId}" not found or inactive for this venue`);
    }

    if (matchedCat.parent_id === null) {
      throw new Error(`Category "${matchedCat.name || matchedCat._id}" is a Super Category. Menu items can only be assigned to Sub Categories.`);
    }

    // Standardize & Validate recipes
    let recipe = data.recipe;
    if (Array.isArray(recipe)) {
      const invItems = (this.getCollection('inventory_items') as any[]).filter(i => i.restaurant_id === data.restaurant_id && i.active !== false);
      recipe = recipe.map((r: any) => {
        const ingId = String(r.ingredient_id || r.ingredientId || '').trim();
        const qty = Number(r.quantity || r.amount || 0);
        const unit = r.unit || 'g';

        if (ingId) {
          const invMatch = invItems.find(i => i._id === ingId || i.id === ingId || (i.name && i.name.toLowerCase() === ingId.toLowerCase()));
          if (!invMatch) {
            throw new Error(`Recipe ingredient "${ingId}" does not exist in inventory for this venue.`);
          }
        }

        return { ingredient_id: ingId, quantity: qty, unit };
      }).filter((r: any) => r.ingredient_id && r.quantity > 0);
    }

    const now = new Date().toISOString();
    const item: MenuItemModel = {
      _id: `ITM_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      restaurant_id: data.restaurant_id,
      category_id: matchedCat._id,
      name: data.name.trim(),
      description: data.description || data.desc || '',
      price,
      emoji: data.emoji || '🍽️',
      image_url: data.image_url || null,
      sort_order: data.sort_order ?? 0,
      active: true,
      available: data.available !== false,
      recipe: recipe || [],
      modifier_groups: data.modifier_groups || [],
      variants: data.variants || [],
      created_at: now,
      updated_at: now,
    };

    const list = this.getCollection('menu_items');
    list.push(item);
    this.saveCollection('menu_items', list);
    await this.syncDirectMongo(COLLECTIONS.menu_items, 'upsert', item);
    return item;
  }

  static async updateMenuItem(id: string, restaurantId: string, update: Partial<MenuItemModel>): Promise<boolean> {
    if (!restaurantId) throw new Error('Restaurant ID is required to update a menu item');
    const list = this.getCollection('menu_items') as MenuItemModel[];
    const idx = list.findIndex(i => (i._id === id || (i as any).id === id) && i.restaurant_id === restaurantId && i.active !== false);
    if (idx === -1) return false;

    if (update.price !== undefined) {
      const p = Number(update.price);
      if (!Number.isFinite(p) || p < 0) {
        throw new Error(`Invalid price "${update.price}": Price must be a finite non-negative number`);
      }
    }

    let categoryId = list[idx].category_id;
    if (update.category_id || update.category) {
      const targetCatId = String(update.category_id || update.category || '').trim();
      const categories = await this.listMenuCategories(restaurantId);
      const matched = categories.find(c => (c._id === targetCatId || (c as any).id === targetCatId) && c.active !== false);
      if (!matched) {
        throw new Error(`Category "${targetCatId}" not found or inactive for this venue`);
      }
      if (matched.parent_id === null) {
        throw new Error(`Category "${matched.name || matched._id}" is a Super Category. Menu items can only belong to Sub Categories.`);
      }
      categoryId = matched._id;
    }

    let recipe = update.recipe !== undefined ? update.recipe : list[idx].recipe;
    if (Array.isArray(recipe)) {
      const invItems = (this.getCollection('inventory_items') as any[]).filter(i => i.restaurant_id === restaurantId && i.active !== false);
      recipe = recipe.map((r: any) => {
        const ingId = String(r.ingredient_id || r.ingredientId || '').trim();
        const qty = Number(r.quantity || r.amount || 0);
        const unit = r.unit || 'g';
        if (ingId) {
          const invMatch = invItems.find(i => i._id === ingId || i.id === ingId || (i.name && i.name.toLowerCase() === ingId.toLowerCase()));
          if (!invMatch) {
            throw new Error(`Recipe ingredient "${ingId}" does not exist in inventory for this venue.`);
          }
        }
        return { ingredient_id: ingId, quantity: qty, unit };
      }).filter((r: any) => r.ingredient_id && r.quantity > 0);
    }

    list[idx] = {
      ...list[idx],
      ...update,
      category_id: categoryId,
      category: categoryId,
      price: update.price !== undefined ? Number(update.price) : list[idx].price,
      recipe: recipe || list[idx].recipe,
      description: update.description || update.desc || list[idx].description,
      updated_at: new Date().toISOString()
    };

    this.saveCollection('menu_items', list);
    await this.syncDirectMongo(COLLECTIONS.menu_items, 'upsert', list[idx]);
    return true;
  }

  static async deleteMenuItem(id: string, restaurantId: string): Promise<boolean> {
    if (!restaurantId) throw new Error('Restaurant ID is required to delete a menu item');
    const list = this.getCollection('menu_items') as MenuItemModel[];
    const idx = list.findIndex(i => (i._id === id || (i as any).id === id) && i.restaurant_id === restaurantId && i.active !== false);
    if (idx === -1) return false;
    list[idx].active = false;
    list[idx].updated_at = new Date().toISOString();
    this.saveCollection('menu_items', list);
    await this.syncDirectMongo(COLLECTIONS.menu_items, 'upsert', list[idx]);
    return true;
  }

  static async setMenuItemAvailability(id: string, restaurantId: string, available: boolean): Promise<boolean> {
    return this.updateMenuItem(id, restaurantId, { available });
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                                ORDERS CRUD                                  */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async createOrder(data: Omit<Order, '_id' | 'created_at' | 'updated_at'>): Promise<Order> {
    // Idempotency check: if client supplied an idempotency_key, return existing order
    if (data.idempotency_key) {
      const existing = this.getCollection('orders').find(
        o => o.restaurant_id === data.restaurant_id && o.idempotency_key === data.idempotency_key
      );
      if (existing) return existing;
    }

    const now = new Date().toISOString();
    const order: Order = {
      _id: `ORD_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`.toUpperCase(),
      ...data,
      created_at: now,
      updated_at: now,
    };
    const list = this.getCollection('orders');
    list.unshift(order);
    this.saveCollection('orders', list);
    await this.syncDirectMongo(COLLECTIONS.orders, 'upsert', order);
    return order;
  }

  static async getOrder(id: string, restaurantId: string): Promise<Order | null> {
    return this.getCollection('orders').find(o => o._id === id && o.restaurant_id === restaurantId) || null;
  }

  static async getOrderById(id: string, restaurantId?: string): Promise<Order | null> {
    const cleanId = String(id).replace(/^cav-/, '');
    const list = this.getCollection('orders');
    return list.find(o => 
      (o._id === id || (o as any).id === id || o._id === cleanId || (o as any).id === cleanId) &&
      (!restaurantId || o.restaurant_id === restaurantId)
    ) || null;
  }

  static async listOrders(restaurantId: string, filters?: { status?: OrderStatus; limit?: number }): Promise<Order[]> {
    let list = this.getCollection('orders').filter(o => o.restaurant_id === restaurantId);
    if (filters?.status) list = list.filter(o => o.status === filters.status);
    if (filters?.limit) list = list.slice(0, filters.limit);
    return list;
  }

  static async updateOrderStatus(id: string, restaurantId: string, status: string, extra?: Partial<Order>): Promise<boolean> {
    const cleanId = String(id).replace(/^cav-/, '');
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
      updated_at: new Date().toISOString(),
    };
    this.saveCollection('orders', list);
    await this.syncDirectMongo(COLLECTIONS.orders, 'upsert', list[idx]);
    return true;
  }

  static async deleteOrder(id: string, restaurantId?: string): Promise<boolean> {
    const list = this.getCollection('orders');
    const cleanId = String(id).replace(/^cav-/, '');
    const idx = list.findIndex(o => 
      (o._id === id || (o as any).id === id || o._id === cleanId || (o as any).id === cleanId) &&
      (!restaurantId || o.restaurant_id === restaurantId)
    );
    if (idx === -1) return false;
    const removed = list.splice(idx, 1)[0];
    this.saveCollection('orders', list);
    await this.syncDirectMongo(COLLECTIONS.orders, 'delete', removed._id);
    return true;
  }

  static async clearArchive(restaurantId: string): Promise<number> {
    const list = this.getCollection('orders');
    const toDelete = list.filter(o => 
      o.restaurant_id === restaurantId && 
      ((o as any).status === 'fulfilled' || (o as any).status === 'completed' || (o as any).closedSession)
    );

    const remaining = list.filter(o => 
      !(o.restaurant_id === restaurantId && ((o as any).status === 'fulfilled' || (o as any).status === 'completed' || (o as any).closedSession))
    );

    this.saveCollection('orders', remaining);

    if (this.mongoConnected && this.db) {
      try {
        await this.db.collection(COLLECTIONS.orders).deleteMany({
          restaurant_id: restaurantId,
          $or: [
            { status: 'fulfilled' },
            { status: 'completed' },
            { closedSession: true }
          ]
        });
      } catch (e) {
        console.warn('[MultiTenantDB] Error in deleteMany on MongoDB Atlas:', e);
      }
    }

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
    const list = this.getCollection('inventory_items');
    const id = `inv_${item.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    list.push(newItem);
    this.saveCollection('inventory_items', list);
    await this.syncDirectMongo(COLLECTIONS.inventory, 'upsert', newItem);
    return newItem;
  }

  static async listInventory(restaurantId: string): Promise<InventoryItem[]> {
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
    const list = this.getCollection('inventory_items');
    const idx = list.findIndex(i => i._id === id && i.restaurant_id === restaurantId);
    if (idx === -1) return false;

    const prevQty = list[idx].stock || 0;
    const newQty = Math.max(0, prevQty + adjustment);
    list[idx].stock = newQty;
    list[idx].updated_at = new Date().toISOString();
    this.saveCollection('inventory_items', list);
    await this.syncDirectMongo(COLLECTIONS.inventory, 'upsert', list[idx]);

    // Record Immutable Transaction Ledger Entry
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
    const list = this.getCollection('inventory_items');
    const idx = list.findIndex(i => (i._id === id || (i as any).id === id) && i.restaurant_id === restaurantId);
    if (idx === -1) return false;

    list[idx] = {
      ...list[idx],
      ...fields,
      updated_at: new Date().toISOString()
    };
    this.saveCollection('inventory_items', list);
    await this.syncDirectMongo(COLLECTIONS.inventory, 'upsert', list[idx]);
    return true;
  }

  static async deleteInventoryItem(id: string, restaurantId: string): Promise<boolean> {
    const list = this.getCollection('inventory_items');
    const idx = list.findIndex(i => (i._id === id || (i as any).id === id) && i.restaurant_id === restaurantId);
    if (idx === -1) return false;

    const item = list[idx];
    list.splice(idx, 1);
    this.saveCollection('inventory_items', list);
    await this.syncDirectMongo(COLLECTIONS.inventory, 'delete', item);
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
    const list = this.getCollection('inventory_transactions');
    list.unshift(entry);
    this.saveCollection('inventory_transactions', list);
    await this.syncDirectMongo(COLLECTIONS.inventory_transactions, 'upsert', entry);
    return entry;
  }

  static async listInventoryTransactions(restaurantId: string, limit = 100): Promise<InventoryTransaction[]> {
    return this.getCollection('inventory_transactions')
      .filter(tx => tx.restaurant_id === restaurantId)
      .slice(0, limit);
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                        TIMECARDS & SHIFT RETENTION                          */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  static async createTimecard(data: Omit<Timecard, '_id' | 'created_at' | 'updated_at'>): Promise<Timecard> {
    const now = new Date().toISOString();
    const timecard: Timecard = {
      _id: `TC_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      ...data,
      created_at: now,
      updated_at: now,
    };
    const list = this.getCollection('timecards');
    list.push(timecard);
    this.saveCollection('timecards', list);
    await this.syncDirectMongo(COLLECTIONS.timecards, 'upsert', timecard);
    return timecard;
  }

  static async getTimecard(id: string, restaurantId: string): Promise<Timecard | null> {
    return this.getCollection('timecards').find(t => t._id === id && t.restaurant_id === restaurantId) || null;
  }

  static async getActiveTimecard(restaurantId: string, userId: string): Promise<Timecard | null> {
    return this.getCollection('timecards').find(
      t => t.restaurant_id === restaurantId && t.user_id === userId && t.status === 'active'
    ) || null;
  }

  static async updateTimecard(id: string, restaurantId: string, update: Partial<Timecard>): Promise<boolean> {
    const list = this.getCollection('timecards');
    const idx = list.findIndex(t => t._id === id && t.restaurant_id === restaurantId);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...update, updated_at: new Date().toISOString() };
    this.saveCollection('timecards', list);
    await this.syncDirectMongo(COLLECTIONS.timecards, 'upsert', list[idx]);
    return true;
  }

  static async listTimecards(
    restaurantId: string,
    filters?: { userId?: string; role?: string; status?: string; startDate?: string; endDate?: string }
  ): Promise<Timecard[]> {
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
    const list = this.getCollection('timecards');
    const idx = list.findIndex(t => t._id === id && t.restaurant_id === restaurantId);
    if (idx === -1) return false;
    const removed = list.splice(idx, 1)[0];
    this.saveCollection('timecards', list);
    await this.syncDirectMongo(COLLECTIONS.timecards, 'delete', removed._id);
    return true;
  }

  /**
   * Safe retention archiving (marks as 'archived' rather than deleting records permanently)
   */
  static async archiveExpiredTimecards(restaurantId?: string, retentionDays = 180): Promise<{ archivedCount: number }> {
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const list = this.getCollection('timecards');
    let archivedCount = 0;

    for (const card of list) {
      const cardTime = new Date(card.clock_in || card.created_at).getTime();
      const matchRestaurant = !restaurantId || card.restaurant_id === restaurantId;
      if (matchRestaurant && cardTime < cutoffTime && card.status === 'completed') {
        card.status = 'archived';
        archivedCount++;
        await this.syncDirectMongo(COLLECTIONS.timecards, 'upsert', card);
      }
    }

    if (archivedCount > 0) {
      this.saveCollection('timecards', list);
      console.log(`🧹 [Retention Policy] Archived ${archivedCount} shift timecards older than ${retentionDays} days.`);
    }

    return { archivedCount };
  }

  /**
   * Alias for backwards compatibility with legacy routes
   */
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
    const log: AuditLog = {
      _id: `AUD_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`.toUpperCase(),
      restaurant_id: restaurantId,
      actor_id: actorId,
      actor_name: actorName,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata,
      timestamp: new Date().toISOString(),
    };
    const list = this.getCollection('audit_logs');
    list.unshift(log);
    this.saveCollection('audit_logs', list);
    await this.syncDirectMongo(COLLECTIONS.audit_logs, 'upsert', log);
    return log;
  }

  static async listAuditLogs(restaurantId: string, limit = 100): Promise<AuditLog[]> {
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
    const list = this.getCollection('leads') as any[];
    list.unshift(lead);
    this.saveCollection('leads', list as any);
    await this.syncDirectMongo(COLLECTIONS.leads, 'upsert', lead);
    return lead;
  }

  static async listLeads(limit = 100): Promise<any[]> {
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
