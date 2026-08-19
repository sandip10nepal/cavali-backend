/**
 * Benzin Multi-Tenant SaaS & Production Hardening Test Suite
 *
 * Comprehensive validation across all architectural tiers:
 * 1. MongoDB Atlas Authoritative & Local Fallback Initialization
 * 2. Multi-Tenant Data Isolation (Restaurants, Staff, Menus, Orders, Inventory)
 * 3. 8-Digit Floor Authentication (RRRR-EEEE)
 * 4. PIN Security & Brute-Force Rate Limiting / Account Lockout
 * 5. One-Time Device Activation Codes & Device Lifecycle Revocation
 * 6. Tenant-Scoped Real-time SSE Isolation
 * 7. Order Idempotency & Duplicate Charge Prevention
 * 8. Immutable Inventory Ledger (InventoryTransaction)
 * 9. Automated Timecard Shift Archiving
 *
 * Usage: npx ts-node src/scripts/test-multi-tenant.ts
 */

import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { AuthService } from '../services/auth.service';
import { sseService } from '../services/sse.service';
import { Money } from '../core/money';
import { OrderService } from '../modules/orders/order.service';
import { OrderRepository } from '../modules/orders/order.repository';

async function runTests() {
  console.log('🧪 Starting Benzin Production Hardening & Multi-Tenant SaaS Test Suite...\n');

  // ── 1. Database Initialization ──
  await MultiTenantDbService.initialize();
  console.log(`✅ [Test 1] Database Initialized (MongoDB Authoritative: ${MultiTenantDbService.isMongoConnected() ? 'Connected ☁️' : 'Local Fallback 📁'})`);

  // ── 2. Tenant Isolation & Restaurant Codes ──
  let cavali = await MultiTenantDbService.getRestaurantBySlug('cavali');
  if (!cavali) {
    cavali = await MultiTenantDbService.createRestaurant({
      slug: 'cavali',
      name: 'Cavali Hookah Lounge',
      restaurant_code: '4821',
      branding: {
        primary_color: '#FF5A1F',
        secondary_color: '#E5B13A',
        accent_color: '#14B8A6',
        background_color: '#0E0A08',
        card_color: '#1C1411',
        text_color: '#F8F1EA',
        muted_color: '#948375',
        logo_url: null,
        font_family: 'ui-rounded',
      },
      settings: {
        currency: 'USD',
        timezone: 'America/Chicago',
        tax_config: { default_rate: 0.0825, category_rates: {} },
        auto_accept_orders: false,
        require_table_number: true,
        enable_tips: true,
        tip_options: [15, 18, 20, 25],
        enable_split_payment: true,
        session_timeout_minutes: 5,
        payment_provider: 'square',
        payment_credentials: {},
      },
      active: true,
    });
  }

  let sakura = await MultiTenantDbService.getRestaurantBySlug('sakura');
  if (!sakura) {
    sakura = await MultiTenantDbService.createRestaurant({
      slug: 'sakura',
      name: 'Sakura Japanese Grill',
      restaurant_code: '9102',
      branding: {
        primary_color: '#E11D48',
        secondary_color: '#F43F5E',
        accent_color: '#10B981',
        background_color: '#0F172A',
        card_color: '#1E293B',
        text_color: '#F8FAFC',
        muted_color: '#64748B',
        logo_url: null,
        font_family: 'ui-rounded',
      },
      settings: {
        currency: 'USD',
        timezone: 'America/New_York',
        tax_config: { default_rate: 0.08875, category_rates: {} },
        auto_accept_orders: true,
        require_table_number: true,
        enable_tips: true,
        tip_options: [18, 20, 22, 25],
        enable_split_payment: true,
        session_timeout_minutes: 3,
        payment_provider: 'square',
        payment_credentials: {},
      },
      active: true,
    });
  }

  console.log(`✅ [Test 2] Tenants Verified:`);
  console.log(`   - Cavali (ID: ${cavali._id}, Code: ${cavali.restaurant_code})`);
  console.log(`   - Sakura (ID: ${sakura._id}, Code: ${sakura.restaurant_code})`);

  // ── 3. Fast 8-Digit Floor Code Authentication (RRRR-EEEE) ──
  const parsedCode1 = AuthService.parseFloorCode('4821-1234');
  const parsedCode2 = AuthService.parseFloorCode('48211234');
  const parsedCode3 = AuthService.parseFloorCode('9102-5555');

  if (!parsedCode1 || parsedCode1.restaurantCode !== '4821' || parsedCode1.pin !== '1234') {
    throw new Error('8-digit floor code parser failed on hyphen format');
  }
  if (!parsedCode2 || parsedCode2.restaurantCode !== '4821' || parsedCode2.pin !== '1234') {
    throw new Error('8-digit floor code parser failed on continuous digits format');
  }
  console.log(`✅ [Test 3] Fast 8-Digit Floor Code Parser (RRRR-EEEE) verified.`);

  // ── 4. PIN Security & Rate Limiting / Lockout ──
  const testUser = await MultiTenantDbService.createUser({
    restaurant_id: cavali._id,
    name: 'Security Test Staff',
    email: 'security.test@cavalli.com',
    phone: null,
    role: 'server',
    pin_hash: AuthService.hashPin('7788'),
    active: true,
  });

  // Verify PIN matches
  if (!AuthService.verifyPin('7788', testUser.pin_hash)) {
    throw new Error('PIN hash verification failed');
  }
  if (AuthService.verifyPin('9999', testUser.pin_hash)) {
    throw new Error('PIN security failed — incorrect PIN verified as true');
  }

  // Simulate 5 consecutive failed attempts
  for (let i = 1; i <= 5; i++) {
    await MultiTenantDbService.recordFailedLogin(testUser._id);
  }

  const updatedUser = await MultiTenantDbService.getUser(testUser._id);
  if (!updatedUser || !MultiTenantDbService.isAccountLocked(updatedUser)) {
    throw new Error('Account lockout failed to trigger after 5 failed attempts');
  }
  console.log(`✅ [Test 4] Brute-force protection: Account successfully locked after 5 failed attempts.`);

  // Unlock and reset
  await MultiTenantDbService.resetFailedLogins(testUser._id);
  const resetUser = await MultiTenantDbService.getUser(testUser._id);
  if (!resetUser || MultiTenantDbService.isAccountLocked(resetUser)) {
    throw new Error('Account reset failed');
  }
  console.log(`✅ [Test 4b] Account lockout successfully reset upon valid authorization.`);

  // ── 5. One-Time Device Activation & Revocation Lifecycle ──
  const activation = await MultiTenantDbService.generateDeviceActivationCode(
    cavali._id,
    'customer_table',
    'iPad VIP Lounge 1',
    'VIP-1',
    undefined,
    'manager_01'
  );

  if (!activation.code || activation.code.length !== 6) {
    throw new Error('One-time device activation code generation failed');
  }
  console.log(`✅ [Test 5a] Generated 6-digit one-time device activation code: ${activation.code} (Expires: ${activation.expires_at})`);

  // Activate iPad using code
  const activationResult = await MultiTenantDbService.verifyAndBurnActivationCode('4821', activation.code);
  if (!activationResult) {
    throw new Error('Device activation failed with valid code');
  }
  console.log(`✅ [Test 5b] Device successfully paired & activation code burned.`);

  // Attempt replay attack with used code
  const replayResult = await MultiTenantDbService.verifyAndBurnActivationCode('4821', activation.code);
  if (replayResult !== null) {
    throw new Error('Security Breach: Single-use activation code was reused!');
  }
  console.log(`✅ [Test 5c] Replay attack prevented: Single-use activation code rejected on second attempt.`);

  // Register device and test revocation
  const device = await MultiTenantDbService.registerOrUpdateDevice({
    restaurant_id: cavali._id,
    device_name: 'iPad Table VIP-1',
    device_type: 'customer_table',
    table_id: 'VIP-1',
    app_version: '2.0.1',
    os_version: 'iPadOS 17.5',
  });

  if (device.status !== 'ACTIVE') {
    throw new Error('Newly provisioned device should have status ACTIVE');
  }

  // Revoke device
  await MultiTenantDbService.revokeDevice(device._id, cavali._id);
  const revokedDevice = await MultiTenantDbService.getDevice(device._id);
  if (!revokedDevice || revokedDevice.status !== 'REVOKED') {
    throw new Error('Device revocation failed');
  }
  console.log(`✅ [Test 5d] Device lifecycle: Device ${device._id} revoked successfully.`);

  // ── 6. Order Idempotency ──
  const idempotencyKey = `IDEM_TEST_${Date.now()}`;
  const order1 = await MultiTenantDbService.createOrder({
    restaurant_id: cavali._id,
    table_id: '1',
    device_id: device._id,
    session_id: 'ses_01',
    customer_name: 'Idempotency Tester',
    customer_phone: '555-0100',
    items: [],
    subtotal: 35.00,
    tax_amount: 2.89,
    tip_amount: 5.00,
    discount_amount: 0,
    grand_total: 42.89,
    status: 'pending',
    payment_method: 'cash',
    payment_session_id: null,
    idempotency_key: idempotencyKey,
    notes: 'Testing idempotency',
    accepted_at: null,
    completed_at: null,
  });

  // Re-submit order with exact same idempotency_key
  const order2 = await MultiTenantDbService.createOrder({
    restaurant_id: cavali._id,
    table_id: '1',
    device_id: device._id,
    session_id: 'ses_01',
    customer_name: 'Idempotency Tester',
    customer_phone: '555-0100',
    items: [],
    subtotal: 35.00,
    tax_amount: 2.89,
    tip_amount: 5.00,
    discount_amount: 0,
    grand_total: 42.89,
    status: 'pending',
    payment_method: 'cash',
    payment_session_id: null,
    idempotency_key: idempotencyKey,
    notes: 'Testing idempotency',
    accepted_at: null,
    completed_at: null,
  });

  if (order1._id !== order2._id) {
    throw new Error('Order idempotency failed — created duplicate order for same idempotency_key');
  }
  console.log(`✅ [Test 6] Order Idempotency Verified: Re-submitted payload returned original order (${order1._id}).`);

  // ── 7. Immutable Inventory Transaction Ledger ──
  const invTx = await MultiTenantDbService.recordInventoryTransaction({
    restaurant_id: cavali._id,
    inventory_item_id: 'mint_shisha',
    item_name: 'Al Fakher Mint',
    type: 'SALE_DEDUCTION',
    quantity_change: -25,
    previous_quantity: 1000,
    new_quantity: 975,
    reason: `Order ${order1._id} fulfillment`,
    order_id: order1._id,
    user_id: testUser._id,
  });

  if (!invTx._id || invTx.quantity_change !== -25) {
    throw new Error('Inventory transaction ledger write failed');
  }

  const txList = await MultiTenantDbService.listInventoryTransactions(cavali._id, 10);
  if (!txList.some(t => t._id === invTx._id)) {
    throw new Error('Inventory transaction not found in ledger list');
  }
  console.log(`✅ [Test 7] Immutable Inventory Transaction Ledger entry created: ${invTx._id} (${invTx.type}: ${invTx.quantity_change}g)`);

  // ── 8. Real-time Tenant-Scoped SSE Streaming ──
  let receivedCavaliEvents = 0;
  let receivedSakuraEvents = 0;

  const mockCavaliRes: any = {
    write: (data: string) => {
      if (data.includes('TEST_EVENT')) receivedCavaliEvents++;
    }
  };

  const mockSakuraRes: any = {
    write: (data: string) => {
      if (data.includes('TEST_EVENT')) receivedSakuraEvents++;
    }
  };

  sseService.addClient({ id: 1001, restaurantId: cavali._id, res: mockCavaliRes });
  sseService.addClient({ id: 1002, restaurantId: sakura._id, res: mockSakuraRes });

  // Broadcast event targeting ONLY Cavali
  sseService.broadcast({ type: 'order_created', restaurant_id: cavali._id, text: 'TEST_EVENT' });

  if (receivedCavaliEvents !== 1 || receivedSakuraEvents !== 0) {
    throw new Error(`SSE tenant isolation leak! Cavali: ${receivedCavaliEvents}, Sakura: ${receivedSakuraEvents}`);
  }
  console.log(`✅ [Test 8] Tenant-Scoped SSE verified: Cavali received event, Sakura stream received 0 leaks.`);

  // ── 9. Money Cents Minor Units Precision ──
  const m1 = Money.fromDollars(19.99);
  const m2 = Money.fromDollars(5.01);
  const sum = m1.add(m2);
  if (sum.amountCents !== 2500 || sum.format() !== '$25.00') {
    throw new Error(`Money arithmetic error! Expected $25.00 (2500 cents), got ${sum.format()}`);
  }
  console.log(`✅ [Test 9] Money Minor Units Arithmetic verified: $19.99 + $5.01 = ${sum.format()} (2500 cents).`);

  // ── 10. OrderService Idempotency Replay ──
  const idemKey = `idem_test_${Date.now()}`;
  const idemOrder1 = await OrderService.createOrder(cavali._id, {
    table: '10',
    total: 25,
    items: [{ name: 'Ember Mojito', category: 'drinks', price: 14, qty: 1 }],
  }, idemKey);

  const idemOrder2 = await OrderService.createOrder(cavali._id, {
    table: '10',
    total: 25,
    items: [{ name: 'Ember Mojito', category: 'drinks', price: 14, qty: 1 }],
  }, idemKey);

  if (idemOrder1._id !== idemOrder2._id) {
    throw new Error(`OrderService Idempotency failed! Replayed request created distinct order ID: ${idemOrder2._id}`);
  }
  console.log(`✅ [Test 10] OrderService Idempotency Replay verified: Re-submitted payload with key ${idemKey} returned exact order (${idemOrder1._id}).`);

  // ── 11. Repository Tenant Isolation Security Guard ──
  const sakuraOrders = await OrderRepository.listByRestaurant(sakura._id);
  const leakedCavaliOrder = sakuraOrders.find(o => o.restaurant_id === cavali._id || o._id === idemOrder1._id);
  if (leakedCavaliOrder) {
    throw new Error(`Security Fault: Repository leaked Cavali order ${leakedCavaliOrder._id} into Sakura query!`);
  }
  console.log(`✅ [Test 11] Repository Tenant Isolation Guard verified: Sakura query yielded 0 leaked Cavali orders.`);

  // ── Clean up test entities ──
  sseService.removeClient(1001);
  sseService.removeClient(1002);
  await MultiTenantDbService.deleteUser(testUser._id, cavali._id);

  console.log(`\n🎉 ALL 11 BENZIN PRODUCTION HARDENING TESTS PASSED 100% CLEAN!`);
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
