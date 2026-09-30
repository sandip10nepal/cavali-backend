import { calculateOrderFinances, OrderService } from '../modules/orders/order.service';
import { OrderRepository } from '../modules/orders/order.repository';
import { MultiTenantDbService } from '../services/multi-tenant-db.service';

async function runBugFixVerification() {
  console.log('🧪 Starting Verification Test: Order Total & Tax/Tip Bug Fix...');

  await MultiTenantDbService.initialize();

  const cavaliRestId = 'RES_EED4E9D266DF';

  // The exact user-reported test order:
  // 1x Cavalli Crush with Ice Base ($37: $35 base + $2 Ice Base modifier)
  // 1x Hummus ($10)
  // 1x Classic Mint Mojito ($10)
  const testOrderPayload = {
    restaurant_id: cavaliRestId,
    table: '10',
    table_id: '10',
    customerNickname: 'Alex M.',
    customerName: 'Alex M.',
    // Mobile app sends cart financial totals
    subtotal: 57.00,
    taxAmount: 4.70,
    gratuityAmount: 10.26,
    tipAmount: 10.26,
    total: 71.96,
    grandTotal: 71.96,
    items: [
      {
        id: 'hookah_cavalli_crush',
        name: 'Cavalli Crush',
        price: 35.00,
        qty: 1,
        category: 'hookah',
        selectedModifiers: [
          { id: 'mod_ice_base', name: 'Ice Base', optionName: 'Ice Base', price: 2.00 }
        ],
        modifiers: [
          { id: 'mod_ice_base', name: 'Ice Base', optionName: 'Ice Base', price: 2.00 }
        ]
      },
      {
        id: 'food_hummus',
        name: 'Hummus',
        price: 10.00,
        qty: 1,
        category: 'food'
      },
      {
        id: 'drink_classic_mojito',
        name: 'Classic Mint Mojito',
        price: 10.00,
        qty: 1,
        category: 'drinks'
      }
    ],
    hookahs: [
      {
        flavor: { name: 'Cavalli Crush', id: 'hookah_cavalli_crush' },
        name: 'Cavalli Crush',
        qty: 1,
        price: 35.00,
        modifiers: [
          { id: 'mod_ice_base', name: 'Ice Base', optionName: 'Ice Base', price: 2.00 }
        ]
      }
    ],
    food: [
      {
        item: { name: 'Hummus', price: 10.00 },
        name: 'Hummus',
        qty: 1,
        price: 10.00
      }
    ],
    drinks: [
      {
        item: { name: 'Classic Mint Mojito', price: 10.00 },
        name: 'Classic Mint Mojito',
        qty: 1,
        price: 10.00
      }
    ]
  };

  console.log('\n--- 1. Testing calculateOrderFinances ---');
  const finances = calculateOrderFinances(testOrderPayload);
  console.log('Computed finances:', finances);

  if (finances.subtotal !== 57.00) {
    throw new Error(`Subtotal mismatch! Expected 57.00, got ${finances.subtotal}`);
  }
  console.log('✅ Subtotal is accurately $57.00');

  if (finances.taxAmount !== 4.70) {
    throw new Error(`Tax amount mismatch! Expected 4.70, got ${finances.taxAmount}`);
  }
  console.log('✅ Sales Tax (8.25%) is accurately $4.70 (NOT $5.94)');

  if (finances.gratuityAmount !== 10.26) {
    throw new Error(`Gratuity mismatch! Expected 10.26, got ${finances.gratuityAmount}`);
  }
  console.log('✅ Gratuity (18%) is accurately $10.26');

  if (finances.grandTotal !== 71.96) {
    throw new Error(`Grand Total mismatch! Expected 71.96, got ${finances.grandTotal} (BUG: should not be 88.16)`);
  }
  console.log('✅ Grand Total is accurately $71.96 (NOT $88.16)');

  if (finances.totalDue !== 71.96) {
    throw new Error(`Total Due mismatch! Expected 71.96, got ${finances.totalDue}`);
  }
  console.log('✅ Total Due is accurately $71.96 (Staff ticket will show $71.96, NOT $88.16)');

  console.log('\n--- 2. Testing OrderService.createOrder ---');
  const idempotencyKey = `idem_bugfix_test_${Date.now()}`;
  const createdOrder = await OrderService.createOrder(cavaliRestId, testOrderPayload, idempotencyKey);

  console.log('Created order ID:', createdOrder._id);
  console.log('Created order finances:', {
    subtotal: createdOrder.subtotal,
    tax_amount: (createdOrder as any).tax_amount || createdOrder.taxAmount,
    gratuity_amount: (createdOrder as any).gratuity_amount || createdOrder.gratuityAmount,
    grand_total: (createdOrder as any).grand_total || createdOrder.grandTotal,
    totalDue: createdOrder.totalDue,
    totalPaid: createdOrder.totalPaid,
  });

  if (createdOrder.subtotal !== 57.00) {
    throw new Error(`Order subtotal mismatch: expected 57, got ${createdOrder.subtotal}`);
  }
  const actualTax = (createdOrder as any).tax_amount || createdOrder.taxAmount;
  if (actualTax !== 4.70) {
    throw new Error(`Order tax_amount mismatch: expected 4.70, got ${actualTax}`);
  }
  const actualGratuity = (createdOrder as any).gratuity_amount || createdOrder.gratuityAmount;
  if (actualGratuity !== 10.26) {
    throw new Error(`Order gratuity_amount mismatch: expected 10.26, got ${actualGratuity}`);
  }
  const actualGrandTotal = (createdOrder as any).grand_total || createdOrder.grandTotal;
  if (actualGrandTotal !== 71.96) {
    throw new Error(`Order grand_total mismatch: expected 71.96, got ${actualGrandTotal}`);
  }
  if (createdOrder.totalDue !== 71.96) {
    throw new Error(`Order totalDue mismatch: expected 71.96, got ${createdOrder.totalDue}`);
  }
  console.log('✅ Order created in repository with exact $71.96 total');

  console.log('\n--- 3. Testing OrderRepository.findById & Modifiers ---');
  const fetched = await OrderRepository.findById(createdOrder._id, cavaliRestId);
  if (!fetched) {
    throw new Error('Could not fetch created order from repository');
  }

  if (fetched.subtotal !== 57.00) {
    throw new Error(`Fetched order subtotal mismatch: expected 57, got ${fetched.subtotal}`);
  }
  if ((fetched as any).grand_total !== 71.96 && fetched.grandTotal !== 71.96) {
    throw new Error(`Fetched order grand_total mismatch: expected 71.96, got ${(fetched as any).grand_total}`);
  }

  // Verify Ice Base modifier is preserved on hookah
  const fetchedHookah = (fetched.hookahs || [])[0] || (fetched.items || []).find((i: any) => i.name.includes('Cavalli Crush'));
  const mods = fetchedHookah?.modifiers || [];
  const hasIceBase = mods.some((m: any) => (m.name || m.optionName || '').toLowerCase().includes('ice base'));
  console.log('Hookah modifiers:', mods, 'hasIceBase:', hasIceBase);
  if (!hasIceBase && !(fetchedHookah?.notes || '').toLowerCase().includes('ice base')) {
    console.warn('⚠️ Warning: Ice Base modifier was not explicitly found in hookah modifier array or notes');
  } else {
    console.log('✅ Ice Base modifier pill is preserved for staff KDS card');
  }

  console.log('\n--- 4. Testing Idempotency Replay ---');
  const replayed = await OrderService.createOrder(cavaliRestId, testOrderPayload, idempotencyKey);
  if (replayed._id !== createdOrder._id) {
    throw new Error(`Idempotency replay failed! Expected ${createdOrder._id}, got ${replayed._id}`);
  }
  if (replayed.totalDue !== 71.96) {
    throw new Error(`Idempotency replayed totalDue mismatch: expected 71.96, got ${replayed.totalDue}`);
  }
  console.log('✅ Idempotency replay returned same order with exact $71.96 total due');

  console.log('\n🎉 ALL ORDER TOTAL BUG FIX VERIFICATION TESTS PASSED 100%!');
  process.exit(0);
}

runBugFixVerification().catch(err => {
  console.error('❌ Bug fix verification test failed:', err);
  process.exit(1);
});
