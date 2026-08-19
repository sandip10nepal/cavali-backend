import { Router, Response } from 'express';
import { ToastService } from '../services/toast.service';
import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { RecipeService } from '../services/recipe.service';
import { sseService } from '../services/sse.service';
import { AuthService } from '../services/auth.service';
import { resolveTenantRestaurantId } from '../middleware/tenant.middleware';
import { OrderRepository } from '../modules/orders/order.repository';
import { OrderService } from '../modules/orders/order.service';
import { InventoryRepository } from '../modules/inventory/inventory.repository';
import { ServiceRequestRepository } from '../modules/service-requests/serviceRequest.repository';
import { PaymentRepository } from '../modules/payments/payment.repository';

const router = Router();

// GET /api/orders/live
// Server-Sent Events stream for real-time dashboard updates (Tenant-Isolated)
router.get('/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const token = (req.query.token as string) || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '');
  let restaurantId = 'RES_001';
  let userId: string | null = null;
  let role = 'guest';

  if (token) {
    const payload = AuthService.verifyToken(token);
    if (payload) {
      restaurantId = payload.rid;
      userId = payload.sub;
      role = payload.role;
    }
  } else if (req.query.restaurant_id) {
    restaurantId = String(req.query.restaurant_id);
  } else if (req.query.restaurant_slug) {
    const r = MultiTenantDbService.getRestaurantBySlug(String(req.query.restaurant_slug));
    if (r) restaurantId = (r as any)._id || restaurantId;
  }

  const clientId = Date.now();
  sseService.addClient({
    id: clientId,
    restaurantId,
    res,
    role,
    userId,
  });

  console.log(`🔌 [SSE] New client connected for restaurant [${restaurantId}]. ID: ${clientId} (Total: ${sseService.getClientCount()})`);

  // Send initial ping to confirm connection
  res.write(`data: ${JSON.stringify({ type: 'ping', restaurant_id: restaurantId })}\n\n`);

  req.on('close', () => {
    console.log(`🔌 [SSE] Client disconnected. ID: ${clientId}`);
    sseService.removeClient(clientId);
  });
});

// Helper to verify if request is from an authorized Manager or Owner
async function isManagerOrOwner(req: any, authPin?: any): Promise<boolean> {
  if (req?.tenant && (req.tenant.role === 'owner' || req.tenant.role === 'manager' || req.tenant.role === 'platform_admin')) {
    return true;
  }
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);
    if (payload && (payload.role === 'owner' || payload.role === 'manager' || payload.role === 'platform_admin')) {
      return true;
    }
  }
    const pin = authPin || req.headers?.['x-admin-pin'] || req.query?.authPin;
    if (pin) {
      const pinStr = String(pin).trim();
      const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
      if (restaurantId && MultiTenantDbService.isInitialized()) {
        const users = await MultiTenantDbService.listUsers(restaurantId);
        for (const u of users) {
          if ((u.role === 'owner' || u.role === 'manager' || u.role === 'platform_admin') && AuthService.verifyPin(pinStr, u.pin_hash)) {
            return true;
          }
        }
      }
    }
    return false;
  }

// Helper: Classify any item into 'hookah' | 'drinks' | 'food'
function classifyOrderItem(item: any): 'hookah' | 'drinks' | 'food' {
  if (!item) return 'food';
  
  const cat = String(item.category || item.category_id || '').toLowerCase().trim();
  const name = String(item.name || (item.item && item.item.name) || (item.flavor && typeof item.flavor === 'object' ? item.flavor.name : item.flavor) || '').toLowerCase().trim();

  // 1. Explicit Hookah Classification
  if (
    cat === 'hookah' || 
    cat === 'cat_hookah' || 
    cat.includes('hookah') || 
    cat.includes('shisha') ||
    item.is_hookah === true ||
    item.flavor !== undefined ||
    item.iceHose !== undefined ||
    item.iceBase !== undefined ||
    name.includes('hookah') ||
    name.includes('shisha') ||
    name.includes('anarkali') ||
    name.includes('sokha') ||
    name.includes('cavali crush') ||
    name.includes('shah jahan') ||
    name.includes('white king') ||
    name.includes('dragon') ||
    name.includes('dubai nights') ||
    name.includes('habibi nights') ||
    name.includes('bombay pan') ||
    name.includes('hawaiian breeze') ||
    name.includes('blue mist') ||
    name.includes('love 66') ||
    name.includes('lady killer') ||
    name.includes('double apple') ||
    name.includes('paan') ||
    name.includes('head refill') ||
    name.includes('coal refill')
  ) {
    return 'hookah';
  }

  // 2. Explicit Food Overrides (desserts, appetizers, dosas, biryanis, tandoori, curries, breads, indo-chinese)
  if (
    cat.includes('food') ||
    cat.includes('appetizer') ||
    cat.includes('starter') ||
    cat.includes('main') ||
    cat.includes('entree') ||
    cat.includes('wing') ||
    cat.includes('burger') ||
    cat.includes('wrap') ||
    cat.includes('dessert') ||
    cat.includes('sweet') ||
    cat.includes('vegetarian') ||
    cat.includes('continental') ||
    cat.includes('tandoori') ||
    cat.includes('curry') ||
    cat.includes('biryani') ||
    cat.includes('bread') ||
    name.includes('cake') ||
    name.includes('jamun') ||
    name.includes('gulab') ||
    name.includes('rasmalai') ||
    name.includes('kulfi') ||
    name.includes('halwa') ||
    name.includes('samosa') ||
    name.includes('pakora') ||
    name.includes('bhaji') ||
    name.includes('bonda') ||
    name.includes('mirchi') ||
    name.includes('dosa') ||
    name.includes('idli') ||
    name.includes('vada') ||
    name.includes('uttappam') ||
    name.includes('tandoori') ||
    name.includes('tikka') ||
    name.includes('seekh') ||
    name.includes('kebab') ||
    name.includes('kabob') ||
    name.includes('chop') ||
    name.includes('chicken') ||
    name.includes('mutton') ||
    name.includes('goat') ||
    name.includes('lamb') ||
    name.includes('beef') ||
    name.includes('fish') ||
    name.includes('shrimp') ||
    name.includes('prawn') ||
    name.includes('pulusu') ||
    name.includes('biryani') ||
    name.includes('rice') ||
    name.includes('naan') ||
    name.includes('roti') ||
    name.includes('kulcha') ||
    name.includes('paratha') ||
    name.includes('poori') ||
    name.includes('bread') ||
    name.includes('paneer') ||
    name.includes('daal') ||
    name.includes('dal') ||
    name.includes('chana') ||
    name.includes('gobi') ||
    name.includes('baingan') ||
    name.includes('kofta') ||
    name.includes('curry') ||
    name.includes('masala') ||
    name.includes('makhani') ||
    name.includes('chettinad') ||
    name.includes('korma') ||
    name.includes('saag') ||
    name.includes('palak') ||
    name.includes('vindaloo') ||
    name.includes('kadai') ||
    name.includes('fry') ||
    name.includes('fries') ||
    name.includes('chaat') ||
    name.includes('puri') ||
    name.includes('falafel') ||
    name.includes('hummus') ||
    name.includes('nacho') ||
    name.includes('queso') ||
    name.includes('taco') ||
    name.includes('momo') ||
    name.includes('noodle') ||
    name.includes('manchurian') ||
    name.includes('chow mein') ||
    name.includes('cordon bleu') ||
    name.includes('sandwich') ||
    name.includes('zinger') ||
    name.includes('shawarma') ||
    name.includes('platter') ||
    name.includes('sampler')
  ) {
    return 'food';
  }

  // 3. Explicit Drinks / Beverages Classification
  if (
    cat === 'drinks' || 
    cat === 'beverages' || 
    cat === 'cat_beverages' || 
    cat.includes('drink') || 
    cat.includes('beverage') || 
    cat.includes('coffee') || 
    cat.includes('tea') || 
    cat.includes('bar') ||
    cat.includes('juice') ||
    cat.includes('refresher') ||
    name.includes('mojito') ||
    name.includes('margarita') ||
    name.includes('juice') ||
    name.includes('shake') ||
    name.includes('lassi') ||
    name.includes('chai') ||
    name.includes('tea') ||
    name.includes('coffee') ||
    name.includes('latte') ||
    name.includes('espresso') ||
    name.includes('cappuccino') ||
    name.includes('soda') ||
    name.includes('coke') ||
    name.includes('sprite') ||
    name.includes('fanta') ||
    name.includes('ginger ale') ||
    name.includes('red bull') ||
    name.includes('saratoga') ||
    name.includes('water') ||
    name.includes('colada') ||
    name.includes('lemonade') ||
    name.includes('smoothie') ||
    name.includes('beer') ||
    name.includes('wine') ||
    name.includes('cocktail') ||
    name.includes('mocktail') ||
    name.includes('secret') ||
    name.includes('affair') ||
    name.includes('melon') ||
    name.includes('karak')
  ) {
    return 'drinks';
  }

  return 'food';
}

