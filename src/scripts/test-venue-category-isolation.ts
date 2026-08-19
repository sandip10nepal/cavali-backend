/**
 * Test: Category & Hookah Feature Dynamic Adaptation
 * Verifies that:
 * 1. Non-hookah venues (e.g., restaurant_bar like Vindu) do NOT have hookah category, hookah items, or hookah options.
 * 2. Hookah lounges (like Cavali) have signature hookahs and full hookah capabilities.
 */
const API_BASE = 'http://localhost:3000';

async function testVenueCategoryIsolation() {
  console.log('🧪 Starting Venue Category & Hookah Dynamic Adaptation Test...\n');

  // 1. Onboard a non-hookah Dining Restaurant: "Vindu Fine Dining"
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const diningPayload = {
    name: `Vindu Fine Dining ${suffix}`,
    owner_name: 'Vindu Owner',
    owner_email: `owner${suffix}@vindudining.com`,
    manager_password: '1234abcD',
    staff_pin: '1234',
    table_count: 8,
    business_type: 'restaurant_bar',
    branding: {
      primary_color: '#D97706',
      secondary_color: '#F59E0B',
    },
    tax_rate: 8.25,
  };

  console.log(`1. Onboarding Dining Restaurant: ${diningPayload.name}...`);
  const diningRes = await fetch(`${API_BASE}/api/restaurants/onboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(diningPayload),
  });
  const diningData = await diningRes.json();
  if (!diningData.success) throw new Error('Onboarding failed: ' + JSON.stringify(diningData));

  const diningId = diningData.restaurant.id;
  const diningToken = diningData.token;
  console.log(`✅ Dining Restaurant Onboarded! ID: ${diningId}, Type: ${diningData.restaurant.business_type}`);

  // 2. Inspect Categories for Dining Restaurant
  console.log('\n2. Fetching Menu Categories for Dining Restaurant...');
  const catRes = await fetch(`${API_BASE}/api/v2/menu/categories?restaurant_id=${diningId}`, {
    headers: { 'Authorization': `Bearer ${diningToken}` },
  });
  const catData = await catRes.json();
  const categories = catData.categories || [];
  console.log('Categories created:', categories.map((c: any) => `${c.title} (type: ${c.menu_type})`));

  const hasHookahCategory = categories.some((c: any) =>
    c.menu_type === 'hookah' || c.title.toLowerCase().includes('hookah')
  );
  if (hasHookahCategory) {
    throw new Error('❌ Non-hookah restaurant has a Hookah category!');
  }
  console.log('✅ PASS: No Hookah category seeded for restaurant_bar!');

  // 3. Inspect Menu Items for Dining Restaurant
  console.log('\n3. Fetching Menu Items for Dining Restaurant...');
  const itemsRes = await fetch(`${API_BASE}/api/v2/menu/items?restaurant_id=${diningId}`, {
    headers: { 'Authorization': `Bearer ${diningToken}` },
  });
  const itemsData = await itemsRes.json();
  const items = itemsData.items || [];
  console.log('Items created:', items.map((i: any) => i.name));

  const hasHookahItems = items.some((i: any) =>
    i.category === 'hookah' || i.name.toLowerCase().includes('hookah') || i.name.toLowerCase().includes('shisha')
  );
  if (hasHookahItems) {
    throw new Error('❌ Non-hookah restaurant has Hookah menu items!');
  }
  console.log('✅ PASS: No Hookah menu items for restaurant_bar!');

  // 4. Test iPad Public Config Endpoint
  console.log('\n4. Fetching iPad Config for Dining Restaurant...');
  const configRes = await fetch(`${API_BASE}/api/restaurants/${diningId}/config`);
  const configData = await configRes.json();
  const ipadItems = configData.menu_items || [];
  const ipadHookahs = ipadItems.filter((i: any) => i.category === 'hookah');
  console.log(`iPad Total Items: ${ipadItems.length}, Hookah Items: ${ipadHookahs.length}`);
  if (ipadHookahs.length > 0) {
    throw new Error('❌ iPad config returns Hookah items for dining venue!');
  }
  console.log('✅ PASS: iPad config returns 0 hookah items for dining venue!');

  // 5. Compare with Cavali Hookah Lounge
  console.log('\n5. Fetching Cavali Hookah Lounge Config for Verification...');
  const cavaliRes = await fetch(`${API_BASE}/api/restaurants/slug/cavali/config`);
  const cavaliData = await cavaliRes.json();
  const cavaliHookahs = (cavaliData.menu_items || []).filter((i: any) => i.category === 'hookah');
  console.log(`Cavali Total Items: ${cavaliData.menu_items?.length}, Hookah Items: ${cavaliHookahs.length}`);
  if (cavaliHookahs.length === 0) {
    throw new Error('❌ Cavali Hookah Lounge has 0 hookahs!');
  }
  console.log('✅ PASS: Cavali Hookah Lounge retains signature hookah options!');

  console.log('\n🎉 ALL VENUE CATEGORY & HOOKAH DYNAMIC ADAPTATION TESTS PASSED 100%! 🚀');
}

testVenueCategoryIsolation().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

export {};
