/**
 * Order Service — Core Business Logic for Orders
 *
 * Implements order creation, station filtering, fulfillment, and state transitions.
 */

import { OrderRepository } from './order.repository';
import { sseService } from '../../services/sse.service';
import { ToastService } from '../../services/toast.service';
import { RecipeService } from '../../services/recipe.service';
import { Order, OrderStatus } from './order.types';
import { AppError, NotFoundError, ValidationError } from '../../core/errors';

import { eventBus } from '../../events/event-bus';
import { createOrderCreatedEvent, createOrderFulfilledEvent } from './order.events';

export class OrderService {
  /**
   * Create order with validation, POS submission, idempotency, and real-time broadcasting
   */
  static async createOrder(restaurantId: string, orderData: any, idempotencyKey?: string): Promise<Order> {
    if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      if ((!orderData.food || orderData.food.length === 0) &&
          (!orderData.drinks || orderData.drinks.length === 0) &&
          (!orderData.hookahs || orderData.hookahs.length === 0)) {
        throw new ValidationError('Order must contain at least one item.');
      }
    }

    // Idempotency check: if an order with this idempotency key already exists for this tenant, return it
    if (idempotencyKey) {
      const existing = await OrderRepository.listByRestaurant(restaurantId);
      const match = existing.find((o: any) => o.idempotencyKey === idempotencyKey || o._id === idempotencyKey);
      if (match) {
        console.log(`[OrderService] Returning idempotent cached order ${match._id} for key ${idempotencyKey}`);
        return match;
      }
    }

    const totalVal = Number(orderData.total) || 0;
    const isTaxExempt = Boolean(orderData.taxExempt);
    const taxRate = isTaxExempt ? 0 : 0.0825;
    const taxAmount = isTaxExempt ? 0 : parseFloat((totalVal * taxRate).toFixed(2));
    const discountAmount = Number(orderData.discountAmount) || 0;
    const tipAmount = Number(orderData.tipAmount) || 0;
    const grandTotal = parseFloat((totalVal + taxAmount + tipAmount - discountAmount).toFixed(2));

    const payload = {
      ...orderData,
      _id: `cav-${Date.now()}`,
      restaurant_id: restaurantId,
      idempotencyKey: idempotencyKey || undefined,
      status: 'pending' as OrderStatus,
      paymentStatus: orderData.paymentStatus || 'unpaid',
      paymentMethod: orderData.paymentMethod || 'CASH',
      taxRate,
      taxAmount,
      taxExempt: isTaxExempt,
      tipAmount,
      discountAmount,
      total: totalVal,
      grandTotal,
      totalDue: orderData.totalDue !== undefined ? Number(orderData.totalDue) : grandTotal,
      totalPaid: Number(orderData.totalPaid) || 0,
      createdAt: new Date().toISOString(),
    };

    const created = await OrderRepository.create(payload);

    // Toast POS forwarding
    try {
      const toastResult = await ToastService.submitOrder(created);
      if (toastResult.success) {
        await OrderRepository.update(created._id, restaurantId, { status: 'sent_to_toast' as any });
        created.status = 'sent_to_toast';
      }
    } catch (err) {
      console.warn('[OrderService] POS submission note:', (err as Error).message);
    }

    // Publish Domain Event
    eventBus.publish(createOrderCreatedEvent(created, restaurantId));

    // Broadcast to KDS / station clients
    sseService.broadcast(created, restaurantId);

    return created;
  }

  /**
   * Get list of orders filtered by station role
   */
  static async getOrdersForStation(restaurantId: string, role: string): Promise<any[]> {
    const rawOrders = await OrderRepository.listByRestaurant(restaurantId);
    
    if (role === 'bartender') {
      return rawOrders
        .filter((o: any) => (o.drinks && o.drinks.length > 0) || (o.items && o.items.some((i: any) => i.category === 'drinks')) || o.kind === 'chai')
        .map((o: any) => ({ ...o, food: [], hookahs: [] }));
    } else if (role === 'chef' || role === 'kitchen') {
      return rawOrders
        .filter((o: any) => (o.food && o.food.length > 0) || (o.items && o.items.some((i: any) => i.category === 'food')))
        .map((o: any) => ({ ...o, drinks: [], hookahs: [] }));
    } else if (role === 'hookah_maker') {
      return rawOrders
        .filter((o: any) => (o.hookahs && o.hookahs.length > 0) || (o.items && o.items.some((i: any) => i.category === 'hookah')))
        .map((o: any) => ({ ...o, food: [], drinks: [] }));
    }

    return rawOrders;
  }

  /**
   * Fulfill order or specific department
   */
  static async fulfillOrder(restaurantId: string, orderId: string, department?: string): Promise<Order> {
    const order = await OrderRepository.findById(orderId, restaurantId);
    if (!order) {
      throw new NotFoundError(`Order #${orderId} not found`);
    }

    if (order.status === 'fulfilled') {
      throw new ValidationError('Order is already fulfilled');
    }

    const fulfilledDeps: string[] = Array.isArray(order.fulfilledDepartments) ? [...order.fulfilledDepartments] : [];

    if (department && ['food', 'drinks', 'hookah'].includes(department)) {
      if (!fulfilledDeps.includes(department)) {
        fulfilledDeps.push(department);
      }
      const updated = await OrderRepository.update(orderId, restaurantId, { fulfilledDepartments: fulfilledDeps } as any);
      sseService.broadcast({ type: 'order_updated', orderId, order: updated }, restaurantId);
      return updated;
    }

    // Full order fulfillment
    RecipeService.processOrderDeductions(order).catch(e => console.warn('[OrderService] Recipe deduction note:', e.message));
    const updated = await OrderRepository.update(orderId, restaurantId, { status: 'fulfilled' as any, fulfilledDepartments: ['food', 'drinks', 'hookah'] });
    sseService.broadcast({ type: 'order_fulfilled', orderId, order: updated }, restaurantId);
    return updated;
  }
}