// Helper: Convert any order (MultiTenant or Legacy) into clean standardized format for KDS / client
function mapOrderForClient(o: any): any {
  if (!o) return {};
  
  // Consolidate all items
  const allRawItems: any[] = [];
  if (Array.isArray(o.items) && o.items.length > 0) {
    allRawItems.push(...o.items);
  }
  if (Array.isArray(o.food) && o.food.length > 0) {
    allRawItems.push(...o.food);
  }
  if (Array.isArray(o.drinks) && o.drinks.length > 0) {
    allRawItems.push(...o.drinks);
  }
  if (Array.isArray(o.hookahs) && o.hookahs.length > 0) {
    allRawItems.push(...o.hookahs);
  }

  // Smart Deduplication: Merge identical item names (e.g. items vs hookahs array duplicates)
  const uniqueItems: any[] = [];
  const nameMap = new Map<string, any>();

  allRawItems.forEach(i => {
    const rawName = i.name || (i.item && i.item.name) || (i.flavor && typeof i.flavor === 'object' ? i.flavor.name : i.flavor) || 'Item';
    const key = rawName.toLowerCase().trim();
    
    if (nameMap.has(key)) {
      const existing = nameMap.get(key);
      // Retain highest price and merge notes/addons if present
      if (!existing.price && i.price) existing.price = i.price;
      if (!existing.notes && (i.notes || i.note)) existing.notes = i.notes || i.note;
      if (i.flavor && !existing.flavor) existing.flavor = i.flavor;
      if (i.iceHose) existing.iceHose = true;
      if (i.iceBase) existing.iceBase = true;
    } else {
      const copy = { 
        ...i, 
        name: rawName,
        qty: Number(i.qty || i.quantity || 1),
        price: i.price !== undefined ? Number(i.price) : (i.item && i.item.price !== undefined ? Number(i.item.price) : 0),
        notes: i.notes || i.note || '',
      };
      nameMap.set(key, copy);
      uniqueItems.push(copy);
    }
  });

  const food: any[] = [];
  const drinks: any[] = [];
  const hookahs: any[] = [];

  uniqueItems.forEach((i: any) => {
    const kind = classifyOrderItem(i);
    if (kind === 'hookah') {
      const flavorName = (i.flavor && typeof i.flavor === 'object' ? i.flavor.name : i.flavor) || i.name || (i.item && i.item.name) || 'Hookah';
      hookahs.push({
        flavor: typeof i.flavor === 'object' ? i.flavor : { name: flavorName },
        name: flavorName,
        price: i.price !== undefined && i.price > 0 ? Number(i.price) : (i.item && i.item.price !== undefined && i.item.price > 0 ? Number(i.item.price) : 18),
        qty: Number(i.qty || i.quantity || 1),
        iceHose: i.iceHose,
        iceBase: i.iceBase,
        notes: i.notes || i.note || '',
      });
    } else if (kind === 'drinks') {
      drinks.push({
        item: {
          name: i.name || (i.item && i.item.name) || 'Drink Item',
          price: i.price !== undefined ? Number(i.price) : (i.item && i.item.price !== undefined ? Number(i.item.price) : 0),
          emoji: i.emoji || (i.item && i.item.emoji) || '🍹',
        },
        name: i.name || (i.item && i.item.name) || 'Drink Item',
        price: i.price !== undefined ? Number(i.price) : (i.item && i.item.price !== undefined ? Number(i.item.price) : 0),
        emoji: i.emoji || (i.item && i.item.emoji) || '🍹',
        qty: Number(i.qty || i.quantity || 1),
        note: i.note || i.notes || '',
      });
    } else {
      food.push({
        item: {
          name: i.name || (i.item && i.item.name) || 'Food Item',
          price: i.price !== undefined ? Number(i.price) : (i.item && i.item.price !== undefined ? Number(i.item.price) : 0),
          emoji: i.emoji || (i.item && i.item.emoji) || '🍔',
        },
        name: i.name || (i.item && i.item.name) || 'Food Item',
        price: i.price !== undefined ? Number(i.price) : (i.item && i.item.price !== undefined ? Number(i.item.price) : 0),
        emoji: i.emoji || (i.item && i.item.emoji) || '🍔',
        qty: Number(i.qty || i.quantity || 1),
        sauce: i.sauce,
        note: i.note || i.notes || '',
      });
    }
  });

  return {
    id: o._id || o.id,
    _id: o._id || o.id,
    table: o.table_id || o.table || '1',
    status: o.status,
    paymentStatus: o.payment_status || o.paymentStatus || (o.status === 'paid' ? 'paid' : 'unpaid'),
    total: o.subtotal || o.grand_total || o.total || 0,
    grandTotal: o.grand_total || o.total || 0,
    taxAmount: o.tax_amount || o.taxAmount || o.tax || 0,
    tipAmount: o.tip_amount || o.tipAmount || o.tip || 0,
    discountAmount: o.discount_amount || o.discountAmount || o.discount || 0,
    createdAt: o.created_at || o.createdAt,
    updatedAt: o.updated_at || o.updatedAt,
    customerName: o.customer_name || o.customerName || 'Guest',
    customerPhone: o.customer_phone || o.customerPhone || '',
    notes: o.notes || '',
    items: uniqueItems,
    hookahs,
    food,
    drinks,
    totalPaid: o.totalPaid || (o.payment_status === 'paid' ? (o.grand_total || o.total) : 0),
    totalDue: o.totalDue !== undefined ? o.totalDue : (o.payment_status === 'paid' ? 0 : (o.grand_total || o.total || 0)),
    kind: o.kind || 'order',
    fulfilledDepartments: o.fulfilledDepartments || [],
  };
}

// Unified Order Finder using OrderRepository
async function findUnifiedOrder(orderId: string, restaurantId?: string | null): Promise<{ order: any; isMultiTenant: boolean; restaurantId?: string } | null> {
  if (!orderId) return null;
  const mtOrder = await OrderRepository.findById(orderId, restaurantId || undefined);
  if (mtOrder) {
    return { order: mtOrder, isMultiTenant: true, restaurantId: mtOrder.restaurant_id || restaurantId || 'RES_EED4E9D266DF' };
  }
  return null;
}

// Unified Order Updater using OrderRepository
async function updateUnifiedOrder(orderId: string, updateFields: any, restaurantId?: string | null): Promise<any> {
  const restId = restaurantId || 'RES_EED4E9D266DF';
  const updatedObj = await OrderRepository.update(orderId, restId, updateFields);
  return mapOrderForClient(updatedObj);
}

// Unified Order Deletion using OrderRepository
async function deleteUnifiedOrder(orderId: string, restaurantId?: string | null): Promise<boolean> {
  return await OrderRepository.delete(orderId, restaurantId || undefined);
}

// GET /api/orders
// Returns orders stored in persistent DB scoped strictly to the caller's role station
router.get('/', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
  const rawOrders = await OrderRepository.listByRestaurant(restaurantId);
  const allOrders = rawOrders.map(mapOrderForClient);

  // Detect caller role
  let callerRole: string = 'manager';
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);
    if (payload?.role) callerRole = payload.role;
  } else if (req.query.role) {
    callerRole = String(req.query.role);
  } else if (req.headers['x-user-role']) {
    callerRole = String(req.headers['x-user-role']);
  }

  // Station-specific order scoping:
  // - Bartender: Live drinks & bar items only
  // - Chef: Live food items only
  // - Hookah Maker: Live hookah items only
  // - Server / Manager / Owner: All orders with full items
  let resultOrders = allOrders;
  if (callerRole === 'bartender') {
    resultOrders = allOrders
      .filter((o: any) => (o.drinks && o.drinks.length > 0) || o.kind === 'chai')
      .map((o: any) => ({
        ...o,
        food: [],
        hookahs: [],
      }));
  } else if (callerRole === 'chef' || callerRole === 'kitchen') {
    resultOrders = allOrders
      .filter((o: any) => o.food && o.food.length > 0)
      .map((o: any) => ({
        ...o,
        drinks: [],
        hookahs: [],
      }));
  } else if (callerRole === 'hookah_maker') {
    resultOrders = allOrders
      .filter((o: any) => o.hookahs && o.hookahs.length > 0)
      .map((o: any) => ({
        ...o,
        food: [],
        drinks: [],
      }));
  }

  res.status(200).json({ success: true, orders: resultOrders });
});

