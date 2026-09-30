/**
 * Order Repository — Single source of truth for Order Persistence
 *
 * Reads/writes order data to MultiTenantDbService (MongoDB Atlas / local cache).
 * Eliminates all direct calls to legacy DbService.
 */

import { MultiTenantDbService } from '../../services/multi-tenant-db.service';
import { Order, OrderStatus } from './order.types';

export class OrderRepository {
  /**
   * Create a new order in persistent multi-tenant store
   */
  static async create(orderData: any): Promise<any> {
    const restaurantId = orderData.restaurant_id || orderData.restaurantId;
    if (!restaurantId) {
      throw new Error('Order is missing restaurant_id');
    }
    
    // Normalize items
    const rawItems: any[] = [];
    if (Array.isArray(orderData.items)) rawItems.push(...orderData.items);
    if (Array.isArray(orderData.food)) rawItems.push(...orderData.food);
    if (Array.isArray(orderData.drinks)) rawItems.push(...orderData.drinks);
    if (Array.isArray(orderData.hookahs)) rawItems.push(...orderData.hookahs);

    let rawItemSubtotal = 0;
    if (rawItems.length > 0) {
      rawItemSubtotal = rawItems.reduce((acc, it) => {
        const p = Number(it.price !== undefined ? it.price : (it.item && it.item.price !== undefined ? it.item.price : 0)) || 0;
        const q = Number(it.qty || it.quantity || 1) || 1;
        const mods = Array.isArray(it.modifiers) ? it.modifiers : (it.selectedModifiers || []);
        const modTotal = Array.isArray(mods) ? mods.reduce((mAcc: number, m: any) => mAcc + (Number(m.price || m.price_adjustment || 0) || 0), 0) : 0;
        return acc + (p + modTotal) * q;
      }, 0);
    }

    const subtotal = parseFloat(Number(orderData.subtotal !== undefined
      ? orderData.subtotal
      : (rawItemSubtotal > 0 ? rawItemSubtotal : (orderData.total || 0))).toFixed(2));
    const isTaxExempt = Boolean(orderData.taxExempt);
    const taxAmount = isTaxExempt
      ? 0
      : parseFloat(Number(orderData.tax_amount !== undefined
          ? orderData.tax_amount
          : (orderData.taxAmount !== undefined ? orderData.taxAmount : (subtotal * 0.0825))).toFixed(2));
    const gratuityAmount = parseFloat(Number(orderData.gratuity_amount !== undefined
      ? orderData.gratuity_amount
      : (orderData.gratuityAmount !== undefined
          ? orderData.gratuityAmount
          : (orderData.tip_amount !== undefined
              ? orderData.tip_amount
              : (orderData.tipAmount !== undefined ? orderData.tipAmount : (subtotal * 0.18))))).toFixed(2));
    const tipAmount = parseFloat(Number(orderData.tip_amount !== undefined
      ? orderData.tip_amount
      : (orderData.tipAmount !== undefined ? orderData.tipAmount : gratuityAmount)).toFixed(2));
    const discountAmount = parseFloat(Number(orderData.discount_amount !== undefined
      ? orderData.discount_amount
      : (orderData.discountAmount || 0)).toFixed(2));
    const grandTotal = parseFloat(Number(orderData.grand_total !== undefined
      ? orderData.grand_total
      : (orderData.grandTotal !== undefined
          ? orderData.grandTotal
          : (subtotal + taxAmount + gratuityAmount - discountAmount))).toFixed(2));
    const totalPaid = parseFloat(Number(orderData.totalPaid || (orderData.payment_status === 'paid' || orderData.paymentStatus === 'paid' ? grandTotal : 0)).toFixed(2));
    const totalDue = orderData.totalDue !== undefined
      ? parseFloat(Number(orderData.totalDue).toFixed(2))
      : Math.max(0, parseFloat((grandTotal - totalPaid).toFixed(2)));

    const rawTable = String(orderData.table_id || orderData.table || '1').trim();
    const cleanTable = rawTable.replace(/^tbl[_-]*/i, '').replace(/^table[\s-_]*/i, '').trim() || rawTable || '1';

    const payload = {
      _id: orderData._id || orderData.id || `cav-${Date.now()}`,
      restaurant_id: restaurantId,
      table_id: cleanTable,
      table: cleanTable,
      device_id: orderData.device_id || 'dev-local',
      session_id: orderData.session_id || orderData.sessionId || `ses-${Date.now()}`,
      customer_name: orderData.customer_name || orderData.customerName || orderData.name || 'Guest',
      customer_phone: orderData.customer_phone || orderData.customerPhone || orderData.phone || '',
      items: rawItems,
      hookahs: orderData.hookahs || [],
      food: orderData.food || [],
      drinks: orderData.drinks || [],
      subtotal,
      total: subtotal,
      tax_amount: taxAmount,
      taxAmount,
      gratuity_amount: gratuityAmount,
      gratuityAmount,
      tip_amount: tipAmount,
      tipAmount,
      discount_amount: discountAmount,
      discountAmount,
      grand_total: grandTotal,
      grandTotal,
      totalPaid,
      totalDue,
      status: (orderData.status as OrderStatus) || 'pending',
      payment_method: orderData.payment_method || orderData.paymentMethod || 'cash',
      payment_status: orderData.payment_status || orderData.paymentStatus || 'unpaid',
      payment_session_id: orderData.payment_session_id || null,
      notes: orderData.notes || orderData.note || '',
      fulfilledDepartments: orderData.fulfilledDepartments || [],
      kind: orderData.kind || 'order',
      accepted_at: orderData.accepted_at || null,
      completed_at: orderData.completed_at || null,
      idempotencyKey: orderData.idempotencyKey || orderData.idempotency_key || null,
      idempotency_key: orderData.idempotencyKey || orderData.idempotency_key || null,
      customer_nickname: orderData.customer_nickname || orderData.customerNickname || orderData.nickname || orderData.customer_name || orderData.customerName || 'Guest',
      customerNickname: orderData.customer_nickname || orderData.customerNickname || orderData.nickname || orderData.customer_name || orderData.customerName || 'Guest',
      tracking_token_hash: orderData.tracking_token_hash || orderData.trackingTokenHash || null,
      trackingTokenHash: orderData.tracking_token_hash || orderData.trackingTokenHash || null,
      tracking_expires_at: orderData.tracking_expires_at || orderData.trackingExpiresAt || null,
      trackingExpiresAt: orderData.tracking_expires_at || orderData.trackingExpiresAt || null,
    };

    return await MultiTenantDbService.createOrder(payload as any);
  }

  /**
   * Find order by ID across tenants or for specific tenant
   */
  static async findById(id: string, restaurantId?: string): Promise<any | null> {
    if (!id) return null;
    return await MultiTenantDbService.getOrderById(id, restaurantId);
  }

  /**
   * List all orders for a restaurant
   */
  static async listByRestaurant(restaurantId: string, filters?: { status?: OrderStatus; limit?: number }): Promise<any[]> {
    return await MultiTenantDbService.listOrders(restaurantId, filters as any);
  }

  /**
   * Update order status or fields
   */
  static async update(id: string, restaurantId: string, updateFields: Partial<Order>): Promise<any | null> {
    const success = await MultiTenantDbService.updateOrderStatus(id, restaurantId, updateFields.status || 'pending', updateFields as any);
    if (!success) return null;
    return await this.findById(id, restaurantId);
  }

  /**
   * Delete order by ID
   */
  static async delete(id: string, restaurantId?: string): Promise<boolean> {
    return await MultiTenantDbService.deleteOrder(id, restaurantId);
  }
}
