/**
 * Automated Verification Script for Staff Multi-Step Verification & Manager Login
 */

const API_BASE = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting Staff & Manager Authentication Flow Tests...\n');

  // Test 1: Fetch Staff Roster for Cavali (Code: 4821)
  console.log('--- Test 1: POST /api/auth/staff-roster for Cavali (4821) ---');
  const rosterRes = await fetch(`${API_BASE}/api/auth/staff-roster`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurant_code: '4821' }),
  });
  const rosterData = await rosterRes.json();
  console.log(`Status: ${rosterRes.status}, Success: ${rosterData.success}`);
  console.log(`Restaurant: ${rosterData.restaurant?.name} (Code: ${rosterData.restaurant?.restaurant_code})`);
  console.log(`Staff Count (Excludes Manager/Owner): ${rosterData.staff?.length}`);
  rosterData.staff?.forEach((s: any) => console.log(`  - ${s.name} (${s.position || s.role}) [Clocked In: ${s.is_clocked_in}]`));

  if (!rosterData.success || rosterData.staff.length === 0) {
    throw new Error('Test 1 failed: Staff roster not returned');
  }

  // Ensure no owner/manager in shift staff list
  const hasManager = rosterData.staff.some((s: any) => s.role === 'owner' || s.role === 'manager');
  if (hasManager) {
    throw new Error('Test 1 failed: Manager or Owner was found in floor staff list!');
  }
  console.log('✅ Test 1 Passed: Staff roster loaded accurately without manager/owner.\n');

  const testStaff = rosterData.staff[0]; // e.g. Alex Rivera or Elena Rostova
  console.log(`Selected test employee: ${testStaff.name} (ID: ${testStaff.id})`);

  // Test 2: Staff Verification with WRONG PIN
  console.log('--- Test 2: Staff Verify with Wrong PIN ---');
  const badPinRes = await fetch(`${API_BASE}/api/auth/staff-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_code: '4821',
      user_id: testStaff.id,
      pin: '9999',
      action: 'login',
    }),
  });
  const badPinData = await badPinRes.json();
  console.log(`Status: ${badPinRes.status}, Error: ${badPinData.error}`);
  if (badPinRes.status !== 401) {
    throw new Error('Test 2 failed: Wrong PIN should return 401');
  }
  console.log('✅ Test 2 Passed: Wrong PIN correctly rejected.\n');

  // Test 3: Staff Verification with WRONG Restaurant Code
  console.log('--- Test 3: Staff Verify with Wrong Restaurant Code ---');
  const badRestRes = await fetch(`${API_BASE}/api/auth/staff-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_code: '0000',
      user_id: testStaff.id,
      pin: '1234',
      action: 'login',
    }),
  });
  const badRestData = await badRestRes.json();
  console.log(`Status: ${badRestRes.status}, Error: ${badRestData.error}`);
  if (badRestRes.status !== 401) {
    throw new Error('Test 3 failed: Wrong Restaurant Code should return 401');
  }
  console.log('✅ Test 3 Passed: Wrong restaurant code correctly rejected.\n');

  // Test 4: 3-Way Staff Verification & Clock-In
  console.log('--- Test 4: 3-Way Staff Verification & Clock-In (Rest PIN + Staff Name + Staff PIN) ---');
  const clockInRes = await fetch(`${API_BASE}/api/auth/staff-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_code: '4821',
      user_id: testStaff.id,
      name: testStaff.name,
      pin: '1234',
      action: 'clock_in',
    }),
  });
  const clockInData = await clockInRes.json();
  console.log(`Status: ${clockInRes.status}, Success: ${clockInData.success}`);
  console.log(`Message: ${clockInData.message}`);
  console.log(`User: ${clockInData.user?.name} (${clockInData.user?.position})`);
  console.log(`Clocked In: ${clockInData.is_clocked_in}`);
  console.log(`Token Issued: ${!!clockInData.token}`);

  if (!clockInData.success || !clockInData.token || !clockInData.is_clocked_in) {
    throw new Error('Test 4 failed: Staff clock-in verification failed');
  }
  console.log('✅ Test 4 Passed: 3-way staff verification & clock-in succeeded!\n');

  // Test 5: 3-Way Staff Verification & Clock-Out
  console.log('--- Test 5: 3-Way Staff Verification & Clock-Out ---');
  const clockOutRes = await fetch(`${API_BASE}/api/auth/staff-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_code: '4821',
      user_id: testStaff.id,
      name: testStaff.name,
      pin: '1234',
      action: 'clock_out',
    }),
  });
  const clockOutData = await clockOutRes.json();
  console.log(`Status: ${clockOutRes.status}, Success: ${clockOutData.success}`);
  console.log(`Message: ${clockOutData.message}`);
  console.log(`Clocked In: ${clockOutData.is_clocked_in}`);

  if (!clockOutData.success || clockOutData.is_clocked_in !== false) {
    throw new Error('Test 5 failed: Staff clock-out verification failed');
  }
  console.log('✅ Test 5 Passed: 3-way staff verification & clock-out succeeded!\n');

  // Test 6: Manager Login Password < 8 characters should fail
  console.log('--- Test 6: Manager Password < 8 chars should fail ---');
  const shortPassRes = await fetch(`${API_BASE}/api/auth/manager-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_id: '4821',
      email: 'owner@cavali.com',
      password: '1234',
    }),
  });
  const shortPassData = await shortPassRes.json();
  console.log(`Status: ${shortPassRes.status}, Error: ${shortPassData.error}`);
  if (shortPassRes.status !== 400) {
    throw new Error('Test 6 failed: Manager password < 8 characters should return 400');
  }
  console.log('✅ Test 6 Passed: Manager password length validation enforced.\n');

  // Test 7: Manager Email & Password ("1234abcD") Login
  console.log('--- Test 7: Manager Email & Password ("1234abcD") Login ---');
  const mgrRes = await fetch(`${API_BASE}/api/auth/manager-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_id: '4821',
      email: 'owner@cavali.com',
      password: '1234abcD',
    }),
  });
  const mgrData = await mgrRes.json();
  console.log(`Status: ${mgrRes.status}, Success: ${mgrData.success}`);
  console.log(`Manager: ${mgrData.user?.name} (${mgrData.user?.role})`);
  console.log(`Token Issued: ${!!mgrData.token}`);

  if (!mgrData.success || !mgrData.token || (mgrData.user?.role !== 'owner' && mgrData.user?.role !== 'manager')) {
    throw new Error('Test 7 failed: Manager login failed');
  }
  console.log('✅ Test 7 Passed: Manager authentication succeeded with 1234abcD!\n');

  // Test 8: Manager Login with Non-Manager Account
  console.log('--- Test 8: Non-Manager trying to use Manager Login ---');
  const nonMgrRes = await fetch(`${API_BASE}/api/auth/manager-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_id: '4821',
      email: testStaff.email || 'alex@cavali.com',
      password: '1234abcD',
    }),
  });
  const nonMgrData = await nonMgrRes.json();
  console.log(`Status: ${nonMgrRes.status}, Error: ${nonMgrData.error}`);
  if (nonMgrRes.status !== 403 && nonMgrRes.status !== 401) {
    throw new Error('Test 8 failed: Non-manager account should be blocked from manager portal');
  }
  console.log('✅ Test 8 Passed: Non-manager account blocked from manager login.\n');

  console.log('🎉 ALL 7 STAFF & MANAGER AUTHENTICATION TESTS PASSED CLEANLY! 🚀');
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});

export {};
