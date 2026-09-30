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
import crypto from 'crypto';

export function calculateOrderFinances(orderData: any): {
  subtotal: number;
  taxAmount: number;
  gratuityAmount: number;
  tipAmount: number;
  discountAmount: number;
  grandTotal: number;
  totalDue: number;
  totalPaid: number;
  taxRate: number;
  isTaxExempt: boolean;
} {
  const allPassedItems: any[] = [];
  if (Array.isArray(orderData.items) && orderData.items.length > 0) {
    allPassedItems.push(...orderData.items);
  } else {
    if (Array.isArray(orderData.hookahs)) allPassedItems.push(...orderData.hookahs);
    if (Array.isArray(orderData.food)) allPassedItems.push(...orderData.food);
    if (Array.isArray(orderData.drinks)) allPassedItems.push(...orderData.drinks);
  }

  let rawItemSubtotal = 0;
  if (allPassedItems.length > 0) {
    rawItemSubtotal = allPassedItems.reduce((acc, it) => {
      const p = Number(it.price !== undefined ? it.price : (it.item && it.item.price !== undefined ? it.item.price : 0)) || 0;
      const q = Number(it.qty || it.quantity || 1) || 1;
      const mods = Array.isArray(it.modifiers) ? it.modifiers : (it.selectedModifiers || []);
      const modTotal = Array.isArray(mods) ? mods.reduce((mAcc: number, m: any) => mAcc + (Number(m.price || m.price_adjustment || 0) || 0), 0) : 0;
      return acc + (p + modTotal) * q;
    }, 0);
  }

  let calculatedSubtotal = 0;
  if (rawItemSubtotal > 0) {
    calculatedSubtotal = parseFloat(rawItemSubtotal.toFixed(2));
  } else if (orderData.subtotal !== undefined && Number(orderData.subtotal) > 0) {
    calculatedSubtotal = parseFloat(Number(orderData.subtotal).toFixed(2));
  } else if (orderData.subtotal_cents !== undefined && Number(orderData.subtotal_cents) > 0) {
    calculatedSubtotal = parseFloat((Number(orderData.subtotal_cents) / 100).toFixed(2));
  } else {
    // If only total was provided, check if it already includes tax and gratuity
    const totalInput = Number(orderData.total || orderData.grandTotal || orderData.grand_total || 0);
    const existingTax = Number(orderData.taxAmount || orderData.tax_amount || 0);
    const existingGratuity = Number(orderData.gratuityAmount || orderData.gratuity_amount || orderData.tipAmount || orderData.tip_amount || 0);
    if (totalInput > 0 && (existingTax > 0 || existingGratuity > 0)) {
      calculatedSubtotal = parseFloat(Math.max(0, totalInput - existingTax - existingGratuity).toFixed(2));
    } else {
      calculatedSubtotal = parseFloat(totalInput.toFixed(2));
    }
  }

  const isTaxExempt = Boolean(orderData.taxExempt);
  const taxRate = isTaxExempt ? 0 : (orderData.taxRate !== undefined ? Number(orderData.taxRate) : 0.0825);

  let taxAmount = isTaxExempt ? 0 : parseFloat((calculatedSubtotal * taxRate).toFixed(2));
  if (!isTaxExempt && orderData.taxAmount !== undefined && Number(orderData.taxAmount) >= 0 && Math.abs(Number(orderData.taxAmount) - taxAmount) < 0.05) {
    taxAmount = parseFloat(Number(orderData.taxAmount).toFixed(2));
  } else if (!isTaxExempt && orderData.tax_amount !== undefined && Number(orderData.tax_amount) >= 0 && Math.abs(Number(orderData.tax_amount) - taxAmount) < 0.05) {
    taxAmount = parseFloat(Number(orderData.tax_amount).toFixed(2));
  }

  let gratuityAmount = 0;
  if (orderData.gratuityAmount !== undefined && orderData.gratuityAmount !== null && Number(orderData.gratuityAmount) >= 0) {
    gratuityAmount = parseFloat(Number(orderData.gratuityAmount).toFixed(2));
  } else if (orderData.gratuity_amount !== undefined && orderData.gratuity_amount !== null && Number(orderData.gratuity_amount) >= 0) {
    gratuityAmount = parseFloat(Number(orderData.gratuity_amount).toFixed(2));
  } else if (orderData.tipAmount !== undefined && orderData.tipAmount !== null && Number(orderData.tipAmount) >= 0) {
    gratuityAmount = parseFloat(Number(orderData.tipAmount).toFixed(2));
  } else if (orderData.tip_amount !== undefined && orderData.tip_amount !== null && Number(orderData.tip_amount) >= 0) {
    gratuityAmount = parseFloat(Number(orderData.tip_amount).toFixed(2));
  } else {
    gratuityAmount = parseFloat((calculatedSubtotal * 0.18).toFixed(2));
  }
  const tipAmount = gratuityAmount;

  const discountAmount = Number(orderData.discountAmount || orderData.discount_amount || 0);
  const grandTotal = parseFloat((calculatedSubtotal + taxAmount + gratuityAmount - discountAmount).toFixed(2));
  const totalPaid = Number(orderData.totalPaid) || (orderData.paymentStatus === 'paid' || orderData.payment_status === 'paid' ? grandTotal : 0);
  const totalDue = Math.max(0, parseFloat((grandTotal - totalPaid).toFixed(2)));

  return {
    subtotal: calculatedSubtotal,
    taxAmount,
    gratuityAmount,
    tipAmount,
    discountAmount,
    grandTotal,
    totalDue,
    totalPaid,
    taxRate,
    isTaxExempt,
  };
}

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
      const match = existing.find((o: any) => o.idempotencyKey === idempotencyKey || o.idempotency_key === idempotencyKey || o._id === idempotencyKey);
      if (match) {
        console.log(`[OrderService] Returning idempotent cached order ${match._id} for key ${idempotencyKey}`);
        return match;
      }
    }

    const finances = calculateOrderFinances(orderData);

    // Enrich generic soft drink items with specific flavor names
    let sanitizedDrinks = Array.isArray(orderData.drinks) ? orderData.drinks : [];
    sanitizedDrinks = sanitizedDrinks.map((d: any) => {
      const itemObj = d.item || {};
      const mods = d.modifiers || itemObj.modifiers || [];
      const modNames = Array.isArray(mods) ? mods.map((m: any) => m.optionName || m.name).filter(Boolean) : [];
      let name = d.name || itemObj.name || 'Drink';
      const noteStr = d.note || d.notes || itemObj.note || itemObj.notes || '';
      if ((name.toLowerCase().includes('soft drink') || name.toLowerCase().includes('soda')) && modNames.length > 0) {
        name = modNames.join(', ');
      }
      const noteParts = [noteStr, modNames.length > 0 && !noteStr.includes(modNames[0]) ? `Choice: ${modNames.join(', ')}` : ''].filter(Boolean);
      const finalNote = noteParts.join(' · ');
      return {
        ...d,
        name,
        item: { ...itemObj, name },
        note: finalNote,
        notes: finalNote,
      };
    });

    let sanitizedItems = Array.isArray(orderData.items) ? orderData.items : [];
    sanitizedItems = sanitizedItems.map((it: any) => {
      const mods = it.modifiers || [];
      const modNames = Array.isArray(mods) ? mods.map((m: any) => m.optionName || m.name).filter(Boolean) : [];
      let name = it.name || 'Item';
      const noteStr = it.notes || it.note || '';
      if ((name.toLowerCase().includes('soft drink') || name.toLowerCase().includes('soda')) && modNames.length > 0) {
        name = modNames.join(', ');
      }
      const noteParts = [noteStr, ...modNames.filter(mn => !noteStr.includes(mn))].filter(Boolean);
      const finalNote = noteParts.join(' · ');
      return {
        ...it,
        name,
        modifiers: mods,
        notes: finalNote,
        note: finalNote,
      };
    });

    // Enrich and preserve hookahs with exact flavor and enhancements (Ice Base, Ice Hose)
    let sanitizedHookahs = Array.isArray(orderData.hookahs) ? orderData.hookahs : [];
    const hookahFromItems = sanitizedItems.filter((it: any) => {
      const cat = (it.category || '').toLowerCase();
      const name = (it.name || '').toLowerCase();
      return cat === 'hookah' || name.includes('hookah') || it.emoji === '💨' || it.emoji === '🧪';
    });

    if (sanitizedHookahs.length === 0 && hookahFromItems.length > 0) {
      sanitizedHookahs = hookahFromItems.map((it: any) => {
        const mods = it.modifiers || [];
        const modNames = Array.isArray(mods) ? mods.map((m: any) => m.optionName || m.name).filter(Boolean) : [];
        const noteStr = it.notes || it.note || '';
        const noteParts = [noteStr, ...modNames.filter(mn => !noteStr.includes(mn))].filter(Boolean);
        const finalNote = noteParts.join(' · ');
        return {
          flavor: { name: it.name, id: it.id },
          name: it.name,
          qty: it.qty || it.quantity || 1,
          price: it.price || 0,
          modifiers: mods,
          notes: finalNote,
          note: finalNote,
        };
      });
    } else {
      sanitizedHookahs = sanitizedHookahs.map((h: any) => {
        const matchingItem = sanitizedItems.find((it: any) => 
          (it.name && h.flavor?.name && it.name.toLowerCase() === h.flavor.name.toLowerCase()) ||
          (it.id && h.flavor?.id && it.id === h.flavor.id) ||
          (it.name && h.name && it.name.toLowerCase() === h.name.toLowerCase())
        );
        const mods = h.modifiers || matchingItem?.modifiers || [];
        const modNames = Array.isArray(mods) ? mods.map((m: any) => m.optionName || m.name).filter(Boolean) : [];
        const existingNote = h.notes || h.note || matchingItem?.notes || matchingItem?.note || '';
        const missingMods = modNames.filter(mn => !existingNote.includes(mn));
        const combinedNotes = [existingNote, ...missingMods].filter(Boolean).join(' · ');
        return {
          ...h,
          name: h.name || h.flavor?.name || 'Hookah',
          flavor: h.flavor || { name: h.name || 'Hookah' },
          modifiers: mods,
          notes: combinedNotes,
          note: combinedNotes,
        };
      });
    }

    const rawTrackingToken = orderData.trackingToken || orderData.tracking_token || ('trk_' + crypto.randomBytes(24).toString('hex'));
    const trackingTokenHash = crypto.createHash('sha256').update(rawTrackingToken).digest('hex');
    const nowMs = Date.now();
    const trackingExpiresAt = new Date(nowMs + 2 * 60 * 60 * 1000).toISOString();
    const nickname = String(orderData.customerNickname || orderData.customer_nickname || orderData.nickname || orderData.customerName || orderData.customer_name || 'Guest').trim();

    const payload = {
      ...orderData,
      _id: `cav-${Date.now()}`,
      restaurant_id: restaurantId,
      idempotencyKey: idempotencyKey || undefined,
      idempotency_key: idempotencyKey || undefined,
      status: 'pending' as OrderStatus,
      paymentStatus: orderData.paymentStatus || 'unpaid',
      paymentMethod: orderData.paymentMethod || 'CASH',
      hookahs: sanitizedHookahs,
      drinks: sanitizedDrinks,
      items: sanitizedItems,
      subtotal: finances.subtotal,
      total: finances.subtotal,
      taxRate: finances.taxRate,
      taxAmount: finances.taxAmount,
      tax_amount: finances.taxAmount,
      taxExempt: finances.isTaxExempt,
      gratuityAmount: finances.gratuityAmount,
      gratuity_amount: finances.gratuityAmount,
      tipAmount: finances.tipAmount,
      tip_amount: finances.tipAmount,
      discountAmount: finances.discountAmount,
      discount_amount: finances.discountAmount,
      grandTotal: finances.grandTotal,
      grand_total: finances.grandTotal,
      totalDue: finances.totalDue,
      totalPaid: finances.totalPaid,
      createdAt: new Date().toISOString(),
      customer_nickname: nickname,
      customerNickname: nickname,
      tracking_token_hash: trackingTokenHash,
      trackingTokenHash: trackingTokenHash,
      tracking_expires_at: trackingExpiresAt,
      trackingExpiresAt: trackingExpiresAt,
    };

    const created = await OrderRepository.create(payload);
    (created as any).trackingToken = rawTrackingToken;
    (created as any).trackingExpiresAt = trackingExpiresAt;
    (created as any).customerNickname = nickname;

    // Process inventory deductions based on item recipes
    try {
      await RecipeService.processOrderDeductions(created);
    } catch (recipeErr) {
      console.warn('[OrderService] Auto inventory deduction error:', recipeErr);
    }

    // Forward to Toast POS
    try {
      const toastResult = await ToastService.submitOrder(created);
      if (toastResult.success) {
        await OrderRepository.update(created._id, restaurantId, { status: 'sent_to_toast' as any });
        created.status = 'sent_to_toast';
      } else {
        await OrderRepository.update(created._id, restaurantId, { status: 'toast_failed' as any });
        created.status = 'toast_failed';
      }
    } catch (err) {
      console.warn('[OrderService] POS submission note:', (err as Error).message);
    }

    // Publish Domain Event
    eventBus.publish(createOrderCreatedEvent(created, restaurantId));

    // Broadcast to KDS / station clients
    const formattedOrder = {
      ...created,
      id: created._id,
      _id: created._id,
      table: (created as any).table_id || (created as any).table || '1',
      customerName: (created as any).customer_name || (created as any).customerName || 'Guest',
      customerPhone: (created as any).customer_phone || (created as any).customerPhone || '',
      subtotal: finances.subtotal,
      total: finances.subtotal,
      taxAmount: finances.taxAmount,
      gratuityAmount: finances.gratuityAmount,
      tipAmount: finances.tipAmount,
      grandTotal: finances.grandTotal,
      totalDue: finances.totalDue,
      totalPaid: finances.totalPaid,
    };

    const broadcastEvent = {
      type: 'order_created',
      id: created._id,
      orderId: created._id,
      restaurant_id: restaurantId,
      order: formattedOrder,
      ...formattedOrder,
    };
    sseService.broadcast(broadcastEvent, restaurantId);

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
