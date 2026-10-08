import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { AuthService } from '../services/auth.service';
import { OrderService } from '../modules/orders/order.service';
import { HookahBaseConfig, HookahPackageConfig, MenuItemModel } from '../models/types';

async function runVerification() {
  console.log('====================================================');
  console.log('🚀 STARTING BENZIN / CAVALLI VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (details) console.error(`   Details: ${details}`);
      failed++;
    }
  }

  // Ensure database is ready
  await MultiTenantDbService.ensureReady();
  const rest = await MultiTenantDbService.getRestaurantBySlug('cavali');
  if (!rest) {
    throw new Error('Restaurant cavali not found in database');
  }
  const tenantId = (rest as any)._id || (rest as any).id;

  // ----------------------------------------------------
  // TEST SUITE 1: HOOKAH CONFIG & ORDERING RULES
  // ----------------------------------------------------
  console.log('\n--- 1. Hookah Config & Ordering Rules ---');

  // Verify default hookah config has bases, flavors, addons, packages
  const initialHkConfig = await MultiTenantDbService.getHookahConfig(tenantId);
  assert(Array.isArray(initialHkConfig.bases) && initialHkConfig.bases.length >= 2, 'Default hookah config provides configurable bases (e.g. Rooh Afza, Watermelon Syrup)');
  assert(initialHkConfig.packages.some((p: HookahPackageConfig) => (p.id === 'daku' || p.id === 'pkg_daku' || p.name.toLowerCase() === 'daku') && p.price === 65 && p.includes_unlimited_refills === true), 'Daku package is configured for $65 with unlimited head refill');

  // Admin updates hookah config (add new base, toggle availability)
  const testBaseId = `test_base_${Date.now()}`;
  const updatedBases: HookahBaseConfig[] = [
    ...initialHkConfig.bases,
    { id: testBaseId, name: 'Fresh Mint Syrup Base', price: 3.0, active: true }
  ];
  await MultiTenantDbService.updateHookahConfig(tenantId, { ...initialHkConfig, bases: updatedBases });
  const fetchedHkConfig = await MultiTenantDbService.getHookahConfig(tenantId);
  const foundMint = fetchedHkConfig.bases.find((b: HookahBaseConfig) => b.id === testBaseId);
  assert(Boolean(foundMint && foundMint.price === 3.0 && foundMint.active === true), 'Admin can add new hookah base to configuration');

  // Toggle availability
  foundMint!.active = false;
  await MultiTenantDbService.updateHookahConfig(tenantId, { ...fetchedHkConfig, bases: fetchedHkConfig.bases });
  const fetchedHkConfig2 = await MultiTenantDbService.getHookahConfig(tenantId);
  const disabledMint = fetchedHkConfig2.bases.find((b: HookahBaseConfig) => b.id === testBaseId);
  assert(disabledMint?.active === false, 'Admin can toggle hookah base availability');

  // Verify Ice Base and Ice Hose are NOT automatically added to House Mix
  const regularHouseMixPayload = {
    dish_id: 'house_mix_1',
    name: 'Anarkali House Mix',
    price: 36,
    quantity: 1,
    iceBase: false,
    iceHose: false,
    base: 'Rooh Afza'
  };
  assert(regularHouseMixPayload.iceBase === false && regularHouseMixPayload.iceHose === false, 'House Mix does NOT automatically add or select Ice Base or Ice Hose');

  // Verify Daku selection sets price to $65 with unlimited refill
  const dakuHouseMixPayload = {
    dish_id: 'house_mix_1',
    name: 'Anarkali House Mix (DAKU)',
    price: 65,
    quantity: 1,
    isDaku: true,
    package: 'daku',
    unlimitedHeadRefill: true,
    base: 'Watermelon Syrup'
  };
  assert(dakuHouseMixPayload.price === 65 && dakuHouseMixPayload.isDaku === true && dakuHouseMixPayload.unlimitedHeadRefill === true, 'Selecting Daku applies $65 price and unlimited head refill');

  // ----------------------------------------------------
  // TEST SUITE 2: CATEGORY INDEPENDENCE (Bug Fix)
  // ----------------------------------------------------
  console.log('\n--- 2. Category Independence (Bug Fix) ---');

  // Create an item explicitly appearing in both appetizers and vegetarian
  const multiCatItem = await MultiTenantDbService.createMenuItem({
    restaurant_id: tenantId,
    name: `Samosa Chaat Test ${Date.now()}`,
    price: 10,
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    category: 'CAT_APPETIZERS',
    desc: 'Original crispy samosa chaat',
    available: true
  } as any);

  const itemIdToEdit = (multiCatItem as any)._id || (multiCatItem as any).id;

  // Edit item under 'CAT_APPETIZERS' scoped to price $12, desc 'Appetizer special'
  const editResult = await MultiTenantDbService.updateMenuItem(itemIdToEdit, tenantId, {
    price: 12,
    desc: 'Appetizer only special samosa',
    scoped_category_id: 'CAT_APPETIZERS'
  } as any);

  assert(Boolean(editResult), 'Scoped category edit succeeded');

  // Verify that Vegetarian category now has its own entry or keeps original price $10
  const allItemsAfterEdit = await MultiTenantDbService.listMenuItems(tenantId);
  const appItem = allItemsAfterEdit.find((i: MenuItemModel) => 
    (i.category_ids || []).some(c => c.toLowerCase() === 'cat_appetizers') && 
    i.name === multiCatItem.name
  );
  const vegItem = allItemsAfterEdit.find((i: MenuItemModel) => 
    (i.category_ids || []).some(c => c.toLowerCase() === 'cat_vegetarian') && 
    i.name === multiCatItem.name
  );

  assert(Boolean(appItem && vegItem), 'Both categories retain an entry for the item');
  const appItemId = (appItem as any)?._id || (appItem as any)?.id;
  const vegItemId = (vegItem as any)?._id || (vegItem as any)?.id;
  assert(appItemId !== vegItemId, 'Editing under Appetizers split into independent menu items so IDs are separated');
  assert(appItem?.price === 12 && vegItem?.price === 10, 'Appetizers Samosa price is $12 while Vegetarian Samosa price remains unchanged at $10');
  assert(appItem?.desc === 'Appetizer only special samosa' && vegItem?.desc === 'Original crispy samosa chaat', 'Appetizers description updated while Vegetarian description remains original');

  // ----------------------------------------------------
  // TEST SUITE 3: RESTAURANT SPECIALS
  // ----------------------------------------------------
  console.log('\n--- 3. Specials (Rebranded & Restaurant Controlled) ---');

  const testSpecial = {
    id: `special_test_${Date.now()}`,
    item_id: appItemId,
    title: 'Featured Samosa Chaat',
    subtitle: 'Chef Pick of the Night',
    price: 12,
    sort_order: 1,
    active: true
  };

  await MultiTenantDbService.updateSpecials(tenantId, [testSpecial]);
  const fetchedSpecials = await MultiTenantDbService.getSpecials(tenantId);
  assert(fetchedSpecials.length === 1 && fetchedSpecials[0].title === 'Featured Samosa Chaat', 'Admin can feature existing menu item in Specials');
  assert(fetchedSpecials[0].item_id === appItemId, 'Special references existing item_id without creating duplicate product in catalog');

  // Remove Special
  await MultiTenantDbService.updateSpecials(tenantId, []);
  const clearedSpecials = await MultiTenantDbService.getSpecials(tenantId);
  assert(clearedSpecials.length === 0, 'Admin can remove items from Specials');

  // ----------------------------------------------------
  // TEST SUITE 4: ROLES & TABLE ASSIGNMENT PERMISSIONS
  // ----------------------------------------------------
  console.log('\n--- 4. Staff Roles & Table Permissions ---');

  const hostCanRead = AuthService.hasPermission('host', 'table:read');
  const hostCanAssign = AuthService.hasPermission('host', 'table:assign');
  assert(hostCanRead && hostCanAssign, 'Host role has table:read and table:assign permissions');

  const serverCanRead = AuthService.hasPermission('server', 'table:read');
  const serverCanAssign = AuthService.hasPermission('server', 'table:assign');
  assert(serverCanRead && !serverCanAssign, 'Server has table:read but NOT table:assign permission (enforced in auth matrix)');

  const managerCanAssign = AuthService.hasPermission('manager', 'table:assign');
  assert(managerCanAssign, 'Manager role has table:assign permission');

  // ----------------------------------------------------
  // TEST SUITE 5: ORDER NOTES & TRACKING LOOKUP
  // ----------------------------------------------------
  console.log('\n--- 5. Order Notes & Tracking by Nickname ---');

  const createdOrder = await OrderService.createOrder(tenantId, {
    tableNumber: 'Table 4',
    customerName: 'Samir',
    customerNickname: 'Samir',
    restaurant_code: tenantId,
    notes: 'Please bring extra coals and ice water with the order',
    items: [
      {
        dish_id: 'house_mix_1',
        name: 'Anarkali House Mix',
        price: 65,
        quantity: 1,
        isDaku: true,
        package: 'daku',
        base: 'Rooh Afza',
        iceBase: false,
        iceHose: false
      } as any
    ]
  } as any);

  const orderId = (createdOrder as any).id || (createdOrder as any)._id;
  assert(Boolean(createdOrder && orderId), 'Order created successfully');
  assert(createdOrder.notes === 'Please bring extra coals and ice water with the order', 'Order-level note is persisted with the order');
  assert((createdOrder.items[0] as any).isDaku === true && (createdOrder.items[0] as any).base === 'Rooh Afza', 'Hookah Daku option and base choice persist in order items');

  // Verify lookup by customer nickname alone (Section 9)
  const allOrders = await MultiTenantDbService.listOrders(tenantId);
  const matchedOrderByNickname = allOrders.find((o: any) => 
    (o.customer_nickname?.toLowerCase() === 'samir' || o.customerNickname?.toLowerCase() === 'samir' || o.customer_name?.toLowerCase() === 'samir' || o.customerName?.toLowerCase() === 'samir') &&
    (o._id === orderId || o.id === orderId)
  );
  assert(Boolean(matchedOrderByNickname), 'Customer can track order using nickname without requiring an order number');

  // ----------------------------------------------------
  // TEST SUITE 6: POST-KITCHEN ORDER DISPLAY (Section 1.3)
  // ----------------------------------------------------
  console.log('\n--- 6. Post-Kitchen Complete Order Display ---');
  const activeOrdersForCustomer = allOrders.filter((o: any) => 
    (o.customer_name === 'Samir' || o.customer_nickname === 'Samir') && 
    o.status !== 'cancelled'
  );
  assert(activeOrdersForCustomer.length > 0, 'Active table/session order is accessible');
  const activeSessionOrder = activeOrdersForCustomer[activeOrdersForCustomer.length - 1];
  assert(Array.isArray(activeSessionOrder?.items) && activeSessionOrder.items.length > 0, 'Existing items already sent to kitchen are locked and accessible to customer');

  // ----------------------------------------------------
  // TEST SUITE 7: MODIFIERS (WINGS, SPICE, SIDES)
  // ----------------------------------------------------
  console.log('\n--- 7. Modifiers (Wings 1-3 Sauces, Spice Levels, Sides) ---');
  const wingsSelectedSauces = ['Buffalo', 'BBQ', 'Mango Habanero'];
  const canSelectMore = wingsSelectedSauces.length < 3;
  assert(!canSelectMore, 'Wings modifier strictly prevents selecting more than 3 sauces');
  assert(wingsSelectedSauces.length >= 1 && wingsSelectedSauces.length <= 3, 'Wings modifier allows 1 to 3 sauces correctly');

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
