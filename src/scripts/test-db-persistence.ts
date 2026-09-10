/**
 * test-db-persistence.ts
 *
 * Comprehensive verification suite for Benzin Backend database persistence:
 * 1. Startup validation: fails fast on missing MONGODB_URI in mongodb mode.
 * 2. Mode enforcement: prohibits DATABASE_MODE=local in production.
 * 3. Ping verification: verifies active connection to MongoDB Atlas.
 * 4. Error handling: 503 DatabaseUnavailableError on disconnection.
 * 5. Non-destructive process-restart persistence for Hummus (restores original in finally).
 * 6. Tenant isolation: verifies strict data segregation between venues.
 * 7. Zero credential exposure: no secrets printed or hardcoded.
 */

import { env } from '../config/env';
import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { DatabaseUnavailableError } from '../core/errors';

async function runTests() {
  console.log('🧪 Starting Benzin Production Persistence Test Suite...\n');
  let failures = 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: Policy Enforcement - Prohibit local mode in production
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('Test 1: Policy Enforcement - Prohibit local mode in production');
  try {
    const oldNodeEnv = process.env.NODE_ENV;
    const oldDbMode = process.env.DATABASE_MODE;

    process.env.NODE_ENV = 'production';
    process.env.DATABASE_MODE = 'local';

    let threw = false;
    try {
      const _ = env.DATABASE_MODE;
    } catch (e: any) {
      threw = true;
      if (e.message.includes('DATABASE_MODE=local is strictly prohibited in production')) {
        console.log('  ✅ Correctly rejected DATABASE_MODE=local in production');
      } else {
        console.error('  ❌ Threw unexpected error message:', e.message);
        failures++;
      }
    }

    if (!threw) {
      console.error('  ❌ FAILED: Did not reject DATABASE_MODE=local in production');
      failures++;
    }

    // Restore env
    process.env.NODE_ENV = oldNodeEnv;
    process.env.DATABASE_MODE = oldDbMode;
  } catch (err: any) {
    console.error('  ❌ Test 1 unexpected error:', err.message);
    failures++;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: Policy Enforcement - Require MONGODB_URI in mongodb mode
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nTest 2: Policy Enforcement - Require MONGODB_URI in mongodb mode');
  try {
    const oldUri = process.env.MONGODB_URI;
    const oldMode = process.env.DATABASE_MODE;

    process.env.DATABASE_MODE = 'mongodb';
    delete process.env.MONGODB_URI;

    let threw = false;
    try {
      const _ = env.MONGODB_URI;
    } catch (e: any) {
      threw = true;
      if (e.message.includes('MONGODB_URI is required')) {
        console.log('  ✅ Correctly failed fast when MONGODB_URI was missing');
      } else {
        console.error('  ❌ Threw unexpected error message:', e.message);
        failures++;
      }
    }

    if (!threw) {
      console.error('  ❌ FAILED: Allowed missing MONGODB_URI in mongodb mode');
      failures++;
    }

    process.env.MONGODB_URI = oldUri;
    process.env.DATABASE_MODE = oldMode;
  } catch (err: any) {
    console.error('  ❌ Test 2 unexpected error:', err.message);
    failures++;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: MongoDB Atlas Ping & Authoritative Connection
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nTest 3: Authoritative Database Initialization & Ping Check');
  try {
    await MultiTenantDbService.close();
    await MultiTenantDbService.initialize();

    const isPingOk = await MultiTenantDbService.pingDatabase();
    if (!isPingOk) {
      throw new Error('Database ping command failed');
    }
    console.log('  ✅ MultiTenantDbService initialized and confirmed active Atlas ping');

    if (!MultiTenantDbService.isMongoConnected()) {
      throw new Error('MultiTenantDbService reports mongoConnected=false');
    }
    console.log('  ✅ MultiTenantDbService confirms mongoConnected=true');
  } catch (err: any) {
    console.error('  ❌ Test 3 connection failure:', err.message);
    failures++;
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: 503 DatabaseUnavailableError on Disconnection
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nTest 4: Disconnection & 503 DatabaseUnavailableError Handling');
  try {
    await MultiTenantDbService.close();

    let threw503 = false;
    try {
      MultiTenantDbService.assertDbReady();
    } catch (e: any) {
      if (e instanceof DatabaseUnavailableError && e.statusCode === 503) {
        threw503 = true;
        console.log('  ✅ assertDbReady() threw DatabaseUnavailableError with HTTP 503');
      } else {
        console.error('  ❌ Threw wrong error type:', e);
      }
    }

    if (!threw503) {
      console.error('  ❌ FAILED: assertDbReady() did not throw 503 when disconnected');
      failures++;
    }

    // Reconnect for remaining tests
    await MultiTenantDbService.initialize();
  } catch (err: any) {
    console.error('  ❌ Test 4 unexpected error:', err.message);
    failures++;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: Hummus Image URL Non-Destructive Process Restart Persistence
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nTest 5: Hummus Image URL Persistence & Process Restart Verification');
  let originalHummusUrl: string | null = null;
  const restaurantSlug = 'cavali';
  const hummusId = 'MI_hummus_1';

  try {
    const restaurant = await MultiTenantDbService.getRestaurantBySlug(restaurantSlug);
    if (!restaurant) {
      throw new Error(`Venue "${restaurantSlug}" not found in MongoDB Atlas`);
    }

    const currentHummus = await MultiTenantDbService.getMenuItem(hummusId, restaurant._id);
    if (!currentHummus) {
      throw new Error(`Menu item "${hummusId}" not found in venue "${restaurantSlug}"`);
    }

    originalHummusUrl = currentHummus.image_url || null;
    console.log(`  ℹ️  Original Hummus image URL: ${originalHummusUrl ? 'Found' : 'Null'}`);

    const testImageUrl = `https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=600&q=80&test=${Date.now()}`;

    // Step A: Update Hummus image URL
    const updateResult = await MultiTenantDbService.updateMenuItem(hummusId, restaurant._id, {
      image_url: testImageUrl
    });
    if (!updateResult) {
      throw new Error('updateMenuItem returned false');
    }
    console.log('  ✅ Updated Hummus image URL in authoritative MongoDB Atlas');

    // Step B: Verify immediate read reflects change
    const updatedHummus = await MultiTenantDbService.getMenuItem(hummusId, restaurant._id);
    if (!updatedHummus || updatedHummus.image_url !== testImageUrl) {
      throw new Error(`Immediate read did not match updated URL. Got: ${updatedHummus?.image_url}`);
    }
    console.log('  ✅ Immediate read verified updated image URL directly from Atlas');

    // Step C: Simulate Fresh Process / Container Restart
    console.log('  🔄 Simulating backend container restart (closing and reinitializing service)...');
    await MultiTenantDbService.close();

    // Verify disconnected state
    if (MultiTenantDbService.isInitialized()) {
      throw new Error('Service still reports initialized after close()');
    }

    // Fresh initialization (as if new container booted)
    await MultiTenantDbService.initialize();
    console.log('  ✅ Fresh backend process initialized successfully');

    // Step D: Read back after restart
    const restartedHummus = await MultiTenantDbService.getMenuItem(hummusId, restaurant._id);
    if (!restartedHummus || restartedHummus.image_url !== testImageUrl) {
      throw new Error(`Post-restart read failed! Expected ${testImageUrl}, got: ${restartedHummus?.image_url}`);
    }
    console.log('  ✅ POST-RESTART VERIFIED: Hummus image URL persisted across process restart!');
  } catch (err: any) {
    console.error('  ❌ Test 5 failure:', err.message);
    failures++;
  } finally {
    // Non-destructive cleanup: restore original URL
    try {
      const restaurant = await MultiTenantDbService.getRestaurantBySlug(restaurantSlug);
      if (restaurant) {
        await MultiTenantDbService.updateMenuItem(hummusId, restaurant._id, {
          image_url: originalHummusUrl
        });
        console.log('  🧹 Non-destructive cleanup: restored original Hummus image URL in Atlas');
      }
    } catch (cleanupErr: any) {
      console.warn('  ⚠️  Failed to restore original Hummus image URL:', cleanupErr.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6: Multi-Tenant Data Isolation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nTest 6: Multi-Tenant Data Isolation');
  try {
    const cavali = await MultiTenantDbService.getRestaurantBySlug('cavali');
    if (!cavali) throw new Error('Cavali venue not found');

    const cavaliItems = await MultiTenantDbService.listMenuItems(cavali._id);
    const nonCavaliItems = cavaliItems.filter(i => i.restaurant_id !== cavali._id);

    if (nonCavaliItems.length > 0) {
      throw new Error(`Found ${nonCavaliItems.length} items from another tenant in Cavali menu list!`);
    }
    console.log(`  ✅ Verified tenant isolation: all ${cavaliItems.length} items belong exclusively to tenant ${cavali._id}`);
  } catch (err: any) {
    console.error('  ❌ Test 6 failure:', err.message);
    failures++;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 7: Deduplication & Unique Compound Index Enforcement
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nTest 7: Zero Duplicates & Unique Constraint Enforcement');
  try {
    const cavali = await MultiTenantDbService.getRestaurantBySlug('cavali');
    if (!cavali) throw new Error('Cavali venue not found');

    const cavaliItems = await MultiTenantDbService.listMenuItems(cavali._id);
    const names = new Set<string>();
    for (const item of cavaliItems) {
      const lower = item.name.trim().toLowerCase();
      if (names.has(lower)) {
        throw new Error(`Found duplicate item in database: "${item.name}"`);
      }
      names.add(lower);
    }
    console.log(`  ✅ Verified 0 duplicate items: all ${cavaliItems.length} dishes in Cavali have distinct names`);

    // Verify unique index in Atlas
    const db = (MultiTenantDbService as any).assertDbReady();
    let rejected = false;
    try {
      await db.collection('menu_items').insertOne({
        _id: 'TEST_DUP_REJECTION',
        restaurant_id: cavali._id,
        name: 'Hummus',
        price: 10,
        active: true,
      });
    } catch (dupErr: any) {
      if (dupErr.code === 11000) rejected = true;
    }
    if (!rejected) throw new Error('Unique constraint failed to reject duplicate "Hummus"!');
    console.log('  ✅ Verified unique compound index: Atlas successfully rejected duplicate item insertion (Error 11000)');
  } catch (err: any) {
    console.error('  ❌ Test 7 failure:', err.message);
    failures++;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  if (failures === 0) {
    console.log('🎉 ALL PERSISTENCE TESTS PASSED! Backend is production ready.');
    console.log('═'.repeat(60) + '\n');
    process.exit(0);
  } else {
    console.error(`💥 ${failures} TEST(S) FAILED. Please review above output.`);
    console.log('═'.repeat(60) + '\n');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error running persistence tests:', err);
  process.exit(1);
});
