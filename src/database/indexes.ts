/**
 * MongoDB Database Index Definitions & Management
 */

import { Database } from './mongodb';
import { COLLECTIONS } from './collections';

export async function ensureDatabaseIndexes(): Promise<void> {
  const db = Database.getDb();
  if (!db) {
    console.warn('[DatabaseIndexes] Skipping index creation: DB not initialized');
    return;
  }

  try {
    // 1. Restaurants Collection Indexing
    await db.collection(COLLECTIONS.restaurants).createIndex({ slug: 1 }, { unique: true, sparse: true });
    await db.collection(COLLECTIONS.restaurants).createIndex({ restaurant_code: 1 }, { unique: true, sparse: true });

    // 2. Orders Collection Indexing (Tenant Isolation + Performance)
    await db.collection(COLLECTIONS.orders).createIndex({ restaurant_id: 1, created_at: -1 });
    await db.collection(COLLECTIONS.orders).createIndex({ restaurant_id: 1, status: 1 });
    await db.collection(COLLECTIONS.orders).createIndex({ restaurant_id: 1, idempotencyKey: 1 }, { sparse: true });

    // 3. Users Collection Indexing
    await db.collection(COLLECTIONS.users).createIndex({ restaurant_id: 1, pin_hash: 1 });
    await db.collection(COLLECTIONS.users).createIndex({ restaurant_id: 1, email: 1 }, { sparse: true });

    // 4. Menu & Items Collection Indexing
    await db.collection(COLLECTIONS.menu_items).createIndex({ restaurant_id: 1, category_id: 1 });
    await db.collection(COLLECTIONS.menu_categories).createIndex({ restaurant_id: 1, sort_order: 1 });

    // 5. Inventory Collection Indexing
    await db.collection(COLLECTIONS.inventory_items).createIndex({ restaurant_id: 1, _id: 1 });
    await db.collection(COLLECTIONS.inventory_transactions).createIndex({ restaurant_id: 1, created_at: -1 });

    // 6. Devices Collection Indexing
    await db.collection(COLLECTIONS.devices).createIndex({ restaurant_id: 1, device_token: 1 });

    console.log('✅ [DatabaseIndexes] All MongoDB collection indexes ensured successfully.');
  } catch (err) {
    console.warn('[DatabaseIndexes] Index ensuring note:', (err as Error).message);
  }
}