// POST /api/orders
// Mobile app submits orders here - SAVES order only, does NOT deduct stock
router.post('/', async (req, res) => {
  try {
    const orderPayload = req.body;
    const restaurantId = (await resolveTenantRestaurantId(req)) || req.tenant?.restaurant_id || orderPayload.restaurant_id || 'RES_EED4E9D266DF';
    
    // Check Idempotency-Key header or payload to eliminate duplicate orders 100%
    const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || orderPayload?.idempotencyKey || orderPayload?.idempotency_key;
    if (idempotencyKey) {
      const existingOrder = await OrderService.createOrder(restaurantId, orderPayload, String(idempotencyKey));
      if (existingOrder) {
        return res.status(200).json({ success: true, order: mapOrderForClient(existingOrder), message: 'Returned idempotent order' });
      }
    }

    const totalVal = Number(orderPayload.total) || 0;

    const isTaxExempt = Boolean(orderPayload.taxExempt);
    const taxRate = isTaxExempt ? 0 : 0.0825;
    const taxAmount = isTaxExempt ? 0 : parseFloat((totalVal * taxRate).toFixed(2));
    const discountAmount = Number(orderPayload.discountAmount) || 0;
    const tipAmount = Number(orderPayload.tipAmount) || 0;
    const grandTotal = parseFloat((totalVal + taxAmount + tipAmount - discountAmount).toFixed(2));

    const orderPayloadToSave = {
      ...orderPayload,
      _id: `cav-${Date.now()}`,
      restaurant_id: restaurantId,
      status: 'pending',
      paymentStatus: orderPayload.paymentStatus || 'unpaid',
      paymentMethod: orderPayload.paymentMethod || 'CASH',
      taxRate,
      taxAmount,
      taxExempt: isTaxExempt,
      tipAmount,
      discountAmount,
      total: totalVal,
      grandTotal,
      totalDue: orderPayload.totalDue !== undefined ? Number(orderPayload.totalDue) : grandTotal,
      totalPaid: Number(orderPayload.totalPaid) || 0,
      createdAt: new Date().toISOString(),
    };

    // Save order strictly once via OrderRepository
    const createdOrder = await OrderRepository.create(orderPayloadToSave);
    const newOrder = mapOrderForClient(createdOrder);

    // Process inventory deductions based on item recipes
    try {
      await RecipeService.processOrderDeductions(newOrder);
    } catch (recipeErr) {
      console.warn('[OrdersRoute] Auto inventory deduction error:', recipeErr);
    }

    // Forward to Toast POS
    const toastResult = await ToastService.submitOrder(newOrder);

    if (toastResult.success) {
      newOrder.status = 'sent_to_toast';
      await OrderRepository.update(newOrder.id, restaurantId, { status: 'sent_to_toast' } as any);
    } else {
      newOrder.status = 'toast_failed';
      await OrderRepository.update(newOrder.id, restaurantId, { status: 'toast_failed' } as any);
    }

    // Broadcast the new order to KDS in real-time
    sseService.broadcast(newOrder, restaurantId);

    res.status(201).json({
      success: true,
      order: newOrder,
      message: toastResult.success ? 'Order received & sent to POS' : 'Order received, POS call failed'
    });

  } catch (error) {
    console.error('Error submitting order:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/orders/server-call
// Customer iPad requests waiter / coals / water / check assistance
router.post('/server-call', async (req, res) => {
  try {
    const { table, requestType, note, restaurant_id } = req.body;
    const tableNum = String(table || '1').replace(/[^0-9]/g, '') || '1';
    
    const requestLabels: Record<string, string> = {
      server: 'Server Assistance Needed',
      coals: 'Hookah Coal Refill 🔥',
      water: 'Ice Water Refresh 💧',
      utensils: 'Plates & Utensils 🍽️',
      check: 'Bill / Check Requested 💳',
      custom: note || 'Customer Assistance',
    };

    const label = note || requestLabels[requestType] || 'Assistance Needed';

    const restId = (await resolveTenantRestaurantId(req)) || req.tenant?.restaurant_id || restaurant_id || 'RES_EED4E9D266DF';
    
    const serviceReq = await ServiceRequestRepository.create({
      restaurant_id: restId,
      table_id: `TBL_${tableNum}`,
      request_type: (requestType as any) || 'server',
      note: label,
    });

    const serverRequestOrder: any = {
      id: serviceReq._id,
      kind: 'server_request',
      table: tableNum,
      requestType: requestType || 'server',
      note: label,
      customerName: `Table ${tableNum}`,
      createdAt: serviceReq.created_at,
      status: 'pending',
      total: 0,
      grandTotal: 0,
      totalDue: 0,
      paymentStatus: 'paid',
      items: [],
      hookahs: [],
      food: [],
      drinks: [],
    };

    // Broadcast in real-time to KDS and Server stations
    sseService.broadcast(serverRequestOrder, restId);

    res.status(200).json({ success: true, request: serverRequestOrder });
  } catch (error: any) {
    console.error('Error handling server call:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/orders/fulfill & POST /api/orders/:id/fulfill
// Called by admin panel to complete order or complete a specific department of an order
const handleFulfillOrder = async (req: any, res: Response) => {
  const orderId = req.params.id || req.body.orderId || req.body.id;
  const department = req.body.department;
  if (!orderId) {
    return res.status(400).json({ success: false, message: 'Missing orderId' });
  }

  const restaurantId = await resolveTenantRestaurantId(req);
  const found = await findUnifiedOrder(orderId, restaurantId);

  if (!found) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const order = found.order;
  const targetId = order._id || order.id;
  const restId = found.restaurantId || restaurantId || 'RES_EED4E9D266DF';

  if (order.status === 'fulfilled') {
    return res.status(400).json({ success: false, message: 'Order already fulfilled' });
  }

  const fulfilledDeps: string[] = Array.isArray(order.fulfilledDepartments) ? [...order.fulfilledDepartments] : [];

  if (department && ['food', 'drinks', 'hookah'].includes(department)) {
    // Department-specific fulfillment from Chef / Bartender / Hookah Maker
    if (!fulfilledDeps.includes(department)) {
      fulfilledDeps.push(department);
    }
    const updatedClientOrder = await updateUnifiedOrder(targetId, { fulfilledDepartments: fulfilledDeps }, restId);

    sseService.broadcast({ type: 'order_updated', orderId: targetId, order: updatedClientOrder });

    return res.status(200).json({
      success: true,
      message: `Department ${department} marked as fulfilled`,
      order: updatedClientOrder
    });
  } else {
    // Full order fulfillment by Server / Manager
    const clientOrderForDeps = mapOrderForClient(order);
    const departmentsInOrder: string[] = [];
    if (clientOrderForDeps?.food && clientOrderForDeps.food.length > 0) departmentsInOrder.push('food');
    if ((clientOrderForDeps?.drinks && clientOrderForDeps.drinks.length > 0) || clientOrderForDeps?.kind === 'chai') departmentsInOrder.push('drinks');
    if (clientOrderForDeps?.hookahs && clientOrderForDeps.hookahs.length > 0) departmentsInOrder.push('hookah');

    departmentsInOrder.forEach(dep => {
      if (!fulfilledDeps.includes(dep)) fulfilledDeps.push(dep);
    });

    // 1. Process inventory deductions
    if (clientOrderForDeps) {
      RecipeService.processOrderDeductions(clientOrderForDeps);
    }

    // 2. Mark order status as fulfilled
    const updatedClientOrder = await updateUnifiedOrder(targetId, { status: 'fulfilled', fulfilledDepartments: fulfilledDeps }, restId);

    // 3. Broadcast fulfillment to update KDS screens & inventory stock levels
    sseService.broadcast({ type: 'order_fulfilled', orderId: targetId, order: updatedClientOrder });

  }
};

router.post('/fulfill', handleFulfillOrder);
router.post('/:id/fulfill', handleFulfillOrder);

// GET /api/orders/sales/summary
// Comprehensive Sales, Tax, Tips, YTD & Payment Logs Analytics Endpoint
router.get('/sales/summary', async (req, res) => {
  try {
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
    const allOrders = await MultiTenantDbService.listOrders(restaurantId);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();

    const dayOfWeek = now.getDay() || 7;
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(now.getDate() - (dayOfWeek - 1));
    const startOfWeekMs = startOfWeek.getTime();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const startOfMonthMs = startOfMonth.getTime();

    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const startOfYearMs = startOfYear.getTime();

    let daily = { sales: 0, tax: 0, tips: 0, gross: 0, count: 0 };
    let weekly = { sales: 0, tax: 0, tips: 0, gross: 0, count: 0 };
    let monthly = { sales: 0, tax: 0, tips: 0, gross: 0, count: 0 };
    let yearly = { sales: 0, tax: 0, tips: 0, gross: 0, count: 0 };

    const paymentLogs: any[] = [];

    allOrders.forEach((o: any) => {
      const createdIso = o.createdAt || o.created_at || new Date().toISOString();
      const createdMs = new Date(createdIso).getTime();

      const subtotal = Number(o.subtotal || o.total || 0);
      const tax = Number(o.taxAmount || o.tax_amount || 0);
      const tip = Number(o.tipAmount || o.tip_amount || 0);
      const gross = Number(o.grandTotal || o.grand_total || (subtotal + tax + tip));

      if (createdMs >= startOfTodayMs) {
        daily.sales += subtotal;
        daily.tax += tax;
        daily.tips += tip;
        daily.gross += gross;
        daily.count++;
      }
      if (createdMs >= startOfWeekMs) {
        weekly.sales += subtotal;
        weekly.tax += tax;
        weekly.tips += tip;
        weekly.gross += gross;
        weekly.count++;
      }
      if (createdMs >= startOfMonthMs) {
        monthly.sales += subtotal;
        monthly.tax += tax;
        monthly.tips += tip;
        monthly.gross += gross;
        monthly.count++;
      }
      if (createdMs >= startOfYearMs) {
        yearly.sales += subtotal;
        yearly.tax += tax;
        yearly.tips += tip;
        yearly.gross += gross;
        yearly.count++;
      }

      const orderPaymentStatus = String(o.payment_status || o.paymentStatus || (o.status === 'paid' ? 'paid' : 'unpaid')).toLowerCase();
      const totalPaid = Number(o.totalPaid !== undefined ? o.totalPaid : (orderPaymentStatus === 'paid' ? gross : 0));

      if (Array.isArray(o.payment_logs) && o.payment_logs.length > 0) {
        o.payment_logs.forEach((pl: any) => {
          paymentLogs.push({
            id: pl.id || o._id || o.id,
            table: o.table_id || o.table || '1',
            customer: o.customer_name || o.customerName || 'Guest',
            payment_method: String(pl.payment_method || o.payment_method || o.paymentMethod || 'CASH').toUpperCase(),
            payment_status: String(pl.payment_status || orderPaymentStatus || 'paid').toUpperCase(),
            subtotal: parseFloat((pl.amount || subtotal).toFixed(2)),
            tax_amount: parseFloat(tax.toFixed(2)),
            tip_amount: parseFloat(tip.toFixed(2)),
            grand_total: parseFloat((pl.amount || gross).toFixed(2)),
            timestamp: pl.timestamp || o.paid_at || createdIso,
          });
        });
      } else {
        paymentLogs.push({
          id: o._id || o.id,
          table: o.table_id || o.table || '1',
          customer: o.customer_name || o.customerName || 'Guest',
          payment_method: String(o.payment_method || o.paymentMethod || 'CASH').toUpperCase(),
          payment_status: String(orderPaymentStatus || 'paid').toUpperCase(),
          subtotal: parseFloat((totalPaid || subtotal).toFixed(2)),
          tax_amount: parseFloat(tax.toFixed(2)),
          tip_amount: parseFloat(tip.toFixed(2)),
          grand_total: parseFloat((totalPaid || gross).toFixed(2)),
          timestamp: o.paid_at || o.updatedAt || o.updated_at || createdIso,
        });
      }
    });

    paymentLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      analytics: {
        daily: {
          sales: parseFloat(daily.sales.toFixed(2)),
          tax: parseFloat(daily.tax.toFixed(2)),
          tips: parseFloat(daily.tips.toFixed(2)),
          gross: parseFloat(daily.gross.toFixed(2)),
          count: daily.count,
        },
        weekly: {
          sales: parseFloat(weekly.sales.toFixed(2)),
          tax: parseFloat(weekly.tax.toFixed(2)),
          tips: parseFloat(weekly.tips.toFixed(2)),
          gross: parseFloat(weekly.gross.toFixed(2)),
          count: weekly.count,
        },
        monthly: {
          sales: parseFloat(monthly.sales.toFixed(2)),
          tax: parseFloat(monthly.tax.toFixed(2)),
          tips: parseFloat(monthly.tips.toFixed(2)),
          gross: parseFloat(monthly.gross.toFixed(2)),
          count: monthly.count,
        },
        yearly: {
          sales: parseFloat(yearly.sales.toFixed(2)),
          tax: parseFloat(yearly.tax.toFixed(2)),
          tips: parseFloat(yearly.tips.toFixed(2)),
          gross: parseFloat(yearly.gross.toFixed(2)),
          count: yearly.count,
        },
        payment_logs_count: paymentLogs.length,
        payment_logs: paymentLogs,
      }
    });
  } catch (err: any) {
    console.error('Error fetching sales summary analytics:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sales summary' });
  }
});

// POST /api/orders/archive/clear
// Clears all fulfilled orders permanently from MongoDB Atlas for the tenant
router.post('/archive/clear', async (req, res) => {
  try {
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
    const count = await MultiTenantDbService.clearArchive(restaurantId);

    console.log(`🗑️ [OrdersArchive] Cleared ${count} fulfilled orders for restaurant [${restaurantId}]`);
    sseService.broadcast({ type: 'archive_cleared' }, restaurantId);
    res.status(200).json({ success: true, message: `Cleared ${count} fulfilled orders from database.` });
  } catch (error) {
    console.error('Error clearing archive:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/orders/inventory
// Returns current raw materials inventory levels for the target restaurant tenant
router.get('/inventory', async (req, res) => {
  try {
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
    const items = await InventoryRepository.list(restaurantId);
    const inventory: Record<string, any> = {};
    items.forEach((i: any) => {
      inventory[i._id || i.id || i.name] = {
        id: i._id || i.id,
        name: i.name,
        stock: i.stock,
        unit: i.unit,
        category: i.category || (i.unit === 'g' ? 'shisha' : 'beverages'),
        cost_per_unit: (i as any).cost_per_unit || 0,
        reorder_threshold: (i as any).reorder_threshold || 0,
      };
    });

    res.status(200).json({ success: true, inventory, rawMaterials: inventory });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch inventory' });
  }
});

// GET /api/orders/inventory/categories — list inventory categories for restaurant
router.get('/inventory/categories', async (req, res) => {
  try {
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
    const categories = await MultiTenantDbService.listInventoryCategories(restaurantId);
    res.status(200).json({ success: true, categories });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch inventory categories' });
  }
});

// POST /api/orders/inventory/categories — create inventory category
router.post('/inventory/categories', async (req, res) => {
  try {
    const isAuth = await isManagerOrOwner(req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Forbidden: Restricted to Managers and Owners.' });
    }
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
    const { title, icon, sort_order } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    const category = await MultiTenantDbService.createInventoryCategory({
      restaurant_id: restaurantId,
      title: String(title).trim(),
      icon: icon || '📦',
      sort_order: sort_order ? Number(sort_order) : 10,
    });
    sseService.broadcast({ type: 'inventory_category_update', action: 'create', category }, restaurantId);
    res.status(201).json({ success: true, category });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create category' });
  }
});

// POST /api/orders/inventory/categories/update — update inventory category
router.post('/inventory/categories/update', async (req, res) => {
  try {
    const isAuth = await isManagerOrOwner(req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Forbidden: Restricted to Managers and Owners.' });
    }
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
    const { id, title, icon, sort_order } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Category ID is required' });
    }
    const updated = await MultiTenantDbService.updateInventoryCategory(String(id), restaurantId, {
      title,
      icon,
      sort_order: sort_order ? Number(sort_order) : undefined,
    });
    sseService.broadcast({ type: 'inventory_category_update', action: 'update', id, title, icon }, restaurantId);
    res.status(200).json({ success: true, message: 'Inventory category updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update category' });
  }
});

// POST /api/orders/inventory/categories/delete — delete inventory category
router.post('/inventory/categories/delete', async (req, res) => {
  try {
    const isAuth = await isManagerOrOwner(req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Forbidden: Restricted to Managers and Owners.' });
    }
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Category ID is required' });
    }

    // Safety Check: verify if any stock items exist in this inventory category
    const invCategories = await MultiTenantDbService.listInventoryCategories(restaurantId);
    const targetCat = invCategories.find(c => (c._id || c.id) === String(id));
    const catTitle = (targetCat?.title || '').toLowerCase();

    const stockItems = await InventoryRepository.list(restaurantId);
    const matchingStock = stockItems.filter((i: any) => {
      const c = (i.category || '').toLowerCase();
      return c === String(id).toLowerCase() || (catTitle && c === catTitle);
    });

    if (matchingStock.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete inventory category because it contains ${matchingStock.length} active stock item(s). Please move or delete the items first.`
      });
    }

    await MultiTenantDbService.deleteInventoryCategory(String(id), restaurantId);
    sseService.broadcast({ type: 'inventory_category_update', action: 'delete', id }, restaurantId);
    res.status(200).json({ success: true, message: 'Inventory category deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete category' });
  }
});

// POST /api/orders/inventory/adjust
// Adjusts inventory (increase/decrease) with pin validations for target tenant (Manager/Owner only)
router.post('/inventory/adjust', async (req, res) => {
  const { ingredientId, amount, type, pin, authPin } = req.body;

  const isAuth = await isManagerOrOwner(req, authPin || pin);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Forbidden: Adjusting inventory is restricted to Managers and Owners.' });
  }

  const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
  
  if (!ingredientId || amount === undefined || Number(amount) <= 0 || !['increase', 'decrease'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid adjust payload parameters' });
  }

  const items = await InventoryRepository.list(restaurantId);
  const targetItem = items.find(i => i._id === ingredientId || (i as any).id === ingredientId || i.name === ingredientId);

  if (targetItem) {
    const delta = type === 'increase' ? Number(amount) : -Number(amount);
    await InventoryRepository.updateStock(targetItem._id || (targetItem as any).id, restaurantId, delta, {
      type: type === 'increase' ? 'PURCHASE' : 'MANUAL_ADJUSTMENT',
      reason: req.body.reason || `Manual ${type} adjustment`,
      userId: req.tenant?.user_id || undefined,
    });

    sseService.broadcast({ type: 'inventory_update', ingredientId, amount, adjustType: type }, restaurantId);

    return res.status(200).json({
      success: true,
      message: `Successfully adjusted ${targetItem.name} stock`,
      item: { ...targetItem, stock: Math.max(0, targetItem.stock + delta) }
    });
  }

  return res.status(404).json({ success: false, message: 'Raw material ingredient not found' });
});

// POST /api/orders/inventory/create
// Creates a new raw material inventory stock item for target tenant
router.post('/inventory/create', async (req, res) => {
  const { name, category, stock, unit, reorder_threshold, cost_per_unit, pin, authPin } = req.body;

  const isAuth = await isManagerOrOwner(req, authPin || pin);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Forbidden: Adding new inventory items is restricted to Managers and Owners.' });
  }

  const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
  if (!name || isNaN(Number(stock))) {
    return res.status(400).json({ success: false, message: 'Item name and valid initial stock quantity are required.' });
  }

  try {
    const newItem = await InventoryRepository.createItem({
      restaurant_id: restaurantId,
      name,
      category: category || 'shisha',
      stock: Number(stock) || 0,
      unit: unit || 'g',
      reorder_threshold: Number(reorder_threshold) || 100,
      cost_per_unit: Number(cost_per_unit) || 0
    });

    sseService.broadcast({ type: 'inventory_create', item: newItem }, restaurantId);

    return res.status(201).json({ success: true, message: `Successfully created inventory item ${name}`, item: newItem });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to create inventory item' });
  }
});

// POST /api/orders/inventory/update
// Updates an existing raw material inventory stock item for target tenant
router.post('/inventory/update', async (req, res) => {
  const { ingredientId, id, name, category, stock, unit, reorder_threshold, pin, authPin } = req.body;
  const targetId = ingredientId || id;

  const isAuth = await isManagerOrOwner(req, authPin || pin);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Forbidden: Editing inventory items is restricted to Managers and Owners.' });
  }

  const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
  if (!targetId) {
    return res.status(400).json({ success: false, message: 'ingredientId is required' });
  }

  try {
    const updateData: any = {};
    if (name) updateData.name = name;
    if (category) updateData.category = category;
    if (unit) updateData.unit = unit;
    if (stock !== undefined && !isNaN(Number(stock))) updateData.stock = Number(stock);
    if (reorder_threshold !== undefined && !isNaN(Number(reorder_threshold))) updateData.reorder_threshold = Number(reorder_threshold);

    const success = await MultiTenantDbService.updateInventoryItem(targetId, restaurantId, updateData);
    sseService.broadcast({ type: 'inventory_update', ingredientId: targetId, updateData }, restaurantId);

    return res.status(200).json({ success: true, message: `Updated inventory item ${targetId}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update inventory item' });
  }
});

// POST /api/orders/inventory/delete
// Deletes a raw material inventory item for target tenant
router.post('/inventory/delete', async (req, res) => {
  const { ingredientId, id, pin, authPin } = req.body;
  const targetId = ingredientId || id;

  const isAuth = await isManagerOrOwner(req, authPin || pin);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Forbidden: Deleting inventory items is restricted to Managers and Owners.' });
  }

  const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
  if (!targetId) {
    return res.status(400).json({ success: false, message: 'ingredientId is required' });
  }

  try {
    const success = await MultiTenantDbService.deleteInventoryItem(targetId, restaurantId);
    sseService.broadcast({ type: 'inventory_delete', ingredientId: targetId }, restaurantId);

    return res.status(200).json({ success: true, message: `Deleted inventory item ${targetId}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete inventory item' });
  }
});

// POST /api/orders/:orderId/payment-session
// iPad calls this to initiate a payment for an existing order.
// Amount is always calculated SERVER-SIDE from the stored order — never trusted from client.
router.post('/:orderId/payment-session', async (req, res) => {
  const { orderId } = req.params;
  const restaurantId = await resolveTenantRestaurantId(req);
  const found = await findUnifiedOrder(orderId, restaurantId);

  if (!found) {
    console.warn(`[Payment] Order not found for ID: ${orderId}`);
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const order = mapOrderForClient(found.order);

  // Reject if already paid
  if (['paid', 'fulfilled'].includes(order.status)) {
    return res.status(400).json({ success: false, message: 'Order is already paid' });
  }

  // Idempotency: if an active session already exists, return it (prevents duplicate on retry)
  const existingSessions = await PaymentRepository.getSessionsByOrderId(String(order.id));
  const activeSession = existingSessions.find(s =>
    !['COMPLETED', 'FAILED', 'CANCELED', 'EXPIRED'].includes(s.status)
  );
  if (activeSession) {
    console.log(`[Payment] Returning existing session ${activeSession._id} for order ${order.id}`);
    return res.status(200).json({
      success: true,
      payment_session_id: activeSession._id,
      order_id: String(order.id),
      amount_cents: activeSession.amount_cents,
      currency: activeSession.currency,
      status: activeSession.status
    });
  }

  // Calculate amount server-side (cents, always integer — never float)
  const remainingCents = Math.round((order.totalDue !== undefined ? order.totalDue : (order.total ?? 0)) * 100);
  
  let amountCents = remainingCents;
  if (req.body.amount_cents !== undefined) {
    const reqCents = Number(req.body.amount_cents);
    if (isNaN(reqCents) || reqCents <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount_cents' });
    }
    if (reqCents > remainingCents) {
      return res.status(400).json({ success: false, message: `Requested amount exceeds remaining order balance of $${(remainingCents/100).toFixed(2)}` });
    }
    amountCents = reqCents;
  }

  if (amountCents <= 0) {
    return res.status(400).json({ success: false, message: 'Order total is zero or already fully paid' });
  }

  const session = await PaymentRepository.createSession({
    id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    restaurant_id: restaurantId || 'RES_EED4E9D266DF',
    order_id: String(order.id),
    amount_cents: amountCents,
    currency: 'USD',
    status: 'PAYMENT_REQUESTED',
    idempotency_key: `idem-${order.id}-${Date.now()}`,
  });

  sseService.broadcast({ type: 'payment_session_created', session }, restaurantId || undefined);

  console.log(`[Payment] Created session ${session._id} for order ${order.id}: $${(amountCents / 100).toFixed(2)}`);

  res.status(201).json({
    success: true,
    payment_session_id: session._id,
    order_id: session.order_id,
    amount_cents: session.amount_cents,
    currency: session.currency,
    status: session.status
  });
});

// POST /api/orders/:orderId/checkout
// Called by iPad to update payment method/splits on an existing order
router.post('/:orderId/checkout', async (req, res) => {
  const { orderId } = req.params;
  const { paymentMethod, totalPaid, totalDue } = req.body;
  const restaurantId = await resolveTenantRestaurantId(req);
  const found = await findUnifiedOrder(orderId, restaurantId);

  if (!found) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const order = mapOrderForClient(found.order);
  const updateFields: any = {
    paymentMethod,
    totalPaid: totalPaid !== undefined ? Number(totalPaid) : (order.totalPaid || 0),
    totalDue: totalDue !== undefined ? Number(totalDue) : (order.totalDue ?? order.total)
  };

  const updatedOrder = await updateUnifiedOrder(orderId, updateFields, found.restaurantId);

  console.log(`[Payment] Order ${order.id} checkout updated to ${paymentMethod}`);

  // Broadcast order update to KDS and iPad in real-time
  sseService.broadcast({
    type: 'payment_status_update',
    order_id: order.id,
    order: updatedOrder
  });

  res.status(200).json({
    success: true,
    order: updatedOrder
  });
});

// POST /api/orders/collect-cash & /api/orders/pay-cash
// Called by admin KDS panel when staff collects cash from customer
const handleCollectCash = async (req: any, res: any) => {
  const orderId = req.params.orderId || req.body.orderId || req.body.id;
  const { amount } = req.body;
  const restaurantId = await resolveTenantRestaurantId(req);
  const found = await findUnifiedOrder(orderId, restaurantId);

  if (!found) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const order = mapOrderForClient(found.order);
  const currentDue = order.totalDue !== undefined ? Number(order.totalDue) : (order.total || 0);
  const collectAmount = amount !== undefined && !isNaN(Number(amount)) && Number(amount) > 0 ? Number(amount) : currentDue;

  if (isNaN(collectAmount) || collectAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid cash collection amount' });
  }

  const newPaid = Number(((order.totalPaid || 0) + collectAmount).toFixed(2));
  const newDue = Number(Math.max(0, currentDue - collectAmount).toFixed(2));
  const paymentStatus = newDue <= 0.01 ? 'paid' : 'partially_paid';

  const nowIso = new Date().toISOString();
  const newPaymentLog = {
    id: `pay-cash-${Date.now()}`,
    order_id: order.id,
    amount: collectAmount,
    payment_method: 'CASH',
    payment_status: paymentStatus,
    timestamp: nowIso
  };

  const existingLogs = Array.isArray(order.payment_logs) ? order.payment_logs : (Array.isArray((found.order as any).payment_logs) ? (found.order as any).payment_logs : []);

  const updateFields: any = {
    totalPaid: newPaid,
    totalDue: newDue,
    paymentStatus,
    payment_status: paymentStatus,
    paymentMethod: 'CASH',
    payment_method: 'CASH',
    paid_at: nowIso,
    updatedAt: nowIso,
    updated_at: nowIso,
    payment_logs: [...existingLogs, newPaymentLog]
  };

  if (paymentStatus === 'paid') {
    updateFields.status = 'paid';
  }

  const updatedOrder = await updateUnifiedOrder(orderId, updateFields, found.restaurantId);

  if (!updatedOrder) {
    return res.status(500).json({ success: false, message: 'Failed to update order' });
  }

  console.log(`[Payment] Cash collected for order ${order.id}: $${collectAmount.toFixed(2)}. Remaining due: $${newDue.toFixed(2)}`);

  sseService.broadcast({
    type: 'payment_status_update',
    order_id: order.id,
    order: updatedOrder
  });
  sseService.broadcast({
    type: 'order_paid',
    orderId: order.id,
    order: updatedOrder
  });

  res.status(200).json({
    success: true,
    message: 'Cash payment processed successfully',
    order: updatedOrder
  });
};

router.post('/collect-cash', handleCollectCash);
router.post('/pay-cash', handleCollectCash);
router.post('/:orderId/collect-cash', handleCollectCash);
router.post('/:orderId/pay-cash', handleCollectCash);

// GET /api/orders/credits
// Aggregates outstanding credit balances by customer phone number for target tenant (Manager/Owner only)
router.get('/credits', async (req, res) => {
  const isAuth = await isManagerOrOwner(req);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Forbidden: Access to customer credits and debt ledger is restricted to Managers and Owners.' });
  }

  const restaurantId = await resolveTenantRestaurantId(req);
  if (!restaurantId) {
    res.status(200).json({ success: true, credits: [] });
    return;
  }

  const tenantOrders = await MultiTenantDbService.listOrders(restaurantId);
  const creditsMap: Record<string, { customerName: string; customerPhone: string; totalDue: number; orders: any[] }> = {};

  tenantOrders.forEach((o: any) => {
    const phone = o.customerPhone ? String(o.customerPhone).trim() : (o.customer_phone ? String(o.customer_phone).trim() : '');
    const due = o.totalDue !== undefined ? Number(o.totalDue) : (o.payment_status === 'paid' ? 0 : Number(o.grand_total || o.total || 0));
    if (phone && due > 0) {
      if (!creditsMap[phone]) {
        creditsMap[phone] = {
          customerName: o.customerName || o.customer_name || 'Walk-in',
          customerPhone: phone,
          totalDue: 0,
          orders: []
        };
      }
      creditsMap[phone].totalDue = Number((creditsMap[phone].totalDue + due).toFixed(2));
      creditsMap[phone].orders.push({
        id: o._id,
        createdAt: o.created_at || o.createdAt,
        total: o.grand_total || o.total,
        totalPaid: o.totalPaid || 0,
        totalDue: due,
        status: o.status
      });
    }
  });

  const credits = Object.values(creditsMap);
  res.status(200).json({ success: true, credits });
});

// POST /api/orders/pay-debt
// Processes a payment towards a customer's accumulated due balances, oldest first (Manager/Owner only)
router.post('/pay-debt', async (req, res) => {
  const isAuth = await isManagerOrOwner(req, req.body?.authPin);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Forbidden: Processing debt payments is restricted to Managers and Owners.' });
  }

  const { phone, amount, paymentMethod } = req.body;
  const restaurantId = await resolveTenantRestaurantId(req);
  if (!phone || amount === undefined || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid phone or payment amount' });
  }

  if (!restaurantId) {
    return res.status(400).json({ success: false, message: 'Tenant restaurant context required.' });
  }

  const payAmount = Number(amount);
  let remainingPayment = payAmount;

  const tenantOrders = await MultiTenantDbService.listOrders(restaurantId);
  const customerUnpaid = tenantOrders
    .filter((o: any) => {
      const p = o.customerPhone || o.customer_phone;
      const due = o.totalDue !== undefined ? Number(o.totalDue) : (o.payment_status === 'paid' ? 0 : Number(o.grand_total || o.total || 0));
      return p && String(p).trim() === String(phone).trim() && due > 0;
    })
    .sort((a, b) => new Date(a.created_at || (a as any).createdAt).getTime() - new Date(b.created_at || (b as any).createdAt).getTime());

  if (customerUnpaid.length === 0) {
    return res.status(400).json({ success: false, message: 'No outstanding debt found for this phone number' });
  }

  const updatedOrders = [];
  for (const order of customerUnpaid) {
    if (remainingPayment <= 0) break;

    const orderDue = (order as any).totalDue !== undefined ? Number((order as any).totalDue) : ((order as any).grand_total || (order as any).total || 0);
    const payForThisOrder = Number(Math.min(remainingPayment, orderDue).toFixed(2));
    
    const newPaid = Number((((order as any).totalPaid || 0) + payForThisOrder).toFixed(2));
    const newDue = Number((orderDue - payForThisOrder).toFixed(2));
    const paymentStatus = newDue <= 0.01 ? 'paid' : 'partially_paid';

    await MultiTenantDbService.updateOrderStatus(order._id, restaurantId, paymentStatus === 'paid' ? 'paid' : order.status, {
      payment_status: paymentStatus as any,
      totalDue: newDue,
      totalPaid: newPaid,
    } as any);

    updatedOrders.push({ ...order, totalPaid: newPaid, totalDue: newDue, payment_status: paymentStatus });
    remainingPayment = Number((remainingPayment - payForThisOrder).toFixed(2));
  }

  sseService.broadcast({ type: 'credits_update' }, restaurantId);

  res.status(200).json({
    success: true,
    message: `Successfully processed $${payAmount.toFixed(2)} towards debt.`,
    remainingUnapplied: remainingPayment,
    updatedOrders
  });
});

// GET /api/orders/closed-days
// Returns list of logged closed days summaries for target tenant (Manager/Owner only)
router.get('/closed-days', async (req, res) => {
  const isAuth = await isManagerOrOwner(req);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Forbidden: Access to closed day summaries is restricted to Managers and Owners.' });
  }

  res.status(200).json({ success: true, closedDays: [] });
});

// POST /api/orders/close-day
// Logs the daily summary of the open session and resets daily active sales (Manager/Owner only)
router.post('/close-day', async (req, res) => {
  try {
    const isAuth = await isManagerOrOwner(req, req.body?.authPin);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Forbidden: Closing business days is restricted to Managers and Owners.' });
    }

    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Tenant restaurant context required.' });
    }

    const tenantOrders = await MultiTenantDbService.listOrders(restaurantId);
    const activeOrders = tenantOrders.filter((o: any) => o.kind !== 'server_request' && !(o as any).closedSession);

    if (activeOrders.length === 0) {
      return res.status(400).json({ success: false, message: 'No active orders in the current open session to close.' });
    }

    let totalSales = 0;
    let totalCollected = 0;
    let totalDue = 0;

    activeOrders.forEach((o: any) => {
      totalSales += Number(o.grand_total || o.total || 0);
      totalCollected += Number(o.totalPaid || (o.payment_status === 'paid' ? o.total : 0));
      totalDue += o.totalDue !== undefined ? Number(o.totalDue) : (o.payment_status === 'paid' ? 0 : Number(o.grand_total || o.total || 0));
    });

    const summary = {
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      restaurant_id: restaurantId,
      totalSales: Number(totalSales.toFixed(2)),
      totalCollected: Number(totalCollected.toFixed(2)),
      totalDue: Number(totalDue.toFixed(2)),
      orderCount: activeOrders.length
    };

    for (const o of activeOrders) {
      await MultiTenantDbService.updateOrderStatus(o._id, restaurantId, o.status, { closedSession: true } as any);
    }

    sseService.broadcast({ type: 'day_closed', summary }, restaurantId);

    res.status(200).json({ success: true, message: 'Day closed successfully and sales reset.', summary });
  } catch (error) {
    console.error('Error closing day:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/:orderId', async (req, res) => {
  const isAuth = await isManagerOrOwner(req, req.body?.authPin);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Forbidden: Deleting orders is restricted to Managers and Owners.' });
  }

  const { orderId } = req.params;
  const restaurantId = await resolveTenantRestaurantId(req);
  const deleted = await deleteUnifiedOrder(orderId, restaurantId);

  if (deleted) {
    console.log(`[Order] Deleted unpaid order ${orderId}`);
    sseService.broadcast({ type: 'order_deleted', orderId });
    res.status(200).json({ success: true, message: 'Order deleted successfully' });
  } else {
    res.status(404).json({ success: false, message: 'Order not found' });
  }
});

// ── POST /api/orders/:id/void ─────────────────────────────────────────────
// Void an unpaid order (Manager+ PIN required)
router.post('/:orderId/void', async (req, res) => {
  const { orderId } = req.params;
  const { reason, authPin } = req.body;

  // Permission check
  const isAuth = await isManagerOrOwner(req, authPin);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Manager or Owner PIN required to void an order' });
  }

  const restaurantId = await resolveTenantRestaurantId(req);
  const found = await findUnifiedOrder(orderId, restaurantId);
  if (!found) return res.status(404).json({ success: false, message: 'Order not found' });
  const order = mapOrderForClient(found.order);

  if (order.status === 'voided') return res.status(400).json({ success: false, message: 'Order is already voided' });
  if (order.paymentStatus === 'paid') return res.status(400).json({ success: false, message: 'Cannot void a paid order — issue a refund instead' });

  const updated = await updateUnifiedOrder(orderId, {
    status: 'voided',
    voidReason: reason || 'No reason provided',
    voidedBy: req.tenant?.restaurant_name || 'Manager',
    voidedAt: new Date().toISOString()
  }, found.restaurantId);

  sseService.broadcast({ type: 'order_voided', orderId, order: updated });
  res.json({ success: true, order: updated });
});

// ── POST /api/orders/:id/refund ───────────────────────────────────────────
// Full or item-level refund (Manager+ PIN required)
router.post('/:orderId/refund', async (req, res) => {
  const { orderId } = req.params;
  const { reason, authPin, items, isFullRefund } = req.body;

  const isAuth = await isManagerOrOwner(req, authPin);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Manager or Owner PIN required to issue a refund' });
  }

  const restaurantId = await resolveTenantRestaurantId(req);
  const found = await findUnifiedOrder(orderId, restaurantId);
  if (!found) return res.status(404).json({ success: false, message: 'Order not found' });
  const order = mapOrderForClient(found.order);

  if (order.status === 'voided') return res.status(400).json({ success: false, message: 'Cannot refund a voided order' });

  // Calculate refund amount
  let refundAmount = 0;
  const refundItems: any[] = [];

  if (isFullRefund || !items || items.length === 0) {
    refundAmount = Number(order.totalPaid || order.total || 0);
  } else {
    items.forEach((it: any) => {
      const price = Number(it.price || 0) * Number(it.qty || 1);
      refundAmount += price;
      refundItems.push(it);
    });
  }

  refundAmount = parseFloat(refundAmount.toFixed(2));

  const refund = {
    id: `ref-${Date.now()}`,
    orderId: String(orderId),
    amount: refundAmount,
    reason: reason || 'No reason provided',
    items: refundItems,
    isFullRefund: Boolean(isFullRefund) || refundItems.length === 0,
    issuedBy: req.tenant?.restaurant_name || 'Manager',
    createdAt: new Date().toISOString()
  };

  await PaymentRepository.createRefund(refund);

  // Mark order as refunded
  const refundStatus = (isFullRefund || refundItems.length === 0) ? 'refunded' : 'partial_refund';
  const updated = await updateUnifiedOrder(orderId, {
    paymentStatus: refundStatus,
    refundedAmount: (Number((order as any).refundedAmount || (order as any).refunded_amount || 0)) + refundAmount,
    refundedAt: new Date().toISOString(),
    refundReason: reason
  }, found.restaurantId);

  sseService.broadcast({ type: 'order_refunded', orderId, refund, order: updated });
  res.json({ success: true, refund, order: updated });
});

// ── POST /api/orders/:id/tip ──────────────────────────────────────────────
// Record tip amount on an order (can be set post-payment)
router.post('/:orderId/tip', async (req, res) => {
  const { orderId } = req.params;
  const { tipAmount } = req.body;

  if (tipAmount === undefined || isNaN(Number(tipAmount))) {
    return res.status(400).json({ success: false, message: 'tipAmount is required' });
  }

  const restaurantId = await resolveTenantRestaurantId(req);
  const found = await findUnifiedOrder(orderId, restaurantId);
  if (!found) return res.status(404).json({ success: false, message: 'Order not found' });
  const order = mapOrderForClient(found.order);

  const tip = parseFloat(Number(tipAmount).toFixed(2));
  const newGrandTotal = parseFloat((Number(order.grandTotal || order.total || 0) + tip - Number(order.tipAmount || 0)).toFixed(2));

  const updated = await updateUnifiedOrder(orderId, {
    tipAmount: tip,
    grandTotal: newGrandTotal,
    totalDue: newGrandTotal - Number(order.totalPaid || 0)
  }, found.restaurantId);

  sseService.broadcast({ type: 'tip_recorded', orderId, order: updated });
  res.json({ success: true, order: updated });
});

// ── GET /api/orders/payments ──────────────────────────────────────────────
// Payment history with period filter: today | weekly | monthly | ytd | yearly for target tenant (Manager/Owner only)
router.get('/payments', async (req, res) => {
  try {
    const isAuth = await isManagerOrOwner(req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access to payment and revenue records is restricted to Managers and Owners.' });
    }

    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
    const period = String(req.query.period || 'today');
    const tenantOrders = await MultiTenantDbService.listOrders(restaurantId);
    const allOrders = tenantOrders.filter((o: any) => o.kind !== 'server_request');
    const refunds = await PaymentRepository.listRefunds();

    const now = new Date();
    let filteredOrders = allOrders;
    if (period === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      filteredOrders = allOrders.filter(o => (o.created_at || (o as any).createdAt || '').startsWith(todayStr));
    } else if (period === 'weekly') {
      const threshold = new Date(now); threshold.setDate(now.getDate() - 7);
      filteredOrders = allOrders.filter(o => new Date(o.created_at || (o as any).createdAt) >= threshold);
    } else if (period === 'monthly') {
      const threshold = new Date(now); threshold.setDate(now.getDate() - 30);
      filteredOrders = allOrders.filter(o => new Date(o.created_at || (o as any).createdAt) >= threshold);
    } else if (period === 'ytd') {
      const threshold = new Date(now.getFullYear(), 0, 1);
      filteredOrders = allOrders.filter(o => new Date(o.created_at || (o as any).createdAt) >= threshold);
    } else if (period === 'yearly') {
      const threshold = new Date(now); threshold.setDate(now.getDate() - 365);
      filteredOrders = allOrders.filter(o => new Date(o.created_at || (o as any).createdAt) >= threshold);
    }

    // Summarize
    let totalCollected = 0; let totalTips = 0; let totalTax = 0; let totalRefunds = 0;
    filteredOrders.forEach((o: any) => {
      totalCollected += Number(o.totalPaid || (o.payment_status === 'paid' ? o.total : 0));
      totalTips += Number(o.tip_amount || o.tipAmount || 0);
      totalTax += Number(o.tax_amount || o.taxAmount || 0);
    });
    refunds.forEach(rf => { totalRefunds += rf.amount; });

    res.json({
      success: true,
      period,
      payments: filteredOrders,
      refunds,
      summary: {
        totalCollected: parseFloat(totalCollected.toFixed(2)),
        totalTips: parseFloat(totalTips.toFixed(2)),
        totalTax: parseFloat(totalTax.toFixed(2)),
        totalRefunds: parseFloat(totalRefunds.toFixed(2)),
        net: parseFloat((totalCollected - totalRefunds).toFixed(2))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load payment history' });
  }
});

// ── GET /api/orders/tax-report ────────────────────────────────────────────
// Tax collected report with period filter for target tenant (Manager/Owner only)
router.get('/tax-report', async (req, res) => {
  try {
    const isAuth = await isManagerOrOwner(req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access to tax reports is restricted to Managers and Owners.' });
    }

    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
    const period = String(req.query.period || 'today');
    const tenantOrders = await MultiTenantDbService.listOrders(restaurantId);
    const allOrders = tenantOrders.filter((o: any) => o.kind !== 'server_request' && !o.taxExempt);

    const now = new Date();
    let filteredOrders = allOrders;
    if (period === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      filteredOrders = allOrders.filter(o => (o.created_at || (o as any).createdAt || '').startsWith(todayStr));
    } else if (period === 'weekly') {
      const t = new Date(now); t.setDate(now.getDate() - 7);
      filteredOrders = allOrders.filter(o => new Date(o.created_at || (o as any).createdAt) >= t);
    } else if (period === 'monthly') {
      const t = new Date(now); t.setDate(now.getDate() - 30);
      filteredOrders = allOrders.filter(o => new Date(o.created_at || (o as any).createdAt) >= t);
    } else if (period === 'ytd') {
      filteredOrders = allOrders.filter(o => new Date(o.created_at || (o as any).createdAt) >= new Date(now.getFullYear(), 0, 1));
    } else if (period === 'yearly') {
      const t = new Date(now); t.setDate(now.getDate() - 365);
      filteredOrders = allOrders.filter(o => new Date(o.created_at || (o as any).createdAt) >= t);
    }

    let totalTax = 0; let hookahTax = 0; let foodTax = 0; let drinksTax = 0;
    const defaultTaxRate = 0.0825;

    filteredOrders.forEach((o: any) => {
      const orderTax = Number(o.tax_amount || o.taxAmount || 0);
      totalTax += orderTax;

      let hookahSub = (o.hookahs?.length || 0) * 18;
      let foodSub = 0; let drinksSub = 0;
      (o.food || []).forEach((f: any) => {
        const p = f.item ? Number(f.item.price || 0) : Number(f.price || 0);
        foodSub += p * Number(f.qty || 1);
      });
      (o.drinks || []).forEach((d: any) => {
        const p = d.item ? Number(d.item.price || 0) : Number(d.price || 0);
        drinksSub += p * Number(d.qty || 1);
      });

      hookahTax += hookahSub * defaultTaxRate;
      foodTax += foodSub * defaultTaxRate;
      drinksTax += drinksSub * defaultTaxRate;
    });

    res.json({
      success: true, period,
      taxReport: {
        totalTax: parseFloat(totalTax.toFixed(2)),
        hookahTax: parseFloat(hookahTax.toFixed(2)),
        foodTax: parseFloat(foodTax.toFixed(2)),
        drinksTax: parseFloat(drinksTax.toFixed(2)),
        taxRate: defaultTaxRate,
        orderCount: filteredOrders.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate tax report' });
  }
});

// ── GET /api/orders/tax-config ────────────────────────────────────────────
router.get('/tax-config', async (req, res) => {
  const isAuth = await isManagerOrOwner(req);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Forbidden: Access to tax configuration is restricted to Managers and Owners.' });
  }
  res.json({ success: true, taxConfig: { defaultRate: 0.0825, hookahRate: 0.0825, foodRate: 0.0825, drinksRate: 0.0825 } });
});

// ── Discounts ─────────────────────────────────────────────────────────────
// GET /api/orders/discounts (Manager/Owner only)
router.get('/discounts', async (req, res) => {
  const isAuth = await isManagerOrOwner(req);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Forbidden: Access to discounts is restricted to Managers and Owners.' });
  }
  res.json({ success: true, discounts: [] });
});

// POST /api/orders/discounts
router.post('/discounts', async (req, res) => {
  const { name, code, type, value, authPin } = req.body;
  const isAuth = await isManagerOrOwner(req, authPin);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Manager or Owner PIN required' });
  }
  if (!name || !code || !type || value === undefined) {
    return res.status(400).json({ success: false, message: 'name, code, type, and value are required' });
  }
  const discount = {
    id: `disc-${Date.now()}`,
    name, code: String(code).toUpperCase(), type, value: parseFloat(value),
    active: true, createdAt: new Date().toISOString()
  };
  res.status(201).json({ success: true, discount });
});

// PATCH /api/orders/discounts/:id
router.patch('/discounts/:id', async (req, res) => {
  const { authPin, ...fields } = req.body;
  const isAuth = await isManagerOrOwner(req, authPin);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Manager or Owner PIN required' });
  }
  res.json({ success: true, discount: fields });
});

// DELETE /api/orders/discounts/:id
router.delete('/discounts/:id', async (req, res) => {
  const { authPin } = req.body;
  const isAuth = await isManagerOrOwner(req, authPin);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Manager or Owner PIN required' });
  }
  res.json({ success: true });
});

export default router;
