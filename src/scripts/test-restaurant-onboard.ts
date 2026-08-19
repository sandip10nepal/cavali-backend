/**
 * Automated Test: Full Restaurant Turnkey Onboarding
 * POST /api/restaurants/onboard
 */
const API_BASE = 'http://localhost:3000';

async function testRestaurantOnboard() {
  console.log('🧪 Starting Turnkey Restaurant Onboarding Test...\n');

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const testPayload = {
    name: `Oasis Hookah Lounge ${randomSuffix}`,
    owner_name: 'Zaid Malik',
    owner_email: `zaid${randomSuffix}@oasis.com`,
    manager_password: '1234abcD',
    staff_pin: '1234',
    table_count: 8,
    business_type: 'hookah_lounge',
    branding: {
      primary_color: '#10B981',
      secondary_color: '#F59E0B',
    },
    tax_rate: 8.25,
  };

  console.log('--- Submitting Onboarding Form for:', testPayload.name, '---');
  const res = await fetch(`${API_BASE}/api/restaurants/onboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload),
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Message:', data.message);
  console.log('Restaurant:', data.restaurant);
  console.log('Credentials:', data.credentials);
  console.log('Stats:', data.stats);

  if (!data.success || !data.restaurant?.restaurant_code || !data.token) {
    throw new Error('Onboarding failed: ' + JSON.stringify(data));
  }

  const newCode = data.restaurant.restaurant_code;
  console.log(`\n✅ Restaurant successfully created with 4-Digit Code: ${newCode}`);

  // Test Logging in as the new manager
  console.log('\n--- Testing Manager Login for Newly Created Restaurant ---');
  const loginRes = await fetch(`${API_BASE}/api/auth/manager-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_code: newCode,
      email: testPayload.owner_email,
      password: '1234abcD',
    }),
  });
  const loginData = await loginRes.json();
  console.log('Manager Login Status:', loginRes.status, 'Success:', loginData.success);
  if (!loginData.success) {
    throw new Error('Manager login failed for newly onboarded restaurant!');
  }
  console.log('✅ Manager Login verified!');

  // Test Staff Floor 3-Way Authentication for Newly Created Restaurant
  console.log('\n--- Testing Floor Staff Verification for Newly Created Restaurant ---');
  const rosterRes = await fetch(`${API_BASE}/api/auth/staff-roster`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurant_code: newCode }),
  });
  const rosterData = await rosterRes.json();
  console.log(`Staff Roster for ${newCode}:`, rosterData.staff?.map((s: any) => s.name));

  if (!rosterData.staff || rosterData.staff.length === 0) {
    throw new Error('Staff roster empty for newly onboarded restaurant!');
  }

  const staffUser = rosterData.staff[0];
  const staffVerifyRes = await fetch(`${API_BASE}/api/auth/staff-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_code: newCode,
      user_id: staffUser.id,
      staff_pin: '1234',
    }),
  });
  const staffVerifyData = await staffVerifyRes.json();
  console.log('Staff Verify Status:', staffVerifyRes.status, 'User:', staffVerifyData.user?.name);
  if (!staffVerifyData.success) {
    throw new Error('Staff floor login verification failed for newly onboarded restaurant!');
  }
  console.log('✅ Staff Floor Login verified!');

  // Test iPad Table Provisioning with 8-digit PIN (e.g. `${newCode}-1234`)
  console.log('\n--- Testing iPad Table Provisioning with 8-Digit Code ---');
  const ipadRes = await fetch(`${API_BASE}/api/auth/device/configure-table`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_name: testPayload.name,
      table_number: '5',
      pin: `${newCode}-1234`,
    }),
  });
  const ipadData = await ipadRes.json();
  console.log('iPad Provision Status:', ipadRes.status, 'Table:', ipadData.table?.label);
  if (!ipadData.success) {
    throw new Error('iPad Table Provisioning failed for newly onboarded restaurant!');
  }
  console.log('✅ iPad Table Provisioning verified!');

  console.log('\n🎉 ALL ONBOARDING & NEW RESTAURANT VERIFICATION TESTS PASSED 100%! 🚀');
}

testRestaurantOnboard().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

export {};
