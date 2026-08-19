/**
 * Automated Test: Device Table Configuration using 8-Digit Unified PIN
 * POST /api/auth/device/configure-table
 */
const API_BASE = 'http://localhost:3000';

async function runDeviceConfigTests() {
  console.log('🧪 Starting Device / iPad Table Configuration Tests...\n');

  // Test 1: Wrong 8-digit PIN (wrong staff PIN)
  console.log('--- Test 1: Configure with Wrong Staff PIN (4821-9999) ---');
  const res1 = await fetch(`${API_BASE}/api/auth/device/configure-table`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_name: 'Cavali Hookah Lounge',
      table_number: '12',
      pin: '4821-9999',
    }),
  });
  const data1 = await res1.json();
  console.log(`Status: ${res1.status}, Error: ${data1.error}`);
  if (res1.status !== 401) {
    throw new Error('Test 1 failed: Should reject invalid staff PIN');
  }
  console.log('✅ Test 1 Passed: Invalid staff PIN rejected.\n');

  // Test 2: Wrong Restaurant Code (9999-1234)
  console.log('--- Test 2: Configure with Wrong Restaurant Code (9999-1234) ---');
  const res2 = await fetch(`${API_BASE}/api/auth/device/configure-table`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_number: '12',
      pin: '9999-1234',
    }),
  });
  const data2 = await res2.json();
  console.log(`Status: ${res2.status}, Error: ${data2.error}`);
  if (res2.status !== 401) {
    throw new Error('Test 2 failed: Should reject invalid restaurant code');
  }
  console.log('✅ Test 2 Passed: Invalid restaurant code rejected.\n');

  // Test 3: Correct 8-digit code for Cavali Table 12 (4821-1234)
  console.log('--- Test 3: Configure Cavali Table 12 with 4821-1234 ---');
  const res3 = await fetch(`${API_BASE}/api/auth/device/configure-table`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_name: 'Cavali Hookah Lounge',
      table_number: '12',
      pin: '4821-1234',
      device_name: 'iPad Pro Table 12',
    }),
  });
  const data3 = await res3.json();
  console.log(`Status: ${res3.status}, Success: ${data3.success}`);
  console.log(`Restaurant: ${data3.restaurant?.name} (${data3.restaurant?.restaurant_code})`);
  console.log(`Table: ${data3.table?.label} (Num: ${data3.table?.number})`);
  console.log(`Authorized By: ${data3.authorized_by?.name} (${data3.authorized_by?.role})`);
  console.log(`Device Token Issued: ${!!data3.token}`);

  if (!data3.success || !data3.token || data3.table?.number !== 12) {
    throw new Error('Test 3 failed: Device table configuration failed');
  }
  console.log('✅ Test 3 Passed: iPad configured successfully for Cavali Table 12!\n');

  console.log('🎉 ALL DEVICE TABLE CONFIGURATION TESTS PASSED CLEANLY! 🚀');
}

runDeviceConfigTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

export {};
