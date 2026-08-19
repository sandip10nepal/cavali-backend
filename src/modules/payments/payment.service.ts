/**
 * Payment Domain Service — Handles Session Creation, Idempotency, and Refunds
 */

import { PaymentRepository } from './payment.repository';
import { PaymentSession } from '../../models/types';
import { OrderRepository } from '../orders/order.repository';
import { SquareService } from '../../services/square.service';
import { sseService } from '../../services/sse.service';
import { AppError, NotFoundError, ValidationError } from '../../core/errors';
import { eventBus } from '../../events/event-bus';
import { randomUUID } from 'crypto';

export class PaymentService {
  static async createPaymentSession(restaurantId: string, orderId: string, requestedAmountCents?: number): Promise<PaymentSession> {
    const order = await OrderRepository.findById(orderId, restaurantId);
    if (!order) {
      throw new NotFoundError(`Order #${orderId} not found`);
    }

    if (['paid', 'fulfilled'].includes(order.status)) {
      throw new ValidationError('Order is already fully paid');
    }

    // Idempotency: check if an active payment session exists
    const existingSessions = await PaymentRepository.getSessionsByOrderId(orderId);
    const active = existingSessions.find(s => !['COMPLETED', 'FAILED', 'CANCELED', 'EXPIRED'].includes(s.status));
    if (active) {
      return active;
    }

    const remainingCents = Math.round(((order as any).totalDue !== undefined ? (order as any).totalDue : (order.total || 0)) * 100);
    const amountCents = requestedAmountCents && requestedAmountCents > 0 ? Math.min(requestedAmountCents, remainingCents) : remainingCents;

    if (amountCents <= 0) {
      throw new ValidationError('Order total is zero or already fully paid');
    }

    const session = await PaymentRepository.createSession({
      id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      restaurant_id: restaurantId,
      order_id: String(orderId),
      amount_cents: amountCents,
      currency: 'USD',
      status: 'PAYMENT_REQUESTED',
      idempotency_key: `idem-${orderId}-${Date.now()}`,
    });

    // Publish event
    eventBus.publish({
      eventId: `evt_${Date.now()}_${randomUUID().substring(0, 8)}`,
      eventType: 'PAYMENT_SESSION_CREATED',
      tenantId: restaurantId,
      entityId: session._id,
      entityType: 'PAYMENT_SESSION',
      timestamp: new Date().toISOString(),
      payload: session,
    });

    sseService.broadcast({ type: 'payment_session_created', session }, restaurantId);
    return session;
  }
}
