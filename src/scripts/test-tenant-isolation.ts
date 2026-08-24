/**
 * Automated Test: Strict Multi-Tenant Data Isolation
 * Verifies that restaurants (e.g. Cavali vs Vindu) NEVER leak orders, staff, inventory, sales, or credits to each other.
 */
const API_BASE = 'http://localhost:3000';

async function testTenantIsolation() {
  console.log('🧪 Starting Strict Multi-Tenant Data Isolation Test...\n');

  // 1. Onboard a brand new isolated restaurant "Vindu Bistro"
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const vinduPayload = {
    name: `Vindu Bistro ${randomSuffix}`,
    owner_name: 'Vindu Owner',
    owner_email: `owner${randomSuffix}@vindu.com`,
    manager_password: '1234abcD',
    staff_pin: '1234',
    table_count: 5,
    business_type: 'restaurant_bar',
    branding: {
      primary_color: '#3B82F6',
      secondary_color: '#10B981',
    },
    tax_rate: 8.0,
  };

  console.log(`1. Onboarding new venue: ${vinduPayload.name}...`);
  const onboardRes = await fetch(`${API_BASE}/api/restaurants/onboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(vinduPayload),
  });
  const onboardData = await onboardRes.json();
  if (!onboardData.success || !onboardData.restaurant) {
    throw new Error('Failed to onboard Vindu: ' + JSON.stringify(onboardData));
  }

  const vinduId = onboardData.restaurant.id;
  const vinduCode = onboardData.restaurant.restaurant_code;
  const vinduToken = onboardData.token;
  console.log(`✅ Vindu created successfully! ID: ${vinduId}, Code: ${vinduCode}\n`);

  // 2. Fetch Cavali token and data for comparison
  console.log('2. Logging in as Cavali Manager...');
  const cavaliLoginRes = await fetch(`${API_BASE}/api/auth/manager-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_id: '4821',
      email: 'owner@cavali.com',
      pin: '1234',
    }),
  });
  const cavaliLoginData = await cavaliLoginRes.json();
  if (!cavaliLoginData.success) {
    throw new Error('Failed to login as Cavali manager: ' + JSON.stringify(cavaliLoginData));
  }
  const cavaliToken = cavaliLoginData.token;
  const cavaliId = cavaliLoginData.restaurant.id;
  console.log(`✅ Cavali authenticated. ID: ${cavaliId}\n`);

  // 3. Test Staff Isolation: Vindu staff should ONLY be Vindu staff (NOT Cavali staff)
  console.log('3. Testing Staff Isolation...');
  const vinduStaffRes = await fetch(`${API_BASE}/api/employees?restaurant_id=${vinduId}`, {
    headers: { 'Authorization': `Bearer ${vinduToken}` }
  });
  const vinduStaffData = await vinduStaffRes.json();
  const vinduStaffNames = vinduStaffData.employees.map((e: any) => e.name);
  console.log('Vindu Staff List:', vinduStaffNames);

  const cavaliStaffRes = await fetch(`${API_BASE}/api/employees?restaurant_id=${cavaliId}`, {
    headers: { 'Authorization': `Bearer ${cavaliToken}` }
  });
  const cavaliStaffData = await cavaliStaffRes.json();
  const cavaliStaffNames = cavaliStaffData.employees.map((e: any) => e.name);
  console.log('Cavali Staff List:', cavaliStaffNames);

  // Assert no overlap
  const leakFound = vinduStaffNames.some((name: string) => ['Aakash', 'Alex Rivera', 'Evana', 'Pasang', 'Suzi'].includes(name));
  if (leakFound) {
    throw new Error('❌ ISOLATION LEAK: Cavali staff found in Vindu employee roster!');
  }
  console.log('✅ Staff Isolation Verified: Zero employee data leaks!\n');

  // 4. Test Orders Isolation: Vindu has 0 orders initially
  console.log('4. Testing Orders Isolation...');
  const vinduOrdersRes = await fetch(`${API_BASE}/api/orders?restaurant_id=${vinduId}`, {
    headers: { 'Authorization': `Bearer ${vinduToken}` }
  });
  const vinduOrdersData = await vinduOrdersRes.json();
  console.log('Vindu Initial Orders Count:', vinduOrdersData.orders.length);
  if (vinduOrdersData.orders.length > 0) {
    throw new Error(`❌ ISOLATION LEAK: Vindu should have 0 initial orders, but found ${vinduOrdersData.orders.length}!`);
  }

  const cavaliOrdersRes = await fetch(`${API_BASE}/api/orders?restaurant_id=${cavaliId}`, {
    headers: { 'Authorization': `Bearer ${cavaliToken}` }
  });
  const cavaliOrdersData = await cavaliOrdersRes.json();
  console.log('Cavali Orders Count:', cavaliOrdersData.orders.length);
  console.log('✅ Orders Isolation Verified: Vindu starts with 0 orders, Cavali orders separate!\n');

  // 5. Test Sales & Payments Isolation: Vindu has 0 sales initially
  console.log('5. Testing Sales / Payments Isolation...');
  const vinduPaymentsRes = await fetch(`${API_BASE}/api/orders/payments?restaurant_id=${vinduId}`, {
    headers: { 'Authorization': `Bearer ${vinduToken}` }
  });
  const vinduPaymentsData = await vinduPaymentsRes.json();
  console.log('Vindu Sales Summary:', vinduPaymentsData.summary);
  if (vinduPaymentsData.summary.totalCollected > 0) {
    throw new Error(`❌ ISOLATION LEAK: Vindu should have $0.00 sales, but found $${vinduPaymentsData.summary.totalCollected}!`);
  }
  console.log('✅ Sales Isolation Verified: Vindu has 0 sales!\n');

  // 6. Test Credits Isolation: Vindu has 0 customer debts/credits
  console.log('6. Testing Customer Credits Isolation...');
  const vinduCreditsRes = await fetch(`${API_BASE}/api/orders/credits?restaurant_id=${vinduId}`, {
    headers: { 'Authorization': `Bearer ${vinduToken}` }
  });
  const vinduCreditsData = await vinduCreditsRes.json();
  console.log('Vindu Credits Count:', vinduCreditsData.credits.length);
  if (vinduCreditsData.credits.length > 0) {
    throw new Error(`❌ ISOLATION LEAK: Vindu should have 0 credits, but found ${vinduCreditsData.credits.length}!`);
  }
  console.log('✅ Credits Isolation Verified: Zero cross-tenant debt leakage!\n');

  // 7. Place a new Order in Vindu and verify isolation
  console.log('7. Placing a test order for Vindu Table 3...');
  const createOrderRes = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${vinduToken}`,
    },
    body: JSON.stringify({
      restaurant_id: vinduId,
      table: '3',
      name: 'Vindu Guest',
      food: [{ name: 'Vindu Special Burger', price: 14.99, qty: 1 }],
      total: 14.99,
      paymentMethod: 'CASH',
    }),
  });
  const createOrderData = await createOrderRes.json();
  console.log('Order Created Status:', createOrderRes.status, 'Order ID:', createOrderData.order?.id);

  // Check Vindu orders now has 1 order
  const checkVinduOrders = await fetch(`${API_BASE}/api/orders?restaurant_id=${vinduId}`, {
    headers: { 'Authorization': `Bearer ${vinduToken}` }
  });
  const checkVinduData = await checkVinduOrders.json();
  console.log('Vindu Orders Count after placement:', checkVinduData.orders.length);
  if (checkVinduData.orders.length !== 1) {
    throw new Error(`Expected 1 order in Vindu, found ${checkVinduData.orders.length}`);
  }

  // Check Cavali orders still does NOT contain Vindu's order
  const checkCavaliOrders = await fetch(`${API_BASE}/api/orders?restaurant_id=${cavaliId}`, {
    headers: { 'Authorization': `Bearer ${cavaliToken}` }
  });
  const checkCavaliData = await checkCavaliOrders.json();
  const vinduOrderFoundInCavali = checkCavaliData.orders.some((o: any) => o.customerName === 'Vindu Guest');
  if (vinduOrderFoundInCavali) {
    throw new Error('❌ ISOLATION LEAK: Vindu order found in Cavali orders list!');
  }
  // 8. Test Inventory Data Isolation: Vindu & ChillPill must NOT see Cavali inventory stock items
  console.log('8. Testing Raw Materials & Stock Inventory Isolation...');
  const vinduInvRes = await fetch(`${API_BASE}/api/orders/inventory?restaurant_id=${vinduId}`, {
    headers: { 'Authorization': `Bearer ${vinduToken}`, 'x-restaurant-id': vinduId }
  });
  const vinduInvData = await vinduInvRes.json();
  const vinduInvItems = Object.values(vinduInvData.inventory || {});
  console.log('Vindu Initial Inventory Items Count:', vinduInvItems.length);
  const cavaliItemsInVindu = vinduInvItems.some((item: any) =>
    ['Pan Ras', 'Lady Killer', 'Bagdadi', 'Watermelon Lit', 'Love 66'].includes(item.name)
  );
  if (cavaliItemsInVindu) {
    throw new Error('❌ ISOLATION LEAK: Cavali inventory items found in Vindu inventory response!');
  }

  // Test ChillPill (RES_CA027A1D1C55 / Code 8204) inventory isolation
  const chillPillInvRes = await fetch(`${API_BASE}/api/orders/inventory`, {
    headers: { 'x-restaurant-code': '8204', 'x-restaurant-id': 'RES_CA027A1D1C55' }
  });
  const chillPillInvData = await chillPillInvRes.json();
  const chillPillInvItems = Object.values(chillPillInvData.inventory || {});
  const cavaliItemsInChillPill = chillPillInvItems.some((item: any) =>
    ['Pan Ras', 'Lady Killer', 'Bagdadi', 'Watermelon Lit', 'Love 66'].includes(item.name)
  );
  if (cavaliItemsInChillPill) {
    throw new Error('❌ ISOLATION LEAK: Cavali inventory items found in ChillPill inventory response!');
  }
  console.log('✅ Inventory Isolation Verified: Zero Cavali stock items leaked into Vindu or ChillPill!\n');

  console.log('🎉 ALL 8 STRICT MULTI-TENANT ISOLATION TESTS PASSED 100%! 🚀');
}

testTenantIsolation().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

export {};
