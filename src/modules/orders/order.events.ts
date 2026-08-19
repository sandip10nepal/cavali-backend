/**
 * Order Domain Events Generator
 */

import { DomainEvent } from '../../events/event-bus';
import { Order } from './order.types';
import { randomUUID } from 'crypto';

export function createOrderCreatedEvent(order: Order, tenantId: string): DomainEvent<Order> {
  return {
    eventId: `evt_${Date.now()}_${randomUUID().substring(0, 8)}`,
    eventType: 'ORDER_CREATED',
    tenantId,
    entityId: order._id,
    entityType: 'ORDER',
    timestamp: new Date().toISOString(),
    payload: order,
  };
}

export function createOrderFulfilledEvent(order: Order, tenantId: string, department?: string): DomainEvent<{ order: Order; department?: string }> {
  return {
    eventId: `evt_${Date.now()}_${randomUUID().substring(0, 8)}`,
    eventType: 'ORDER_FULFILLED',
    tenantId,
    entityId: order._id,
    entityType: 'ORDER',
    timestamp: new Date().toISOString(),
    payload: { order, department },
  };
}
