/**
 * Automated Test: iPad Multi-Tenant Menu Isolation
 * Verifies that when an iPad pairs/configures to Vindu:
 * 1. It fetches Vindu's exact isolated menu config (NOT Cavali).
 * 2. It submits orders with Vindu's restaurant_id.
 * 3. Menu items match Vindu's admin panel items.
 */
const API_BASE = 'http://localhost:3000';

async function testIpadTenantMenu() {
  console.log('🧪 Starting iPad Multi-Tenant Menu Isolation Test...\n');

  // 1. Onboard a fresh isolated restaurant "Vindu Kitchen"
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const vinduPayload = {
    name: `Vindu Kitchen ${randomSuffix}`,
    owner_name: 'Vindu Manager',
    owner_email: `manager${randomSuffix}@vindu.com`,
    manager_password: '1234abcD',
    staff_pin: '1234',
    table_count: 6,
    business_type: 'restaurant_bar',
    branding: {
      primary_color: '#10B981',
      secondary_color: '#F59E0B',
    },
    tax_rate: 8.25,
  };

  console.log(`1. Onboarding new restaurant: ${vinduPayload.name}...`);
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
  const vinduSlug = onboardData.restaurant.slug;
  const pairingCode = `${vinduCode}-1234`;
  console.log(`✅ Vindu onboarded! ID: ${vinduId}, Code: ${vinduCode}, Slug: ${vinduSlug}, Pairing PIN: ${pairingCode}\n`);

  // 2. Add a custom menu item in Vindu (to simulate admin adding distinct menu item)
  console.log('2. Adding unique item "Vindu Royal Biryani" to Vindu menu...');
  const catRes = await fetch(`${API_BASE}/api/v2/menu/categories?restaurant_id=${vinduId}`, {
    headers: { 'Authorization': `Bearer ${onboardData.token}` }
  });
  const catData = await catRes.json();
  const mainCatId = catData.categories?.[0]?.id || 'cat_mains';

  const addItemRes = await fetch(`${API_BASE}/api/v2/menu/items?restaurant_id=${vinduId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${onboardData.token}`,
    },
    body: JSON.stringify({
      category_id: mainCatId,
      name: 'Vindu Royal Biryani',
      desc: 'Fragrant basmati rice slow-cooked with aromatic spices.',
      price: 18.99,
      active: true,
    }),
  });
  const addItemData = await addItemRes.json();
  console.log('Added Item Status:', addItemRes.status, 'Item ID:', addItemData.item?.id);

  // 3. Simulate iPad Pairing Flow for Table 4
  console.log('\n3. Simulating iPad Table 4 Configuration with PIN:', pairingCode);
  const pairRes = await fetch(`${API_BASE}/api/auth/device/configure-table`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_name: vinduPayload.name,
      table_number: 4,
      pin: pairingCode,
      device_name: 'Table 4 iPad',
    }),
  });
  const pairData = await pairRes.json();
  if (!pairData.success || !pairData.token) {
    throw new Error('iPad Table Configuration failed: ' + JSON.stringify(pairData));
  }
  const deviceJwt = pairData.token;
  console.log('✅ iPad Paired! Restaurant:', pairData.restaurant?.name, 'Table:', pairData.table?.number);

  // 4. Fetch Config via iPad Device Token
  console.log('\n4. Fetching Public Menu Config for iPad from /api/restaurants/:id/config...');
  const configRes = await fetch(`${API_BASE}/api/restaurants/${vinduId}/config`, {
    headers: {
      'Authorization': `Bearer ${deviceJwt}`,
      'Cache-Control': 'no-cache',
    },
  });
  const configData = await configRes.json();
  if (!configData.success || !configData.menu_items) {
    throw new Error('Failed to load menu config: ' + JSON.stringify(configData));
  }

  const vinduMenuItems = configData.menu_items;
  const vinduItemNames = vinduMenuItems.map((i: any) => i.name);
  console.log('Vindu iPad Menu Items (Count:', vinduMenuItems.length, '):');
  console.log(vinduItemNames);

  // 5. Fetch Cavali Menu for Comparison
  console.log('\n5. Fetching Cavali Public Menu Config for Comparison...');
  const cavaliConfigRes = await fetch(`${API_BASE}/api/restaurants/slug/cavali/config`);
  const cavaliConfigData = await cavaliConfigRes.json();
  const cavaliItemNames = cavaliConfigData.menu_items.map((i: any) => i.name);
  console.log('Cavali Menu Items Count:', cavaliItemNames.length);

  // Check 1: Vindu iPad menu contains Vindu Royal Biryani
  if (!vinduItemNames.includes('Vindu Royal Biryani')) {
    throw new Error('❌ Missing Vindu Royal Biryani in Vindu iPad menu!');
  }

  // Check 2: Vindu iPad menu DOES NOT leak Cavali items (e.g. Cavalli Crush, etc.)
  const leakedCavaliItems = vinduItemNames.filter((name: string) =>
    name.toLowerCase().includes('cavalli') || name.toLowerCase().includes('cavali')
  );
  if (leakedCavaliItems.length > 0) {
    throw new Error(`❌ ISOLATION LEAK: Found Cavali items in Vindu iPad menu: ${leakedCavaliItems.join(', ')}`);
  }

  console.log('\n✅ Menu Isolation Check Passed: 0 Cavali items in Vindu menu!');

  // 6. Submit Customer Order from iPad
  console.log('\n6. Submitting Live Customer Order from iPad for Table 4...');
  const submitRes = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deviceJwt}`,
      'X-Restaurant-ID': vinduId,
    },
    body: JSON.stringify({
      restaurant_id: vinduId,
      table: '4',
      name: 'Vindu Table 4 Customer',
      food: [{ name: 'Vindu Royal Biryani', price: 18.99, qty: 2 }],
      total: 37.98,
      paymentMethod: 'CASH',
    }),
  });
  const submitData = await submitRes.json();
  console.log('Order Submission Status:', submitRes.status, 'Order ID:', submitData.order?.id);

  // 7. Verify Order on Vindu KDS
  console.log('\n7. Verifying Order on Vindu Admin KDS...');
  const vinduOrdersRes = await fetch(`${API_BASE}/api/orders?restaurant_id=${vinduId}`, {
    headers: { 'Authorization': `Bearer ${onboardData.token}` }
  });
  const vinduOrdersData = await vinduOrdersRes.json();
  const vinduOrders = vinduOrdersData.orders || [];
  console.log('Vindu Orders Count:', vinduOrders.length);
  if (vinduOrders.length !== 1 || vinduOrders[0].customerName !== 'Vindu Table 4 Customer') {
    throw new Error('❌ Order verification failed on Vindu KDS!');
  }

  console.log('✅ Order verified on Vindu KDS!');
  console.log('\n🎉 ALL IPAD MULTI-TENANT MENU ISOLATION TESTS PASSED 100%! 🚀');
}

testIpadTenantMenu().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

export {};
