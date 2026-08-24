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

    const subtotal = Number(orderData.subtotal || orderData.total || 0);
    const taxAmount = Number(orderData.tax_amount || orderData.taxAmount || 0);
    const tipAmount = Number(orderData.tip_amount || orderData.tipAmount || 0);
    const discountAmount = Number(orderData.discount_amount || orderData.discountAmount || 0);
    const grandTotal = Number(orderData.grand_total || orderData.grandTotal || (subtotal + taxAmount + tipAmount - discountAmount));

    const payload = {
      _id: orderData._id || orderData.id || `cav-${Date.now()}`,
      restaurant_id: restaurantId,
      table_id: String(orderData.table_id || orderData.table || '1'),
      device_id: orderData.device_id || 'dev-local',
      session_id: orderData.session_id || orderData.sessionId || `ses-${Date.now()}`,
      customer_name: orderData.customer_name || orderData.customerName || orderData.name || 'Guest',
      customer_phone: orderData.customer_phone || orderData.customerPhone || orderData.phone || '',
      items: rawItems,
      subtotal,
      tax_amount: taxAmount,
      tip_amount: tipAmount,
      discount_amount: discountAmount,
      grand_total: grandTotal,
      totalPaid: Number(orderData.totalPaid || 0),
      totalDue: orderData.totalDue !== undefined ? Number(orderData.totalDue) : grandTotal,
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
