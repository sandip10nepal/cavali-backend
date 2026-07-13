import { Router, Response } from 'express';
import { ToastService } from '../services/toast.service';
import { DbService } from '../services/db.service';
import { RecipeService } from '../services/recipe.service';

const router = Router();

// Store active Server-Sent Events (SSE) connections
let sseClients: { id: number; res: Response }[] = [];

// Helper to broadcast events to connected clients
function broadcastEvent(event: any) {
  sseClients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
}

// GET /api/orders/live
// Server-Sent Events stream for real-time dashboard updates
router.get('/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const clientId = Date.now();
  sseClients.push({ id: clientId, res });

  console.log(`🔌 [SSE] New admin client connected. ID: ${clientId}`);

  // Send initial ping to check connection
  res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);

  req.on('close', () => {
    console.log(`🔌 [SSE] Admin client disconnected. ID: ${clientId}`);
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// GET /api/orders
// Returns all orders stored in the persistent database
router.get('/', (req, res) => {
  const orders = DbService.getOrders();
  res.status(200).json({ success: true, orders });
});

// POST /api/orders
// Mobile app submits orders here - SAVES order only, does NOT deduct stock
router.post('/', async (req, res) => {
  try {
    const orderPayload = req.body;
    
    const newOrder = {
      ...orderPayload,
      id: `cav-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'pending', // remains pending until fulfilled by admin
    };

    // Save order in database
    DbService.addOrder(newOrder);

    // Forward to Toast POS
    const toastResult = await ToastService.submitOrder(newOrder);

    if (toastResult.success) {
      newOrder.status = 'sent_to_toast';
      DbService.updateOrderStatus(newOrder.id, 'sent_to_toast');
    } else {
      newOrder.status = 'toast_failed';
      DbService.updateOrderStatus(newOrder.id, 'toast_failed');
    }

    // Broadcast the new order to KDS in real-time
    broadcastEvent(newOrder);

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

// POST /api/orders/fulfill
// Called by admin panel to complete order and deduct materials
router.post('/fulfill', (req, res) => {
  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ success: false, message: 'Missing orderId' });
  }

  const orders = DbService.getOrders();
  const order = orders.find(o => String(o.id) === String(orderId));

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (order.status === 'fulfilled') {
    return res.status(400).json({ success: false, message: 'Order already fulfilled' });
  }

  // 1. Process inventory deductions
  RecipeService.processOrderDeductions(order);

  // 2. Mark order status as fulfilled
  DbService.updateOrderStatus(orderId, 'fulfilled');
  order.status = 'fulfilled';

  // 3. Broadcast fulfillment to update KDS screens & inventory stock levels
  broadcastEvent({ type: 'order_fulfilled', orderId, order });

  res.status(200).json({
    success: true,
    message: 'Order successfully fulfilled and inventory updated',
    order
  });
});

// POST /api/orders/archive/clear
// Clears all fulfilled orders from the database
router.post('/archive/clear', (req, res) => {
  try {
    DbService.clearArchivedOrders();
    broadcastEvent({ type: 'inventory_update' });
    res.status(200).json({ success: true, message: 'Archive cleared successfully' });
  } catch (error) {
    console.error('Error clearing archive:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/orders/inventory
// Returns current raw materials inventory levels
router.get('/inventory', (req, res) => {
  const inventory = DbService.getInventory();
  res.status(200).json({ success: true, inventory });
});

// POST /api/orders/inventory/adjust
// Adjusts inventory (increase/decrease) with pin validations
router.post('/inventory/adjust', (req, res) => {
  const { ingredientId, amount, type, pin } = req.body;
  
  if (!ingredientId || amount === undefined || Number(amount) <= 0 || !['increase', 'decrease'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid adjust payload parameters' });
  }

  const inventory = DbService.getInventory();
  if (!inventory[ingredientId]) {
    return res.status(404).json({ success: false, message: 'Raw material ingredient not found' });
  }

  // Security check for manual decreases
  if (type === 'decrease') {
    if (pin !== '1577') {
      return res.status(403).json({ success: false, message: 'Unauthorized. Invalid security PIN.' });
    }
    DbService.reduceInventory(ingredientId, Number(amount));
  } else {
    // Increase (restock)
    DbService.restockInventory(ingredientId, Number(amount));
  }
  
  // Broadcast update to all active screens
  broadcastEvent({ type: 'inventory_update', ingredientId, amount, adjustType: type });

  res.status(200).json({
    success: true,
    message: `Successfully adjusted ${inventory[ingredientId].name} stock`,
    item: DbService.getInventory()[ingredientId]
  });
});

export default router;
