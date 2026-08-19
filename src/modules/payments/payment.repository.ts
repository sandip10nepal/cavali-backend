/**
 * Payment Repository
 *
 * Handles payment sessions, transactions, and refunds.
 */

import { MultiTenantDbService } from '../../services/multi-tenant-db.service';
import { PaymentSession, Refund } from '../../models/types';

export class PaymentRepository {
  private static inMemorySessions: PaymentSession[] = [];
  private static inMemoryRefunds: Refund[] = [];

  static async getSession(id: string): Promise<PaymentSession | null> {
    const session = this.inMemorySessions.find(s => s._id === id || (s as any).id === id);
    return session || null;
  }

  static async getSessionsByOrderId(orderId: string): Promise<PaymentSession[]> {
    const cleanId = String(orderId).replace(/^cav-/, '');
    return this.inMemorySessions.filter(s =>
      String(s.order_id) === String(orderId) ||
      String(s.order_id).replace(/^cav-/, '') === cleanId
    );
  }

  static async listUnclaimedSessions(): Promise<PaymentSession[]> {
    const cutoff = Date.now() - 30 * 60 * 1000;
    return this.inMemorySessions.filter(s =>
      s.status === 'PAYMENT_REQUESTED' &&
      new Date(s.created_at).getTime() > cutoff
    );
  }

  static async createSession(session: any): Promise<PaymentSession> {
    const entity: PaymentSession = {
      _id: session._id || session.id || `pay-${Date.now()}`,
      restaurant_id: session.restaurant_id || 'RES_EED4E9D266DF',
      order_id: String(session.order_id),
      amount_cents: session.amount_cents,
      currency: session.currency || 'USD',
      status: session.status || 'PAYMENT_REQUESTED',
      idempotency_key: session.idempotency_key || `idem-${session.order_id}-${Date.now()}`,
      provider_payment_id: session.square_payment_id || session.provider_payment_id || null,
      payment_device_id: session.payment_device_id || null,
      error_code: session.error_code || null,
      error_message: session.error_message || null,
      created_at: session.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: session.completed_at || null,
    };

    const idx = this.inMemorySessions.findIndex(s => s._id === entity._id);
    if (idx >= 0) {
      this.inMemorySessions[idx] = entity;
    } else {
      this.inMemorySessions.push(entity);
    }
    return entity;
  }

  static async updateSession(id: string, update: Partial<PaymentSession>): Promise<PaymentSession | null> {
    const idx = this.inMemorySessions.findIndex(s => s._id === id || (s as any).id === id);
    if (idx < 0) return null;

    this.inMemorySessions[idx] = {
      ...this.inMemorySessions[idx],
      ...update,
      updated_at: new Date().toISOString(),
    };
    return this.inMemorySessions[idx];
  }

  static async createRefund(refund: Refund): Promise<Refund> {
    this.inMemoryRefunds.push(refund);
    return refund;
  }

  static async listRefunds(): Promise<Refund[]> {
    return this.inMemoryRefunds;
  }
}
