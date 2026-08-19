/**
 * Domain Event Types & Event Bus Specification
 */

export interface DomainEvent<T = any> {
  eventId: string;
  eventType: string;
  tenantId: string;
  venueId?: string;
  entityId: string;
  entityType: string;
  timestamp: string;
  payload: T;
}

export type EventCallback<T = any> = (event: DomainEvent<T>) => void | Promise<void>;

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, EventCallback[]> = new Map();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public subscribe<T>(eventType: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  public publish<T>(event: DomainEvent<T>): void {
    const callbacks = this.listeners.get(event.eventType) || [];
    const wildcardCallbacks = this.listeners.get('*') || [];

    [...callbacks, ...wildcardCallbacks].forEach(cb => {
      try {
        Promise.resolve(cb(event)).catch(err => {
          console.warn(`[EventBus] Error handling event ${event.eventType}:`, (err as Error).message);
        });
      } catch (err) {
        console.warn(`[EventBus] Sync error handling event ${event.eventType}:`, (err as Error).message);
      }
    });
  }
}

export const eventBus = EventBus.getInstance();
